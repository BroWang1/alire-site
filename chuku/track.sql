-- Chuku tracking check: USPS's word on every box, written by the chuku-track Edge Function. Safe to re-run.
-- Why: Whatnot's "in transit" only means the label was scanned at the shop; only USPS knows if the box left.

create table if not exists wn_tracking (
  shop              text not null references shops(shop),
  shipment_id       text not null,
  tracking          text not null,
  checked_at        timestamptz not null default now(),
  error             text,                      -- USPS could not answer (bad number, not in system, ...)
  received          boolean,                   -- true = USPS has a real scan, false = only "label created"
  status            text,
  status_category   text,                      -- USPS's bucket: Pre-Shipment, In Transit, Delivered, Alert, ...
  status_summary    text,
  mail_class        text,
  event_type        text,                      -- latest scan, in words
  event_city        text,
  event_state       text,
  event_at          timestamptz,
  expected_delivery date,
  delivered_at      timestamptz,
  events            jsonb not null default '[]',   -- last 5 scans
  primary key (shop, shipment_id)
);
create index if not exists wn_tracking_shop_checked on wn_tracking (shop, checked_at);

create table if not exists wn_track_runs (
  id          bigserial primary key,
  shop        text not null references shops(shop),
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  kind        text not null default 'cron',   -- cron | manual
  checked     int not null default 0,
  failed      int not null default 0,
  received    int not null default 0,
  delivered   int not null default 0,
  "left"      int not null default 0,
  error       text
);
create index if not exists wn_track_runs_shop_started on wn_track_runs (shop, started_at desc);

alter table wn_tracking   enable row level security;
alter table wn_track_runs enable row level security;
drop policy if exists "allowed read wn_tracking"   on wn_tracking;
drop policy if exists "allowed read wn_track_runs" on wn_track_runs;
create policy "allowed read wn_tracking"   on wn_tracking   for select to authenticated using (is_allowed());
create policy "allowed read wn_track_runs" on wn_track_runs for select to authenticated using (is_allowed());

-- Daily sweep at 14:00 UTC (6 AM Pacific in winter, 7 AM in summer). Until USPS approves tracking access each run
-- just logs the 403 in wn_track_runs; the day they approve, it starts working on its own.
select cron.unschedule('chuku-track') where exists (select 1 from cron.job where jobname = 'chuku-track');
select cron.schedule(
  'chuku-track', '0 14 * * *',
  $$ select net.http_post(
       url := 'https://cxsqqniunjenklxexbvb.supabase.co/functions/v1/chuku-track',
       headers := jsonb_build_object('Content-Type', 'application/json',
                    'apikey', 'sb_publishable_CdZMIc0Jb6oLmnyY0AmQNw_rGAV6Ogz',
                    'Authorization', 'Bearer sb_publishable_CdZMIc0Jb6oLmnyY0AmQNw_rGAV6Ogz',
                    'x-sync-key', (select value from chuku_settings where key = 'sync_key')),
       body := '{"sweep":true}'::jsonb,
       timeout_milliseconds := 300000) $$
);
