-- 수집 함수 예약 실행 (Supabase Cron = pg_cron + pg_net)
--
-- 미리 필요한 것 (이 파일에 값을 쓰지 않는다):
--   Vault 비밀 2개. 이름만 정해져 있고 값은 환경마다 SQL Editor 등에서 직접 넣는다.
--     project_url : https://<project-ref>.supabase.co
--     sync_secret : 수집 함수의 SYNC_SECRET과 같은 값 (x-sync-secret 헤더로 보냄)
--
-- 시간대: cron.timezone = GMT(UTC). 한국 시간(KST, UTC+9, 서머타임 없음)으로 바꾸면
--   과기대        매일 06:00 KST = 매일 21:00 UTC   → '0 21 * * *'
--   Hacker News   매시간 10분     (시간대와 무관)    → '10 * * * *'
--
-- cron.schedule은 같은 작업 이름이 있으면 새로 만들지 않고 기존 작업을 갱신한다.
-- 실행 결과 확인: cron.job_run_details (SQL 실행 성공 여부) + net._http_response (함수의 실제 HTTP 응답)

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'sync-contests-daily',
  '0 21 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/sync-contests?pages=3',
    headers := jsonb_build_object(
      'x-sync-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'sync_secret')
    ),
    timeout_milliseconds := 60000
  );
  $$
);

select cron.schedule(
  'sync-hacker-news-hourly',
  '10 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/sync-hacker-news?limit=200',
    headers := jsonb_build_object(
      'x-sync-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'sync_secret')
    ),
    timeout_milliseconds := 60000
  );
  $$
);
