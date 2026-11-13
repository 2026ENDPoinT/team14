-- 일기 '오늘의 발자취' 보상 (+100 온기)
-- 규칙
-- - 한국 시간(KST) 오늘 날짜 일기에, 내용이 있는 발자취 글(앞뒤 공백 제외 1자 이상)을 저장하면 그날 처음 한 번만 +100
--   (이번 저장 요청에 발자취 글이 들어 있을 때만. p_footprint가 null인 이전 버전 화면 저장으로는 지급하지 않음)
-- - 중복 방지: reward_events 고유 키 (사용자, 'footprint_first_of_day', KST 날짜)
--   → 수정·다시 저장, 삭제 후 다시 쓰기, 동시 저장 모두 두 번째부터는 지급하지 않는다 (grant_reward)
-- - 기존 일기 보상(본문 20자 이상, diary_first_of_day +200)과 따로 판정·지급한다 (둘 다 받을 수 있음)
-- - 지난 날짜 일기는 지급하지 않는다. 누적 온기(energy)·보유 온기(warmth_balance)가 함께 늘어난다 (기존 보상과 같음)
-- 응답: 기존 { diary, reward, pet }에 footprint_reward 추가
--   footprint_reward: { rewarded: true, energy: 100 } 또는 { rewarded: false, reason: 'NOT_TODAY' | 'EMPTY' | 'ALREADY_REWARDED' }
-- 적용 순서: 20261114002600_diary_footprint.sql → 이 파일

-- 1. 보상 종류 추가 (기존 값은 그대로)
alter table public.reward_events drop constraint reward_events_type_check;
alter table public.reward_events add constraint reward_events_type_check
  check (type in ('attendance', 'diary_first_of_day', 'node_reflection', 'semester_reflection', 'footprint_first_of_day'));

-- 2. 일기 저장 (발자취 보상 추가, 나머지는 20261114002600과 같음)
create or replace function public.save_diary(
  p_date date,
  p_content text,
  p_mood text default null,
  p_linked_node_id uuid default null,
  p_footprint text default null
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
  v_has_footprint boolean := char_length(btrim(coalesce(p_footprint, ''))) > 0;
  v_diary public.diaries;
  v_rewarded boolean := false;
  v_fp_rewarded boolean := false;
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
  if char_length(coalesce(p_footprint, '')) > 2000 then
    raise exception 'VALIDATION_ERROR' using detail = '발자취는 2000자까지 쓸 수 있습니다.';
  end if;
  -- 연결할 노드는 내 노드여야 한다
  if p_linked_node_id is not null
     and not exists (select 1 from public.nodes where id = p_linked_node_id and user_id = v_uid) then
    raise exception 'NOT_FOUND' using detail = '연결할 활동을 찾을 수 없습니다.';
  end if;

  -- 사용자·날짜당 1개: 있으면 수정 (p_footprint가 null이면 기존 발자취 유지)
  insert into public.diaries (user_id, date, mood, content, linked_node_id, footprint)
  values (v_uid, p_date, p_mood, v_content, p_linked_node_id, coalesce(p_footprint, ''))
  on conflict (user_id, date) do update
    set mood = excluded.mood,
        content = excluded.content,
        linked_node_id = excluded.linked_node_id,
        footprint = case when p_footprint is null then public.diaries.footprint else excluded.footprint end,
        updated_at = now()
  returning * into v_diary;

  -- 일기 보상: 오늘 날짜 + 본문 공백 포함 20자 이상 → 하루 1회 +200 (발자취는 세지 않음)
  if p_date = v_today and char_length(v_content) >= 20 then
    v_rewarded := public.grant_reward(v_uid, 'diary_first_of_day', v_today::text, 200);
  end if;
  -- 발자취 보상: 오늘 날짜 + 이번 저장에 내용이 있는 발자취 → 하루 1회 +100 (일기 보상과 따로)
  if p_date = v_today and v_has_footprint then
    v_fp_rewarded := public.grant_reward(v_uid, 'footprint_first_of_day', v_today::text, 100);
  end if;

  return jsonb_build_object(
    'diary', to_jsonb(v_diary),
    'reward', case when v_rewarded then jsonb_build_object('rewarded', true, 'energy', 200)
      else jsonb_build_object('rewarded', false, 'reason',
        case when p_date <> v_today then 'NOT_TODAY'
             when char_length(v_content) < 20 then 'TOO_SHORT'
             else 'ALREADY_REWARDED' end)
      end,
    'footprint_reward', case when v_fp_rewarded then jsonb_build_object('rewarded', true, 'energy', 100)
      else jsonb_build_object('rewarded', false, 'reason',
        case when p_date <> v_today then 'NOT_TODAY'
             when not v_has_footprint then 'EMPTY'
             else 'ALREADY_REWARDED' end)
      end,
    'pet', public.my_pet_json(v_uid)
  );
end;
$$;

revoke all on function public.save_diary(date, text, text, uuid, text) from public, anon;
grant execute on function public.save_diary(date, text, text, uuid, text) to authenticated;
