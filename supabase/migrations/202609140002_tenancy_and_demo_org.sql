-- Dispensia is a product, not one pharmacy's install. This migration turns the
-- schema into a real multi-tenant one: anybody can sign up, create their own
-- organisation, and see nothing but their own. It also seeds a single shared
-- "Demo Pharmacy" tenant that every signed-in user may read but nobody may
-- write, so the whole product can be exercised before a real org exists.

-- ── The tenant's own identity ───────────────────────────────────────────────
-- A receipt has to name the organisation that issued it, with the tax number
-- and licence a regulator would ask for. None of that fitted in `name`.
alter table public.organizations
  add column if not exists slug text,
  add column if not exists legal_name text,
  add column if not exists ntn text,
  add column if not exists drap_licence text,
  add column if not exists address text,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists currency text not null default 'PKR',
  add column if not exists tax_note text not null default 'Prices include GST where applicable.',
  add column if not exists is_demo boolean not null default false,
  add column if not exists created_by uuid references auth.users(id) on delete set null;

create unique index if not exists organizations_slug_key on public.organizations (slug);

-- Only one tenant may ever be the shared demo.
create unique index if not exists organizations_single_demo_idx
  on public.organizations ((true)) where is_demo;

alter table public.branches
  add column if not exists city text,
  add column if not exists phone text,
  add column if not exists licence text,
  add column if not exists hours text,
  add column if not exists is_primary boolean not null default false;

-- ── Roles ───────────────────────────────────────────────────────────────────
-- The 'owner' and 'cashier' enum values are added in 202609140001, which must
-- run first: a new enum value cannot be used in the transaction that adds it.
alter table public.staff_profiles
  add column if not exists email text,
  add column if not exists pharmacist_licence text;

-- ── Who am I ────────────────────────────────────────────────────────────────

create or replace function public.is_demo_organization(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.organizations where id = target and is_demo);
$$;

-- ── Reading ─────────────────────────────────────────────────────────────────
-- Your own organisation, plus the demo tenant. Nothing else, ever.

drop policy if exists "read own organization" on public.organizations;
create policy "read own organization" on public.organizations
  for select using (id = public.current_organization_id() or is_demo);

drop policy if exists "staff can read organization branches" on public.branches;
create policy "staff can read organization branches" on public.branches
  for select using (
    organization_id = public.current_organization_id()
    or public.is_demo_organization(organization_id)
  );

drop policy if exists "read own staff profile" on public.staff_profiles;
create policy "read own staff profile" on public.staff_profiles
  for select using (
    id = auth.uid() or organization_id = public.current_organization_id()
  );

-- ── Writing ─────────────────────────────────────────────────────────────────
-- Tenant data is writable by its own staff. The demo tenant is explicitly
-- excluded: it is a showroom, and one visitor must not be able to change what
-- the next one sees.

do $$
declare
  t text;
begin
  foreach t in array array[
    'patients', 'products', 'inventory_batches',
    'prescriptions', 'inventory_movements', 'audit_logs'
  ]
  loop
    execute format('drop policy if exists "write own %1$s" on public.%1$I', t);
    execute format($p$
      create policy "write own %1$s" on public.%1$I
        for all
        using (organization_id = public.current_organization_id())
        with check (organization_id = public.current_organization_id())
    $p$, t);
  end loop;
end
$$;

-- ── Onboarding ──────────────────────────────────────────────────────────────
-- Creating an organisation is the one write that cannot be policy-gated by
-- membership, because the caller is not a member of anything yet. It runs as a
-- definer function so the rules stay explicit and in one place: you must be
-- signed in, and you must not already belong to an organisation.

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
  uid uuid := auth.uid();
  new_org uuid;
  new_branch uuid;
  base_slug text;
  candidate text;
  suffix integer := 0;
