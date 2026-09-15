-- The demo is browsable again without joining it.
--
-- 202609150002 made the demo a real, writable tenant and, in doing so, closed
-- it to anyone who was not a member. That went too far: somebody deciding
-- whether to register a pharmacy should be able to walk around a working one
-- first, and onboarding offers exactly that.
--
-- So reads open back up, and writes stay shut. The distinction is the point:
--
--   read   — your own organisation, plus the demo. Anyone may look.
--   write  — your own organisation only. current_organization_id() is null for
--            a visitor with no membership, so every write policy fails closed
--            for them without needing a demo carve-out of its own.
--
-- The demo account (demo@dispensia.app) has a staff profile in the demo tenant,
-- so for that account current_organization_id() *is* the demo — which is what
-- makes it fully editable when you sign in as it, and read-only to everyone
-- else looking around.

drop policy if exists "read own organization" on public.organizations;
create policy "read own organization" on public.organizations
  for select using (id = public.current_organization_id() or is_demo);

drop policy if exists "staff can read organization branches" on public.branches;
create policy "staff can read organization branches" on public.branches
  for select using (
    organization_id = public.current_organization_id()
    or public.is_demo_organization(organization_id)
  );
