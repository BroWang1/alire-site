-- Chuku: shops and Whatnot personal access tokens (keys page). Safe to re-run.
-- Tokens live ONLY in Supabase Vault. shop_keys holds the last 4 characters and metadata.

create table if not exists shops (
  shop            text primary key,                 -- lower(username) from GET /users/me
  whatnot_user_id text unique,
  display_name    text,
  seller_currency text,
  country_code    text,
  tz              text not null default 'America/Los_Angeles',
  created_at      timestamptz not null default now(),
  added_by        text
);

create table if not exists shop_keys (
  id                 bigint generated always as identity primary key,
  shop               text not null references shops(shop),
  vault_secret_id    uuid,
  token_hint         text,                           -- last 4 characters only
  scopes             text[] not null default '{}',   -- as ticked by the person who added it
  probe              jsonb,                          -- what the API answered at add/check time
  expires_at         date,
  status             text not null default 'ok',     -- ok | invalid | unreachable | removed
  last_checked_at    timestamptz,
  last_http_status   int,
  last_error         text,
  automation_on      boolean not null default false, -- daily labels email (built in a later step)
  recipients         text[] not null default '{}',
  ignored_buyers     text[] not null default '{}',   -- usernames skipped by the daily run
  send_time          time not null default '06:00',  -- in shops.tz
  max_labels_per_run int not null default 150,
  include_older      boolean not null default true,  -- older still-unlabeled boxes ride along in a separate section
  last_sync_at       timestamptz,
  added_by           text,
  added_at           timestamptz not null default now(),
  removed_by         text,
  removed_at         timestamptz
);
create unique index if not exists shop_keys_one_active_per_shop on shop_keys (shop) where removed_at is null;

alter table shops     enable row level security;
alter table shop_keys enable row level security;
drop policy if exists "allowed read shops" on shops;
drop policy if exists "allowed read shop_keys" on shop_keys;
create policy "allowed read shops"     on shops     for select to authenticated using (is_allowed());
create policy "allowed read shop_keys" on shop_keys for select to authenticated using (is_allowed());

-- Settings an allowed user may change from the page (never the token).
create or replace function set_key_settings(
  p_key_id bigint, p_automation_on boolean, p_recipients text[], p_ignored_buyers text[],
  p_send_time time, p_max_labels int, p_include_older boolean)
returns void language plpgsql security definer set search_path = public as $$
declare who text := coalesce(auth.jwt()->>'email', '');
begin
  if not is_allowed() then raise exception 'not allowed'; end if;
  if p_automation_on and coalesce(array_length(p_recipients, 1), 0) = 0 then
    raise exception 'add at least one recipient before turning automation on';
  end if;
  update shop_keys set
    automation_on = p_automation_on,
    recipients = (select coalesce(array_agg(lower(trim(x))), '{}') from unnest(p_recipients) x where trim(x) <> ''),
    ignored_buyers = (select coalesce(array_agg(lower(trim(x))), '{}') from unnest(p_ignored_buyers) x where trim(x) <> ''),
    send_time = coalesce(p_send_time, send_time),
    max_labels_per_run = coalesce(p_max_labels, max_labels_per_run),
    include_older = coalesce(p_include_older, include_older)
  where id = p_key_id and removed_at is null;
  if not found then raise exception 'key not found'; end if;
  insert into events (kind, shop, email, detail)
    select 'key_settings', shop, who, jsonb_build_object('key_id', p_key_id, 'automation_on', p_automation_on, 'recipients', p_recipients, 'ignored', p_ignored_buyers, 'send_time', p_send_time)
    from shop_keys where id = p_key_id;
end $$;
revoke all on function set_key_settings(bigint, boolean, text[], text[], time, int, boolean) from public;
grant execute on function set_key_settings(bigint, boolean, text[], text[], time, int, boolean) to authenticated;

-- Vault wrappers: only the server (service_role) may call these. The token never passes through RLS tables.
create or replace function store_shop_token(p_key_id bigint, p_token text)
returns uuid language plpgsql security definer set search_path = public, vault as $$
declare sid uuid;
begin
  select vault_secret_id into sid from shop_keys where id = p_key_id;
  if sid is null then
    sid := vault.create_secret(p_token, 'whatnot_key_' || p_key_id, 'Whatnot personal access token for shop_keys.id=' || p_key_id);
    update shop_keys set vault_secret_id = sid where id = p_key_id;
  else
    perform vault.update_secret(sid, p_token);
  end if;
  return sid;
end $$;

create or replace function read_shop_token(p_key_id bigint)
returns text language sql security definer set search_path = public, vault as $$
  select s.decrypted_secret from vault.decrypted_secrets s
  join shop_keys k on k.vault_secret_id = s.id
  where k.id = p_key_id and k.removed_at is null;
$$;

create or replace function drop_shop_token(p_key_id bigint)
returns void language plpgsql security definer set search_path = public, vault as $$
declare sid uuid;
begin
  select vault_secret_id into sid from shop_keys where id = p_key_id;
  if sid is not null then delete from vault.secrets where id = sid; end if;
  update shop_keys set vault_secret_id = null where id = p_key_id;
end $$;

revoke all on function store_shop_token(bigint, text) from public, anon, authenticated;
revoke all on function read_shop_token(bigint)        from public, anon, authenticated;
revoke all on function drop_shop_token(bigint)        from public, anon, authenticated;
grant execute on function store_shop_token(bigint, text) to service_role;
grant execute on function read_shop_token(bigint)        to service_role;
grant execute on function drop_shop_token(bigint)        to service_role;
