-- 일기 '오늘의 발자취' (공부·활동 기록, 선택 작성) + 로드맵 노드 연결 저장
-- 1) diaries.footprint: 발자취 글 (선택, 2000자까지)
-- 2) save_diary(...): p_footprint 추가. 보상 규칙은 그대로 (오늘 KST + 일기 본문 content 20자 이상 → 하루 1회 +200)
--    발자취 글은 보상 글자 수에 넣지 않는다.
--    p_footprint를 보내지 않으면(null) 기존 발자취를 그대로 둔다 (이전 버전 화면이 저장해도 지워지지 않게)
-- 연결 노드(linked_node_id)는 기존 칸을 쓴다. 본인 노드만 연결된다 (diaries_linked_node_fkey).
-- 기존 테이블·데이터는 지우지 않는다.

-- 1. 발자취 칸 -------------------------------------------------------------
alter table public.diaries
  add column footprint text not null default ''
  constraint diaries_footprint_length check (char_length(footprint) <= 2000);

-- 2. 일기 저장 (발자취 추가) ---------------------------------------------------
drop function public.save_diary(date, text, text, uuid);

create function public.save_diary(
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
  if char_length(coalesce(p_footprint, '')) > 2000 then
    raise exception 'VALIDATION_ERROR' using detail = '발자취는 2000자까지 쓸 수 있습니다.';
  end if;
  -- 연결할 노드는 내 노드여야 한다 (외래 키도 막지만, 알아볼 수 있는 오류로 먼저 알려 준다)
  if p_linked_node_id is not null
     and not exists (select 1 from public.nodes where id = p_linked_node_id and user_id = v_uid) then
    raise exception 'NOT_FOUND' using detail = '연결할 활동을 찾을 수 없습니다.';
  end if;

  -- 사용자·날짜당 1개: 있으면 수정
  insert into public.diaries (user_id, date, mood, content, linked_node_id, footprint)
  values (v_uid, p_date, p_mood, v_content, p_linked_node_id, coalesce(p_footprint, ''))
  on conflict (user_id, date) do update
    set mood = excluded.mood,
        content = excluded.content,
        linked_node_id = excluded.linked_node_id,
        footprint = case when p_footprint is null then public.diaries.footprint else excluded.footprint end,
        updated_at = now()
  returning * into v_diary;

  -- 보상: 오늘 날짜 + 일기 본문 공백 포함 20자 이상 → 하루 1회 (발자취는 세지 않음)
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

revoke all on function public.save_diary(date, text, text, uuid, text) from public, anon;
grant execute on function public.save_diary(date, text, text, uuid, text) to authenticated;
