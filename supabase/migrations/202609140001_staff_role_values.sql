-- The product talks about owners and cashiers; the enum did not.
--
-- These live in a migration of their own because `alter type ... add value`
-- cannot be followed by a use of the new value in the same transaction. Keeping
-- them apart means the next migration is free to reference 'owner'.

alter type public.staff_role add value if not exists 'owner';
alter type public.staff_role add value if not exists 'cashier';
