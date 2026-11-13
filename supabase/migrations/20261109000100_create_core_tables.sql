-- TASKS 3-3: 기본 테이블 생성 (docs/API.md 2장 기준)
-- 규칙: DB 컬럼은 snake_case. camelCase 변환은 frontend/src/services/ 에서 한다.
-- 각 테이블은 만들자마자 RLS를 켠다. 정책이 없으면 아무도 접근할 수 없다.
-- 접근 정책·권한은 다음 파일(20261109000200)에서 추가한다.

-- 공통: updated_at 자동 갱신
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ------------------------------------------------------------
-- profiles (User): auth.users 1명당 1행. 가입 시 트리거로 자동 생성
-- ------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text,                                         -- 중복 허용, 온보딩 전에는 비어 있을 수 있음
  grade smallint check (grade between 1 and 4),          -- 온보딩 전에는 null
  onboarding_completed boolean not null default false,
  interests text[] not null default '{}',                -- 희망 직무 키 목록
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- ------------------------------------------------------------
-- timeline_periods (TimelinePeriod): 학기·기간
-- ------------------------------------------------------------
create table public.timeline_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null
    check (type in ('semester', 'leave', 'military', 'exchange', 'extra', 'custom')),
  name text not null,
  sort_order integer not null check (sort_order >= 0),  -- API의 order (order는 SQL 예약어)
  created_at timestamptz not null default now(),
  -- 다른 테이블이 "같은 사용자의 학기"만 가리키게 하는 복합 외래키용
  constraint timeline_periods_id_user_key unique (id, user_id),
  -- 한 사용자 안에서 순서 중복 금지. 삽입 RPC가 여러 행을 한꺼번에 +1 할 수 있도록
  -- 검사를 트랜잭션 끝으로 미룬다(deferrable).
  constraint timeline_periods_user_order_key unique (user_id, sort_order)
    deferrable initially deferred
);
alter table public.timeline_periods enable row level security;

-- ------------------------------------------------------------
-- nodes (Node): 활동·교과목 노드. period_id가 null이면 보관함
-- ------------------------------------------------------------
create table public.nodes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) > 0),
  theme text not null,                                   -- 기본 테마 키 또는 사용자 정의 테마 ID
  period_id uuid,
  position_x double precision not null default 0,        -- 좌표 기준은 [협의 필요]
  position_y double precision not null default 0,
  status text not null check (status in ('placed', 'stored')),
  source text not null default 'user'
    check (source in ('user', 'onboarding', 'completed_course', 'recommended', 'explore')),
  origin_key text,                                       -- 예: course:cs2026-2-1-01
  completed boolean not null default false,              -- 이수 완료 표시
  created_at timestamptz not null default now(),
  constraint nodes_id_user_key unique (id, user_id),
  -- 같은 과목 노드 중복 생성 방지 (origin_key가 null인 노드는 여러 개 가능)
  constraint nodes_user_origin_key unique (user_id, origin_key),
  -- 본인 학기에만 배치 가능. 노드가 남은 학기는 지울 수 없음
  -- (학기 삭제는 노드를 먼저 보관함으로 옮기는 RPC가 처리)
  constraint nodes_period_fkey foreign key (period_id, user_id)
    references public.timeline_periods (id, user_id),
  -- placed ↔ 학기 있음, stored ↔ 보관함(period_id null)
  constraint nodes_status_period_check check (
    (status = 'placed' and period_id is not null)
    or (status = 'stored' and period_id is null)
  )
);
create index nodes_user_period_idx on public.nodes (user_id, period_id);
alter table public.nodes enable row level security;

-- ------------------------------------------------------------
-- edges (Edge): 사용자가 직접 만든 노드 연결선
-- ------------------------------------------------------------
create table public.edges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  source_node_id uuid not null,
  target_node_id uuid not null,
  created_at timestamptz not null default now(),
  -- 본인 노드끼리만 연결. 노드가 삭제되면 연결선도 삭제
  constraint edges_source_fkey foreign key (source_node_id, user_id)
    references public.nodes (id, user_id) on delete cascade,
  constraint edges_target_fkey foreign key (target_node_id, user_id)
    references public.nodes (id, user_id) on delete cascade
);
create index edges_source_idx on public.edges (source_node_id, user_id);
create index edges_target_idx on public.edges (target_node_id, user_id);
alter table public.edges enable row level security;

-- ------------------------------------------------------------
-- node_documents (NodeDocument): 노드와 1:1
-- ------------------------------------------------------------
create table public.node_documents (
  node_id uuid primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  content jsonb not null default '{"format": "plain", "body": ""}'::jsonb,
  updated_at timestamptz not null default now(),
  -- 본인 노드의 문서만. 노드 삭제 시 함께 삭제 (학기 삭제 때는 노드가 남으므로 문서도 남음)
  constraint node_documents_node_fkey foreign key (node_id, user_id)
    references public.nodes (id, user_id) on delete cascade
);
create trigger node_documents_set_updated_at
  before update on public.node_documents
  for each row execute function public.set_updated_at();
alter table public.node_documents enable row level security;

-- ------------------------------------------------------------
-- diaries (Diary): 사용자당 날짜별 1개. 작성·수정은 save_diary RPC로만
-- ------------------------------------------------------------
create table public.diaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,                                    -- 어느 날의 일기인지 (보상 날짜와 무관)
  mood text,                                             -- 값 목록 [미확정] → 제약 없음
  content text not null default '',                      -- 글자 수와 관계없이 저장
  photo_urls text[] not null default '{}',
  linked_node_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint diaries_user_date_key unique (user_id, date),
  -- 본인 노드만 연결. 노드가 삭제되면 연결만 끊음
  constraint diaries_linked_node_fkey foreign key (linked_node_id, user_id)
    references public.nodes (id, user_id) on delete set null (linked_node_id)
);
create index diaries_linked_node_idx on public.diaries (linked_node_id, user_id);
create trigger diaries_set_updated_at
  before update on public.diaries
  for each row execute function public.set_updated_at();
alter table public.diaries enable row level security;

-- ------------------------------------------------------------
-- pets (Pet): 사용자당 1마리. 온보딩 RPC가 생성, 보상 RPC만 변경
-- ------------------------------------------------------------
create table public.pets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  type text,                                             -- 외형 키 [미확정] → 제약 없음
  stage smallint not null default 1 check (stage between 1 and 4),
  energy integer not null default 0 check (energy >= 0), -- 누적 에너지, 차감 없음
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- 단계 기준값(0/50/150/300)의 DB 관리 방식은 [미확정]이라 여기서 만들지 않는다.
create trigger pets_set_updated_at
  before update on public.pets
  for each row execute function public.set_updated_at();
alter table public.pets enable row level security;

-- ------------------------------------------------------------
-- reward_events (RewardEvent): 보상 이력. 보상 RPC만 추가
-- ------------------------------------------------------------
create table public.reward_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null
    check (type in ('attendance', 'diary_first_of_day', 'node_reflection', 'semester_reflection')),
  ref_id text not null check (char_length(ref_id) > 0),  -- KST 날짜 또는 nodeId/periodId
  energy integer not null check (energy > 0),
  created_at timestamptz not null default now(),
  -- 같은 보상 중복 지급 방지 (API.md 3장)
  constraint reward_events_user_type_ref_key unique (user_id, type, ref_id)
);
alter table public.reward_events enable row level security;
