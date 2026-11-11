-- TASKS 3-5: 사용자별 RLS 정책과 테이블 권한 (docs/API.md 5장 표 기준)
--
-- 두 겹으로 막는다.
--   1) 권한(GRANT): 어떤 동작(조회·추가·수정·삭제)과 어떤 컬럼을 쓸 수 있는지
--   2) RLS 정책: 그중 어떤 행(본인 행)만 다룰 수 있는지
-- "RPC로만" 항목은 권한을 아예 주지 않는다. 나중에 만들 RPC(security definer)만 바꿀 수 있다.
-- Supabase는 public 테이블에 anon/authenticated 권한을 기본으로 모두 주므로 먼저 전부 회수한다.

revoke all on table
  public.profiles,
  public.timeline_periods,
  public.nodes,
  public.edges,
  public.node_documents,
  public.diaries,
  public.pets,
  public.reward_events
from anon, authenticated;

-- 트리거 함수는 직접 호출할 필요가 없다.
revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- ------------------------------------------------------------
-- profiles: 조회 본인 / 추가 가입 트리거 / 수정 본인(닉네임·학년·희망 직무만) / 삭제 불가
-- onboarding_completed는 직접 바꿀 수 없다. (바꾸면 온보딩을 다시 실행해 학기가 중복될 수 있음)
-- ------------------------------------------------------------
grant select on public.profiles to authenticated;
grant update (nickname, grade, interests) on public.profiles to authenticated;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ------------------------------------------------------------
-- timeline_periods: 조회 본인 / 추가 RPC / 수정 본인(이름·타입만) / 삭제 RPC
-- 순서(sort_order) 변경은 reorder_periods·insert_period RPC로만 한다.
-- ------------------------------------------------------------
grant select on public.timeline_periods to authenticated;
grant update (name, type) on public.timeline_periods to authenticated;

create policy timeline_periods_select_own on public.timeline_periods
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy timeline_periods_update_own on public.timeline_periods
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ------------------------------------------------------------
-- nodes: 조회·추가·수정·삭제 모두 본인
-- origin_key(온보딩 중복 방지 키)는 직접 쓸 수 없다. 온보딩 RPC만 넣는다.
-- ------------------------------------------------------------
grant select, delete on public.nodes to authenticated;
grant insert (id, user_id, title, theme, period_id, position_x, position_y, status, source, completed)
  on public.nodes to authenticated;
grant update (title, theme, period_id, position_x, position_y, status, completed)
  on public.nodes to authenticated;

create policy nodes_select_own on public.nodes
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy nodes_insert_own on public.nodes
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy nodes_update_own on public.nodes
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy nodes_delete_own on public.nodes
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ------------------------------------------------------------
-- edges: 조회·추가·수정·삭제 모두 본인
-- ------------------------------------------------------------
grant select, delete on public.edges to authenticated;
grant insert (id, user_id, source_node_id, target_node_id) on public.edges to authenticated;
grant update (source_node_id, target_node_id) on public.edges to authenticated;

create policy edges_select_own on public.edges
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy edges_insert_own on public.edges
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy edges_update_own on public.edges
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy edges_delete_own on public.edges
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ------------------------------------------------------------
-- node_documents: 조회·추가·수정·삭제 모두 본인 (자동 저장은 upsert)
-- supabase-js의 upsert는 보낸 컬럼을 모두 UPDATE 하므로 node_id·user_id 수정 권한도 준다.
-- (다른 사람 노드를 가리키면 복합 외래키, 다른 user_id면 RLS가 막는다)
-- ------------------------------------------------------------
grant select, delete on public.node_documents to authenticated;
grant insert (node_id, user_id, content) on public.node_documents to authenticated;
grant update (node_id, user_id, content) on public.node_documents to authenticated;

create policy node_documents_select_own on public.node_documents
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy node_documents_insert_own on public.node_documents
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy node_documents_update_own on public.node_documents
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy node_documents_delete_own on public.node_documents
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ------------------------------------------------------------
-- diaries: 조회 본인 / 추가·수정 save_diary RPC / 삭제 본인 (보상 이력은 남음)
-- ------------------------------------------------------------
grant select, delete on public.diaries to authenticated;

create policy diaries_select_own on public.diaries
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy diaries_delete_own on public.diaries
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ------------------------------------------------------------
-- pets: 조회 본인 / 추가·수정 RPC / 삭제 불가
-- 에너지·단계는 보상 RPC(check_in, save_diary)만 바꾼다.
-- ------------------------------------------------------------
grant select on public.pets to authenticated;

create policy pets_select_own on public.pets
  for select to authenticated
  using (user_id = (select auth.uid()));

-- ------------------------------------------------------------
-- reward_events: 조회 본인 / 추가 RPC / 수정·삭제 불가
-- ------------------------------------------------------------
grant select on public.reward_events to authenticated;

create policy reward_events_select_own on public.reward_events
  for select to authenticated
  using (user_id = (select auth.uid()));
