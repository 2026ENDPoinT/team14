-- 온보딩 경험 화면(EXPERIENCE_GROUPS, 8개 분류 × 6개)의 나머지 42개 항목을 저장할 수 있게 기준 데이터를 추가한다.
--
-- - key: 화면 항목 id 그대로 (frontend/src/features/onboarding/onboardingOptions.js)
-- - title: 화면 이름 그대로 (보관함 노드 제목이 된다)
-- - theme: 로드맵 종류 규칙과 같게 맞춘다 (frontend/src/features/roadmap/nodeCategories.js GROUP_THEME·ITEM_THEME)
--     프로젝트 → project / 공모전·대회, 대외활동 → external / 동아리·교내활동·대학생활 이벤트 → event
--     연구·진로 → career (연구실 인턴만 research) / 학업·자기계발 → free
-- - 기존 12개 키(00500)와 이미 저장된 노드는 바꾸지 않는다. 같은 키가 있으면 건너뛴다.
-- - complete_onboarding 함수와 검증 규칙은 바꾸지 않는다. (이 표에 없는 키는 여전히 VALIDATION_ERROR)

insert into public.onboarding_experience_types (key, title, theme) values
  -- 프로젝트
  ('personal_project',       '개인 프로젝트',        'project'),
  ('team_project',           '팀 프로젝트',          'project'),
  ('course_project',         '교과목 프로젝트',      'project'),
  ('capstone',               '캡스톤디자인',         'project'),
  ('open_source',            '오픈소스 기여',        'project'),
  ('startup_service',        '창업·서비스 개발',     'project'),
  -- 공모전·대회 (해커톤은 기존 키)
  ('programming_contest',    '프로그래밍 경진대회',  'external'),
  ('ai_data_contest',        'AI·데이터 경진대회',   'external'),
  ('idea_contest',           '아이디어 공모전',      'external'),
  ('startup_contest',        '창업 경진대회',        'external'),
  ('design_content_contest', '디자인·콘텐츠 공모전', 'external'),
  -- 동아리·커뮤니티
  ('dev_club',               '전공·개발 동아리',     'event'),
  ('academic_club',          '학술 동아리·학회',     'event'),
  ('central_club',           '중앙 동아리',          'event'),
  ('study_group',            '스터디',               'event'),
  ('hobby_club',             '취미·문화 동아리',     'event'),
  ('external_community',     '외부 커뮤니티',        'event'),
  -- 대외활동
  ('supporters',             '서포터즈',             'external'),
  ('ambassador',             '홍보대사',             'external'),
  ('reporter_content',       '기자단·콘텐츠 제작',   'external'),
  ('volunteer',              '봉사활동',             'external'),
  ('education_mentoring',    '교육·멘토링',          'external'),
  ('camp_workshop',          '캠프·워크숍',          'external'),
  -- 연구·진로 (학부연구생은 기존 키)
  ('lab_intern',             '연구실 인턴',          'research'),
  ('company_intern',         '기업 인턴',            'career'),
  ('field_practice',         '현장실습',             'career'),
  ('job_experience',         '직무체험·기업탐방',    'career'),
  ('career_program',         '취업·진로 프로그램',   'career'),
  -- 학업·자기계발 (자격증은 기존 키)
  ('language_study',         '어학 공부',            'free'),
  ('online_course',          '온라인 강의',          'free'),
  ('bootcamp',               '부트캠프',             'free'),
  ('algorithm_practice',     '알고리즘·코딩테스트',  'free'),
  ('self_study',             '개인 학습',            'free'),
  -- 교내활동
  ('general_council',        '총학생회',             'event'),
  ('department_council',     '학과 학생회',          'event'),
  ('campus_event_staff',     '교내 행사 운영',       'event'),
  ('tutoring',               '튜터링·멘토링',        'event'),
  ('campus_work',            '교내 근로',            'event'),
  ('student_autonomy',       '학생 자치활동',        'event'),
  -- 대학생활 이벤트 (휴학·군 복무·교환학생은 기존 키)
  ('return_to_school',       '복학',                 'event'),
  ('overseas_training',      '해외연수',             'event'),
  ('double_major',           '복수전공·전과',        'event')
on conflict (key) do nothing;
