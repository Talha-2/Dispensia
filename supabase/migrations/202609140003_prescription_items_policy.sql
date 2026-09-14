-- prescription_items had row-level security enabled and no policy, which is
-- deny-all: the lines of a prescription were unreachable even to the pharmacy
-- that wrote them.
--
-- The table carries no organization_id of its own — a line belongs to a
-- prescription, and the prescription belongs to the tenant — so the scope is
-- resolved through the parent rather than duplicated onto the child, where it
-- could drift out of agreement with it.

drop policy if exists "read own prescription items" on public.prescription_items;
create policy "read own prescription items" on public.prescription_items
  for select using (
    exists (
      select 1 from public.prescriptions p
      where p.id = prescription_items.prescription_id
        and p.organization_id = public.current_organization_id()
    )
  );

drop policy if exists "write own prescription items" on public.prescription_items;
create policy "write own prescription items" on public.prescription_items
  for all
  using (
    exists (
      select 1 from public.prescriptions p
      where p.id = prescription_items.prescription_id
        and p.organization_id = public.current_organization_id()
    )
  )
  with check (
    exists (
      select 1 from public.prescriptions p
      where p.id = prescription_items.prescription_id
        and p.organization_id = public.current_organization_id()
    )
  );

-- Adding a colleague to your own organisation. The read policy already scopes
-- staff_profiles to the tenant; without these an owner could never invite
-- anybody, because create_organization() only ever writes the first profile.
drop policy if exists "manage own organization staff" on public.staff_profiles;
create policy "manage own organization staff" on public.staff_profiles
  for all
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

-- Branches, likewise: a tenant opens its own.
drop policy if exists "manage own branches" on public.branches;
create policy "manage own branches" on public.branches
  for all
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

-- The organisation's own record is editable by its members and by nobody else.
-- The demo tenant is deliberately excluded: it is readable by everyone, so a
-- visitor being able to rename it would rename it for everybody.
drop policy if exists "update own organization" on public.organizations;
create policy "update own organization" on public.organizations
  for update
  using (id = public.current_organization_id() and not is_demo)
  with check (id = public.current_organization_id() and not is_demo);
