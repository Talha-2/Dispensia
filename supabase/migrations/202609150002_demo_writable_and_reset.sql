-- The demo stops being a showroom you can look at and becomes a pharmacy you
-- can actually run.
--
-- Before this, Demo Pharmacy was readable by every signed-in account and
-- writable by none, so a visitor could not add a branch, invite anybody or
-- correct the trading name — which meant the demo could not exercise the half
-- of the product that matters. It is now an ordinary tenant in every respect
-- but two: you reach it with its own credentials rather than by having no
-- organisation, and it can be reset to the state it was seeded in.

-- ── Reached by credentials, not by default ──────────────────────────────────
-- Dropping `or is_demo` from the read policies: an account that belongs to a
-- real pharmacy has no business seeing the demo's data alongside its own.

drop policy if exists "read own organization" on public.organizations;
create policy "read own organization" on public.organizations
  for select using (id = public.current_organization_id());

drop policy if exists "staff can read organization branches" on public.branches;
create policy "staff can read organization branches" on public.branches
  for select using (organization_id = public.current_organization_id());

-- ── Writable like any other tenant ──────────────────────────────────────────
-- The demo carve-out goes. Its members edit it exactly as a real pharmacy
-- edits its own, and the reset below is what makes that safe.

drop policy if exists "update own organization" on public.organizations;
create policy "update own organization" on public.organizations
  for update
  using (id = public.current_organization_id())
  with check (id = public.current_organization_id());

-- Inviting into the demo is now allowed; it is a tenant like any other.
create or replace function public.invite_member(
  invite_email text,
  invite_role public.staff_role default 'technician',
  invite_branch uuid default null
)
returns public.invitations
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  org uuid := public.current_organization_id();
  my_role public.staff_role;
  row public.invitations;
begin
  if uid is null or org is null then
    raise exception 'Create or join an organisation before inviting anybody.';
  end if;

  select role into my_role from public.staff_profiles where id = uid;
  if my_role not in ('owner', 'admin') then
    raise exception 'Only an owner or admin may invite staff.';
  end if;

  if invite_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'That is not a valid email address.';
  end if;

  if exists (
    select 1 from public.staff_profiles p
    where p.organization_id = org and lower(p.email) = lower(trim(invite_email))
  ) then
    raise exception 'That address is already on the team.';
  end if;

  update public.invitations
     set revoked_at = now()
   where organization_id = org
     and lower(email) = lower(trim(invite_email))
     and accepted_at is null
     and revoked_at is null;

  insert into public.invitations (organization_id, branch_id, email, role, invited_by)
  values (org, invite_branch, lower(trim(invite_email)), invite_role, uid)
  returning * into row;

  return row;
end;
$$;

-- ── The demo account is a member, and its owner ─────────────────────────────
-- Without a staff profile the demo account had no organisation at all, which
-- is what made everything read-only.

insert into public.staff_profiles (id, organization_id, branch_id, full_name, role, email)
select
  u.id,
  o.id,
  (select b.id from public.branches b where b.organization_id = o.id order by b.is_primary desc, b.name limit 1),
  'Demo Pharmacist',
  'owner',
  u.email
from auth.users u
cross join public.organizations o
where u.email = 'demo@dispensia.app'
  and o.slug = 'demo'
on conflict (id) do update
  set organization_id = excluded.organization_id,
      role = 'owner',
      branch_id = excluded.branch_id;

-- ── Reset ───────────────────────────────────────────────────────────────────
-- Everything the demo's visitors add is undone; the seed is put back exactly.
-- Only a member of the demo tenant may call it, and it can touch nothing else,
-- because every statement is scoped to the demo organisation's own id.

create or replace function public.reset_demo_organization()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  org uuid := public.current_organization_id();
  demo_user uuid;
  removed integer := 0;
  n integer;
begin
  if org is null or not public.is_demo_organization(org) then
    raise exception 'Only the demo organisation can be reset.';
  end if;

  select id into demo_user from auth.users where email = 'demo@dispensia.app';

  -- Working data first. prescription_items goes through its parent, and
  -- inventory_movements through its batch, so both are cleared explicitly
  -- before the rows they hang off.
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

  -- Everyone who joined the demo loses their membership, so the next visitor
  -- does not inherit a roster somebody else invented. The demo account itself
  -- stays, because it is how anybody gets back in.
  delete from public.staff_profiles
   where organization_id = org
     and (demo_user is null or id <> demo_user);
  get diagnostics n = row_count; removed := removed + n;

  -- The organisation's own record, back to what it was seeded as.
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

  -- Branches: drop whatever is there and lay the three seeded ones back down.
  -- staff_profiles.branch_id is ON DELETE SET NULL, so the demo account is
  -- reattached to the primary branch afterwards.
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
         role = 'owner',
         full_name = 'Demo Pharmacist'
   where organization_id = org;

  return format('Demo reset. %s added record(s) removed; 3 branches restored.', removed);
end;
$$;

revoke all on function public.reset_demo_organization() from public;
grant execute on function public.reset_demo_organization() to authenticated;
