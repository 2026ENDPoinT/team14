-- 노드 종류(카테고리) 영구 저장
--
-- 1) node_categories: 사용자가 직접 만든 종류 (예: '알바', '여행'). 사용자별로 이름이 겹치지 않는다.
-- 2) nodes에 선택값 3개 추가 (기존 theme·기존 노드는 그대로)
--      category_key : 기본 종류 키 (프론트 nodeCategories.js의 BASE_CATEGORIES id. 예: 'project', 'contest', 'major')
--      category_id  : 사용자 정의 종류 (node_categories.id)
--      detail_key   : 세부 활동 키 (온보딩 경험 항목 id. 예: 'hackathon')
--    한 노드는 기본 종류(category_key)나 사용자 정의 종류(category_id) 중 하나만 가진다. 둘 다 없으면 theme으로 표시한다.
-- 3) 사용자 정의 종류를 지우면 연결된 노드는 남고 category_id만 비워진다 → 노드는 기존 theme으로 표시된다.
-- 4) 다른 사람의 종류는 내 노드에 연결할 수 없다: (category_id, user_id) 복합 외래키로 DB가 막는다.
--
-- 기존 데이터: 새 컬럼은 모두 null로 시작한다. 기존 행을 바꾸거나 지우지 않는다.

-- 1. node_categories ------------------------------------------------------
create table public.node_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 12),  -- 프론트 CATEGORY_NAME_MAX = 12
  base_theme text not null default 'free'
    check (base_theme in ('major', 'project', 'external', 'career', 'research', 'event', 'free')),
  created_at timestamptz not null default now(),
  -- nodes가 "같은 사용자의 종류"만 가리키게 하는 복합 외래키용
  constraint node_categories_id_user_key unique (id, user_id)
);

-- 사용자별 이름 중복 방지 (앞뒤 공백·대소문자 무시: 프론트 sameName과 같은 규칙)
create unique index node_categories_user_name_key
  on public.node_categories (user_id, lower(btrim(name)));

alter table public.node_categories enable row level security;

revoke all on table public.node_categories from anon, authenticated;
grant select, delete on public.node_categories to authenticated;
grant insert (name, base_theme) on public.node_categories to authenticated; -- user_id는 auth.uid() 기본값
grant update (name, base_theme) on public.node_categories to authenticated;

create policy node_categories_select_own on public.node_categories
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy node_categories_insert_own on public.node_categories
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy node_categories_update_own on public.node_categories
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy node_categories_delete_own on public.node_categories
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- 2. nodes 확장 -----------------------------------------------------------
alter table public.nodes
  add column category_key text check (category_key ~ '^[a-z][a-z0-9_]{0,39}$'),
  add column category_id uuid,
  add column detail_key text check (detail_key ~ '^[a-z][a-z0-9_]{0,39}$'),
  -- 기본 종류와 사용자 정의 종류를 동시에 가질 수 없다
  add constraint nodes_category_one_check check (category_key is null or category_id is null),
  -- 세부 활동은 기본 종류를 골랐을 때만 (사용자 정의 종류에는 세부 활동이 없다)
  add constraint nodes_detail_needs_key_check check (detail_key is null or category_key is not null),
  -- 본인 종류만 연결 + 종류를 지우면 category_id만 비운다 (user_id는 그대로, 노드는 남음)
  add constraint nodes_category_fkey foreign key (category_id, user_id)
    references public.node_categories (id, user_id) on delete set null (category_id);

create index nodes_category_id_idx on public.nodes (category_id);

-- 기존 컬럼 단위 권한(00200)에 새 컬럼만 더한다
grant insert (category_key, category_id, detail_key) on public.nodes to authenticated;
grant update (category_key, category_id, detail_key) on public.nodes to authenticated;
