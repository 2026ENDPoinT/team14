-- 공모전·대외활동 공고 (수집 함수 supabase/functions/sync-contests가 저장)
--
-- - 사용자별 데이터가 아니라 모든 사용자가 같은 공고를 본다.
-- - 로그인 사용자는 조회만 가능. 추가·수정·삭제 권한은 주지 않는다.
--   수집 함수는 서버에서 service_role로 실행되어 RLS를 거치지 않고 저장한다.
-- - 같은 공고 중복 저장 방지: (source, source_id) 유일 제약 + upsert

create table public.contests (
  id uuid primary key default gen_random_uuid(),
  source text not null,                 -- 수집처 키. 예: seoultech_center_program
  source_id text not null,              -- 수집처의 원본 글 ID (서울과기대: bidx)
  title text not null check (char_length(btrim(title)) > 0),
  source_tag text,                      -- 제목 앞 [분류] (예: 공모전, 박람회). 없으면 null
  source_status text,                   -- 수집처 표시 상태 (예: 진행, 마감)
  deadline date,                        -- 마감일 (수집처 표기 날짜, KST)
  url text not null,                    -- 원문 상세 링크
  is_pinned boolean not null default false,   -- 수집처 상단 고정 공지 여부
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contests_source_key unique (source, source_id)
);

create index contests_deadline_idx on public.contests (deadline);

-- updated_at 자동 갱신 (00100의 공통 함수 재사용)
create trigger contests_set_updated_at
  before update on public.contests
  for each row execute function public.set_updated_at();

alter table public.contests enable row level security;

revoke all on table public.contests from anon, authenticated;
grant select on public.contests to authenticated;

create policy contests_select_all on public.contests
  for select to authenticated
  using (true);
