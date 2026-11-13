-- 채용 공고 (고용24 공채속보. 수집 함수 supabase/functions/sync-work24-jobs가 저장)
--
-- - 사용자별 데이터가 아니라 모든 사용자가 같은 공고를 본다.
-- - 로그인 사용자는 조회만 가능. 추가·수정·삭제 권한은 주지 않는다.
-- - 수집 함수는 service_role로 추가·수정만 한다. (삭제 권한 없음)
-- - 같은 공고 중복 저장 방지: (source, source_id) 유일 제약 + upsert
-- - 기존 테이블·데이터는 건드리지 않는다. (새 테이블만 추가)

create table public.job_postings (
  id uuid primary key default gen_random_uuid(),
  source text not null,                 -- 수집처 키. 예: work24_open_recruit
  source_id text not null,              -- 수집처의 원본 ID (고용24: empSeqno)
  title text not null check (char_length(btrim(title)) > 0), -- 공고명 (empWantedTitle)
  company text,                         -- 기업명 (empBusiNm)
  deadline date,                        -- 마감일 (empWantedEndt를 날짜로 바꾼 값). 비었거나 날짜가 아니면 null
  deadline_raw text,                    -- 마감일 원본 표기 (확인용)
  url text,                             -- 원문 링크 (empWantedHomepgDetail). http(s)가 아니면 null
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_postings_source_key unique (source, source_id)
);

create index job_postings_deadline_idx on public.job_postings (deadline);

-- updated_at 자동 갱신 (00100의 공통 함수 재사용)
create trigger job_postings_set_updated_at
  before update on public.job_postings
  for each row execute function public.set_updated_at();

alter table public.job_postings enable row level security;

revoke all on table public.job_postings from anon, authenticated;
grant select on public.job_postings to authenticated;
grant select, insert, update on table public.job_postings to service_role;

create policy job_postings_select_all on public.job_postings
  for select to authenticated
  using (true);
