-- 홈 테마 통합: 이전 20261114003200_pet_theme_shop.sql 적용 후 실행.
-- 무료: light / dark. 유료: sunset / ocean / blossom / forest / night.
-- 기존 구매 기록은 유지하며 classic 장착 기록은 light로 이전한다.

alter table public.pet_theme_inventory drop constraint if exists pet_theme_inventory_theme_id_check;
alter table public.pet_theme_inventory add constraint pet_theme_inventory_theme_id_check
  check (theme_id in ('sunset','ocean','blossom','forest','night'));

alter table public.pet_theme_settings drop constraint if exists pet_theme_settings_equipped_theme_check;
alter table public.pet_theme_settings add constraint pet_theme_settings_equipped_theme_check
  check (equipped_theme in ('light','dark','sunset','ocean','blossom','forest','night')) not valid;
update public.pet_theme_settings set equipped_theme='light' where equipped_theme='classic';
alter table public.pet_theme_settings alter column equipped_theme set default 'light';
alter table public.pet_theme_settings validate constraint pet_theme_settings_equipped_theme_check;

create or replace function public.get_my_pet_themes() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  return jsonb_build_object(
    'owned', coalesce((select jsonb_agg(theme_id) from public.pet_theme_inventory where user_id=v_uid), '[]'::jsonb),
    'equipped', coalesce((select equipped_theme from public.pet_theme_settings where user_id=v_uid), 'light')
  );
end; $$;

create or replace function public.purchase_pet_theme(p_theme_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_price integer;
  v_pet public.pets;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  v_price := case p_theme_id
    when 'sunset' then 350
    when 'ocean' then 450
    when 'blossom' then 300
    when 'forest' then 500
    when 'night' then 700
    else null end;
  if v_price is null then raise exception 'VALIDATION_ERROR' using detail='판매하지 않는 테마입니다.'; end if;
  select * into v_pet from public.pets where user_id=v_uid for update;
  if not found then raise exception 'NOT_FOUND' using detail='펫 정보를 찾을 수 없어요.'; end if;
  if exists (select 1 from public.pet_theme_inventory where user_id=v_uid and theme_id=p_theme_id) then
    raise exception 'ALREADY_OWNED' using detail='이미 보유한 테마예요.';
  end if;
  if v_pet.warmth_balance < v_price then
    raise exception 'INSUFFICIENT_WARMTH' using detail='온기가 부족해요.';
  end if;
  update public.pets set warmth_balance=warmth_balance-v_price where user_id=v_uid;
  insert into public.pet_theme_inventory(user_id,theme_id) values (v_uid,p_theme_id);
  return jsonb_build_object('theme_id',p_theme_id,'price',v_price,'balance',v_pet.warmth_balance-v_price);
end; $$;

create or replace function public.equip_pet_theme(p_theme_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_theme_id is null or p_theme_id not in ('light','dark','sunset','ocean','blossom','forest','night') then
    raise exception 'VALIDATION_ERROR';
  end if;
  if p_theme_id not in ('light','dark') and not exists (
    select 1 from public.pet_theme_inventory where user_id=v_uid and theme_id=p_theme_id
  ) then raise exception 'NOT_OWNED' using detail='보유하지 않은 테마예요.'; end if;
  insert into public.pet_theme_settings(user_id,equipped_theme) values (v_uid,p_theme_id)
    on conflict (user_id) do update set equipped_theme=excluded.equipped_theme;
  return jsonb_build_object('equipped',p_theme_id);
end; $$;
