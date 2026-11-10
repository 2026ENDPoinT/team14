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
