-- Who may clear a clinical finding.
--
-- The counter used to gate an override behind a four-digit PIN that was a
-- constant in the browser bundle: the same digits for every pharmacy, readable
-- by anyone who opened the source, and attached to no particular person. An
-- override is a clinical act recorded against somebody, so the authority to
-- make one belongs to a role, and the role is read here rather than asserted by
-- the client.
--
-- Security definer because a technician must be able to learn that they may
-- not, which means reading a row their own policies would otherwise hide.

create or replace function public.can_override_findings()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.staff_profiles p
    where p.id = public.clerk_user_id()
      and p.organization_id = public.current_organization_id()
      and p.active
      and p.role in ('owner', 'admin', 'pharmacist')
  );
$$;

grant execute on function public.can_override_findings() to authenticated;
