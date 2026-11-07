// chuku-sync: keeps Chuku's own copy of every box (wn_shipments) current from the Whatnot Seller API,
// writes a change-log row for every status change (wn_shipment_events), fills in contents
// (wn_shipment_cache), and records each run (wn_sync_runs). Read only toward Whatnot: never makes labels.
// Called every 5 minutes by pg_cron with the x-sync-key header (value in chuku_settings), or by a signed-in allowed user (Refresh).
import { createClient } from "npm:@supabase/supabase-js@2";

const WN = "https://api.whatnot.com/seller-api/rest/v2";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WATCH_DAYS = 45;          // how far back each run walks
const MAX_PAGES = 60;           // 60 x 50 = 3000 boxes per run, more than 45 days ever holds
const CONTENTS_PER_RUN = 60;    // boxes whose contents are fetched per run (3 Whatnot calls each)
const DAY_START = 9, DAY_END = 17;   // Pacific hours: every run between 9:00 and 16:59
const NIGHT_GAP_MS = 3 * 3600e3;     // otherwise only if the last run is older than this
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sync-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function wn(token: string, path: string): Promise<{ status: number; body: any }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(WN + path, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
    if (r.status === 429) { await sleep(Number(r.headers.get("Retry-After") || 1) * 1000); continue; }
    let body: any = null; try { body = await r.json(); } catch { body = null; }
    return { status: r.status, body };
  }
  return { status: 429, body: null };
}
const money = (m: any): number | null => m && m.amount != null ? Math.round(parseFloat(m.amount) * 100) : null;
const sameTime = (a: any, b: any) => (a ? new Date(a).getTime() : 0) === (b ? new Date(b).getTime() : 0);
function row(shop: string, s: any) {
  return {
    shop, shipment_id: String(s.id), status: s.status, fulfillment: s.fulfillment_method ?? null,
    buyer: s.recipient?.username ?? null, buyer_name: s.recipient?.display_name ?? null, url: s.url ?? null,
    created_at: s.created_at ?? null, updated_at: s.updated_at ?? null, dropoff_due: s.dropoff_due ?? null,
    carrier: s.tracking?.carrier ?? null, service: s.tracking?.service ?? null, tracking: s.tracking?.tracking_code ?? null,
    has_label: !!(s.documents?.bundled_url || s.documents?.label_url),
    seller_cost_cents: money(s.seller_paid_shipping_cost),
    weight: s.weight ? `${s.weight.value} ${s.weight.unit}` : null,
    dims: s.dimensions ? `${s.dimensions.length}x${s.dimensions.width}x${s.dimensions.height} ${s.dimensions.unit}` : null,
    required_actions: s.required_actions ?? [], replacement_id: s.replacement_shipment_id ?? null,
  };
}
async function fetchContents(token: string, sid: string) {
  const si = await wn(token, `/shipments/${sid}/items?limit=50`);
  if (si.status !== 200) return null;
  const orderIds = [...new Set((si.body?.data ?? []).map((x: any) => x.order_id).filter(Boolean))] as string[];
  const orders: any[] = [];
  for (const oid of orderIds) {
    const [o, oi] = await Promise.all([wn(token, `/orders/${oid}`), wn(token, `/orders/${oid}/items?limit=50`)]);
    if (o.status !== 200 || oi.status !== 200) return null;
    orders.push({
      id: oid, status: o.body?.status ?? null, type: o.body?.transaction_type ?? null, created_at: o.body?.created_at ?? null, show_id: o.body?.show_id ?? null,
      total_cents: money(o.body?.amounts?.total), shipping_cents: money(o.body?.amounts?.shipping), url: o.body?.url ?? null,
      items: (oi.body?.data ?? []).filter((it: any) => !it.shipment_id || String(it.shipment_id) === sid)
        .map((it: any) => ({ id: it.id, title: it.purchased_item?.title ?? "", qty: it.quantity ?? 1, price_cents: money(it.unit_price) })),
    });
  }
  const titles = new Set<string>(); let units = 0;
  for (const o of orders) for (const it of o.items) { titles.add(it.title.trim().toLowerCase()); units += it.qty || 0; }
  return { orders, sku_count: titles.size, unit_count: units };
}
const pacificHour = () => Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", hour12: false }).format(new Date()));

