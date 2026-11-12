// chuku-track: asks USPS where each box is. Whatnot's "in transit" only means the label was scanned at the
// shop, so USPS is the only source that knows whether a box actually left. Writes one row per box into
// wn_tracking and one row per run into wn_track_runs. Read only toward USPS.
// Body: { test: ["tracking", ...] } returns USPS's raw answer (for checking the hookup).
//       { sweep: true, shop? } checks every undelivered box that has a trackable number, oldest check first.
// Called daily by pg_cron with x-sync-key (value in chuku_settings), or by a signed-in allowed user.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const USPS_ID = Deno.env.get("USPS_CLIENT_ID") ?? "";
const USPS_SECRET = Deno.env.get("USPS_CLIENT_SECRET") ?? "";
const USPS = "https://apis.usps.com";
const BATCH = 35;               // USPS takes up to 35 tracking numbers per request
const MAX_BATCHES = 24;         // 840 boxes per run at most; the rest waits for the next run
const RECHECK_HOURS = 20;       // a box checked less than this long ago is skipped
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sync-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let tokenCache: { token: string; until: number } | null = null;
async function uspsToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.until) return tokenCache.token;
  if (!USPS_ID || !USPS_SECRET) throw new Error("USPS_CLIENT_ID / USPS_CLIENT_SECRET are not set");
  const r = await fetch(`${USPS}/oauth2/v3/token`, {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ grant_type: "client_credentials", client_id: USPS_ID, client_secret: USPS_SECRET, scope: "tracking" }),
  });
  const b: any = await r.json().catch(() => ({}));
  if (!r.ok || !b.access_token) throw new Error(`USPS token: HTTP ${r.status} ${b.error_description || b.error || JSON.stringify(b).slice(0, 200)}`);
  tokenCache = { token: b.access_token, until: Date.now() + Math.max(60, (Number(b.expires_in) || 3600) - 120) * 1000 };
  return b.access_token;
}
// One USPS call for up to 35 numbers. Returns { status, body } where body is an array (200 or 207) or an error object.
async function uspsTrack(numbers: string[]): Promise<{ status: number; body: any }> {
  const token = await uspsToken();
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(`${USPS}/tracking/v3r2/tracking`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(numbers.map((trackingNumber) => ({ trackingNumber }))),
    });
    if (r.status === 429 || r.status === 503) { await sleep(Math.min(30, Number(r.headers.get("Retry-After") || 5)) * 1000); continue; }
    let body: any = null; try { body = await r.json(); } catch { body = null; }
    return { status: r.status, body };
  }
  return { status: 429, body: null };
}

const PRE = /pre-?shipment|awaiting item|label created/i;
// Turn one USPS answer into a wn_tracking row (without shop/shipment_id).
function digest(d: any) {
  const ev = Array.isArray(d.trackingEvents) ? d.trackingEvents : [];
  const latest = ev[0] ?? null;
  const cat = d.statusCategory ?? null, status = d.status ?? null;
  const deliveredEv = ev.find((e: any) => /^01$/.test(String(e.eventCode ?? "")) || /^delivered\b/i.test(String(e.eventType ?? "")));
  const when = (e: any) => e ? (e.GMTTimestamp ? new Date(e.GMTTimestamp).toISOString() : (e.eventTimestamp ? new Date(e.eventTimestamp).toISOString() : null)) : null;
  const received = !!cat && !PRE.test(cat) && !PRE.test(status ?? "") && ev.length > 0 && !(ev.length === 1 && PRE.test(String(latest?.eventType ?? "")));
  return {
    checked_at: new Date().toISOString(), error: null,
    received, status, status_category: cat, status_summary: d.statusSummary ?? null,
    mail_class: d.mailClass ?? null,
    event_type: latest?.eventType ?? null, event_city: latest?.eventCity ?? null, event_state: latest?.eventState ?? null, event_at: when(latest),
    expected_delivery: d.expectedDeliveryDate ?? d.predictedDeliveryDate ?? null,
    delivered_at: /delivered/i.test(cat ?? "") ? (when(deliveredEv) ?? when(latest)) : null,
    events: ev.slice(0, 5).map((e: any) => ({ type: e.eventType ?? null, code: e.eventCode ?? null, city: e.eventCity ?? null, state: e.eventState ?? null, at: when(e) })),
  };
}
function failure(msg: string) {
  return { checked_at: new Date().toISOString(), error: msg, received: null, status: null, status_category: null, status_summary: null, mail_class: null,
    event_type: null, event_city: null, event_state: null, event_at: null, expected_delivery: null, delivered_at: null, events: [] };
}
// Map a USPS batch answer back onto the numbers asked.
function digestBatch(numbers: string[], res: { status: number; body: any }): Map<string, any> {
  const out = new Map<string, any>();
  const items: any[] = Array.isArray(res.body) ? res.body : [];
  if (!items.length) { for (const n of numbers) out.set(n, failure(`USPS HTTP ${res.status}: ${(res.body?.error?.message || res.body?.message || "no answer")}`.slice(0, 300))); return out; }
  for (const it of items) {
    const n = String(it.trackingNumber ?? "");
    if (!n) continue;
    if (it.error || (it.statusCode && String(it.statusCode) !== "200") || !it.statusCategory && !it.trackingEvents) {
      const m = it.error?.message || it.error?.errors?.[0]?.detail || it.error?.errors?.[0]?.title || `USPS ${it.statusCode ?? "error"}`;
      out.set(n, failure(String(m).slice(0, 300)));
    } else out.set(n, digest(it));
  }
  for (const n of numbers) if (!out.has(n)) out.set(n, failure("USPS gave no answer for this number"));
  return out;
}

