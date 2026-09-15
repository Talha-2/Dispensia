-- The demo stops leaking into real organisations.
--
-- Reads allowed the demo unconditionally, so that somebody with no pharmacy of
-- their own could look around one. The side effect was that a real pharmacy saw
-- the demo's three branches listed beside its own — its Settings claimed four
-- branches, one of them somebody else's showroom.
--
-- The demo is for visitors, so the demo is visible only to visitors: an account
-- that belongs to an organisation sees exactly its own.

drop policy if exists "read own organization" on public.organizations;
create policy "read own organization" on public.organizations
  for select using (
    id = public.current_organization_id()
    or (public.current_organization_id() is null and is_demo)
  );

drop policy if exists "staff can read organization branches" on public.branches;
create policy "staff can read organization branches" on public.branches
  for select using (
    organization_id = public.current_organization_id()
    or (
      public.current_organization_id() is null
      and public.is_demo_organization(organization_id)
    )
  );
