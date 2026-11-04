-- Chuku: cache of what is inside each Whatnot shipment, filled by the chuku-orders Edge Function
-- the first time a shipment is seen, so the order-management page can sort boxes by how many
-- different items they hold without asking Whatnot again. Safe to re-run.
create table if not exists wn_shipment_cache (
  shop         text not null references shops(shop),
  shipment_id  text not null,
  updated_at   timestamptz,          -- Whatnot's updated_at at fetch time; a newer value means refetch
  status       text,
  orders       jsonb not null default '[]',  -- [{id,status,type,created_at,total_cents,shipping_cents,url,items:[{title,qty,price_cents}]}]
  sku_count    int  not null default 0,      -- distinct item titles across the box
  unit_count   int  not null default 0,      -- total units
  fetched_at   timestamptz not null default now(),
  primary key (shop, shipment_id)
);
alter table wn_shipment_cache enable row level security;
drop policy if exists "allowed read wn_shipment_cache" on wn_shipment_cache;
create policy "allowed read wn_shipment_cache" on wn_shipment_cache for select to authenticated using (is_allowed());

-- Labels asked for through the page (print batch). One row per shipment, ever: the function never asks Whatnot twice.
create table if not exists wn_label_requests (
  shop text not null references shops(shop),
  shipment_id text not null,
  requested_at timestamptz not null default now(),
  requested_by text,
  http_status int,
  note text,
  primary key (shop, shipment_id)
);
alter table wn_label_requests enable row level security;
drop policy if exists "allowed read wn_label_requests" on wn_label_requests;
create policy "allowed read wn_label_requests" on wn_label_requests for select to authenticated using (is_allowed());
