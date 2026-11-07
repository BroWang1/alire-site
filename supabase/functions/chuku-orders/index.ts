// chuku-orders: read-only live view of a shop's shipments from the Whatnot Seller API, using the token in Vault.
// Actions: list (recent shipments), items / items_bulk (what is in each shipment), label (fresh label links),
// generate_labels (ask Whatnot to make labels, once per shipment), label_status (re-read shipments),
// build_pdf (fetch each shipment's label PDF and hand back one combined PDF in the order given).
// Never exposes the token. Callers must be signed in and on the allowed list.
import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument } from "npm:pdf-lib@1.17.1";

const WN = "https://api.whatnot.com/seller-api/rest/v2";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "x-chuku-report",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function wn(token: string, path: string, method = "GET"): Promise<{ status: number; body: any }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(WN + path, { method, headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
    if (r.status === 429) { await sleep(Number(r.headers.get("Retry-After") || 1) * 1000); continue; }
    let body: any = null; try { body = await r.json(); } catch { body = null; }
    return { status: r.status, body };
  }
  return { status: 429, body: null };
}

const sameTime = (a: any, b: any) => (a ? new Date(a).getTime() : 0) === (b ? new Date(b).getTime() : 0);
async function fetchContents(token: string, sid: string) {
  const si = await wn(token, `/shipments/${sid}/items?limit=50`);
  if (si.status !== 200) return null;
  const orderIds = [...new Set((si.body?.data ?? []).map((x: any) => x.order_id).filter(Boolean))] as string[];
  const orders: any[] = [];
  for (const oid of orderIds) {
    const [o, oi] = await Promise.all([wn(token, `/orders/${oid}`), wn(token, `/orders/${oid}/items?limit=50`)]);
    if (o.status !== 200 || oi.status !== 200) return null;
    orders.push({
      id: oid, status: o.body?.status ?? null, type: o.body?.transaction_type ?? null, created_at: o.body?.created_at ?? null,
      total_cents: money(o.body?.amounts?.total), shipping_cents: money(o.body?.amounts?.shipping), url: o.body?.url ?? null,
      items: (oi.body?.data ?? []).filter((it: any) => !it.shipment_id || String(it.shipment_id) === sid)
        .map((it: any) => ({ id: it.id, title: it.purchased_item?.title ?? "", qty: it.quantity ?? 1, price_cents: money(it.unit_price) })),
    });
  }
  const titles = new Set<string>(); let units = 0;
  for (const o of orders) for (const it of o.items) { titles.add(it.title.trim().toLowerCase()); units += it.qty || 0; }
  return { orders, sku_count: titles.size, unit_count: units };
}
const money = (m: any): number | null => m && m.amount != null ? Math.round(parseFloat(m.amount) * 100) : null;
function slim(s: any) {
  return {
    id: String(s.id), url: s.url, status: s.status, fulfillment: s.fulfillment_method,
    buyer: s.recipient?.username ?? null, buyer_name: s.recipient?.display_name ?? null,
    created_at: s.created_at, updated_at: s.updated_at, dropoff_due: s.dropoff_due ?? null,
    carrier: s.tracking?.carrier ?? null, service: s.tracking?.service ?? null, tracking: s.tracking?.tracking_code ?? null,
    has_label: !!(s.documents?.bundled_url || s.documents?.label_url),
    seller_cost_cents: money(s.seller_paid_shipping_cost),
    weight: s.weight ? `${s.weight.value} ${s.weight.unit}` : null,
    dims: s.dimensions ? `${s.dimensions.length}x${s.dimensions.width}x${s.dimensions.height} ${s.dimensions.unit}` : null,
    required_actions: s.required_actions ?? [], replacement_id: s.replacement_shipment_id ?? null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "POST only" });
  const auth = req.headers.get("Authorization") ?? "";
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data: u, error: uerr } = await asUser.auth.getUser();
  if (uerr || !u?.user?.email) return json(401, { error: "sign in first" });
  const { data: allowed } = await asUser.rpc("is_allowed");
  if (!allowed) return json(403, { error: "not on the allowed list" });

  let body: any; try { body = await req.json(); } catch { return json(400, { error: "bad json" }); }
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const shop = String(body.shop ?? "").toLowerCase();
  const { data: key } = await admin.from("shop_keys").select("id, status, ignored_buyers").eq("shop", shop).is("removed_at", null).maybeSingle();
  if (!key) return json(404, { error: `no key stored for @${shop}` });
  const { data: token } = await admin.rpc("read_shop_token", { p_key_id: key.id });
  if (!token) return json(500, { error: "token missing from vault" });

  const action = String(body.action ?? "list");

  if (action === "list") {
    // Walk newest-first until shipments are older than `since` or we hit max_pages (50 per page).
    // The page calls this repeatedly with the returned next_cursor until stopped_by is "since" or "end",
    // so there is no ceiling on how many shipments a busy shop can have in the window.
    const since = body.since ? new Date(String(body.since)).getTime() : Date.now() - 30 * 864e5;
    const maxPages = Math.min(Math.max(Number(body.max_pages) || 6, 1), 12);
    const out: any[] = []; let cursor = String(body.cursor ?? ""); let pages = 0; let stoppedBy = "end"; let oldestSeen = Infinity;
    while (pages < maxPages) {
      const r = await wn(token, `/shipments?limit=50${cursor ? "&cursor=" + encodeURIComponent(cursor) : ""}`);
      if (r.status === 401) { await admin.from("shop_keys").update({ status: "invalid", last_http_status: 401, last_checked_at: new Date().toISOString() }).eq("id", key.id); return json(502, { error: "Whatnot rejected the stored token (401). Replace it on the keys page." }); }
      if (r.status !== 200) return json(502, { error: `Whatnot answered ${r.status}`, partial: out });
      pages++;
      const data: any[] = r.body?.data ?? [];
      for (const s of data) { out.push(slim(s)); const t = s.created_at ? new Date(s.created_at).getTime() : Infinity; if (t < oldestSeen) oldestSeen = t; }
      cursor = r.body?.next_cursor ?? "";
      if (!cursor) { stoppedBy = "end"; break; }
      if (oldestSeen < since) { stoppedBy = "since"; break; }
      stoppedBy = "more";
      await sleep(80);
    }
    // Attach cached contents (sku/unit counts, items) where the cache is still current.
    const ids = out.map((s) => s.id);
    const cache = new Map<string, any>();
    for (let i = 0; i < ids.length; i += 200) {
      const { data: rows } = await admin.from("wn_shipment_cache").select("shipment_id, updated_at, status, orders, sku_count, unit_count").eq("shop", shop).in("shipment_id", ids.slice(i, i + 200));
      for (const r of rows ?? []) cache.set(r.shipment_id, r);
    }
    for (const s of out) {
      const c = cache.get(s.id);
      if (c && sameTime(c.updated_at, s.updated_at) && c.status === s.status) { s.contents = { orders: c.orders, sku_count: c.sku_count, unit_count: c.unit_count }; }
    }
    await admin.from("shop_keys").update({ last_sync_at: new Date().toISOString() }).eq("id", key.id);
    return json(200, { shipments: out, pages, stopped_by: stoppedBy, next_cursor: cursor || null, oldest_seen: isFinite(oldestSeen) ? new Date(oldestSeen).toISOString() : null, ignored_buyers: key.ignored_buyers ?? [], fetched_at: new Date().toISOString(), cached: out.filter((s) => s.contents).length });
  }

  // Contents of one or more shipments. Fetched from Whatnot once, then cached per (shop, shipment, updated_at).
  if (action === "items" || action === "items_bulk") {
    const want: { id: string; updated_at?: string; status?: string }[] = action === "items"
      ? [{ id: String(body.shipment_id ?? "") }]
      : (Array.isArray(body.shipments) ? body.shipments : []).slice(0, 25).map((x: any) => ({ id: String(x.id ?? x), updated_at: x.updated_at, status: x.status }));
    if (!want.length || !want[0].id) return json(400, { error: "shipment_id or shipments[] required" });
    const results: Record<string, any> = {};
    const { data: cached } = await admin.from("wn_shipment_cache").select("shipment_id, updated_at, status, orders, sku_count, unit_count").eq("shop", shop).in("shipment_id", want.map((w) => w.id));
    const cmap = new Map((cached ?? []).map((r: any) => [r.shipment_id, r]));
    const todo: typeof want = [];
    for (const w of want) {
      const c = cmap.get(w.id);
      if (c && (!w.updated_at || (sameTime(c.updated_at, w.updated_at) && c.status === w.status))) results[w.id] = { orders: c.orders, sku_count: c.sku_count, unit_count: c.unit_count, cached: true };
      else todo.push(w);
    }
    // Five boxes at a time: each box is ~3 Whatnot calls, so this stays under the 10 req/s limit.
    let failed = 0;
    for (let i = 0; i < todo.length; i += 5) {
      const group = todo.slice(i, i + 5);
      const got = await Promise.all(group.map((w) => fetchContents(token, w.id)));
      const rows: any[] = [];
      group.forEach((w, k) => {
        const c = got[k];
        if (!c) { failed++; return; }
        results[w.id] = c;
        rows.push({ shop, shipment_id: w.id, updated_at: w.updated_at ?? null, status: w.status ?? null, orders: c.orders, sku_count: c.sku_count, unit_count: c.unit_count, fetched_at: new Date().toISOString() });
      });
      if (rows.length) await admin.from("wn_shipment_cache").upsert(rows, { onConflict: "shop,shipment_id" });
    }
    if (action === "items") { const r = results[want[0].id]; return r ? json(200, { shipment_id: want[0].id, ...r }) : json(502, { error: "Whatnot did not answer for this shipment" }); }
    return json(200, { contents: results, fetched: todo.length - failed, failed });
  }

  if (action === "label") {
    const sid = String(body.shipment_id ?? "");
    const r = await wn(token, `/shipments/${sid}`);
    if (r.status !== 200) return json(502, { error: `Whatnot answered ${r.status}` });
    const d = r.body?.documents ?? {};
    return json(200, { bundled_url: d.bundled_url ?? null, label_url: d.label_url ?? null, status: r.body?.status });
  }

  // Re-read shipments (status, label presence). Used while waiting for labels Whatnot is making.
  if (action === "label_status") {
    const ids: string[] = (Array.isArray(body.shipment_ids) ? body.shipment_ids : []).slice(0, 100).map(String);
    const results: Record<string, any> = {};
    for (let i = 0; i < ids.length; i += 8) {
      await Promise.all(ids.slice(i, i + 8).map(async (sid) => {
        const r = await wn(token, `/shipments/${sid}`);
        results[sid] = r.status === 200 ? slim(r.body) : { error: `Whatnot answered ${r.status}` };
      }));
    }
    return json(200, { shipments: results });
  }

  // Ask Whatnot to make labels. This buys postage, so each shipment is asked at most once ever
  // (wn_label_requests remembers). Whatnot only queues the work; we then re-read each shipment for up to ~40 s.
  if (action === "generate_labels") {
    const ids: string[] = [...new Set<string>((Array.isArray(body.shipment_ids) ? body.shipment_ids : []).slice(0, 150).map(String))];
    if (!ids.length) return json(400, { error: "shipment_ids required" });
    const { data: prior } = await admin.from("wn_label_requests").select("shipment_id, http_status").eq("shop", shop).in("shipment_id", ids);
    const asked = new Map((prior ?? []).map((r: any) => [r.shipment_id, r.http_status]));
    const results: Record<string, any> = {};
    const fresh = ids.filter((id) => !asked.has(id));
    for (let i = 0; i < fresh.length; i += 5) {
      const group = fresh.slice(i, i + 5);
      const got = await Promise.all(group.map((sid) => wn(token, `/shipments/${sid}/generate_label`, "POST")));
      const rows = group.map((sid, k) => ({ shop, shipment_id: sid, requested_by: u.user!.email, http_status: got[k].status, note: got[k].status === 200 ? null : (got[k].body?.detail ?? got[k].body?.error ?? JSON.stringify(got[k].body ?? "")).toString().slice(0, 300) }));
      await admin.from("wn_label_requests").upsert(rows, { onConflict: "shop,shipment_id" });
      group.forEach((sid, k) => { results[sid] = { requested: true, http_status: got[k].status, error: got[k].status === 200 ? null : (got[k].status === 403 ? "Whatnot refused (403): seller verification or token scope" : got[k].status === 409 ? "Whatnot refused (409): shipment settings block label creation" : `Whatnot answered ${got[k].status}`) }; });
      await sleep(200);
    }
    for (const id of ids) if (asked.has(id)) results[id] = { requested: false, http_status: asked.get(id), error: null, note: "already asked before, not asking again" };
    // Wait for the labels to appear.
    const pending = new Set(ids.filter((id) => results[id].http_status === 200 || (results[id].requested === false)));
    const t0 = Date.now();
    while (pending.size && Date.now() - t0 < 40000) {
      await sleep(4000);
      const batch = [...pending];
      for (let i = 0; i < batch.length; i += 8) {
        await Promise.all(batch.slice(i, i + 8).map(async (sid) => {
          const r = await wn(token, `/shipments/${sid}`);
          if (r.status !== 200) return;
          const sl = slim(r.body); results[sid].shipment = sl;
          if (sl.status !== "created" || sl.has_label) pending.delete(sid);
        }));
      }
    }
    return json(200, { results, still_waiting: [...pending] });
  }

  // One PDF out of many: fetch each shipment's bundled label+slip PDF in the order given, append pages.
  if (action === "build_pdf") {
    const ids: string[] = (Array.isArray(body.shipment_ids) ? body.shipment_ids : []).slice(0, 250).map(String);
    if (!ids.length) return json(400, { error: "shipment_ids required" });
    const docs: (Uint8Array | null)[] = new Array(ids.length).fill(null);
    const missing: { id: string; why: string }[] = [];
    for (let i = 0; i < ids.length; i += 8) {
      await Promise.all(ids.slice(i, i + 8).map(async (sid, k) => {
        const r = await wn(token, `/shipments/${sid}`);
        if (r.status !== 200) { missing.push({ id: sid, why: `Whatnot answered ${r.status}` }); return; }
        const url = r.body?.documents?.bundled_url ?? r.body?.documents?.label_url;
        if (!url) { missing.push({ id: sid, why: "no label yet" }); return; }
        try {
          const f = await fetch(url);
          if (!f.ok) { missing.push({ id: sid, why: `label file ${f.status}` }); return; }
          docs[i + k] = new Uint8Array(await f.arrayBuffer());
        } catch (e) { missing.push({ id: sid, why: String(e).slice(0, 120) }); }
      }));
    }
    const out = await PDFDocument.create();
    let pages = 0, boxes = 0;
    for (let i = 0; i < ids.length; i++) {
      const bytes = docs[i]; if (!bytes) continue;
      try {
        const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const copied = await out.copyPages(src, src.getPageIndices());
        for (const pg of copied) { out.addPage(pg); pages++; }
        boxes++;
      } catch (e) { missing.push({ id: ids[i], why: "could not read PDF: " + String(e).slice(0, 80) }); }
    }
    if (!boxes) return json(502, { error: "none of the labels could be fetched", missing });
    const bytes = await out.save();
    return new Response(new Blob([bytes as BlobPart]), { status: 200, headers: { ...cors, "Content-Type": "application/pdf", "x-chuku-report": JSON.stringify({ boxes, pages, missing }) } });
  }

  return json(400, { error: "unknown action" });
});
