-- 탐색 → 내 로드맵 보관함 추가 범위 확대
--
-- 1) 대외활동 공고: [공모전]만 추가할 수 있던 제한을 없앤다. (멘토링·설명회·박람회·직무체험·분류 없음 등 모두 가능)
--    - add_contest_to_roadmap의 이름·인자·반환 형식은 그대로다. 기존 화면 호출과 기존 공모전 노드는 바뀌지 않는다.
--    - 막는 경우는 하나: 이미 마감된 공고 (수집처 상태 '마감' 또는 마감일이 한국 날짜 기준 지남)
-- 2) 고용24 채용 공고: 새 RPC add_job_posting_to_roadmap
--    - 노드: theme 'career'(진로·취업), source 'explore', status 'stored'(보관함), period_id null
--    - nodes.job_posting_id: 노드가 어떤 채용 공고에서 왔는지. 공고명·기업명·마감일·원문 링크는 job_postings에서 읽는다.
--    - 중복 방지: (user_id, origin_key) 유일 제약 + on conflict do nothing
--        대외활동 origin_key = 'contest:<source>:<source_id>' (기존과 같음)
--        채용     origin_key = 'job:<source>:<source_id>'     (출처가 다르면 키가 겹치지 않는다)
--    - 노드 제목은 화면이 보낸 값이 아니라 DB의 원본 공고에서 가져온다.
--    - 마감일이 없는 공고도 추가할 수 있다. 날짜를 만들지 않는다.
-- job_posting_id·origin_key는 사용자가 직접 쓸 수 없다 (00200·01100의 컬럼 권한에 없음). 이 RPC만 넣는다.

-- 1. 대외활동 공고 추가: 공모전 제한 제거 ------------------------------------
create or replace function public.add_contest_to_roadmap(p_contest_id uuid)
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

-- 2. 채용 공고 노드 ---------------------------------------------------------
alter table public.nodes
  add column job_posting_id uuid references public.job_postings (id) on delete set null;

create index nodes_job_posting_id_idx on public.nodes (job_posting_id);

-- 채용 공고를 내 보관함에 추가
-- 반환: { "added": true|false, "node": <nodes 행> }  (이미 있으면 added=false, 기존 노드)
-- 오류: UNAUTHENTICATED / NOT_FOUND / VALIDATION_ERROR (이미 마감)
create function public.add_job_posting_to_roadmap(p_job_posting_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_job public.job_postings%rowtype;
  v_key text;
  v_node public.nodes%rowtype;
  v_added boolean;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using detail = '로그인이 필요합니다.';
  end if;

  select * into v_job from public.job_postings where id = p_job_posting_id;
  if not found then
    raise exception 'NOT_FOUND' using detail = '채용 공고를 찾을 수 없습니다.';
  end if;

  -- 마감일이 있고 한국 날짜 기준으로 지났으면 막는다 (마감일이 없으면 막지 않는다)
  if v_job.deadline < (now() at time zone 'Asia/Seoul')::date then
    raise exception 'VALIDATION_ERROR' using detail = '이미 마감된 공고예요.';
  end if;

  v_key := 'job:' || v_job.source || ':' || v_job.source_id;

  insert into public.nodes (user_id, title, theme, status, source, origin_key, job_posting_id)
  values (v_uid, v_job.title, 'career', 'stored', 'explore', v_key, v_job.id)
  on conflict (user_id, origin_key) do nothing
  returning * into v_node;

  v_added := found;
  if not v_added then
    select * into v_node from public.nodes where user_id = v_uid and origin_key = v_key;
  end if;

  return jsonb_build_object('added', v_added, 'node', to_jsonb(v_node));
end;
$$;

revoke all on function public.add_job_posting_to_roadmap(uuid) from public, anon;
grant execute on function public.add_job_posting_to_roadmap(uuid) to authenticated;
