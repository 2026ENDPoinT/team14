-- AI 진로 추천: 사용자별 마지막 성공 결과 1개
--
-- - 저장 값: 추천 직무(job) · 추천 이유(reason) · 추천 시각(recommended_at)뿐이다.
--   성적 · 역량 키워드 · 이수 과목 목록 · 근거 키워드는 저장하지 않는다.
-- - 저장: Edge Function recommend-career가 추천에 성공한 직후, 호출한 사용자 본인 권한(JWT)으로 upsert한다.
--   → 아래 RLS가 그대로 적용된다. 실패한 추천은 저장하지 않으므로 직전 성공 결과가 남는다.
-- - 결과를 보거나 다시 추천받아도 profiles.interests(희망 직무)와 로드맵 노드는 바뀌지 않는다.
-- - 기존 테이블·데이터는 바꾸지 않는다.

create table public.career_recommendations (
  user_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  -- 온보딩 희망 직무 10개 키 (frontend onboardingOptions.js CAREERS, recommend-career JOBS와 같다)
  job text not null check (job in (
    'backend', 'frontend', 'mobile', 'ai', 'data',
    'security', 'system_network', 'embedded_iot', 'game', 'uiux'
  )),
  reason text not null check (char_length(btrim(reason)) between 1 and 200),
  recommended_at timestamptz not null default now()
);

alter table public.career_recommendations enable row level security;

-- 본인 행만 조회·저장 (삭제 없음). user_id는 auth.uid() 기본값이라 따로 넣지 않는다.
revoke all on table public.career_recommendations from anon, authenticated;
grant select on public.career_recommendations to authenticated;
grant insert (job, reason, recommended_at) on public.career_recommendations to authenticated;
grant update (job, reason, recommended_at) on public.career_recommendations to authenticated;

create policy career_recommendations_select_own on public.career_recommendations
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy career_recommendations_insert_own on public.career_recommendations
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy career_recommendations_update_own on public.career_recommendations
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
