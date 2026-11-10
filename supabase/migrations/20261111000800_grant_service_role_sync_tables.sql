-- 수집 함수(sync-contests, sync-hacker-news)가 service_role로 저장할 수 있게 권한을 준다.
--
-- team4-dev에는 SQL Editor에서 같은 권한을 먼저 수동으로 줬다. 이 파일은 그 내용을 기록한 것이다.
-- grant는 이미 있으면 아무것도 바뀌지 않으므로 다시 실행해도 안전하다.
-- service_role은 서버 전용 키다. 프론트엔드에는 절대 넣지 않는다. (AGENTS.md 5장)
-- 삭제(DELETE) 권한은 주지 않는다. 수집 함수는 추가·수정만 한다.

grant select, insert, update on table public.contests to service_role;
grant select, insert, update on table public.tech_articles to service_role;
