-- Chuku sync engine: Chuku's own copy of every box, kept current by the chuku-sync Edge Function.
-- Safe to re-run. See chuku/sync-engine.md for the definition.

-- One row per box: the current state as Whatnot last reported it.
create table if not exists wn_shipments (
  shop              text not null references shops(shop),
  shipment_id       text not null,
  status            text not null,
  fulfillment       text,
  buyer             text,
  buyer_name        text,
  url               text,
  created_at        timestamptz,
  updated_at        timestamptz,
  dropoff_due       timestamptz,
  carrier           text,
  service           text,
  tracking          text,
  has_label         boolean not null default false,
  seller_cost_cents int,
  weight            text,
  dims              text,
  required_actions  text[] not null default '{}',
  replacement_id    text,
  first_seen_at     timestamptz not null default now(),
  last_seen_at      timestamptz not null default now(),
  primary key (shop, shipment_id)
);
create index if not exists wn_shipments_shop_created on wn_shipments (shop, created_at desc);
create index if not exists wn_shipments_shop_status  on wn_shipments (shop, status);

-- The change log: one row every time a box's status changes (or when it is first seen).
create table if not exists wn_shipment_events (
  id          bigserial primary key,
  shop        text not null references shops(shop),
  shipment_id text not null,
  from_status text,
  to_status   text not null,
  seen_at     timestamptz not null default now()
);
create index if not exists wn_shipment_events_shop_seen on wn_shipment_events (shop, seen_at desc);
create index if not exists wn_shipment_events_box       on wn_shipment_events (shop, shipment_id);

-- One row per sync run.
create table if not exists wn_sync_runs (
  id               bigserial primary key,
  shop             text not null references shops(shop),
  started_at       timestamptz not null default now(),
  finished_at      timestamptz,
  kind             text not null default 'cron',   -- cron | manual
  boxes_seen       int not null default 0,
  changed          int not null default 0,
  contents_fetched int not null default 0,
  pages            int not null default 0,
  error            text
);
create index if not exists wn_sync_runs_shop_started on wn_sync_runs (shop, started_at desc);

alter table wn_shipments       enable row level security;
alter table wn_shipment_events enable row level security;
alter table wn_sync_runs       enable row level security;
drop policy if exists "allowed read wn_shipments"       on wn_shipments;
drop policy if exists "allowed read wn_shipment_events" on wn_shipment_events;
drop policy if exists "allowed read wn_sync_runs"       on wn_sync_runs;
create policy "allowed read wn_shipments"       on wn_shipments       for select to authenticated using (is_allowed());
create policy "allowed read wn_shipment_events" on wn_shipment_events for select to authenticated using (is_allowed());
create policy "allowed read wn_sync_runs"       on wn_sync_runs       for select to authenticated using (is_allowed());

-- What the orders page reads: each box with its contents (when the cached contents match the box's last update).
create or replace view wn_boxes with (security_invoker = true) as
select s.*,
       case when c.updated_at is not distinct from s.updated_at and c.status is not distinct from s.status then c.orders end     as orders,
       case when c.updated_at is not distinct from s.updated_at and c.status is not distinct from s.status then c.sku_count end  as sku_count,
       case when c.updated_at is not distinct from s.updated_at and c.status is not distinct from s.status then c.unit_count end as unit_count
from wn_shipments s
left join wn_shipment_cache c on c.shop = s.shop and c.shipment_id = s.shipment_id;
grant select on wn_boxes to authenticated;

-- The shared key the cron sends and the function checks. No RLS policies: only the service role can read it.
create table if not exists chuku_settings (key text primary key, value text not null, updated_at timestamptz not null default now());
alter table chuku_settings enable row level security;
insert into chuku_settings (key, value) values ('sync_key', 'SYNC_KEY') on conflict (key) do update set value = excluded.value, updated_at = now();

-- Schedule: the function is poked every 5 minutes; it decides by Pacific time whether to run
-- (every 5 min 11 AM-7 PM, every 3 hours otherwise). The public key satisfies the gateway's JWT check; x-sync-key is the real secret. Replace SYNC_KEY (both places) with a long random string before running.
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.unschedule('chuku-sync') where exists (select 1 from cron.job where jobname = 'chuku-sync');
select cron.schedule(
  'chuku-sync', '*/5 * * * *',
  $$ select net.http_post(
       url := 'https://cxsqqniunjenklxexbvb.supabase.co/functions/v1/chuku-sync',
       headers := '{"Content-Type":"application/json","apikey":"sb_publishable_CdZMIc0Jb6oLmnyY0AmQNw_rGAV6Ogz","Authorization":"Bearer sb_publishable_CdZMIc0Jb6oLmnyY0AmQNw_rGAV6Ogz","x-sync-key":"SYNC_KEY"}'::jsonb,
       body := '{"all":true}'::jsonb,
       timeout_milliseconds := 120000) $$
);
