-- =========================================================
-- ALAA CLINIC V60
-- VISUAL LOGISTICS GALLERY + ADMIN EDIT/ADD/REMOVE
-- Run once in Supabase SQL Editor.
-- =========================================================

begin;

-- Keep the existing V44 table and image bucket.
insert into storage.buckets (id,name,public)
values ('clinic-item-images','clinic-item-images',true)
on conflict (id) do update set public = true;

-- Management can upload item photos.
drop policy if exists clinic_v60_item_images_insert on storage.objects;
create policy clinic_v60_item_images_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'clinic-item-images'
  and (
       private.has_role('owner')
    or private.has_role('manager')
    or private.has_role('deputy_manager')
  )
);

-- Gallery source.
create or replace function public.v60_logistics_items()
returns table (
  id uuid,
  arabic_name text,
  english_name text,
  image_url text,
  available_stock integer,
  is_active boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    i.id,
    i.arabic_name,
    i.english_name,
    i.image_url,
    i.available_stock,
    i.is_active
  from public.clinic_inventory_items i
  where auth.uid() is not null
    and i.is_active = true
  order by
    coalesce(nullif(trim(i.english_name),''), i.arabic_name);
$$;

revoke all on function public.v60_logistics_items() from public, anon;
grant execute on function public.v60_logistics_items() to authenticated;

-- Admin save/edit. This intentionally includes owner + manager + deputy manager.
create or replace function public.v60_save_inventory_item(
  p_item uuid,
  p_arabic_name text,
  p_english_name text,
  p_image_url text,
  p_available_stock integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not (
       private.has_role('owner')
    or private.has_role('manager')
    or private.has_role('deputy_manager')
  ) then
    raise exception 'Administrator access required';
  end if;

  if nullif(trim(coalesce(p_arabic_name,'')),'') is null
     and nullif(trim(coalesce(p_english_name,'')),'') is null then
    raise exception 'Item name is required';
  end if;

  if coalesce(p_available_stock,-1) < 0 then
    raise exception 'Available stock cannot be negative';
  end if;

  if p_item is null then
    insert into public.clinic_inventory_items(
      arabic_name, english_name, image_url,
      available_stock, is_active, created_by
    )
    values(
      coalesce(nullif(trim(p_arabic_name),''), trim(p_english_name)),
      nullif(trim(coalesce(p_english_name,'')),''),
      nullif(trim(coalesce(p_image_url,'')),''),
      p_available_stock,
      true,
      auth.uid()
    )
    returning id into v_id;
  else
    update public.clinic_inventory_items
    set
      arabic_name = coalesce(nullif(trim(p_arabic_name),''), nullif(trim(p_english_name),''), arabic_name),
      english_name = nullif(trim(coalesce(p_english_name,'')),''),
      image_url = nullif(trim(coalesce(p_image_url,'')),''),
      available_stock = p_available_stock,
      is_active = true,
      updated_at = now()
    where id = p_item
    returning id into v_id;

    if v_id is null then
      raise exception 'Inventory item not found';
    end if;
  end if;

  return jsonb_build_object('success',true,'item_id',v_id);
end;
$$;

revoke all on function public.v60_save_inventory_item(uuid,text,text,text,integer)
from public, anon;
grant execute on function public.v60_save_inventory_item(uuid,text,text,text,integer)
to authenticated;

-- "Remove" is a safe soft delete, so old requests/purchases remain auditable.
create or replace function public.v60_remove_inventory_item(p_item uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not (
       private.has_role('owner')
    or private.has_role('manager')
    or private.has_role('deputy_manager')
  ) then
    raise exception 'Administrator access required';
  end if;

  update public.clinic_inventory_items
  set is_active = false, updated_at = now()
  where id = p_item;

  if not found then
    raise exception 'Inventory item not found';
  end if;

  return jsonb_build_object('success',true);
end;
$$;

revoke all on function public.v60_remove_inventory_item(uuid) from public, anon;
grant execute on function public.v60_remove_inventory_item(uuid) to authenticated;

-- Seed the photographed clinic items.
-- Relative image paths point to the asset folder supplied in this package.
insert into public.clinic_inventory_items
  (arabic_name, english_name, image_url, available_stock, is_active)
select *
from (
  values
    ('فلتر مياه تانك 3 مراحل','Tank 3-stage water filter','assets/logistics/water-filter.jpeg',1,true),
    ('غلاية كهربائية','Electric kettle','assets/logistics/electric-kettle.jpeg',1,true),
    ('يانسون','Anise tea','assets/logistics/anise-tea.jpeg',1,true),
    ('سكر / مُحلّي أبيض','Sugar / white sweetener','assets/logistics/sugar.jpeg',1,true),
    ('قهوة سريعة التحضير','Instant coffee sachets','assets/logistics/instant-coffee.jpeg',1,true),
    ('مشروبات وأعشاب أكياس','Herbal drink sachets','assets/logistics/herbal-sachets.jpeg',1,true),
    ('قهوة مطحونة','Ground coffee','assets/logistics/loose-coffee.jpeg',1,true),
    ('ترايستيفيا بديل السكر','Traistivia sweetener','assets/logistics/stevia.jpeg',1,true),
    ('سائل غسيل أطباق بريل','Pril dishwashing liquid','assets/logistics/dishwashing-liquid.jpeg',1,true),
    ('صابون يد سائل','Liquid hand soap','assets/logistics/hand-soap.jpeg',1,true),
    ('مناديل مطبخ رول','Paper towel roll','assets/logistics/paper-towel.jpeg',1,true),
    ('مجلات منطقة الانتظار','Waiting-area magazines','assets/logistics/waiting-magazines.jpeg',1,true),
    ('جهاز تنظيف كهربائي','Electric cleaning appliance','assets/logistics/cleaning-appliance.jpeg',1,true),
    ('مناديل ورقية','Facial tissues','assets/logistics/tissues.jpeg',1,true),
    ('أكواب بلاستيك','Disposable plastic cups','assets/logistics/plastic-cups.jpeg',1,true),
    ('بطاريات AAA','AAA batteries','assets/logistics/aaa-battery.jpeg',1,true),
    ('منظم أكريليك','Acrylic organizer','assets/logistics/acrylic-organizer.jpeg',1,true),
    ('مبرد مياه + زجاجة نستله 18.9 لتر','Water dispenser + Nestle 18.9 L bottle','assets/logistics/water-dispenser.jpeg',1,true)
) as seed(arabic_name,english_name,image_url,available_stock,is_active)
where not exists (
  select 1
  from public.clinic_inventory_items x
  where lower(coalesce(x.english_name,'')) = lower(seed.english_name)
     or lower(x.arabic_name) = lower(seed.arabic_name)
);

notify pgrst, 'reload schema';
commit;

select 'V60 logistics gallery installed' as status;
