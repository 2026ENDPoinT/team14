-- 관심 분야 태그 + 기술 글(Hacker News) + 탐색 목록 조회 함수
--
-- 1) contests에 tags 추가 (sync-contests가 제목으로 태그를 붙여 저장)
-- 2) tech_articles 새 테이블 (sync-hacker-news가 저장). 제목·출처명·원문 URL·게시 시각·태그만 저장. 본문·댓글 없음.
-- 3) 로그인 사용자용 조회 함수 2개: 내 관심 분야(profiles.interests)와 태그가 겹치는 글을 먼저 돌려준다.
--    태그는 글에, 관심 분야는 프로필에 따로 있고 조회할 때 비교하므로 관심 분야를 바꾸면 재수집 없이 바로 반영된다.
--
-- tags 값은 온보딩 희망 직무 키(backend, ai, security …)와 같다. 빈 배열 = 미분류.
-- 수집 함수는 service_role로 저장하므로 사용자에게는 조회 권한만 준다.

-- 1. contests.tags ----------------------------------------------------------
alter table public.contests
  add column tags text[] not null default '{}';

create index contests_tags_idx on public.contests using gin (tags);

-- 2. tech_articles ----------------------------------------------------------
create table public.tech_articles (
  id uuid primary key default gen_random_uuid(),
  source text not null,                 -- 수집처 키. 예: hacker_news
  source_id text not null,              -- 수집처의 원본 글 ID (Hacker News item id)
  source_name text not null,            -- 화면에 보일 출처명. 예: Hacker News
  title text not null check (char_length(btrim(title)) > 0),
  url text not null check (url ~* '^https?://'),   -- 원문 링크
  published_at timestamptz not null,    -- 수집처 게시 시각
  tags text[] not null default '{}',
  first_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tech_articles_source_key unique (source, source_id)
);

create index tech_articles_published_at_idx on public.tech_articles (published_at desc);
create index tech_articles_tags_idx on public.tech_articles using gin (tags);

create trigger tech_articles_set_updated_at
  before update on public.tech_articles
  for each row execute function public.set_updated_at();

alter table public.tech_articles enable row level security;

revoke all on table public.tech_articles from anon, authenticated;
grant select on public.tech_articles to authenticated;

create policy tech_articles_select_all on public.tech_articles
  for select to authenticated
  using (true);

-- 3. 탐색 목록 조회 함수 ----------------------------------------------------
-- security invoker: 호출한 사용자 권한으로 실행 → 프로필은 RLS 때문에 본인 것만 읽힌다.
-- matches_interest: 내 관심 분야와 태그가 하나라도 겹치면 true.
-- 관심 분야가 없거나 겹치는 글이 없으면 모두 false → 전체 목록이 기본 순서대로 나온다.

-- 기술 글: 관심 분야 일치 먼저, 그다음 최신순
create function public.list_tech_articles_for_me(p_limit integer default 30)
returns table (
  id uuid,
  source text,
  source_name text,
  title text,
  url text,
  published_at timestamptz,
  tags text[],
  matches_interest boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  with me as (
    select coalesce(
      (select p.interests from public.profiles p where p.id = auth.uid()),
      '{}'::text[]
    ) as interests
  )
  select a.id, a.source, a.source_name, a.title, a.url, a.published_at, a.tags,
         a.tags && me.interests as matches_interest
  from public.tech_articles a
  cross join me
  order by (a.tags && me.interests) desc, a.published_at desc, a.id
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
$$;

-- 대외활동: 한국 시간 오늘 기준 접수 중인 것만, 관심 분야 일치 먼저, 그다음 마감 임박순
-- 접수 중 = 마감일이 오늘(KST) 이후이고, 수집처 상태가 '마감'이 아님. 마감일이 없는 공고는 제외.
-- d_day: 마감일 - 오늘(KST). 0이면 오늘 마감(D-day), 3이면 D-3.
create function public.list_open_contests_for_me(p_limit integer default 30)
returns table (
  id uuid,
  source text,
  title text,
  source_tag text,
  source_status text,
  deadline date,
  d_day integer,
  url text,
  is_pinned boolean,
  tags text[],
  matches_interest boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  with me as (
    select coalesce(
      (select p.interests from public.profiles p where p.id = auth.uid()),
      '{}'::text[]
    ) as interests
  ),
  today as (
    select (now() at time zone 'Asia/Seoul')::date as kst
  )
  select c.id, c.source, c.title, c.source_tag, c.source_status, c.deadline,
         c.deadline - today.kst as d_day,
         c.url, c.is_pinned, c.tags,
         c.tags && me.interests as matches_interest
  from public.contests c
  cross join me
  cross join today
  where c.deadline >= today.kst
    and coalesce(c.source_status, '') <> '마감'
  order by (c.tags && me.interests) desc, c.deadline asc, c.id
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
$$;

revoke all on function public.list_tech_articles_for_me(integer) from public, anon;
revoke all on function public.list_open_contests_for_me(integer) from public, anon;
grant execute on function public.list_tech_articles_for_me(integer) to authenticated;
grant execute on function public.list_open_contests_for_me(integer) to authenticated;
