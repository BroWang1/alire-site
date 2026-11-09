-- Chuku packer pay: flat rate per shipped box, counted when the carrier scans it, payable on delivery.
-- Safe to re-run. See chuku/packer-pay.md. Needs sync.sql (wn_shipments, wn_shipment_events).

-- The rate, with history. The rate for a box is the latest row whose effective_from is on or before its ship day.
create table if not exists pay_rates (
  id             bigserial primary key,
  shop           text not null references shops(shop),
  effective_from date not null,
  cents          int  not null check (cents >= 0),
  set_by         text,
  set_at         timestamptz not null default now(),
  unique (shop, effective_from)
);
-- A payment you made, and which boxes it covered.
create table if not exists pay_payments (
  id           bigserial primary key,
  shop         text not null references shops(shop),
  paid_at      timestamptz not null default now(),
  amount_cents int  not null,
  boxes        int  not null,
  note         text,
  paid_by      text
);
create table if not exists pay_paid_boxes (
  shop        text not null references shops(shop),
  shipment_id text not null,
  payment_id  bigint not null references pay_payments(id) on delete cascade,
  cents       int not null,
  primary key (shop, shipment_id)
);

alter table pay_rates      enable row level security;
alter table pay_payments   enable row level security;
alter table pay_paid_boxes enable row level security;
drop policy if exists "allowed read pay_rates"      on pay_rates;
drop policy if exists "allowed read pay_payments"   on pay_payments;
drop policy if exists "allowed read pay_paid_boxes" on pay_paid_boxes;
create policy "allowed read pay_rates"      on pay_rates      for select to authenticated using (is_allowed());
create policy "allowed read pay_payments"   on pay_payments   for select to authenticated using (is_allowed());
create policy "allowed read pay_paid_boxes" on pay_paid_boxes for select to authenticated using (is_allowed());

-- Each shipping box with the day it shipped and the day it was delivered, as the sync engine saw them.
-- The first sync run for a shop loaded everything at once, so its rows carry no real dates and are left out.
create or replace view wn_pay_boxes with (security_invoker = true) as
with first_load as (select shop, min(seen_at) as t from wn_shipment_events group by shop),
shipped as (
  select e.shop, e.shipment_id, min(e.seen_at) as shipped_at
  from wn_shipment_events e join first_load f on f.shop = e.shop
  where e.to_status in ('dropped_off', 'in_transit', 'delivered') and e.seen_at > f.t
  group by e.shop, e.shipment_id),
delivered as (
  select e.shop, e.shipment_id, min(e.seen_at) as delivered_at
  from wn_shipment_events e join first_load f on f.shop = e.shop
  where e.to_status = 'delivered' and e.seen_at > f.t
  group by e.shop, e.shipment_id)
select s.shop, s.shipment_id, s.buyer, s.status, s.created_at, s.tracking, s.carrier,
       sh.shipped_at, d.delivered_at,
       (s.status like 'cancelled%' or s.status = 'failed') as cancelled
from wn_shipments s
left join shipped   sh on sh.shop = s.shop and sh.shipment_id = s.shipment_id
left join delivered d  on d.shop  = s.shop and d.shipment_id  = s.shipment_id
where s.fulfillment is distinct from 'pickup';
grant select on wn_pay_boxes to authenticated;

-- Set the rate from a given day on (allowed users only).
create or replace function set_pay_rate(p_shop text, p_cents int, p_from date) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_allowed() then raise exception 'not allowed'; end if;
  if p_cents is null or p_cents < 0 or p_cents > 10000 then raise exception 'rate out of range'; end if;
  insert into pay_rates (shop, effective_from, cents, set_by)
  values (lower(p_shop), p_from, p_cents, auth.jwt() ->> 'email')
  on conflict (shop, effective_from) do update set cents = excluded.cents, set_by = excluded.set_by, set_at = now();
end $$;

-- Record a payment covering a list of boxes: p_boxes = [{"id": "...", "cents": 25}, ...]. Boxes already paid are skipped.
create or replace function mark_pay_paid(p_shop text, p_boxes jsonb, p_note text) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint; v_n int; v_sum int;
begin
  if not is_allowed() then raise exception 'not allowed'; end if;
  insert into pay_payments (shop, amount_cents, boxes, note, paid_by)
  values (lower(p_shop), 0, 0, nullif(trim(coalesce(p_note, '')), ''), auth.jwt() ->> 'email') returning id into v_id;
  insert into pay_paid_boxes (shop, shipment_id, payment_id, cents)
  select lower(p_shop), b ->> 'id', v_id, greatest(coalesce((b ->> 'cents')::int, 0), 0)
  from jsonb_array_elements(p_boxes) b
  where exists (select 1 from wn_shipments s where s.shop = lower(p_shop) and s.shipment_id = b ->> 'id')
  on conflict (shop, shipment_id) do nothing;
  select count(*), coalesce(sum(cents), 0) into v_n, v_sum from pay_paid_boxes where payment_id = v_id;
  if v_n = 0 then delete from pay_payments where id = v_id; return null; end if;
  update pay_payments set amount_cents = v_sum, boxes = v_n where id = v_id;
  return v_id;
end $$;
revoke all on function set_pay_rate(text, int, date) from public, anon;
revoke all on function mark_pay_paid(text, jsonb, text) from public, anon;
grant execute on function set_pay_rate(text, int, date) to authenticated;
grant execute on function mark_pay_paid(text, jsonb, text) to authenticated;
