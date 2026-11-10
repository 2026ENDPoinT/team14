-- 온보딩 STEP 2 경험 키 → 노드 제목·테마 매핑 (complete_onboarding이 사용)
--
-- - 경험 선택은 선택 사항이다. 고른 경험만 보관함(stored) 노드로 만든다.
-- - 경험은 학기에 자동 배치하지 않고, 과목 추천 계산에도 쓰지 않는다.
-- - 키 목록은 SPEC.md 4장 STEP 2 예시 12개 기준. hackathon·club은 docs/API.md 4.2 예시 키.
-- - 온보딩 화면에 보이는 모든 경험 키가 이 표에 있어야 한다. (없으면 VALIDATION_ERROR)
-- - 키는 사용자 데이터와 프론트 선택지가 함께 쓰므로 바꾸지 않는다. 추가·수정은 새 migration으로 한다.

insert into public.onboarding_experience_types (key, title, theme) values
  ('hackathon',          '해커톤',         'external'),
  ('contest',            '공모전',         'external'),
  ('project',            '프로젝트',       'project'),
  ('club',               '동아리',         'event'),
  ('student_council',    '학생회',         'event'),
  ('internship',         '인턴십',         'career'),
  ('undergrad_research', '학부연구생',     'research'),
  ('exchange',           '교환학생',       'event'),
  ('leave',              '휴학',           'event'),
  ('military',           '군 복무',        'event'),
  ('certificate',        '자격증',         'career'),
  ('personal_growth',    '개인 성장 활동', 'free')
on conflict (key) do nothing;
