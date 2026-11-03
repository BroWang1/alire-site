// chuku-keys: validates a Whatnot personal access token, stores it in Vault, checks/replaces/removes keys.
// Called from /tool/chuku/keys with the signed-in user's JWT. The token is only ever in the request body
// and in Vault; it is never logged, never returned, never written to a normal table.
import { createClient } from "npm:@supabase/supabase-js@2";

const WN = "https://api.whatnot.com/seller-api/rest/v2";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function wn(token: string, path: string) {
  const r = await fetch(WN + path, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
  let body: unknown = null;
  try { body = await r.json(); } catch { body = null; }
  return { status: r.status, body: body as Record<string, unknown> | null };
}

// Probe what the token can do. Never throws; records statuses and whether customer fields came back.
async function probe(token: string) {
  const [o, s] = await Promise.all([wn(token, "/orders?limit=1"), wn(token, "/shipments?limit=1")]);
  const order = (o.body?.data as Record<string, unknown>[] | undefined)?.[0];
  const ship = (s.body?.data as Record<string, unknown>[] | undefined)?.[0];
  return {
    orders: o.status,
    shipments: s.status,
    customers: order ? (order.buyer != null ? "yes" : "null") : ship ? (ship.recipient != null ? "yes" : "null") : "no data",
    documents: ship ? ((ship.documents as Record<string, unknown> | null)?.bundled_url != null ? "yes" : "null") : "no data",
    checked_at: new Date().toISOString(),
  };
}

function hint(t: string) { return "…" + t.slice(-4); }
function cleanToken(raw: unknown) {
  const t = String(raw ?? "").replace(/^\s*bearer\s+/i, "").replace(/\s+/g, "");
  if (!t) return { error: "no token" };
  if (t.startsWith("wn_access_tk_")) return { error: "that is an OAuth app token, not a personal access token" };
  if (!t.startsWith("wn_pat_tk_")) return { error: "personal access tokens start with wn_pat_tk_" };
  return { token: t };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "POST only" });

  // Who is calling? Must be a signed-in user on the allowed list.
  const auth = req.headers.get("Authorization") ?? "";
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data: userData, error: userErr } = await asUser.auth.getUser();
  if (userErr || !userData?.user?.email) return json(401, { error: "sign in first" });
  const email = userData.user.email.toLowerCase();
  const { data: allowed } = await asUser.rpc("is_allowed");
  if (!allowed) return json(403, { error: "not on the allowed list" });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const log = (kind: string, shop: string | null, detail: Record<string, unknown>) =>
    admin.from("events").insert({ kind, shop, email, detail, agent: req.headers.get("user-agent")?.slice(0, 200) ?? null });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json(400, { error: "bad json" }); }
  const action = String(body.action ?? "");

  // ---------- add ----------
  if (action === "add") {
    const c = cleanToken(body.token);
    if ("error" in c) return json(422, { error: c.error });
    const token = c.token!;
    const me = await wn(token, "/users/me");
    if (me.status === 401) return json(422, { error: "Whatnot rejected this token (401). It may be expired, deleted, or mistyped." });
    if (me.status !== 200 || !me.body?.username) return json(502, { error: `Whatnot answered ${me.status} to /users/me` });
    const shop = String(me.body.username).toLowerCase();
    const whatnotId = String(me.body.id);

    const { data: existing } = await admin.from("shop_keys").select("id, added_by, added_at").eq("shop", shop).is("removed_at", null).maybeSingle();
    if (existing) return json(409, { error: `A key for @${shop} already exists, added by ${existing.added_by} on ${String(existing.added_at).slice(0, 10)}. Use Replace on that row.` });

    const pr = await probe(token);
    const { error: shopErr } = await admin.from("shops").upsert({
      shop, whatnot_user_id: whatnotId, display_name: me.body.display_name ?? null,
      seller_currency: me.body.seller_currency ?? null, country_code: me.body.country_code ?? null, added_by: email,
    }, { onConflict: "shop" });
    if (shopErr) return json(500, { error: "could not save shop: " + shopErr.message });

    const scopes = Array.isArray(body.scopes) ? (body.scopes as unknown[]).map(String) : [];
    const { data: row, error: rowErr } = await admin.from("shop_keys").insert({
      shop, token_hint: hint(token), scopes, probe: pr, expires_at: body.expires_at || null,
      status: "ok", last_checked_at: new Date().toISOString(), last_http_status: 200, added_by: email,
      recipients: [email],
    }).select("id").single();
    if (rowErr) return json(500, { error: "could not save key: " + rowErr.message });

    const { error: vaultErr } = await admin.rpc("store_shop_token", { p_key_id: row.id, p_token: token });
    if (vaultErr) {
      await admin.from("shop_keys").delete().eq("id", row.id);
      return json(500, { error: "could not store token in vault: " + vaultErr.message });
    }
    await log("key_added", shop, { key_id: row.id, scopes, probe: pr, hint: hint(token) });
    return json(200, { ok: true, key_id: row.id, shop, display_name: me.body.display_name ?? null, probe: pr });
  }

  // ---------- check ----------
  if (action === "check") {
    const keyId = Number(body.key_id);
    const { data: key } = await admin.from("shop_keys").select("id, shop").eq("id", keyId).is("removed_at", null).maybeSingle();
    if (!key) return json(404, { error: "key not found" });
    const { data: token } = await admin.rpc("read_shop_token", { p_key_id: keyId });
    if (!token) return json(500, { error: "token missing from vault" });
    const me = await wn(token, "/users/me");
    const status = me.status === 200 ? "ok" : me.status === 401 ? "invalid" : "unreachable";
    const pr = me.status === 200 ? await probe(token) : null;
    await admin.from("shop_keys").update({
      status, last_checked_at: new Date().toISOString(), last_http_status: me.status,
      last_error: me.status === 200 ? null : `HTTP ${me.status} from /users/me`, ...(pr ? { probe: pr } : {}),
    }).eq("id", keyId);
    if (me.status === 200 && me.body?.username) {
      await admin.from("shops").update({ display_name: me.body.display_name ?? null }).eq("shop", key.shop);
    }
    await log("key_checked", key.shop, { key_id: keyId, status, http: me.status });
    return json(200, { ok: true, status, http: me.status, probe: pr });
  }

  // ---------- replace ----------
  if (action === "replace") {
    const keyId = Number(body.key_id);
    const { data: key } = await admin.from("shop_keys").select("id, shop, shops(whatnot_user_id)").eq("id", keyId).is("removed_at", null).maybeSingle();
    if (!key) return json(404, { error: "key not found" });
    const c = cleanToken(body.token);
    if ("error" in c) return json(422, { error: c.error });
    const token = c.token!;
    const me = await wn(token, "/users/me");
    if (me.status !== 200 || !me.body?.username) return json(422, { error: `Whatnot answered ${me.status} to /users/me` });
    const expectId = (key.shops as unknown as { whatnot_user_id: string } | null)?.whatnot_user_id;
    if (expectId && String(me.body.id) !== expectId) return json(422, { error: `This token belongs to @${me.body.username}, not @${key.shop}.` });
    const pr = await probe(token);
    const { error: vaultErr } = await admin.rpc("store_shop_token", { p_key_id: keyId, p_token: token });
    if (vaultErr) return json(500, { error: "could not store token in vault: " + vaultErr.message });
    const scopes = Array.isArray(body.scopes) ? (body.scopes as unknown[]).map(String) : undefined;
    await admin.from("shop_keys").update({
      token_hint: hint(token), status: "ok", last_checked_at: new Date().toISOString(), last_http_status: 200, last_error: null,
      probe: pr, expires_at: body.expires_at || null, ...(scopes ? { scopes } : {}),
    }).eq("id", keyId);
    await log("key_replaced", key.shop, { key_id: keyId, hint: hint(token) });
    return json(200, { ok: true, probe: pr });
  }

  // ---------- remove ----------
  if (action === "remove") {
    const keyId = Number(body.key_id);
    const { data: key } = await admin.from("shop_keys").select("id, shop").eq("id", keyId).is("removed_at", null).maybeSingle();
    if (!key) return json(404, { error: "key not found" });
    await admin.rpc("drop_shop_token", { p_key_id: keyId });
    await admin.from("shop_keys").update({ status: "removed", automation_on: false, removed_by: email, removed_at: new Date().toISOString() }).eq("id", keyId);
    await log("key_removed", key.shop, { key_id: keyId });
    return json(200, { ok: true });
  }

  return json(400, { error: "unknown action" });
});
