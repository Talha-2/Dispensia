-- Stock becomes the organisation's own.
--
-- Until now every tenant saw the same 1,885 synthetic stock lines, because
-- stock was read out of the shared catalogue file rather than the database.
-- That made the catalogue and the shelf the same dataset under two names, and
-- it meant a new pharmacy appeared to already hold inventory it had never
-- bought.
--
-- The split the product needs:
--
--   catalogue  — shared, ours, read-only. 10,434 products with their molecule,
--                manufacturer, AWaRe class, QT grade and clinical flags. What a
--                medicine *is* does not vary by pharmacy.
--   stock      — per tenant, per branch, writable. What this shelf holds, in
--                what batch, expiring when, bought at what price.
--
-- A stock line therefore references the shared catalogue by its id rather than
-- copying the product into each tenant, so a correction to a molecule or an
-- AWaRe class reaches every pharmacy at once and cannot drift per customer.
-- The existing `products` and `inventory_batches` tables assumed the opposite
-- and are left alone; nothing reads them.

create table if not exists public.stock_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,

  -- The shared catalogue's product id. Deliberately not a foreign key: the
  -- catalogue lives in a file that ships with the app, not in this database.
  catalogue_id text not null,

  on_hand integer not null default 0 check (on_hand >= 0),
  reorder integer not null default 0 check (reorder >= 0),
  batch text,
  expiry date,
  shelf text,
  cost numeric(12, 2) check (cost is null or cost >= 0),
  price numeric(12, 2) check (price is null or price >= 0),
  counted_at date,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One line per product per batch per branch. Receiving the same batch again
  -- adds to the line that exists rather than creating a second one.
  unique (branch_id, catalogue_id, batch)
);

create index if not exists stock_lines_org_idx on public.stock_lines (organization_id);
create index if not exists stock_lines_expiry_idx on public.stock_lines (organization_id, expiry);
create index if not exists stock_lines_catalogue_idx on public.stock_lines (organization_id, catalogue_id);

alter table public.stock_lines enable row level security;

drop policy if exists "read own stock" on public.stock_lines;
create policy "read own stock" on public.stock_lines
  for select using (organization_id = public.current_organization_id());

drop policy if exists "write own stock" on public.stock_lines;
create policy "write own stock" on public.stock_lines
  for all
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

create or replace function public.touch_stock_line()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists stock_lines_touch on public.stock_lines;
create trigger stock_lines_touch
  before update on public.stock_lines
  for each row execute function public.touch_stock_line();

-- ── Receiving stock ─────────────────────────────────────────────────────────
-- One call per imported row. Receiving is additive by batch, because that is
-- what actually happens at a goods-in door: the same batch arriving twice is
-- more of the same stock, not a second shelf entry.

create or replace function public.receive_stock(
  p_catalogue_id text,
  p_quantity integer,
  p_batch text default null,
  p_expiry date default null,
  p_shelf text default null,
  p_reorder integer default null,
  p_cost numeric default null,
  p_price numeric default null,
  p_branch uuid default null
)
returns public.stock_lines
language plpgsql
security definer
set search_path = public
as $$
declare
  org uuid := public.current_organization_id();
  target_branch uuid;
  row public.stock_lines;
begin
  if org is null then
    raise exception 'Join an organisation before receiving stock.';
  end if;
  if coalesce(trim(p_catalogue_id), '') = '' then
    raise exception 'A stock line needs a catalogue product.';
  end if;
  if p_quantity is null or p_quantity < 0 then
    raise exception 'Quantity must be zero or more.';
  end if;

  target_branch := coalesce(
    (select b.id from public.branches b where b.id = p_branch and b.organization_id = org),
    (select b.id from public.branches b where b.organization_id = org order by b.is_primary desc, b.name limit 1)
  );

  if target_branch is null then
    raise exception 'This organisation has no branch to receive stock into.';
  end if;

  insert into public.stock_lines as s (
    organization_id, branch_id, catalogue_id, on_hand, reorder,
    batch, expiry, shelf, cost, price, counted_at
  )
  values (
    org, target_branch, trim(p_catalogue_id), p_quantity, coalesce(p_reorder, 0),
    nullif(trim(coalesce(p_batch, '')), ''), p_expiry, nullif(trim(coalesce(p_shelf, '')), ''),
    p_cost, p_price, current_date
  )
  on conflict (branch_id, catalogue_id, batch) do update set
    on_hand = s.on_hand + excluded.on_hand,
    reorder = greatest(s.reorder, excluded.reorder),
    expiry = coalesce(excluded.expiry, s.expiry),
    shelf = coalesce(excluded.shelf, s.shelf),
    cost = coalesce(excluded.cost, s.cost),
    price = coalesce(excluded.price, s.price),
    counted_at = current_date
  returning * into row;

  return row;
