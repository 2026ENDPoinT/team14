// 온보딩 화면 선택지

export const GRADES = [1, 2, 3, 4]

// STEP 2 경험: key·title은 DB 매핑(supabase/migrations/..._seed_onboarding_experience_types.sql)과
// 반드시 같아야 한다. 여기에만 키를 추가하면 저장 시 VALIDATION_ERROR가 난다.
export const EXPERIENCES = [
  { key: 'hackathon', title: '해커톤' },
  { key: 'contest', title: '공모전' },
  { key: 'project', title: '프로젝트' },
  { key: 'club', title: '동아리' },
  { key: 'student_council', title: '학생회' },
  { key: 'internship', title: '인턴십' },
  { key: 'undergrad_research', title: '학부연구생' },
  { key: 'exchange', title: '교환학생' },
  { key: 'leave', title: '휴학' },
  { key: 'military', title: '군 복무' },
  { key: 'certificate', title: '자격증' },
  { key: 'personal_growth', title: '개인 성장 활동' },
]

// STEP 4 희망 직무: 이름은 SPEC 4장. 키는 [초안] — 4번의 job-relevance.json 직무 키와 맞춰야 한다.
// (backend, ai는 docs/API.md 예시 키)
export const UNDECIDED_JOB = 'undecided'
export const JOBS = [
  { key: 'backend', title: '백엔드' },
  { key: 'frontend', title: '프론트엔드' },
  { key: 'ai', title: 'AI·머신러닝' },
  { key: 'data', title: '데이터 분석' },
  { key: 'security', title: '정보보안' },
  { key: 'system_network', title: '시스템·네트워크' },
  { key: 'game', title: '게임 개발' },
  { key: 'uiux', title: 'UI/UX' },
  { key: UNDECIDED_JOB, title: '아직 정하지 않음' },
]

// 미래 추천 과목의 초기 위치 (기본값 auto)
export const ROADMAP_MODES = [
  { key: 'auto', title: '바로 배치', description: '연계도의 권장 학기에 바로 넣어요.' },
  { key: 'inbox', title: '보관함', description: '보관함에 넣어 두고 직접 배치해요.' },
]

// ─────────────────────────────────────────────────────────────
// 최종 기획(Figma) 화면용 선택지
// 위의 기존 목록·키는 저장 계약이므로 바꾸지 않고, 화면 선택지만 아래에 따로 둔다.
// dbKey: 현재 DB·추천 데이터가 받는 키. null이면 아직 저장할 수 없어 완료 전에 안내한다.
// id: 화면 안에서만 쓰는 고유 값 (DB 키가 추가될 때 제안하는 이름과 같다). 저장 요청에 보내지 않는다.
// ─────────────────────────────────────────────────────────────

// 현재 학년·학기 (1-1 ~ 4-2). 지금 DB에는 학년(grade)만 저장된다.
export const TERMS = GRADES.flatMap((grade) =>
  [1, 2].map((semester) => ({ id: `${grade}-${semester}`, grade, semester })),
)

