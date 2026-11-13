-- 온기 보상: 자동 출석(+100) · 일기(+200) · 펫 온기 잔액
-- (docs/backend-pet-home.md 3장, docs/backend-diary-reward.md 3장의 요청을 구현)
--
-- 1) pets.warmth_balance: 사용할 수 있는 온기 (이름 변경 등에 쓰면 줄어든다)
--    pets.energy: 펫 성장에 쓰는 누적 획득 온기 (줄지 않는다)
--    기존 펫은 잔액 0으로 시작한다. (적용 직전 team4-dev 확인: 모든 펫 energy 0, reward_events 0건, 사용 기록 없음)
-- 2) 보상 지급은 grant_reward 한 곳에서만 한다 (외부에서 직접 부를 수 없음)
--    - reward_events (user_id, type, ref_id) 유일 제약으로 중복을 막는다 → 동시에 여러 번 불러도 1번만 지급
--    - 지급 이력이 새로 생겼을 때만 energy·warmth_balance를 함께 올린다
--    - 펫이 아직 없으면(온보딩 전) 펫 행을 만들어 거기에 쌓는다. 온보딩은 펫을 on conflict do nothing으로
--      만들므로 이미 받은 온기가 그대로 남는다 (누락·중복 없음)
-- 3) check_in(): 서버 KST 날짜 기준 하루 1회 +100 (로그인할 때 프론트가 자동으로 부른다)
-- 4) save_diary(...): 일기 저장 + 같은 트랜잭션에서 보상 판정 (오늘 KST 날짜 + 공백 포함 20자 이상 → 하루 1회 +200)
-- 날짜는 항상 서버 시각으로 계산한다: (now() at time zone 'Asia/Seoul')::date
-- 기존 테이블·데이터는 지우지 않는다. 펫 단계(stage)는 바꾸지 않는다 (화면이 energy로 계산).

-- 1. 펫 온기 잔액 ---------------------------------------------------------
alter table public.pets
  add column warmth_balance integer not null default 0 check (warmth_balance >= 0);

-- 2. 보상 지급 (내부 전용) --------------------------------------------------
create function public.grant_reward(p_uid uuid, p_type text, p_ref text, p_amount integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.reward_events (user_id, type, ref_id, energy)
  values (p_uid, p_type, p_ref, p_amount)
  on conflict (user_id, type, ref_id) do nothing
  returning id into v_id;

  if v_id is null then
    return false; -- 이미 받은 보상
  end if;

  insert into public.pets (user_id, energy, warmth_balance)
  values (p_uid, p_amount, p_amount)
  on conflict (user_id) do update
    set energy = public.pets.energy + p_amount,
        warmth_balance = public.pets.warmth_balance + p_amount,
        updated_at = now();
  return true;
end;
$$;

-- 다른 RPC 안에서만 쓴다. 로그인 사용자도 직접 부를 수 없다.
revoke all on function public.grant_reward(uuid, text, text, integer) from public, anon, authenticated;

-- 화면에 돌려줄 펫 (없으면 null)
create function public.my_pet_json(p_uid uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select to_jsonb(p) from public.pets p where p.user_id = p_uid
$$;
revoke all on function public.my_pet_json(uuid) from public, anon, authenticated;

-- 3. 출석 ----------------------------------------------------------------
create function public.check_in()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_rewarded boolean;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using detail = '로그인이 필요합니다.';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'NOT_FOUND' using detail = '프로필이 없습니다.';
  end if;

  v_rewarded := public.grant_reward(v_uid, 'attendance', v_today::text, 100);

  return jsonb_build_object(
    'date', v_today,
    'reward', case when v_rewarded then jsonb_build_object('rewarded', true, 'energy', 100)
                   else jsonb_build_object('rewarded', false, 'reason', 'ALREADY_CHECKED_IN') end,
    'pet', public.my_pet_json(v_uid)
  );
end;
$$;

revoke all on function public.check_in() from public, anon;
grant execute on function public.check_in() to authenticated;

-- 4. 일기 저장 ------------------------------------------------------------
create function public.save_diary(
  p_date date,
  p_content text,
  p_mood text default null,
  p_linked_node_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_content text := coalesce(p_content, '');
  v_diary public.diaries;
  v_rewarded boolean := false;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using detail = '로그인이 필요합니다.';
  end if;
  if p_date is null or p_date > v_today then
    raise exception 'VALIDATION_ERROR' using detail = '미래 날짜에는 일기를 쓸 수 없습니다.';
  end if;
  if char_length(v_content) > 5000 then
    raise exception 'VALIDATION_ERROR' using detail = '일기는 5000자까지 쓸 수 있습니다.';
  end if;

  -- 사용자·날짜당 1개: 있으면 수정
  insert into public.diaries (user_id, date, mood, content, linked_node_id)
  values (v_uid, p_date, p_mood, v_content, p_linked_node_id)
  on conflict (user_id, date) do update
    set mood = excluded.mood,
        content = excluded.content,
        linked_node_id = excluded.linked_node_id,
        updated_at = now()
  returning * into v_diary;

  -- 보상: 오늘 날짜 + 공백 포함 20자 이상 → 하루 1회 (새로 쓰기·수정 모두. 삭제 후 재작성도 이력이 남아 있어 0)
  -- char_length = 문자 수 (프론트 countChars [...text].length와 같은 방식)
  if p_date = v_today and char_length(v_content) >= 20 then
    v_rewarded := public.grant_reward(v_uid, 'diary_first_of_day', v_today::text, 200);
  end if;

  return jsonb_build_object(
    'diary', to_jsonb(v_diary),
    'reward', case when v_rewarded then jsonb_build_object('rewarded', true, 'energy', 200)
      else jsonb_build_object('rewarded', false, 'reason',
        case when p_date <> v_today then 'NOT_TODAY'
             when char_length(v_content) < 20 then 'TOO_SHORT'
             else 'ALREADY_REWARDED' end)
      end,
    'pet', public.my_pet_json(v_uid)
  );
end;
$$;

revoke all on function public.save_diary(date, text, text, uuid) from public, anon;
grant execute on function public.save_diary(date, text, text, uuid) to authenticated;