// One run for one shop. Returns a short summary.
async function syncShop(admin: any, shop: string, trigger: string, force: boolean) {
  const { data: key } = await admin.from("shop_keys").select("id, status").eq("shop", shop).is("removed_at", null).maybeSingle();
  if (!key) return { shop, skipped: "no key" };
  // Is it time? Day window: always. Night: only if the last finished run is older than 3 h.
  const { data: last } = await admin.from("wn_sync_runs").select("started_at, finished_at").eq("shop", shop).order("started_at", { ascending: false }).limit(1).maybeSingle();
  if (last && !last.finished_at && Date.now() - new Date(last.started_at).getTime() < 10 * 60e3) return { shop, skipped: "a run is still going" };
  const h = pacificHour(); const inDay = h >= DAY_START && h < DAY_END;
  if (!force && !inDay && last?.finished_at && Date.now() - new Date(last.finished_at).getTime() < NIGHT_GAP_MS) return { shop, skipped: "night, synced recently" };
  const { data: token } = await admin.rpc("read_shop_token", { p_key_id: key.id });
  if (!token) return { shop, skipped: "token missing" };

  const { data: run } = await admin.from("wn_sync_runs").insert({ shop, kind: trigger }).select("id").single();
  const t0 = Date.now(); let pages = 0, changed = 0, contentsFetched = 0; const seen: any[] = [];
  const finish = async (error: string | null) => {
    await admin.from("wn_sync_runs").update({ finished_at: new Date().toISOString(), boxes_seen: seen.length, changed, contents_fetched: contentsFetched, pages, error }).eq("id", run.id);
    return { shop, boxes_seen: seen.length, changed, contents_fetched: contentsFetched, pages, seconds: Math.round((Date.now() - t0) / 1000), error };
  };
  try {
    // 1. Walk the list newest first, back to WATCH_DAYS.
    const since = Date.now() - WATCH_DAYS * 864e5; let cursor = "";
    while (pages < MAX_PAGES) {
      const r = await wn(token, `/shipments?limit=50${cursor ? "&cursor=" + encodeURIComponent(cursor) : ""}`);
      if (r.status === 401) { await admin.from("shop_keys").update({ status: "invalid", last_http_status: 401, last_checked_at: new Date().toISOString() }).eq("id", key.id); return await finish("Whatnot rejected the token (401)"); }
      if (r.status !== 200) return await finish(`Whatnot answered ${r.status} on page ${pages + 1}`);
      pages++;
      const data: any[] = r.body?.data ?? [];
      let oldest = Infinity;
      for (const s of data) { seen.push(row(shop, s)); const t = s.created_at ? new Date(s.created_at).getTime() : Infinity; if (t < oldest) oldest = t; }
      cursor = r.body?.next_cursor ?? "";
      if (!cursor || oldest < since) break;
      await sleep(80);
    }
    // 2. Compare with what we have; write rows and the change log.
    const now = new Date().toISOString();
    const ids = seen.map((s) => s.shipment_id);
    const have = new Map<string, any>();
    for (let i = 0; i < ids.length; i += 300) {
      const { data: rows } = await admin.from("wn_shipments").select("shipment_id, status, updated_at").eq("shop", shop).in("shipment_id", ids.slice(i, i + 300));
      for (const r of rows ?? []) have.set(r.shipment_id, r);
    }
    // Rows in one upsert must share the same columns, so new boxes (with first_seen_at) go separately from known ones.
    const fresh: any[] = [], known: any[] = [], events: any[] = [];
    for (const s of seen) {
      const old = have.get(s.shipment_id);
      if (!old) { fresh.push({ ...s, first_seen_at: now, last_seen_at: now }); events.push({ shop, shipment_id: s.shipment_id, from_status: null, to_status: s.status, seen_at: now }); changed++; continue; }
      known.push({ ...s, last_seen_at: now });
      if (old.status !== s.status) { events.push({ shop, shipment_id: s.shipment_id, from_status: old.status, to_status: s.status, seen_at: now }); changed++; }
    }
    for (const batch of [fresh, known]) for (let i = 0; i < batch.length; i += 300) {
      const { error } = await admin.from("wn_shipments").upsert(batch.slice(i, i + 300), { onConflict: "shop,shipment_id" });
      if (error) return await finish("db: " + error.message);
    }
    for (let i = 0; i < events.length; i += 300) await admin.from("wn_shipment_events").insert(events.slice(i, i + 300));
    // 3. Contents for boxes whose cache is missing or stale, newest first, a batch per run.
    const cache = new Map<string, any>();
    for (let i = 0; i < ids.length; i += 300) {
      const { data: rows } = await admin.from("wn_shipment_cache").select("shipment_id, updated_at, status").eq("shop", shop).in("shipment_id", ids.slice(i, i + 300));
      for (const r of rows ?? []) cache.set(r.shipment_id, r);
    }
    const need = seen.filter((s) => { const c = cache.get(s.shipment_id); return !c || !sameTime(c.updated_at, s.updated_at) || c.status !== s.status; }).slice(0, CONTENTS_PER_RUN);
    for (let i = 0; i < need.length && Date.now() - t0 < 100e3; i += 5) {
      const group = need.slice(i, i + 5);
      const got = await Promise.all(group.map((s) => fetchContents(token, s.shipment_id)));
      const rows: any[] = [];
      group.forEach((s, k) => { const c = got[k]; if (!c) return; rows.push({ shop, shipment_id: s.shipment_id, updated_at: s.updated_at, status: s.status, orders: c.orders, sku_count: c.sku_count, unit_count: c.unit_count, fetched_at: new Date().toISOString() }); });
      if (rows.length) { await admin.from("wn_shipment_cache").upsert(rows, { onConflict: "shop,shipment_id" }); contentsFetched += rows.length; }
    }
    await admin.from("shop_keys").update({ last_sync_at: now, last_http_status: 200, last_checked_at: now }).eq("id", key.id);
    return await finish(null);
  } catch (e) { return await finish(String(e).slice(0, 300)); }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "POST only" });
  let body: any = {}; try { body = await req.json(); } catch { body = {}; }
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  // Who is asking: the cron (shared key kept in chuku_settings, readable only by the service role)
  // or a signed-in allowed person (Refresh button).
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
  const force = trigger === "manual" || !!body.force;
  let shops: string[] = [];
  if (body.shop) shops = [String(body.shop).toLowerCase()];
  else { const { data } = await admin.from("shop_keys").select("shop").is("removed_at", null).eq("status", "ok"); shops = (data ?? []).map((r: any) => r.shop); }
  const results = [];
  for (const shop of shops) results.push(await syncShop(admin, shop, trigger, force));
  return json(200, { results, at: new Date().toISOString() });
});
