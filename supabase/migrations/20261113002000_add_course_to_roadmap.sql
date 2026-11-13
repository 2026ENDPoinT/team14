-- 로드맵 '수강 필요' 과목을 보관함에 추가하거나 학기에 배치 (작업표 4-9)
--
-- 왜 RPC인가: 과목 노드는 origin_key 'course:<과목 키>'로 같은 과목을 한 개만 둔다 (nodes_user_origin_key 유일 제약).
-- 프론트는 nodes.origin_key를 쓸 권한이 없다 (00200 컬럼 권한) → 과목 키를 붙여 만드는 일은 이 함수가 한다.
--
-- add_course_to_roadmap(p_course_key, p_title, p_period_id default null)
-- - 로그인 사용자 본인의 노드만 만든다 (auth.uid()).
-- - p_course_key: 교과과정 과목 키 형식 'cs2026-<학년>-<학기>-<두 자리>'만 허용
-- - p_title: 과목 이름 (1~100자, 앞뒤 공백 제거)
-- - p_period_id: null이면 보관함(stored), 값이 있으면 그 학기에 배치(placed). 본인 학기만 가능 (아니면 NOT_FOUND)
--   위치는 기본값(0, 0)으로 만들고, 화면이 로드맵 배치 규칙으로 자리를 정해 저장한다 (기존 노드 이동과 같은 방식).
-- - 이미 같은 과목 노드가 있으면 새로 만들지 않고 그 노드를 그대로 돌려준다 (created: false). 기존 노드는 바꾸지 않는다.
-- - 새 노드: theme 'major', source 'recommended', completed false
-- 결과: { node: nodes 행, created: boolean }
-- 기존 테이블·데이터·complete_onboarding은 바꾸지 않는다.

create function public.add_course_to_roadmap(
  p_course_key text,
  p_title text,
  p_period_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_title text := btrim(coalesce(p_title, ''));
  v_origin text;
  v_node public.nodes;
  v_created boolean := false;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using detail = '로그인이 필요합니다.';
  end if;
  if p_course_key is null or p_course_key !~ '^cs2026-[1-4]-[12]-[0-9]{2}$' then
    raise exception 'VALIDATION_ERROR' using detail = '과목 키 형식이 올바르지 않습니다.';
  end if;
  if char_length(v_title) not between 1 and 100 then
    raise exception 'VALIDATION_ERROR' using detail = '과목 이름은 1~100자여야 합니다.';
  end if;
  if p_period_id is not null and not exists (
    select 1 from public.timeline_periods where id = p_period_id and user_id = v_uid
  ) then
    raise exception 'NOT_FOUND' using detail = '학기를 찾을 수 없습니다.';
  end if;

  v_origin := 'course:' || p_course_key;

  insert into public.nodes (user_id, title, theme, period_id, status, source, origin_key, completed)
  values (v_uid, v_title, 'major', p_period_id,
          case when p_period_id is null then 'stored' else 'placed' end,
          'recommended', v_origin, false)
  on conflict (user_id, origin_key) do nothing
  returning * into v_node;

  if v_node.id is not null then
    v_created := true;
  else
    select * into v_node from public.nodes where user_id = v_uid and origin_key = v_origin;
  end if;

  return jsonb_build_object('node', to_jsonb(v_node), 'created', v_created);
end;
$$;

revoke all on function public.add_course_to_roadmap(text, text, uuid) from public, anon;
grant execute on function public.add_course_to_roadmap(text, text, uuid) to authenticated;
