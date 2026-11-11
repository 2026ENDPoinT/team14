-- 탐색의 공모전 공고 → 내 로드맵 보관함 노드로 추가
--
-- - 노드: theme 'external'(대외활동), source 'explore', status 'stored'(보관함), period_id null
-- - 중복 방지: 기존 (user_id, origin_key) 유일 제약을 그대로 쓴다.
--     origin_key = 'contest:<source>:<source_id>'  (수집처 원본 ID라서 공고 행이 다시 저장돼도 변하지 않음)
--   연속 클릭·동시 요청이 와도 insert ... on conflict do nothing 이라 노드는 하나만 생긴다.
-- - contest_id: 노드가 어떤 공고에서 왔는지. 마감일·출처·원문 링크는 contests에서 읽는다.
--   (수집기가 마감일을 고치면 노드 표시도 따라 바뀐다. 마감된 공고도 행은 지우지 않으므로 노드는 계속 보인다)
-- - origin_key·contest_id는 사용자가 직접 쓸 수 없다(00200의 컬럼 권한). 이 RPC만 넣는다.

alter table public.nodes
  add column contest_id uuid references public.contests (id) on delete set null;

create index nodes_contest_id_idx on public.nodes (contest_id);

-- 공모전 공고를 내 보관함에 추가
-- 반환: { "added": true|false, "node": <nodes 행> }  (이미 있으면 added=false, 기존 노드)
-- 오류: UNAUTHENTICATED / NOT_FOUND / VALIDATION_ERROR (공모전 아님, 이미 마감)
create function public.add_contest_to_roadmap(p_contest_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_contest public.contests%rowtype;
  v_key text;
  v_node public.nodes%rowtype;
  v_added boolean;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using detail = '로그인이 필요합니다.';
  end if;

  select * into v_contest from public.contests where id = p_contest_id;
  if not found then
    raise exception 'NOT_FOUND' using detail = '공고를 찾을 수 없습니다.';
  end if;

  if v_contest.source_tag is distinct from '공모전' then
    raise exception 'VALIDATION_ERROR' using detail = '공모전 공고만 로드맵에 추가할 수 있습니다.';
  end if;

  -- 마감 여부는 한국 날짜 기준 (탐색 목록 list_open_contests_for_me와 같은 규칙)
  if v_contest.source_status = '마감'
     or v_contest.deadline < (now() at time zone 'Asia/Seoul')::date then
    raise exception 'VALIDATION_ERROR' using detail = '이미 마감된 공고예요.';
  end if;

  v_key := 'contest:' || v_contest.source || ':' || v_contest.source_id;

  insert into public.nodes (user_id, title, theme, status, source, origin_key, contest_id)
  values (v_uid, v_contest.title, 'external', 'stored', 'explore', v_key, v_contest.id)
  on conflict (user_id, origin_key) do nothing
  returning * into v_node;

  v_added := found;
  if not v_added then
    select * into v_node from public.nodes where user_id = v_uid and origin_key = v_key;
  end if;

  return jsonb_build_object('added', v_added, 'node', to_jsonb(v_node));
end;
$$;

revoke all on function public.add_contest_to_roadmap(uuid) from public, anon;
grant execute on function public.add_contest_to_roadmap(uuid) to authenticated;
