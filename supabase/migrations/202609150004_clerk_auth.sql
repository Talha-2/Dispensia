-- Authentication moves from Supabase Auth to Clerk.
--
-- Postgres now validates Clerk's JWT against the Clerk JWKS, because the
-- instance is registered as a third-party auth provider on the project. Two
-- things follow, and both reach into every policy in this schema:
--
--   1. auth.uid() returns null. It parses the `sub` claim as a uuid, and a
--      Clerk subject is `user_2abc…`, which is not one. Identity now comes from
--      auth.jwt() ->> 'sub' and is text.
--   2. auth.users no longer holds the people using this product, so nothing may
--      reference it — not as a foreign key, and not as a place to look up the
--      email an invitation has to be matched against.
--
-- The second point is the one with teeth. accept_invitation() proved that the
-- redeeming account owned the invited address by reading auth.users.email. That
-- check is what stops a forwarded link being a way into somebody else's
-- pharmacy, so it is not dropped — it is moved onto Clerk's own verified email
-- claim, passed in by the caller and checked against the token.

-- ── Identity becomes text ───────────────────────────────────────────────────

-- Postgres refuses to retype a column a policy mentions, so the policies that
-- name staff_profiles.id come down first and go back up at the end.
drop policy if exists "read own staff profile" on public.staff_profiles;
drop policy if exists "manage own organization staff" on public.staff_profiles;

alter table public.staff_profiles drop constraint if exists staff_profiles_id_fkey;
alter table public.invitations drop constraint if exists invitations_invited_by_fkey;
alter table public.invitations drop constraint if exists invitations_accepted_by_fkey;
alter table public.inventory_movements drop constraint if exists inventory_movements_staff_id_fkey;
alter table public.audit_logs drop constraint if exists audit_logs_staff_id_fkey;
alter table public.prescriptions drop constraint if exists prescriptions_reviewed_by_fkey;
alter table public.prescriptions drop constraint if exists prescriptions_dispensed_by_fkey;
alter table public.organizations drop constraint if exists organizations_created_by_fkey;

alter table public.staff_profiles alter column id type text using id::text;
alter table public.invitations alter column invited_by type text using invited_by::text;
alter table public.invitations alter column accepted_by type text using accepted_by::text;
alter table public.inventory_movements alter column staff_id type text using staff_id::text;
alter table public.audit_logs alter column staff_id type text using staff_id::text;
alter table public.prescriptions alter column reviewed_by type text using reviewed_by::text;
alter table public.prescriptions alter column dispensed_by type text using dispensed_by::text;
alter table public.organizations alter column created_by type text using created_by::text;

-- The staff-profile references stay referential; only the identity provider
-- changed, not the shape of the relationship.
alter table public.inventory_movements
  add constraint inventory_movements_staff_id_fkey
  foreign key (staff_id) references public.staff_profiles(id) on delete set null;
alter table public.audit_logs
  add constraint audit_logs_staff_id_fkey
  foreign key (staff_id) references public.staff_profiles(id) on delete set null;
alter table public.prescriptions
  add constraint prescriptions_reviewed_by_fkey
  foreign key (reviewed_by) references public.staff_profiles(id) on delete set null;
alter table public.prescriptions
  add constraint prescriptions_dispensed_by_fkey
  foreign key (dispensed_by) references public.staff_profiles(id) on delete set null;

-- ── Who am I, under Clerk ───────────────────────────────────────────────────

create or replace function public.clerk_user_id()
returns text
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'sub', '');
$$;

-- Clerk puts the primary verified address in `email` on the session token when
-- the JWT template includes it. It is read here rather than trusted from the
-- client, so an invitation cannot be redeemed by claiming somebody else's
-- address.
create or replace function public.clerk_email()
returns text
language sql
stable
as $$
  select lower(nullif(coalesce(auth.jwt() ->> 'email', auth.jwt() -> 'user_metadata' ->> 'email'), ''));
$$;

create or replace function public.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id
  from public.staff_profiles
  where id = public.clerk_user_id() and active = true;
$$;

-- ── Onboarding ──────────────────────────────────────────────────────────────

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

  if exists (select 1 from public.staff_profiles where id = uid) then
    raise exception 'This account already belongs to an organisation.';
  end if;

  if coalesce(trim(org_name), '') = '' then
    raise exception 'An organisation needs a name.';
  end if;

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
    'owner',
    public.clerk_email()
  );

  return new_org;
end;
$$;

-- ── Invitations ─────────────────────────────────────────────────────────────

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
  uid text := public.clerk_user_id();
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

create or replace function public.revoke_invitation(invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  my_role public.staff_role;
begin
  select role into my_role from public.staff_profiles where id = public.clerk_user_id();
  if my_role not in ('owner', 'admin') then
    raise exception 'Only an owner or admin may revoke an invitation.';
  end if;

  update public.invitations
     set revoked_at = now()
   where id = invitation_id
     and organization_id = public.current_organization_id()
     and accepted_at is null;
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

  -- The token alone is not enough. It was issued to one address, and only an
  -- account Clerk has verified owns that address may redeem it — otherwise a
  -- forwarded link is a way into somebody else's pharmacy.
  if my_email is null then
    raise exception 'Your account has no verified email address, so this invitation cannot be matched to it.';
  end if;
  if my_email <> lower(inv.email) then
    raise exception 'This invitation was sent to %. Sign in as that address to accept it.', inv.email;
  end if;

  if exists (select 1 from public.staff_profiles where id = uid) then
    raise exception 'This account already belongs to an organisation.';
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

  return inv.organization_id;
end;
$$;

-- ── The demo reset ──────────────────────────────────────────────────────────
-- Its only tie to auth.users was finding the demo account to keep. Under Clerk
-- the demo profile is the one whose email is the demo address, which is a fact
-- this schema already holds.

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

  -- Everyone who joined the demo loses their membership. Whoever is running the
  -- reset keeps theirs, because they still need a way back in.
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

-- ── Policies that named auth.uid() directly ─────────────────────────────────

create policy "read own staff profile" on public.staff_profiles
  for select using (
    id = public.clerk_user_id() or organization_id = public.current_organization_id()
  );

create policy "manage own organization staff" on public.staff_profiles
  for all
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

-- ── Grants ──────────────────────────────────────────────────────────────────
-- Clerk-issued tokens arrive as the `authenticated` role.

grant execute on function public.clerk_user_id() to anon, authenticated;
grant execute on function public.clerk_email() to anon, authenticated;
grant execute on function public.create_organization(text, text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.invite_member(text, public.staff_role, uuid) to authenticated;
grant execute on function public.revoke_invitation(uuid) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
grant execute on function public.reset_demo_organization() to authenticated;

-- The demo profile is stale: it points at a Supabase auth user that no longer
-- authenticates anything. It is removed here and recreated when the demo
-- account signs in through Clerk.
delete from public.staff_profiles where lower(email) = 'demo@dispensia.app';
