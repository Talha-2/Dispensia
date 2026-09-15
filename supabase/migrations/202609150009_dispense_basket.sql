-- Closing a basket is one transaction.
--
-- Checkout printed a receipt and changed nothing: stock stayed where it was and
-- the controlled-drug register stayed empty, so the two records that a
-- pharmacy is actually inspected on had to be written by hand afterwards —
-- which is to say, they did not get written.
--
-- This does the whole thing at once. Per line it takes the quantity off the
-- shelf, and for anything register-bound it writes the statutory entry with the
-- balance that resulted. One transaction, because a register that disagrees
-- with the shelf is worse than either being missing: it is a document that says
-- something untrue about a controlled drug.

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
  branch uuid;
begin
  if org is null then
    raise exception 'Join an organisation before dispensing.';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'Nothing to dispense.';
  end if;

  select full_name into my_name
    from public.staff_profiles where id = me and organization_id = org;

  select b.id into branch
    from public.branches b
   where b.organization_id = org
   order by b.is_primary desc, b.name
   limit 1;

  for line in select * from jsonb_array_elements(p_lines)
  loop
    cat_id := line ->> 'catalogue_id';
    qty := coalesce((line ->> 'qty')::integer, 0);
    is_controlled := coalesce((line ->> 'controlled')::boolean, false);

    if cat_id is null or qty < 1 then
      continue;
    end if;

    -- Take it from the line that expires soonest and can cover it. A pharmacist
    -- reaches for the oldest stock, and so should the system.
    select * into stock_row
      from public.stock_lines
     where organization_id = org
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
      -- Sold from stock this pharmacy never recorded receiving. The sale still
      -- happened, so it is still written down; the count is returned so the
      -- counter can say so rather than quietly implying the shelf was right.
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
        org,
        coalesce(stock_row.branch_id, branch),
        cat_id,
        coalesce(line ->> 'brand', cat_id),
        nullif(trim(coalesce(line ->> 'strength', '')), ''),
        coalesce(line ->> 'molecule', '—'),
        p_patient,
        coalesce(nullif(trim(coalesce(p_patient_name, '')), ''), 'Walk-in'),
        nullif(trim(coalesce(p_mrn, '')), ''),
        qty,
        coalesce(remaining, 0),
        coalesce(nullif(trim(coalesce(my_name, '')), ''), public.clerk_email(), 'Unknown'),
        me,
        nullif(trim(coalesce(p_overrides, '')), '')
      );
      entries := entries + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'stock_lines_taken', taken,
    'lines_not_in_stock', short,
    'register_entries', entries
  );
end;
$$;

revoke all on function public.dispense_basket(jsonb, uuid, text, text, text) from public;
grant execute on function public.dispense_basket(jsonb, uuid, text, text, text) to authenticated;
