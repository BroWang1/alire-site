// chuku-lark: reads from Lark (or Feishu) with the app credentials in LARK_APP_ID / LARK_APP_SECRET.
// Read only. Never returns the credentials or the Lark token.
// Body: { action: "probe" }                    is the hookup alive, and which files can the app see
//       { action: "tables", base: "<Base link or app token>" }   tables, fields and row counts of one Base
// Called with x-sync-key (value in chuku_settings) or by a signed-in allowed user.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_ID = (Deno.env.get("LARK_APP_ID") ?? "").trim();
const APP_SECRET = (Deno.env.get("LARK_APP_SECRET") ?? "").trim();
const HOSTS = ["https://open.larksuite.com", "https://open.feishu.cn"];   // Lark first, then Feishu
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sync-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

let cache: { host: string; token: string; until: number } | null = null;
async function larkToken(): Promise<{ host: string; token: string; tried: any[] }> {
  if (cache && Date.now() < cache.until) return { host: cache.host, token: cache.token, tried: [] };
  if (!APP_ID || !APP_SECRET) throw new Error("LARK_APP_ID / LARK_APP_SECRET are not set");
  const tried: any[] = [];
  for (const host of HOSTS) {
    const r = await fetch(`${host}/open-apis/auth/v3/tenant_access_token/internal`, {
      method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET }),
    });
    const b: any = await r.json().catch(() => ({}));
    tried.push({ host, http: r.status, code: b.code ?? null, msg: b.msg ?? null });
    if (r.ok && b.code === 0 && b.tenant_access_token) {
      cache = { host, token: b.tenant_access_token, until: Date.now() + Math.max(60, (Number(b.expire) || 7200) - 300) * 1000 };
      return { host, token: b.tenant_access_token, tried };
    }
  }
  const e: any = new Error("Lark did not accept the App ID / App Secret"); e.tried = tried; throw e;
}
async function lark(path: string): Promise<{ http: number; code: number | null; msg: string | null; data: any }> {
  const { host, token } = await larkToken();
  const r = await fetch(host + path, { headers: { Authorization: `Bearer ${token}` } });
  const b: any = await r.json().catch(() => ({}));
  return { http: r.status, code: b.code ?? null, msg: b.msg ?? null, data: b.data ?? null };
}
async function pages(path: string, max = 5): Promise<{ items: any[]; err: any }> {
  const items: any[] = []; let pt = "";
  for (let i = 0; i < max; i++) {
    const res = await lark(`${path}${path.includes("?") ? "&" : "?"}page_size=100${pt ? "&page_token=" + encodeURIComponent(pt) : ""}`);
    if (res.code !== 0) return { items, err: { http: res.http, code: res.code, msg: res.msg } };
    items.push(...(res.data?.items ?? res.data?.files ?? []));
    if (!res.data?.has_more) break; pt = res.data.page_token ?? res.data.next_page_token ?? ""; if (!pt) break;
  }
  return { items, err: null };
}
// A Base link looks like https://x.larksuite.com/base/<token>?table=tbl... or .../wiki/<token>
function parseBase(input: string): { kind: "base" | "wiki"; token: string } | null {
  const s = String(input || "").trim(); if (!s) return null;
  const m = s.match(/\/(base|wiki)\/([A-Za-z0-9]+)/);
  if (m) return { kind: m[1] as "base" | "wiki", token: m[2] };
  if (/^[A-Za-z0-9]{10,}$/.test(s)) return { kind: "base", token: s };
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "POST only" });
  let body: any = {}; try { body = await req.json(); } catch { body = {}; }
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const syncKey = req.headers.get("x-sync-key") ?? "";
  const { data: sk } = await admin.from("chuku_settings").select("value").eq("key", "sync_key").maybeSingle();
  if (!(sk?.value && syncKey === sk.value)) {
    const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: u, error: uerr } = await asUser.auth.getUser();
    if (uerr || !u?.user?.email) return json(401, { error: "sign in first" });
    const { data: allowed } = await asUser.rpc("is_allowed");
    if (!allowed) return json(403, { error: "not on the allowed list" });
  }
  try {
    const action = String(body.action ?? "probe");
    if (action === "probe") {
      const t = await larkToken();
      const files = await pages("/open-apis/drive/v1/files?order_by=EditedTime&direction=DESC", 2);
      return json(200, {
        ok: true, host: t.host, app_id_start: APP_ID.slice(0, 8), secret_length: APP_SECRET.length,
        files_visible: files.items.map((f: any) => ({ name: f.name, type: f.type, token: f.token, url: f.url })), files_error: files.err,
      });
    }
    if (action === "tables") {
      const p = parseBase(body.base); if (!p) return json(400, { error: "give the Base link or its token as base" });
      let appToken = p.token; let via: any = null;
      if (p.kind === "wiki") {
        const node = await lark(`/open-apis/wiki/v2/spaces/get_node?token=${encodeURIComponent(p.token)}`);
        if (node.code !== 0) return json(200, { ok: false, step: "wiki lookup", lark: { http: node.http, code: node.code, msg: node.msg } });
        via = { wiki_title: node.data?.node?.title, obj_type: node.data?.node?.obj_type };
        if (node.data?.node?.obj_type !== "bitable") return json(200, { ok: false, step: "wiki lookup", note: "that wiki page is not a Base", via });
        appToken = node.data.node.obj_token;
      }
      const meta = await lark(`/open-apis/bitable/v1/apps/${appToken}`);
      const tables = await pages(`/open-apis/bitable/v1/apps/${appToken}/tables`);
      if (tables.err) return json(200, { ok: false, step: "list tables", base_name: meta.data?.app?.name ?? null, lark: tables.err, meta: { code: meta.code, msg: meta.msg } });
      const out = [];
      for (const t of tables.items.slice(0, 30)) {
        const fields = await pages(`/open-apis/bitable/v1/apps/${appToken}/tables/${t.table_id}/fields`, 3);
        const one = await lark(`/open-apis/bitable/v1/apps/${appToken}/tables/${t.table_id}/records?page_size=1`);
        out.push({ table_id: t.table_id, name: t.name, rows: one.code === 0 ? (one.data?.total ?? null) : null, rows_error: one.code === 0 ? null : { code: one.code, msg: one.msg },
          fields: fields.items.map((f: any) => ({ name: f.field_name, type: f.ui_type ?? f.type })), fields_error: fields.err });
      }
      return json(200, { ok: true, base_name: meta.data?.app?.name ?? null, via, tables: out });
    }
    return json(400, { error: "unknown action" });
  } catch (err) {
    const e = err as any;
    return json(200, { ok: false, error: String(e.message ?? e), tried: e.tried ?? null, app_id_start: APP_ID.slice(0, 8), secret_length: APP_SECRET.length });
  }
});
