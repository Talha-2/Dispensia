-- Patients and the controlled-drug register become the organisation's own.
--
-- The catalogue is the only dataset a new pharmacy inherits, because it is the
-- only one that is not theirs to begin with: what a medicine is, which molecule
-- it carries, its AWaRe class and its interactions are facts about medicine.
-- Everything else on these screens — who the patients are, what was dispensed,
-- what the shelf holds — is a record of what *this* pharmacy did, and a
-- pharmacy that has just opened has done none of it.
--
-- So a new organisation now opens patients, the register, the counter's feed
-- and every count on the dashboard empty.

-- ── Patients ────────────────────────────────────────────────────────────────
-- The table existed but could not hold what the safety engine reads. Age and
-- sex in particular are load-bearing: the paediatric blocks, the teratogen gate
-- and the reproductive-age ACEi check cannot fire without them, and a record
-- missing them silently disarms half the rule book.

alter table public.patients
  add column if not exists age integer check (age is null or (age >= 0 and age <= 130)),
  add column if not exists sex text check (sex is null or sex in ('f', 'm')),
  add column if not exists phone text,
  add column if not exists prescriber text,
  add column if not exists conditions text[] not null default '{}',
  add column if not exists notes text,
  add column if not exists last_visit date,
  add column if not exists created_by text;

-- ── The controlled-drug register ────────────────────────────────────────────
-- Append-only by design: a correction is a new line, never an edit to an old
-- one. That is enforced here rather than trusted to the UI — there is an insert
-- policy and a select policy, and deliberately no update or delete.

create table if not exists public.register_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,

  catalogue_id text not null,
  brand text not null,
  strength text,
  molecule text not null,

  patient_id uuid references public.patients(id) on delete set null,
  patient_name text not null,
  mrn text,

  quantity integer not null check (quantity > 0),
  balance_after integer not null check (balance_after >= 0),

  pharmacist text not null,
  pharmacist_id text,
  override_reason text,

  entered_at timestamptz not null default now()
);

create index if not exists register_entries_org_idx
  on public.register_entries (organization_id, entered_at desc);

alter table public.register_entries enable row level security;

drop policy if exists "read own register" on public.register_entries;
create policy "read own register" on public.register_entries
  for select using (organization_id = public.current_organization_id());

-- Insert only. No update, no delete: the register is a legal record, and the
-- absence of those policies is what makes "append-only" true rather than a
-- promise the interface makes on the database's behalf.
drop policy if exists "append to own register" on public.register_entries;
create policy "append to own register" on public.register_entries
  for insert with check (organization_id = public.current_organization_id());

-- ── Writing an entry ────────────────────────────────────────────────────────
-- Takes the quantity off the shelf and records the balance in one transaction,
-- so the ledger and the stock can never disagree about what happened.

create or replace function public.record_controlled_supply(
  p_catalogue_id text,
  p_brand text,
  p_molecule text,
  p_patient_name text,
  p_quantity integer,
  p_strength text default null,
  p_patient uuid default null,
  p_mrn text default null,
  p_override text default null,
  p_batch text default null
)
returns public.register_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  org uuid := public.current_organization_id();
  me text := public.clerk_user_id();
  my_name text;
  my_licence text;
  line public.stock_lines;
  remaining integer;
  row public.register_entries;
begin
  if org is null then
    raise exception 'Join an organisation before dispensing.';
  end if;
  if p_quantity is null or p_quantity < 1 then
    raise exception 'A register entry needs a quantity of at least one.';
  end if;

  select full_name, pharmacist_licence into my_name, my_licence
    from public.staff_profiles where id = me;

  -- Take it off the shelf first. A specific batch if one was named, otherwise
  -- the line that expires soonest, which is what a pharmacist reaches for.
  select * into line
    from public.stock_lines
   where organization_id = org
     and catalogue_id = p_catalogue_id
     and (p_batch is null or batch = p_batch)
     and on_hand >= p_quantity
   order by expiry nulls last
   limit 1;

  if line.id is not null then
    update public.stock_lines
       set on_hand = on_hand - p_quantity
     where id = line.id
    returning on_hand into remaining;
  else
    -- Nothing on the shelf to take it from. The supply is still recorded,
    -- because the register documents what left the counter, not what the
    -- stock system believed was there.
    remaining := 0;
  end if;

  insert into public.register_entries (
    organization_id, branch_id, catalogue_id, brand, strength, molecule,
    patient_id, patient_name, mrn, quantity, balance_after,
    pharmacist, pharmacist_id, override_reason
  )
  values (
    org,
    coalesce(line.branch_id, (select b.id from public.branches b where b.organization_id = org order by b.is_primary desc, b.name limit 1)),
    p_catalogue_id, p_brand, nullif(trim(coalesce(p_strength, '')), ''), p_molecule,
    p_patient, p_patient_name, nullif(trim(coalesce(p_mrn, '')), ''),
    p_quantity, coalesce(remaining, 0),
    coalesce(nullif(trim(coalesce(my_name, '')), ''), public.clerk_email(), 'Unknown'),
    me, nullif(trim(coalesce(p_override, '')), '')
  )
  returning * into row;

  return row;
end;
$$;

revoke all on function public.record_controlled_supply(text, text, text, text, integer, text, uuid, text, text, text) from public;
grant execute on function public.record_controlled_supply(text, text, text, text, integer, text, uuid, text, text, text) to authenticated;

-- ── The demo reset clears these too ─────────────────────────────────────────

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

  delete from public.register_entries where organization_id = org;
  get diagnostics n = row_count; removed := removed + n;

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
