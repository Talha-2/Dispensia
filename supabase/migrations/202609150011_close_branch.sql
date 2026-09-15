-- Closing a branch.
--
-- Not deleting one. A branch row is referenced by the controlled-drug register
-- (on delete set null) and by stock (on delete cascade), so removing it would
-- erase which site dispensed a controlled drug and silently destroy whatever
-- inventory that site held. Both are records somebody can be asked to produce
-- years later.
--
-- So a closed branch stays. It stops being somewhere you can stand — it leaves
-- the switcher, takes no deliveries and dispenses nothing — while its register
-- history remains exactly where it was.

alter table public.branches
  add column if not exists closed_at timestamptz;

create or replace function public.close_branch(target uuid, reopen boolean default false)
returns public.branches
language plpgsql
security definer
set search_path = public
as $$
declare
  org uuid := public.current_organization_id();
  my_role public.staff_role;
  branch public.branches;
  remaining integer;
  fallback uuid;
begin
  if org is null then
    raise exception 'Sign in to an organisation first.';
  end if;

  select role into my_role
    from public.staff_profiles
   where id = public.clerk_user_id() and organization_id = org;

  if my_role not in ('owner', 'admin') then
    raise exception 'Only an owner or admin may close a branch.';
  end if;

  select * into branch from public.branches where id = target and organization_id = org;
  if branch.id is null then
    raise exception 'That branch belongs to another organisation.';
  end if;

  if reopen then
    update public.branches set closed_at = null where id = target returning * into branch;
    return branch;
  end if;

  -- A pharmacy has to have somewhere to dispense from.
  if (
    select count(*) from public.branches
    where organization_id = org and closed_at is null
  ) <= 1 then
    raise exception 'This is the only open branch. A pharmacy needs at least one.';
  end if;

  if branch.is_primary then
    raise exception 'The primary branch cannot be closed. Make another branch primary first.';
  end if;

  -- Stock does not evaporate because a shop shut. It has to be moved or
  -- written off deliberately, by a person, before the door closes.
  select coalesce(sum(on_hand), 0) into remaining
    from public.stock_lines where branch_id = target;

  if remaining > 0 then
    raise exception 'That branch still holds % units. Move or write off its stock first.', remaining;
  end if;

  -- Anyone standing there is moved to the primary branch rather than left
  -- pointing at a site that no longer takes deliveries.
  select id into fallback
    from public.branches
   where organization_id = org and closed_at is null and id <> target
   order by is_primary desc, name
   limit 1;

  update public.staff_profiles
     set branch_id = fallback
   where organization_id = org and branch_id = target;

  update public.branches
     set closed_at = now()
   where id = target
  returning * into branch;

  return branch;
end;
$$;

revoke all on function public.close_branch(uuid, boolean) from public;
grant execute on function public.close_branch(uuid, boolean) to authenticated;

-- A closed branch is not somewhere you can stand.
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

  if not exists (
    select 1 from public.branches
    where id = target and organization_id = org and closed_at is null
  ) then
    raise exception 'That branch is closed, or belongs to another organisation.';
  end if;

  update public.staff_profiles
     set branch_id = target
   where id = uid and organization_id = org;

  return target;
end;
$$;

grant execute on function public.switch_branch(uuid) to authenticated;

-- Nor does it take deliveries.
create or replace function public.receive_stock(
  p_catalogue_id text,
  p_quantity integer,
  p_batch text default null,
  p_expiry date default null,
  p_shelf text default null,
  p_reorder integer default null,
  p_cost numeric default null,
  p_price numeric default null,
  p_branch uuid default null
)
returns public.stock_lines
language plpgsql
security definer
set search_path = public
as $$
declare
  org uuid := public.current_organization_id();
  target_branch uuid;
  row public.stock_lines;
begin
  if org is null then
    raise exception 'Join an organisation before receiving stock.';
  end if;
  if coalesce(trim(p_catalogue_id), '') = '' then
    raise exception 'A stock line needs a catalogue product.';
  end if;
  if p_quantity is null or p_quantity < 0 then
    raise exception 'Quantity must be zero or more.';
  end if;

  target_branch := coalesce(
    (
      select b.id from public.branches b
      where b.id = p_branch and b.organization_id = org and b.closed_at is null
    ),
    public.current_branch_id()
  );

  if target_branch is null then
    raise exception 'This organisation has no open branch to receive stock into.';
  end if;

  insert into public.stock_lines as s (
    organization_id, branch_id, catalogue_id, on_hand, reorder,
    batch, expiry, shelf, cost, price, counted_at
  )
  values (
    org, target_branch, trim(p_catalogue_id), p_quantity, coalesce(p_reorder, 0),
    nullif(trim(coalesce(p_batch, '')), ''), p_expiry, nullif(trim(coalesce(p_shelf, '')), ''),
    p_cost, p_price, current_date
  )
  on conflict (branch_id, catalogue_id, batch) do update set
    on_hand = s.on_hand + excluded.on_hand,
    reorder = greatest(s.reorder, excluded.reorder),
    expiry = coalesce(excluded.expiry, s.expiry),
    shelf = coalesce(excluded.shelf, s.shelf),
    cost = coalesce(excluded.cost, s.cost),
    price = coalesce(excluded.price, s.price),
    counted_at = current_date
  returning * into row;

  return row;
end;
$$;

grant execute on function public.receive_stock(text, integer, text, date, text, integer, numeric, numeric, uuid) to authenticated;

-- current_branch_id() must never hand back a closed site.
create or replace function public.current_branch_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select p.branch_id
      from public.staff_profiles p
      join public.branches b on b.id = p.branch_id and b.closed_at is null
      where p.id = public.clerk_user_id()
        and p.organization_id = public.current_organization_id()
        and p.active
      limit 1
    ),
    (
      select b.id
      from public.branches b
      where b.organization_id = public.current_organization_id()
        and b.closed_at is null
      order by b.is_primary desc, b.name
      limit 1
    )
  );
$$;

grant execute on function public.current_branch_id() to authenticated;
