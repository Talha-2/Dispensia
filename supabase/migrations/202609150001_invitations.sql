-- Invitations.
--
-- An organisation is created by one person, and a pharmacy is not one person.
-- This is how the second one gets in.
--
-- The design constraint that shapes everything here: an invitee is, by
-- definition, not yet a member of the organisation inviting them, so none of
-- the tenant policies can see them. The token is therefore the credential —
-- and because a token is a credential, it is never listed back to anybody but
-- the organisation that issued it, it expires, and it can only be redeemed by
-- an account whose own verified email matches the address it was sent to.

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  email text not null,
  role public.staff_role not null default 'technician',
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz
);

-- One live invitation per address per organisation. Re-inviting replaces
-- rather than accumulates, so a revoked or expired row never blocks a resend.
create unique index if not exists invitations_live_email_idx
  on public.invitations (organization_id, lower(email))
  where accepted_at is null and revoked_at is null;

create index if not exists invitations_org_idx on public.invitations (organization_id, created_at desc);

alter table public.invitations enable row level security;

-- The issuing organisation sees its own invitations. The invitee does not read
-- this table at all — they arrive with a token, and the functions below answer
-- for them. That keeps the token out of every listing an invitee could reach.
drop policy if exists "manage own invitations" on public.invitations;
create policy "manage own invitations" on public.invitations
  for all
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

-- ── Issuing ─────────────────────────────────────────────────────────────────
-- Only an owner or admin may invite, and never into the demo tenant.

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

  if public.is_demo_organization(org) then
    raise exception 'The demo organisation does not take invitations.';
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

  -- Supersede any invitation still outstanding for this address.
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
  select role into my_role from public.staff_profiles where id = auth.uid();
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

-- ── Redeeming ───────────────────────────────────────────────────────────────

-- What the invite screen may show before anybody signs in: who invited you and
-- as what. Never the token, never anything about the organisation's data.
create or replace function public.peek_invitation(invite_token text)
returns table (organization_name text, role public.staff_role, email text, expired boolean, claimed boolean)
language sql
stable
security definer
set search_path = public
as $$
  select
    o.name,
    i.role,
    i.email,
    (i.expires_at < now() or i.revoked_at is not null),
    (i.accepted_at is not null)
  from public.invitations i
  join public.organizations o on o.id = i.organization_id
  where i.token = invite_token;
$$;

create or replace function public.accept_invitation(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  me record;
  inv public.invitations;
begin
  if uid is null then
    raise exception 'Sign in to accept an invitation.';
  end if;

  select email, email_confirmed_at into me from auth.users where id = uid;

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

  -- The token alone is not enough. It was sent to one address, and only the
  -- account that proved it owns that address may redeem it — otherwise a
  -- forwarded link is a way into somebody else's pharmacy.
  if lower(me.email) <> lower(inv.email) then
    raise exception 'This invitation was sent to %. Sign in as that address to accept it.', inv.email;
  end if;
  if me.email_confirmed_at is null then
    raise exception 'Confirm your email address before accepting an invitation.';
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
    coalesce(
      nullif(trim((select raw_user_meta_data ->> 'full_name' from auth.users where id = uid)), ''),
      me.email
    ),
    inv.role,
    me.email
  );

  update public.invitations
     set accepted_at = now(), accepted_by = uid
   where id = inv.id;

  return inv.organization_id;
end;
$$;

revoke all on function public.invite_member(text, public.staff_role, uuid) from public;
revoke all on function public.revoke_invitation(uuid) from public;
revoke all on function public.accept_invitation(text) from public;
revoke all on function public.peek_invitation(text) from public;

grant execute on function public.invite_member(text, public.staff_role, uuid) to authenticated;
grant execute on function public.revoke_invitation(uuid) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
-- Anonymous, deliberately: the invite page has to say who invited you before
-- you have an account to sign in with.
grant execute on function public.peek_invitation(text) to anon, authenticated;
