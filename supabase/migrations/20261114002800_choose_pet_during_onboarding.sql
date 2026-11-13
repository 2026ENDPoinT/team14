-- choose_pet을 온보딩 중에만 쓸 수 있게 바꾼다 (20261114002700_choose_pet.sql의 함수를 교체)
-- 왜: 온보딩 완료(complete_onboarding) 뒤에 펫 저장만 실패하면, 새로고침·재로그인 때 HOME으로 바로 가서
--     펫을 고를 화면이 없었다. → 프론트가 펫을 먼저 저장하고 그다음 온보딩을 완료한다.
--     펫 저장이 실패하면 온보딩이 아직 완료되지 않았으므로 다시 온보딩에서 이어서 마칠 수 있다.
-- 규칙
-- - 온보딩 완료 전: 펫 행이 없으면 만든다 (complete_onboarding은 같은 행을 on conflict do nothing으로 쓰므로 중복 없음)
--   고른 종류로 정하거나 바꾸고(p_type), 직무를 고른 경우 비운다(p_type = null → 직무로 자동 결정)
-- - 온보딩 완료 후: 새로 지정·변경·비우기 모두 불가 (CONFLICT). 펫 종류는 온보딩에서만 정한다
-- - 허용 값: penguin · otter · black_cat · hamster · rabbit
-- - 이름·누적 온기·잔액·성장 단계·보상 기록은 건드리지 않는다. 로그인한 본인 펫만
-- 적용 순서: 20261114002700_choose_pet.sql → 이 파일
create or replace function public.choose_pet(p_type text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_done boolean;
  v_pet public.pets;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using detail = '로그인이 필요합니다.';
  end if;
  if p_type is not null and p_type not in ('penguin', 'otter', 'black_cat', 'hamster', 'rabbit') then
    raise exception 'VALIDATION_ERROR' using detail = '고를 수 없는 펫이에요.';
  end if;

  -- 본인 프로필을 잠가 온보딩 완료와 순서를 맞춘다
  select onboarding_completed into v_done from public.profiles where id = v_uid for update;
  if not found then
    raise exception 'NOT_FOUND' using detail = '프로필이 없습니다.';
  end if;
  if v_done then
    raise exception 'CONFLICT' using detail = '온보딩을 마친 뒤에는 펫 종류를 정하거나 바꿀 수 없어요.';
  end if;

  insert into public.pets (user_id) values (v_uid) on conflict (user_id) do nothing;
  select * into v_pet from public.pets where user_id = v_uid for update;

  if v_pet.type is not distinct from p_type then
    return jsonb_build_object('changed', false, 'pet', public.my_pet_json(v_uid));
  end if;

  update public.pets set type = p_type where user_id = v_uid;
  return jsonb_build_object('changed', true, 'pet', public.my_pet_json(v_uid));
end;
$$;

revoke all on function public.choose_pet(text) from public, anon;
grant execute on function public.choose_pet(text) to authenticated;
