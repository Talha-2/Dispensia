-- An account can belong to more than one pharmacy.
--
-- staff_profiles was keyed by the user alone, so a person *was* one
-- organisation: current_organization_id() read their single row, and every
-- policy in the schema resolved through it. That made "switch organisation"
-- impossible to offer honestly — there was only ever one to switch to — and it
-- made the demo reachable only by signing in as a different account.
--
-- Membership is now the pair (person, organisation), and which one they are
-- acting for is a separate, explicit choice. That separation matters: a
-- pharmacist locum who covers two shops must never be ambiguous about whose
-- register they are writing to.

-- ── Membership becomes a pair ───────────────────────────────────────────────

-- These referenced staff_profiles.id, which stops being unique.
alter table public.inventory_movements drop constraint if exists inventory_movements_staff_id_fkey;
alter table public.audit_logs drop constraint if exists audit_logs_staff_id_fkey;
alter table public.prescriptions drop constraint if exists prescriptions_reviewed_by_fkey;
alter table public.prescriptions drop constraint if exists prescriptions_dispensed_by_fkey;

drop policy if exists "read own staff profile" on public.staff_profiles;
drop policy if exists "manage own organization staff" on public.staff_profiles;

alter table public.staff_profiles drop constraint if exists staff_profiles_pkey;
alter table public.staff_profiles add primary key (id, organization_id);

create index if not exists staff_profiles_user_idx on public.staff_profiles (id);

-- ── Which organisation am I acting for ──────────────────────────────────────
-- Held per user rather than inferred, so switching is a deliberate act with a
-- record of itself rather than a side effect of ordering.

create table if not exists public.user_state (
  user_id text primary key,
  active_organization_id uuid references public.organizations(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.user_state enable row level security;

drop policy if exists "read own state" on public.user_state;
create policy "read own state" on public.user_state
  for select using (user_id = public.clerk_user_id());

-- Falls back to any active membership, so an account that has never switched
-- still resolves — and an account whose active organisation was deleted or
-- revoked drops to another rather than losing access to everything.
create or replace function public.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select s.active_organization_id
      from public.user_state s
      join public.staff_profiles p
        on p.id = public.clerk_user_id()
       and p.organization_id = s.active_organization_id
       and p.active
      where s.user_id = public.clerk_user_id()
    ),
    (
      select p.organization_id
      from public.staff_profiles p
      where p.id = public.clerk_user_id() and p.active
      order by p.created_at
      limit 1
    )
  );
$$;

create policy "read own staff profile" on public.staff_profiles
  for select using (
    id = public.clerk_user_id() or organization_id = public.current_organization_id()
  );

create policy "manage own organization staff" on public.staff_profiles
  for all
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

-- ── Switching ───────────────────────────────────────────────────────────────

