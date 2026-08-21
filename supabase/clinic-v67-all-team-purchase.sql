begin;

create or replace function public.v62_record_inventory_purchase(
  p_item uuid,
  p_units_added integer,
  p_amount_paid numeric,
  p_payment_method text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_before integer;
  v_after integer;
  v_purchase uuid;
  v_expense uuid;
  v_name text;
  v_payload jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not exists(
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
  ) then
    raise exception 'Active clinic account required';
  end if;

  if coalesce(p_units_added,0) <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;

  if coalesce(p_amount_paid,0) <= 0 then
    raise exception 'Amount paid must be greater than zero';
  end if;

  if p_payment_method not in ('cash','card','instapay','bank_transfer','other') then
    raise exception 'Invalid payment method';
  end if;

  select
    available_stock,
    coalesce(nullif(trim(english_name),''), arabic_name)
  into
    v_before,
    v_name
  from public.clinic_inventory_items
  where id = p_item
    and is_active = true
  for update;

  if not found then
    raise exception 'Inventory item not found';
  end if;

  v_after := v_before + p_units_added;

  update public.clinic_inventory_items
  set
    available_stock = v_after,
    is_critical = false,
    critical_note = null,
    critical_marked_by = null,
    critical_marked_at = null,
    updated_at = now()
  where id = p_item;

  insert into public.clinic_inventory_purchases(
    item_id,
    linked_request_id,
    units_added,
    amount_paid,
    purchase_note,
    purchased_by,
    stock_before,
    stock_after
  )
  values(
    p_item,
    null,
    p_units_added,
    p_amount_paid,
    nullif(trim(coalesce(p_note,'')),''),
    auth.uid(),
    v_before,
    v_after
  )
  returning id into v_purchase;

  insert into public.clinic_inventory_history(
    item_id,
    delta,
    note,
    changed_by
  )
  values(
    p_item,
    p_units_added,
    'Purchased new stock',
    auth.uid()
  );

  if to_regclass('public.clinic_expenses') is null then
    raise exception 'Finance expense table clinic_expenses was not found';
  end if;

  v_payload := jsonb_build_object(
    'amount', p_amount_paid,
    'description', 'Logistics purchase: ' || v_name,
    'notes', nullif(trim(coalesce(p_note,'')),''),
    'note', nullif(trim(coalesce(p_note,'')),''),
    'item_name', v_name,
    'expense_at', now(),
    'payment_method', p_payment_method,
    'created_by', auth.uid(),
    'submitted_by', auth.uid(),
    'paid_by', auth.uid(),
    'is_voided', false
  );

  begin
    execute '
      insert into public.clinic_expenses
      select (jsonb_populate_record(null::public.clinic_expenses,$1)).*
      returning id
    '
    into v_expense
    using v_payload;
  exception when others then
    raise exception 'Purchase was NOT saved because Finance expense creation failed: %', sqlerrm;
  end;

  return jsonb_build_object(
    'success', true,
    'purchase_id', v_purchase,
    'expense_id', v_expense,
    'stock_before', v_before,
    'stock_after', v_after,
    'amount_paid', p_amount_paid
  );
end;
$$;

revoke all on function public.v62_record_inventory_purchase(uuid,integer,numeric,text,text)
from public, anon;

grant execute on function public.v62_record_inventory_purchase(uuid,integer,numeric,text,text)
to authenticated;

notify pgrst,'reload schema';
commit;

select 'V67 all-team purchase permission installed' as status;