end;
$$;

revoke all on function public.receive_stock(text, integer, text, date, text, integer, numeric, numeric, uuid) from public;
grant execute on function public.receive_stock(text, integer, text, date, text, integer, numeric, numeric, uuid) to authenticated;

-- The demo reset has one more table to clear.
create or replace function public.reset_demo_organization()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  org uuid := public.current_organization_id();
  removed integer := 0;
  n integer;
begin
  if org is null or not public.is_demo_organization(org) then
    raise exception 'Only the demo organisation can be reset.';
  end if;

  delete from public.stock_lines where organization_id = org;
  get diagnostics n = row_count; removed := removed + n;

  delete from public.prescription_items pi
   using public.prescriptions p
   where pi.prescription_id = p.id and p.organization_id = org;

  delete from public.inventory_movements where organization_id = org;
  get diagnostics n = row_count; removed := removed + n;

  delete from public.prescriptions where organization_id = org;
  get diagnostics n = row_count; removed := removed + n;

  delete from public.inventory_batches where organization_id = org;
  get diagnostics n = row_count; removed := removed + n;

  delete from public.products where organization_id = org;
  get diagnostics n = row_count; removed := removed + n;

  delete from public.patients where organization_id = org;
  get diagnostics n = row_count; removed := removed + n;

  delete from public.audit_logs where organization_id = org;
  get diagnostics n = row_count; removed := removed + n;

  delete from public.invitations where organization_id = org;
  get diagnostics n = row_count; removed := removed + n;

  delete from public.staff_profiles
   where organization_id = org
     and id <> public.clerk_user_id();
  get diagnostics n = row_count; removed := removed + n;

  update public.organizations
     set name = 'Demo Pharmacy',
         legal_name = 'Demo Pharmacy (Private) Limited',
         ntn = 'NTN 0000000-0',
         drap_licence = 'DRAP-RP-DEMO-0001',
         address = '14-C Main Boulevard, Gulberg III, Lahore 54660',
         phone = '+92 42 111 723 723',
         email = 'demo@dispensia.app',
         currency = 'PKR',
         tax_note = 'Demonstration data. Prices include GST where applicable.'
   where id = org;

  delete from public.branches where organization_id = org;
  get diagnostics n = row_count; removed := removed + n;

  insert into public.branches (organization_id, name, city, address, phone, licence, hours, is_primary)
  values
    (org, 'Main Branch',  'Lahore', '14-C Main Boulevard, Gulberg III, Lahore', '+92 42 111 723 723', 'DRAP-RP-LHR-04412', '09:00 – 23:00, seven days', true),
    (org, 'Johar Town',   'Lahore', 'Block G1, Johar Town, Lahore',             '+92 42 111 723 724', 'DRAP-RP-LHR-05180', '09:00 – 22:00, seven days', false),
    (org, 'DHA Phase 5',  'Lahore', 'Commercial Broadway, DHA Phase 5, Lahore', '+92 42 111 723 725', 'DRAP-RP-LHR-05902', '10:00 – 00:00, seven days', false);

  update public.staff_profiles
     set branch_id = (
           select b.id from public.branches b
           where b.organization_id = org
           order by b.is_primary desc, b.name
           limit 1
         ),
         role = 'owner'
   where organization_id = org;

  return format('Demo reset. %s added record(s) removed; 3 branches restored.', removed);
end;
$$;

grant execute on function public.reset_demo_organization() to authenticated;
