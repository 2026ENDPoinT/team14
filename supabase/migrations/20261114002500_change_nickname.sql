-- 사용자 닉네임 변경 RPC change_nickname (docs/backend-pet-home.md 9장)
-- 규칙
-- - 정규화: 유니코드 NFC로 맞춘 뒤 앞뒤 공백(일반 공백·탭·줄바꿈·전각 공백·NBSP)을 뺀다
-- - 1~8자 (문자 수 = 코드 포인트, 프론트 [...text].length와 같은 방식). 줄바꿈 같은 제어 문자는 거부
-- - 같은 닉네임이면 아무것도 바꾸지 않음 (차감 없음, changed=false)
-- - 첫 실제 변경은 무료, 이후 변경마다 pets.warmth_balance에서 300 차감. 잔액이 부족하면 아무것도 바꾸지 않음
-- - 누적 온기(energy)·성장 단계·보상 기록은 그대로. 닉네임 저장과 차감은 한 트랜잭션 (프로필 행 잠금)
-- - 온보딩에서 처음 정하는 닉네임(complete_onboarding)은 변경 횟수에 넣지 않는다
-- - 로그인한 본인 프로필만 바꾼다 (auth.uid())
-- 권한
-- - 브라우저에서 profiles.nickname을 직접 UPDATE하지 못하게 한다 (규칙·차감 우회 방지)
-- - 테이블 전체 UPDATE 권한이 혹시 있더라도 함께 회수하고, 마이페이지가 쓰던 학년·희망 직무 수정 권한만 다시 준다
--   (RLS 정책 profiles_update_own은 그대로)

alter table public.profiles
  add column nickname_change_count integer not null default 0 check (nickname_change_count >= 0);

revoke update on public.profiles from anon, authenticated;
grant update (grade, interests) on public.profiles to authenticated;

create function public.change_nickname(p_nickname text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := btrim(normalize(coalesce(p_nickname, ''), NFC), E' \t\r\n　 ');
  v_profile public.profiles;
  v_pet public.pets;
  v_cost integer := 0;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using detail = '로그인이 필요합니다.';
  end if;
  if char_length(v_name) < 1 or char_length(v_name) > 8 then
    raise exception 'VALIDATION_ERROR' using detail = '닉네임은 1~8자로 입력해 주세요.';
  end if;
  if v_name ~ '[[:cntrl:]]' then
    raise exception 'VALIDATION_ERROR' using detail = '닉네임에 줄바꿈 같은 특수 문자는 쓸 수 없어요.';
  end if;

  -- 본인 프로필 행을 잠근다 (같은 사용자의 동시 요청은 차례로 처리)
  select * into v_profile from public.profiles where id = v_uid for update;
  if not found then
    raise exception 'NOT_FOUND' using detail = '프로필이 없습니다.';
  end if;

  -- 같은 닉네임: 아무것도 바꾸지 않음
  if v_profile.nickname is not distinct from v_name then
    return jsonb_build_object('profile', to_jsonb(v_profile), 'cost', 0, 'changed', false, 'pet', public.my_pet_json(v_uid));
  end if;

  -- 두 번째 실제 변경부터 보유 온기 300 차감
  if v_profile.nickname_change_count > 0 then
    v_cost := 300;
    select * into v_pet from public.pets where user_id = v_uid for update;
    if not found or v_pet.warmth_balance < v_cost then
      raise exception 'INSUFFICIENT_WARMTH' using detail = '온기가 부족해요. 닉네임 변경에는 온기 300이 필요해요.';
    end if;
    update public.pets set warmth_balance = warmth_balance - v_cost, updated_at = now() where user_id = v_uid;
  end if;

  update public.profiles
    set nickname = v_name, nickname_change_count = nickname_change_count + 1
    where id = v_uid
    returning * into v_profile;

  return jsonb_build_object('profile', to_jsonb(v_profile), 'cost', v_cost, 'changed', true, 'pet', public.my_pet_json(v_uid));
end;
$$;

revoke all on function public.change_nickname(text) from public, anon;
grant execute on function public.change_nickname(text) to authenticated;