create or replace function public.switch_organization(target uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid text := public.clerk_user_id();
begin
  if uid is null then
    raise exception 'Sign in first.';
  end if;

  -- You may only act for a pharmacy you are actually a member of. Without this
  -- the switcher would be a way to read any organisation by id.
  if not exists (
    select 1 from public.staff_profiles
    where id = uid and organization_id = target and active
  ) then
    raise exception 'You are not a member of that organisation.';
  end if;

  insert into public.user_state (user_id, active_organization_id, updated_at)
  values (uid, target, now())
  on conflict (user_id) do update
    set active_organization_id = excluded.active_organization_id,
        updated_at = now();

  return target;
end;
$$;

/** Everything this account may act for, with the one it is acting for marked. */
create or replace function public.my_organizations()
returns table (
  organization_id uuid,
  name text,
  is_demo boolean,
  role public.staff_role,
  branch_id uuid,
  is_active boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    o.id,
    o.name,
    o.is_demo,
    p.role,
    p.branch_id,
    o.id = public.current_organization_id()
  from public.staff_profiles p
  join public.organizations o on o.id = p.organization_id
  where p.id = public.clerk_user_id() and p.active
  order by o.is_demo, o.name;
$$;

-- ── Joining the demo ────────────────────────────────────────────────────────
-- The demo is a real tenant that anybody may join and that resets, so joining
-- it is a membership like any other rather than a special read-only mode. That
-- keeps one rule in the database instead of two.

create or replace function public.join_demo()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid text := public.clerk_user_id();
  demo uuid;
begin
  if uid is null then
    raise exception 'Sign in first.';
  end if;

  select id into demo from public.organizations where is_demo limit 1;
  if demo is null then
    raise exception 'There is no demo organisation on this deployment.';
  end if;

  insert into public.staff_profiles (id, organization_id, branch_id, full_name, role, email)
  values (
    uid,
    demo,
    (select b.id from public.branches b where b.organization_id = demo order by b.is_primary desc, b.name limit 1),
    coalesce(nullif(trim(coalesce(auth.jwt() ->> 'name', '')), ''), public.clerk_email(), 'Demo user'),
    'owner',
    public.clerk_email()
  )
  on conflict (id, organization_id) do update set active = true;

  perform public.switch_organization(demo);
  return demo;
end;
$$;

-- ── Membership checks that assumed one organisation ─────────────────────────

create or replace function public.create_organization(
  org_name text,
  branch_name text default 'Main Branch',
  full_name text default null,
  legal_name text default null,
  ntn text default null,
  drap_licence text default null,
  address text default null,
  phone text default null,
  city text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid text := public.clerk_user_id();
  new_org uuid;
  new_branch uuid;
  base_slug text;
  candidate text;
  suffix integer := 0;
begin
  if uid is null then
    raise exception 'Sign in before creating an organisation.';
  end if;
  if coalesce(trim(org_name), '') = '' then
    raise exception 'An organisation needs a name.';
  end if;

  base_slug := trim(both '-' from regexp_replace(lower(trim(org_name)), '[^a-z0-9]+', '-', 'g'));
  if base_slug = '' then base_slug := 'pharmacy'; end if;
  candidate := base_slug;
  while exists (select 1 from public.organizations where slug = candidate) loop
    suffix := suffix + 1;
    candidate := base_slug || '-' || suffix;
  end loop;

  insert into public.organizations (
    name, slug, legal_name, ntn, drap_licence, address, phone, email, created_by
  )
  values (
    trim(org_name), candidate, nullif(trim(coalesce(legal_name, '')), ''),
    nullif(trim(coalesce(ntn, '')), ''), nullif(trim(coalesce(drap_licence, '')), ''),
    nullif(trim(coalesce(address, '')), ''), nullif(trim(coalesce(phone, '')), ''),
    public.clerk_email(), uid
  )
  returning id into new_org;

  insert into public.branches (organization_id, name, address, city, phone, licence, is_primary)
  values (
    new_org, coalesce(nullif(trim(coalesce(branch_name, '')), ''), 'Main Branch'),
    nullif(trim(coalesce(address, '')), ''), nullif(trim(coalesce(city, '')), ''),
    nullif(trim(coalesce(phone, '')), ''), nullif(trim(coalesce(drap_licence, '')), ''), true
  )
  returning id into new_branch;

  insert into public.staff_profiles (id, organization_id, branch_id, full_name, role, email)
  values (
    uid, new_org, new_branch,
    coalesce(nullif(trim(coalesce(full_name, '')), ''), public.clerk_email(), 'Owner'),
    'owner', public.clerk_email()
  );

  -- A pharmacy you just created is the one you want to be in.
  perform public.switch_organization(new_org);
  return new_org;
end;
$$;

create or replace function public.accept_invitation(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid text := public.clerk_user_id();
  my_email text := public.clerk_email();
  inv public.invitations;
begin
  if uid is null then
    raise exception 'Sign in to accept an invitation.';
  end if;

  select * into inv from public.invitations where token = invite_token;
  if inv.id is null then
    raise exception 'That invitation link is not valid.';
  end if;
  if inv.accepted_at is not null then
    raise exception 'That invitation has already been used.';
  end if;
  if inv.revoked_at is not null or inv.expires_at < now() then
    raise exception 'That invitation has expired. Ask for a new one.';
  end if;

  if my_email is null then
    raise exception 'Your account has no verified email address, so this invitation cannot be matched to it.';
  end if;
  if my_email <> lower(inv.email) then
    raise exception 'This invitation was sent to %. Sign in as that address to accept it.', inv.email;
  end if;

  -- Only this organisation is a duplicate now; belonging elsewhere is fine.
  if exists (
    select 1 from public.staff_profiles
    where id = uid and organization_id = inv.organization_id
  ) then
    raise exception 'You already belong to that organisation.';
  end if;

  insert into public.staff_profiles (id, organization_id, branch_id, full_name, role, email)
  values (
    uid,
    inv.organization_id,
    coalesce(inv.branch_id, (
      select b.id from public.branches b
      where b.organization_id = inv.organization_id
      order by b.is_primary desc, b.name
      limit 1
    )),
    coalesce(nullif(trim(coalesce(auth.jwt() ->> 'name', '')), ''), my_email),
    inv.role,
    my_email
  );

  update public.invitations
     set accepted_at = now(), accepted_by = uid
   where id = inv.id;

  perform public.switch_organization(inv.organization_id);
  return inv.organization_id;
end;
$$;

-- ── Which branch am I on ────────────────────────────────────────────────────

create or replace function public.switch_branch(target uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid text := public.clerk_user_id();
  org uuid := public.current_organization_id();
begin
  if uid is null or org is null then
    raise exception 'Sign in first.';
  end if;

  if not exists (select 1 from public.branches where id = target and organization_id = org) then
    raise exception 'That branch belongs to another organisation.';
  end if;

  update public.staff_profiles
     set branch_id = target
   where id = uid and organization_id = org;

  return target;
end;
$$;

-- ── Resetting the demo no longer evicts the people in it ────────────────────
-- Memberships are kept: with multi-org, throwing somebody out of the demo also
-- switches them somewhere they did not ask to be.

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
         )
   where organization_id = org;

  return format('Demo reset. %s record(s) removed; 3 branches restored.', removed);
end;
$$;

grant execute on function public.switch_organization(uuid) to authenticated;
grant execute on function public.switch_branch(uuid) to authenticated;
grant execute on function public.my_organizations() to authenticated;
grant execute on function public.join_demo() to authenticated;
grant execute on function public.create_organization(text, text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
grant execute on function public.reset_demo_organization() to authenticated;
