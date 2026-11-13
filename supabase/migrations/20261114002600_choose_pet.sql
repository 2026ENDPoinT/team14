-- 직무 미정 사용자가 온보딩 마지막 화면에서 고른 펫 저장 RPC choose_pet
-- 규칙
-- - 펫 종류(외형 키)는 기존 pets.type 칸에 저장한다 (새 칸 없음). 직무(profiles.interests)와 따로 관리
--   → 프론트 resolvePetCharacter가 pets.type을 직무보다 먼저 보므로, 나중에 직무를 골라도 고른 펫이 바뀌지 않는다
-- - 허용 값: penguin · otter · black_cat · hamster · rabbit (새싹은 성장 1단계 모습이라 종류로 고를 수 없음)
-- - 이미 종류가 정해진 펫은 바꾸지 않는다 (changed=false). 같은 요청을 다시 보내도 결과가 같다
-- - 이름·누적 온기(energy)·잔액·성장 단계·보상 기록은 건드리지 않는다
-- - 펫 행은 complete_onboarding이 만든다 → 온보딩 완료 뒤에 부른다. 펫이 없으면 NOT_FOUND
-- - 로그인한 본인 펫만 (auth.uid()). pets는 브라우저에서 직접 수정할 수 없어 이 RPC로만 바꾼다
create function public.choose_pet(p_type text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_pet public.pets;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using detail = '로그인이 필요합니다.';
  end if;
  if p_type is null or p_type not in ('penguin', 'otter', 'black_cat', 'hamster', 'rabbit') then
    raise exception 'VALIDATION_ERROR' using detail = '고를 수 없는 펫이에요.';
  end if;

  select * into v_pet from public.pets where user_id = v_uid for update;
  if not found then
    raise exception 'NOT_FOUND' using detail = '펫이 아직 없어요. 온보딩을 먼저 완료해 주세요.';
  end if;
  if v_pet.type is not null then
    return jsonb_build_object('changed', false, 'pet', public.my_pet_json(v_uid));
  end if;

  update public.pets set type = p_type where user_id = v_uid;
  return jsonb_build_object('changed', true, 'pet', public.my_pet_json(v_uid));
end;
$$;

revoke all on function public.choose_pet(text) from public, anon;
grant execute on function public.choose_pet(text) to authenticated;
