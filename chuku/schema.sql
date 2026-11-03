-- Chuku: packing-slip data store for the Whatnot Label Sorter.
-- Paste this whole file into Supabase > SQL Editor > New query > Run. Safe to re-run.

-- ---------- tables ----------
create table if not exists batches (
  id            bigint generated always as identity primary key,
  dropped_at    timestamptz not null default now(),
  shop          text not null,
  file_name     text,
  page_count    int,
  shipment_count int,
  item_count    int,
  total_cents   int,
  fingerprint   text unique            -- hash of all order numbers: same PDF twice = same batch
);

create table if not exists shipments (
  id            bigint generated always as identity primary key,
  batch_id      bigint references batches(id) on delete cascade,
  shop          text not null,
  buyer         text not null,         -- Whatnot username
  show_title    text,
  order_date    date,
  pickup        boolean not null default false,
  item_count    int,
  total_cents   int,
  carrier       text,
  tracking      text,
  weight_oz     numeric,
  dimensions    text,
  slip_pages    int,
  first_seen    timestamptz not null default now()
);
create unique index if not exists shipments_tracking_key on shipments (tracking) where tracking is not null;
create index if not exists shipments_buyer_idx on shipments (shop, buyer);
create index if not exists shipments_date_idx on shipments (shop, order_date);

create table if not exists items (
  id            bigint generated always as identity primary key,
  shipment_id   bigint references shipments(id) on delete cascade,
  shop          text not null,
  order_number  text not null unique,  -- Whatnot order id: the dedupe key
  product       text not null,         -- lot number stripped
  lot           int,
  qty           int not null default 1,
  price_cents   int not null default 0,
  order_date    date,
  buyer         text
);
create index if not exists items_product_idx on items (shop, product);

create table if not exists allowed_users (
  email text primary key,
  note  text
);

-- ---------- one call stores a whole drop ----------
-- payload: {shop, file_name, page_count, shipments:[{buyer, show_title, order_date, pickup, item_count, total_cents,
--           carrier, tracking, weight_oz, dimensions, slip_pages, items:[{order_number, product, lot, qty, price_cents}]}]}
create or replace function ingest_batch(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  b_id bigint; s jsonb; it jsonb; s_id bigint; fp text;
  n_ship int := 0; n_item int := 0; n_new int := 0; tot int := 0;
begin
  if payload->>'shop' is null or jsonb_typeof(payload->'shipments') <> 'array' then
    raise exception 'payload needs shop and shipments[]';
  end if;
  select md5(string_agg(x, ',' order by x)) into fp
    from jsonb_path_query(payload, '$.shipments[*].items[*].order_number') as x;
  if fp is null then raise exception 'no order numbers in payload'; end if;

  insert into batches (shop, file_name, page_count, fingerprint)
    values (payload->>'shop', payload->>'file_name', (payload->>'page_count')::int, fp)
    on conflict (fingerprint) do update set dropped_at = now(), file_name = excluded.file_name
    returning id into b_id;

  for s in select * from jsonb_array_elements(payload->'shipments') loop
    n_ship := n_ship + 1;
    tot := tot + coalesce((s->>'total_cents')::int, 0);
    -- a shipment is keyed by tracking when it has one; pickups have none, so they key by their first order number
    s_id := null;
    if s->>'tracking' is not null then
      select id into s_id from shipments where tracking = s->>'tracking';
    else
      select sh.id into s_id from items i join shipments sh on sh.id = i.shipment_id
        where i.order_number = (s->'items'->0->>'order_number') limit 1;
    end if;
    if s_id is null then
      insert into shipments (batch_id, shop, buyer, show_title, order_date, pickup, item_count, total_cents, carrier, tracking, weight_oz, dimensions, slip_pages)
      values (b_id, payload->>'shop', s->>'buyer', s->>'show_title', (s->>'order_date')::date, coalesce((s->>'pickup')::boolean, false),
              (s->>'item_count')::int, (s->>'total_cents')::int, s->>'carrier', s->>'tracking', (s->>'weight_oz')::numeric, s->>'dimensions', (s->>'slip_pages')::int)
      returning id into s_id;
      n_new := n_new + 1;
    else
      update shipments set batch_id = b_id, buyer = s->>'buyer', show_title = s->>'show_title', order_date = (s->>'order_date')::date,
        pickup = coalesce((s->>'pickup')::boolean, false), item_count = (s->>'item_count')::int, total_cents = (s->>'total_cents')::int,
        carrier = s->>'carrier', weight_oz = (s->>'weight_oz')::numeric, dimensions = s->>'dimensions', slip_pages = (s->>'slip_pages')::int
      where id = s_id;
    end if;
    for it in select * from jsonb_array_elements(s->'items') loop
      n_item := n_item + 1;
      insert into items (shipment_id, shop, order_number, product, lot, qty, price_cents, order_date, buyer)
      values (s_id, payload->>'shop', it->>'order_number', it->>'product', (it->>'lot')::int, coalesce((it->>'qty')::int, 1),
              coalesce((it->>'price_cents')::int, 0), (s->>'order_date')::date, s->>'buyer')
      on conflict (order_number) do update set shipment_id = excluded.shipment_id, product = excluded.product, lot = excluded.lot,
        qty = excluded.qty, price_cents = excluded.price_cents, order_date = excluded.order_date, buyer = excluded.buyer;
    end loop;
  end loop;

  update batches set shipment_count = n_ship, item_count = n_item, total_cents = tot where id = b_id;
  return jsonb_build_object('batch_id', b_id, 'shipments', n_ship, 'new_shipments', n_new, 'items', n_item);
end $$;

-- ---------- who may read ----------
create or replace function is_allowed()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from allowed_users where lower(email) = lower(coalesce(auth.jwt()->>'email', '')));
$$;