async function sweep(admin: any, shop: string, kind: string) {
  const { data: run } = await admin.from("wn_track_runs").insert({ shop, kind }).select("id").single();
  const finish = async (fields: any) => { await admin.from("wn_track_runs").update({ finished_at: new Date().toISOString(), ...fields }).eq("id", run.id); };
  try {
    // Boxes worth asking about: a real tracking number, not delivered or cancelled, not letter postage (USPS cannot track those).
    const { data: boxes, error } = await admin.from("wn_shipments")
      .select("shipment_id, tracking, service, status")
      .eq("shop", shop).not("tracking", "is", null)
      .not("status", "in", "(delivered,failed,cancelled,cancelled_not_shipped,cancelled_not_shipped_with_dropoff,cancelled_tracking_stuck)")
      .gte("created_at", new Date(Date.now() - 60 * 864e5).toISOString()).limit(5000);
    if (error) throw new Error(error.message);
    const cutoff = Date.now() - RECHECK_HOURS * 3600e3;
    const { data: seen } = await admin.from("wn_tracking").select("shipment_id, checked_at, delivered_at").eq("shop", shop).limit(10000);
    const last = new Map<string, any>((seen ?? []).map((t: any) => [t.shipment_id, t]));
    const due = (boxes ?? [])
      .filter((b: any) => !/letter/i.test(b.service ?? "") && /^[0-9A-Z]{4,34}$/i.test(b.tracking))
      .filter((b: any) => { const t = last.get(b.shipment_id); return !t || (!t.delivered_at && new Date(t.checked_at).getTime() < cutoff); })
      .sort((a: any, b: any) => (last.get(a.shipment_id)?.checked_at ?? "").localeCompare(last.get(b.shipment_id)?.checked_at ?? ""));
    let checked = 0, failed = 0, received = 0, delivered = 0, batches = 0, stop: string | null = null;
    for (let i = 0; i < due.length && batches < MAX_BATCHES; i += BATCH, batches++) {
      const slice = due.slice(i, i + BATCH);
      const res = await uspsTrack(slice.map((b: any) => b.tracking));
      if (res.status === 401 || res.status === 403) { stop = `USPS HTTP ${res.status}: ${res.body?.error?.message ?? "not allowed"}`; break; }
      if (res.status === 429) { stop = "USPS rate limit, the rest waits for the next run"; break; }
      const got = digestBatch(slice.map((b: any) => b.tracking), res);
      const rows = slice.map((b: any) => ({ shop, shipment_id: b.shipment_id, tracking: b.tracking, ...got.get(b.tracking) }));
      const { error: upErr } = await admin.from("wn_tracking").upsert(rows, { onConflict: "shop,shipment_id" });
      if (upErr) throw new Error(upErr.message);
      for (const r of rows) { checked++; if (r.error) failed++; if (r.received) received++; if (r.delivered_at) delivered++; }
    }
    const left = Math.max(0, due.length - checked);
    await finish({ checked, failed, received, delivered, left, error: stop });
    return { shop, checked, failed, received, delivered, left, stopped: stop };
  } catch (err) {
    await finish({ error: String((err as Error).message ?? err).slice(0, 500) });
    return { shop, error: String((err as Error).message ?? err) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "POST only" });
  let body: any = {}; try { body = await req.json(); } catch { body = {}; }
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  let trigger = "cron";
  const syncKey = req.headers.get("x-sync-key") ?? "";
  const { data: sk } = await admin.from("chuku_settings").select("value").eq("key", "sync_key").maybeSingle();
  const SYNC_KEY = sk?.value ?? "";
  if (!(SYNC_KEY && syncKey === SYNC_KEY)) {
    const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: u, error: uerr } = await asUser.auth.getUser();
    if (uerr || !u?.user?.email) return json(401, { error: "sign in first" });
    const { data: allowed } = await asUser.rpc("is_allowed");
    if (!allowed) return json(403, { error: "not on the allowed list" });
    trigger = "manual";
  }
  if (Array.isArray(body.test)) {
    const numbers = body.test.map(String).slice(0, BATCH);
    try {
      const res = await uspsTrack(numbers);
      const got = digestBatch(numbers, res);
      return json(200, { usps_status: res.status, digest: Object.fromEntries(got), raw: res.body });
    } catch (err) { return json(502, { error: String((err as Error).message ?? err) }); }
  }
  let shops: string[] = [];
  if (body.shop) shops = [String(body.shop).toLowerCase()];
  else { const { data } = await admin.from("shop_keys").select("shop").is("removed_at", null).eq("status", "ok"); shops = (data ?? []).map((r: any) => r.shop); }
  const results = [];
  for (const shop of shops) results.push(await sweep(admin, shop, trigger));
  return json(200, { results, at: new Date().toISOString() });
});