begin
  if uid is null then
    raise exception 'Sign in before creating an organisation.';
  end if;

  if exists (select 1 from public.staff_profiles where id = uid) then
    raise exception 'This account already belongs to an organisation.';
  end if;

  if coalesce(trim(org_name), '') = '' then
    raise exception 'An organisation needs a name.';
  end if;

  -- A readable, unique handle for the tenant.
  base_slug := trim(both '-' from regexp_replace(lower(trim(org_name)), '[^a-z0-9]+', '-', 'g'));
  if base_slug = '' then
    base_slug := 'pharmacy';
  end if;
  candidate := base_slug;
  while exists (select 1 from public.organizations where slug = candidate) loop
    suffix := suffix + 1;
    candidate := base_slug || '-' || suffix;
  end loop;

  insert into public.organizations (
    name, slug, legal_name, ntn, drap_licence, address, phone,
    email, created_by
  )
  values (
    trim(org_name), candidate, nullif(trim(coalesce(legal_name, '')), ''),
    nullif(trim(coalesce(ntn, '')), ''), nullif(trim(coalesce(drap_licence, '')), ''),
    nullif(trim(coalesce(address, '')), ''), nullif(trim(coalesce(phone, '')), ''),
    (select email from auth.users where id = uid), uid
  )
  returning id into new_org;

  insert into public.branches (organization_id, name, address, city, phone, licence, is_primary)
  values (
    new_org, coalesce(nullif(trim(coalesce(branch_name, '')), ''), 'Main Branch'),
    nullif(trim(coalesce(address, '')), ''), nullif(trim(coalesce(city, '')), ''),
    nullif(trim(coalesce(phone, '')), ''), nullif(trim(coalesce(drap_licence, '')), ''), true
  )
  returning id into new_branch;

  -- Whoever creates the organisation owns it.
  insert into public.staff_profiles (id, organization_id, branch_id, full_name, role, email)
  values (
    uid, new_org, new_branch,
    coalesce(
      nullif(trim(coalesce(full_name, '')), ''),
      (select coalesce(raw_user_meta_data ->> 'full_name', email) from auth.users where id = uid),
      'Owner'
    ),
    'owner',
    (select email from auth.users where id = uid)
  );

  return new_org;
end;
$$;

revoke all on function public.create_organization(text, text, text, text, text, text, text, text, text) from public;
grant execute on function public.create_organization(text, text, text, text, text, text, text, text, text) to authenticated;

-- ── The Demo tenant ─────────────────────────────────────────────────────────
-- Seeded once, readable by every signed-in user, writable by none. The counter,
-- catalogue, patients, register and reports all have something to run against
-- the moment somebody signs in, without touching anybody's real data.

insert into public.organizations (
  name, slug, legal_name, ntn, drap_licence, address, phone, email,
  currency, tax_note, is_demo
)
values (
  'Demo Pharmacy',
  'demo',
  'Demo Pharmacy (Private) Limited',
  'NTN 0000000-0',
  'DRAP-RP-DEMO-0001',
  '14-C Main Boulevard, Gulberg III, Lahore 54660',
  '+92 42 111 723 723',
  'demo@dispensia.app',
  'PKR',
  'Demonstration data. Prices include GST where applicable.',
  true
)
on conflict (slug) do update set
  is_demo = true,
  legal_name = excluded.legal_name,
  address = excluded.address;

insert into public.branches (organization_id, name, city, address, phone, licence, hours, is_primary)
select
  org.id, seed.name, seed.city, seed.address, seed.phone, seed.licence, seed.hours, seed.is_primary
from public.organizations org
cross join (
  values
    ('Main Branch',  'Lahore', '14-C Main Boulevard, Gulberg III, Lahore', '+92 42 111 723 723', 'DRAP-RP-LHR-04412', '09:00 – 23:00, seven days', true),
    ('Johar Town',   'Lahore', 'Block G1, Johar Town, Lahore',             '+92 42 111 723 724', 'DRAP-RP-LHR-05180', '09:00 – 22:00, seven days', false),
    ('DHA Phase 5',  'Lahore', 'Commercial Broadway, DHA Phase 5, Lahore', '+92 42 111 723 725', 'DRAP-RP-LHR-05902', '10:00 – 00:00, seven days', false)
) as seed(name, city, address, phone, licence, hours, is_primary)
where org.slug = 'demo'
  and not exists (
    select 1 from public.branches b
    where b.organization_id = org.id and b.name = seed.name
  );