alter table batches       enable row level security;
alter table shipments     enable row level security;
alter table items         enable row level security;
alter table allowed_users enable row level security;

drop policy if exists "allowed read batches"   on batches;
drop policy if exists "allowed read shipments" on shipments;
drop policy if exists "allowed read items"     on items;
create policy "allowed read batches"   on batches   for select to authenticated using (is_allowed());
create policy "allowed read shipments" on shipments for select to authenticated using (is_allowed());
create policy "allowed read items"     on items     for select to authenticated using (is_allowed());
-- nobody reads allowed_users through the API; ingest_batch writes as definer, so no insert policies are needed.

revoke all on function ingest_batch(jsonb) from public;
grant execute on function ingest_batch(jsonb) to anon, authenticated;
grant execute on function is_allowed() to anon, authenticated;

-- ---------- report views (inherit the table policies) ----------
create or replace view v_daily with (security_invoker = true) as
  select shop, order_date, count(distinct shipment_id) as shipments, sum(qty) as units, sum(price_cents) as revenue_cents
  from items group by shop, order_date;

create or replace view v_products with (security_invoker = true) as
  select shop, product, count(*) as orders, sum(qty) as units, sum(price_cents) as revenue_cents,
         min(price_cents) as min_cents, max(price_cents) as max_cents, min(order_date) as first_date, max(order_date) as last_date
  from items group by shop, product;

create or replace view v_buyers with (security_invoker = true) as
  select shop, buyer, count(distinct shipment_id) as shipments, sum(qty) as units, sum(price_cents) as revenue_cents,
         min(order_date) as first_date, max(order_date) as last_date
  from items group by shop, buyer;

create or replace view v_shops with (security_invoker = true) as
  select shop, count(distinct shipment_id) as shipments, sum(qty) as units, sum(price_cents) as revenue_cents,
         min(order_date) as first_date, max(order_date) as last_date
  from items group by shop;

-- ---------- allow yourself ----------
-- insert into allowed_users (email, note) values ('you@example.com', 'owner');
