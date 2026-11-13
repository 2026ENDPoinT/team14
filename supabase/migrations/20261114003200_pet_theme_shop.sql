-- 홈 배경 테마 상점. 온기 차감은 서버 함수 한 트랜잭션에서만 수행한다.
create table public.pet_theme_inventory (
  user_id uuid not null references public.profiles(id) on delete cascade,
  theme_id text not null check (theme_id in ('blossom','forest','night')),
  created_at timestamptz not null default now(),
  primary key (user_id, theme_id)
);
alter table public.pet_theme_inventory enable row level security;
create policy pet_theme_inventory_read_own on public.pet_theme_inventory
  for select to authenticated using (user_id = (select auth.uid()));
grant select on public.pet_theme_inventory to authenticated;
-- 직접 INSERT / UPDATE / DELETE 불가: 구매는 RPC로만 가능
revoke insert, update, delete on public.pet_theme_inventory from anon, authenticated;

create table public.pet_theme_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  equipped_theme text not null default 'classic'
    check (equipped_theme in ('classic','blossom','forest','night'))
);
alter table public.pet_theme_settings enable row level security;
create policy pet_theme_settings_read_own on public.pet_theme_settings
  for select to authenticated using (user_id = (select auth.uid()));
grant select on public.pet_theme_settings to authenticated;
revoke insert, update, delete on public.pet_theme_settings from anon, authenticated;

create function public.get_my_pet_themes() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  return jsonb_build_object(
    'owned', coalesce((select jsonb_agg(theme_id) from public.pet_theme_inventory where user_id=v_uid), '[]'::jsonb),
    'equipped', coalesce((select equipped_theme from public.pet_theme_settings where user_id=v_uid), 'classic')
  );
end; $$;

create function public.purchase_pet_theme(p_theme_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_price integer;
  v_pet public.pets;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  v_price := case p_theme_id when 'blossom' then 300 when 'forest' then 500 when 'night' then 700 else null end;
  if v_price is null then raise exception 'VALIDATION_ERROR' using detail='판매하지 않는 테마입니다.'; end if;
  -- 사용자 펫 행 잠금: 여러 탭에서 구매해도 잔액/중복 구매가 일관되게 처리된다.
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

create function public.equip_pet_theme(p_theme_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_theme_id not in ('classic','blossom','forest','night') or p_theme_id is null then
    raise exception 'VALIDATION_ERROR';
  end if;
  if p_theme_id <> 'classic' and not exists (
    select 1 from public.pet_theme_inventory where user_id=v_uid and theme_id=p_theme_id
  ) then raise exception 'NOT_OWNED' using detail='보유하지 않은 테마예요.'; end if;
  insert into public.pet_theme_settings(user_id,equipped_theme) values (v_uid,p_theme_id)
    on conflict (user_id) do update set equipped_theme=excluded.equipped_theme;
  return jsonb_build_object('equipped',p_theme_id);
end; $$;

revoke all on function public.get_my_pet_themes() from public, anon;
revoke all on function public.purchase_pet_theme(text) from public, anon;
revoke all on function public.equip_pet_theme(text) from public, anon;
grant execute on function public.get_my_pet_themes() to authenticated;
grant execute on function public.purchase_pet_theme(text) to authenticated;
grant execute on function public.equip_pet_theme(text) to authenticated;