// 기존 경험: 8개 대분류 × 세부 6개
const exp = (id, title, dbKey = null) => ({ id, title, dbKey })
export const EXPERIENCE_GROUPS = [
  {
    id: 'project', title: '프로젝트', items: [
      exp('personal_project', '개인 프로젝트'),
      exp('team_project', '팀 프로젝트'),
      exp('course_project', '교과목 프로젝트'),
      exp('capstone', '캡스톤디자인'),
      exp('open_source', '오픈소스 기여'),
      exp('startup_service', '창업·서비스 개발'),
    ],
  },
  {
    id: 'contest', title: '공모전·대회', items: [
      exp('hackathon', '해커톤', 'hackathon'),
      exp('programming_contest', '프로그래밍 경진대회'),
      exp('ai_data_contest', 'AI·데이터 경진대회'),
      exp('idea_contest', '아이디어 공모전'),
      exp('startup_contest', '창업 경진대회'),
      exp('design_content_contest', '디자인·콘텐츠 공모전'),
    ],
  },
  {
    id: 'club', title: '동아리·커뮤니티', items: [
      exp('dev_club', '전공·개발 동아리'),
      exp('academic_club', '학술 동아리·학회'),
      exp('central_club', '중앙 동아리'),
      exp('study_group', '스터디'),
      exp('hobby_club', '취미·문화 동아리'),
      exp('external_community', '외부 커뮤니티'),
    ],
  },
  {
    id: 'external', title: '대외활동', items: [
      exp('supporters', '서포터즈'),
      exp('ambassador', '홍보대사'),
      exp('reporter_content', '기자단·콘텐츠 제작'),
      exp('volunteer', '봉사활동'),
      exp('education_mentoring', '교육·멘토링'),
      exp('camp_workshop', '캠프·워크숍'),
    ],
  },
  {
    id: 'career', title: '연구·진로', items: [
      exp('undergrad_research', '학부연구생', 'undergrad_research'),
      exp('lab_intern', '연구실 인턴'),
      exp('company_intern', '기업 인턴'),
      exp('field_practice', '현장실습'),
      exp('job_experience', '직무체험·기업탐방'),
      exp('career_program', '취업·진로 프로그램'),
    ],
  },
  {
    id: 'study', title: '학업·자기계발', items: [
      exp('certificate', '자격증', 'certificate'),
      exp('language_study', '어학 공부'),
      exp('online_course', '온라인 강의'),
      exp('bootcamp', '부트캠프'),
      exp('algorithm_practice', '알고리즘·코딩테스트'),
      exp('self_study', '개인 학습'),
    ],
  },
  {
    id: 'campus', title: '교내활동', items: [
      exp('general_council', '총학생회'),
      exp('department_council', '학과 학생회'),
      exp('campus_event_staff', '교내 행사 운영'),
      exp('tutoring', '튜터링·멘토링'),
      exp('campus_work', '교내 근로'),
      exp('student_autonomy', '학생 자치활동'),
    ],
  },
  {
    id: 'life', title: '대학생활 이벤트', items: [
      exp('leave', '휴학', 'leave'),
      exp('return_to_school', '복학'),
      exp('military', '군 복무', 'military'),
      exp('exchange', '교환학생', 'exchange'),
      exp('overseas_training', '해외연수'),
      exp('double_major', '복수전공·전과'),
    ],
  },
]

// 희망 직무 (대표 1개). dbKey는 위 JOBS 키와 같다.
// 시스템·네트워크·클라우드는 기존 system_network 키를 쓴다. (supabase/functions/_shared/interest-tags.ts와 같은 범위)
// 모바일 앱·임베디드·IoT는 직무 키·관련도 데이터가 아직 없어 저장할 수 없다.
const career = (id, title, dbKey = id) => ({ id, title, dbKey })
export const CAREERS = [
  career('backend', '백엔드 개발자'),
  career('frontend', '프론트엔드 개발자'),
  career('mobile', '모바일 앱 개발자', null),
  career('ai', 'AI·머신러닝 엔지니어'),
  career('data', '데이터 분석'),
  career('security', '정보보안'),
  career('system_network', '시스템·네트워크·클라우드'),
  career('embedded_iot', '임베디드·IoT', null),
  career('game', '게임 개발자'),
  career('uiux', 'UI/UX 엔지니어'),
  career(UNDECIDED_JOB, '아직 정하지 않음'),
]

// 로드맵 구성 방식
// auto: 추천 과목을 권장 학기에 배치 / manual: 추천 과목을 만들지 않음 (이수 과목·경험만 저장)
export const SETUP_MODES = [
  {
    key: 'auto',
    title: '자동으로 구성하기',
    description: '관심 분야와 교과과정을 바탕으로 추천 과목을 학기별로 배치해 드려요.',
  },
  {
    key: 'manual',
    title: '직접 구성하기',
    description: '추천 과목을 자동으로 추가하지 않고, 필요한 활동을 직접 선택하고 배치할 수 있어요.',
  },
]
