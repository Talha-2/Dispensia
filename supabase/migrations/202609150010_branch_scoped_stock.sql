-- Stock and the register belong to a branch, not just to a pharmacy.
--
-- stock_lines and register_entries already carried branch_id, but nothing used
-- it: receiving always went to the primary branch, and dispensing took from
-- whichever line happened to sort first across the whole organisation. A
-- three-branch pharmacy therefore had one shelf pretending to be three.
--
-- That is wrong in a way that matters. A controlled-drug register is kept per
-- registered site — each branch has its own DRAP licence, and an inspector
-- asks that site for that site's book. A balance that mixes three shops is not
-- a defence.

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
      where p.id = public.clerk_user_id()
        and p.organization_id = public.current_organization_id()
        and p.active
      limit 1
    ),
    (
      select b.id
      from public.branches b
      where b.organization_id = public.current_organization_id()
      order by b.is_primary desc, b.name
      limit 1
    )
  );
$$;

grant execute on function public.current_branch_id() to authenticated;

-- Receiving goes to the branch you are standing in unless told otherwise.
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
    (select b.id from public.branches b where b.id = p_branch and b.organization_id = org),
    public.current_branch_id()
  );

  if target_branch is null then
    raise exception 'This organisation has no branch to receive stock into.';
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

-- Dispensing takes from the shelf you are standing at, and writes that
-- branch's register.
create or replace function public.dispense_basket(
  p_lines jsonb,
  p_patient uuid default null,
  p_patient_name text default 'Walk-in',
  p_mrn text default null,
  p_overrides text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  org uuid := public.current_organization_id();
  branch uuid := public.current_branch_id();
  me text := public.clerk_user_id();
  my_name text;
  line jsonb;
  cat_id text;
  qty integer;
  is_controlled boolean;
  stock_row public.stock_lines;
  remaining integer;
  taken integer := 0;
  short integer := 0;
  entries integer := 0;
begin
  if org is null then
    raise exception 'Join an organisation before dispensing.';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'Nothing to dispense.';
  end if;

  select full_name into my_name
    from public.staff_profiles where id = me and organization_id = org;

  for line in select * from jsonb_array_elements(p_lines)
  loop
    cat_id := line ->> 'catalogue_id';
    qty := coalesce((line ->> 'qty')::integer, 0);
    is_controlled := coalesce((line ->> 'controlled')::boolean, false);

    if cat_id is null or qty < 1 then
      continue;
    end if;

    -- This branch's shelf only, oldest batch first. Taking from another site's
    -- stock would make both balances wrong at once.
    select * into stock_row
      from public.stock_lines
     where organization_id = org
       and branch_id = branch
       and catalogue_id = cat_id
       and on_hand >= qty
     order by expiry nulls last
     limit 1;

    if stock_row.id is not null then
      update public.stock_lines
         set on_hand = on_hand - qty
       where id = stock_row.id
      returning on_hand into remaining;
      taken := taken + 1;
    else
      remaining := 0;
      short := short + 1;
    end if;

    if is_controlled then
      insert into public.register_entries (
        organization_id, branch_id, catalogue_id, brand, strength, molecule,
        patient_id, patient_name, mrn, quantity, balance_after,
        pharmacist, pharmacist_id, override_reason
      )
      values (
        org, branch, cat_id,
        coalesce(line ->> 'brand', cat_id),
        nullif(trim(coalesce(line ->> 'strength', '')), ''),
        coalesce(line ->> 'molecule', '—'),
        p_patient,
        coalesce(nullif(trim(coalesce(p_patient_name, '')), ''), 'Walk-in'),
        nullif(trim(coalesce(p_mrn, '')), ''),
        qty, coalesce(remaining, 0),
        coalesce(nullif(trim(coalesce(my_name, '')), ''), public.clerk_email(), 'Unknown'),
        me, nullif(trim(coalesce(p_overrides, '')), '')
      );
      entries := entries + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'stock_lines_taken', taken,
    'lines_not_in_stock', short,
    'register_entries', entries,
    'branch_id', branch
  );
end;
$$;

grant execute on function public.dispense_basket(jsonb, uuid, text, text, text) to authenticated;
