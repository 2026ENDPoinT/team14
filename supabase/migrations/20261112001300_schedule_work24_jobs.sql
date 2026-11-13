-- 고용24 채용 공고 수집 예약 실행 (00900의 기존 예약 수집과 같은 방식)
--
-- 미리 필요한 것 (이 파일에 값을 쓰지 않는다):
--   Vault 비밀 project_url, sync_secret (00900에서 이미 사용 중인 것 그대로)
--   Edge Function secrets의 WORK24_API_KEY (고용24 인증키. Vault가 아니라 함수 환경 변수)
--
-- 시간: 매일 06:30 KST = 매일 21:30 UTC → '30 21 * * *'
--   (과기대 06:00 수집과 겹치지 않게 30분 뒤)
-- cron.schedule은 같은 작업 이름이 있으면 새로 만들지 않고 기존 작업을 갱신한다.

select cron.schedule(
  'sync-work24-jobs-daily',
  '30 21 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/sync-work24-jobs?pages=3',
    headers := jsonb_build_object(
      'x-sync-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'sync_secret')
    ),
    timeout_milliseconds := 60000
  );
  $$
);
