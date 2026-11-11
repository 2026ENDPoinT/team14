// 공고·글 제목 → 가장 관련 높은 직무 분야 (탐색 세 탭 공통, 화면 표시용)
// 보통 하나. 백엔드와 프론트엔드가 제목에 둘 다 명시되면 둘 다 붙인다.
//
// - 분야 키는 온보딩 희망 직무 키(onboardingOptions.js CAREERS id)와 같다. DB profiles.interests에도 같은 키가 저장된다.
// - 단어 목록은 수집기의 관심 분야 태그(supabase/functions/_shared/interest-tags.ts INTEREST_KEYWORDS)를 그대로 옮겨 왔다.
//   다른 점은 하나: 한 단어만으로 분야를 단정하기 어려운 단어('보안', 'AI', 'API' 등)를 '약한 근거'로 따로 뒀다.
//   ※ interest-tags.ts의 단어를 바꾸면 여기도 같이 바꾼다. (같은지 확인하는 테스트가 있다)
//   모바일 앱·임베디드·IoT는 interest-tags.ts에 아직 없어서 여기에서 단어를 추가했다.
// - 고르는 규칙
//   강한 근거 단어 = 2점, 약한 근거 단어 = 1점. 분야별로 더해서
//   · 최고 점수가 2점 이상이고 1등이 하나뿐이면 그 분야
//   · 아니면 '기타' (근거가 약하거나, 비슷한 후보가 여러 개라 하나를 고를 근거가 부족함)
// - 저장된 제목·분류는 바꾸지 않는다. 화면에서 제목 앞에 [분야명]만 붙인다.

export const OTHER_FIELD = 'other'

// 화면에 보일 한글 분야명: 온보딩 JOBS의 짧은 이름. JOBS에 없는 두 분야는 CAREERS 이름에서 가져왔다.
export const FIELD_LABELS = {
  backend: '백엔드',
  frontend: '프론트엔드',
  mobile: '모바일 앱', // CAREERS '모바일 앱 개발자'
  ai: 'AI·머신러닝',
  data: '데이터 분석',
  security: '정보보안',
  system_network: '시스템·네트워크',
  embedded_iot: '임베디드·IoT', // CAREERS '임베디드·IoT'
  game: '게임 개발',
  uiux: 'UI/UX',
  [OTHER_FIELD]: '기타',
}

// 분야별 단어. strong: interest-tags.ts 단어(약한 근거로 옮긴 것 제외) + 추가 단어 / weak: 한 단어만으로는 단정하지 않는 단어
export const FIELD_KEYWORDS = {
  backend: {
    strong: [
      '백엔드', '서버 개발', '서버개발', '데이터베이스',
      'backend', 'back-end', 'back end', 'REST API', 'GraphQL', 'gRPC', 'database', 'databases',
      'PostgreSQL', 'Postgres', 'MySQL', 'SQLite', 'Redis', 'Kafka', 'microservice', 'microservices',
      'Django', 'FastAPI', 'Spring Boot', 'Node.js',
    ],
    weak: ['API', 'APIs'],
  },
  frontend: {
    strong: [
      '프론트엔드', '웹 퍼블리싱', '웹퍼블리싱',
      'frontend', 'front-end', 'front end', 'React', 'Next.js', 'Vue', 'Svelte', 'CSS', 'HTML', 'JavaScript', 'TypeScript',
    ],
    weak: [],
  },
  mobile: {
    strong: ['모바일 앱', '모바일앱', '앱 개발', 'iOS', 'Android', '안드로이드', 'SwiftUI', 'Kotlin', 'Flutter', 'React Native', 'Jetpack Compose'],
    weak: ['Swift', '모바일'],
  },
  ai: {
    strong: [
      '인공지능', '머신러닝', '딥러닝', '생성형', '자연어처리', '강화학습', '컴퓨터 비전', '거대언어모델',
      'LLM', 'LLMs', 'GPT', 'NLP', 'machine learning', 'deep learning', 'neural network', 'neural networks',
      'reinforcement learning', 'computer vision',
      // 추가: 'AI'와 함께 쓰여 AI 분야임이 분명한 표현
      'AI 에이전트', 'AI 개발', 'AI 엔지니어', 'AI 모델', 'AI 연구', 'AI agent', 'AI agents', 'AI model', 'AI models',
      'OpenAI', 'ChatGPT',
    ],
    weak: ['AI'],
  },
  data: {
    strong: [
      '데이터 분석', '데이터분석', '빅데이터', '데이터 사이언스', '데이터 엔지니어', '데이터 시각화', '공공데이터', '데이터 활용',
      'data science', 'data scientist', 'data engineering', 'data engineer', 'data analysis', 'data analytics',
      'data pipeline', 'data pipelines', 'data warehouse', 'ETL',
    ],
    weak: ['analytics', 'dataset', 'datasets'],
  },
  security: {
    strong: [
      '정보보호', '정보보안', '사이버보안', '사이버 보안', '취약점', '해킹대회', '해킹 대회', '모의해킹', '침해사고', '악성코드', '암호학',
      'CTF', 'CVE', 'OAuth', 'vulnerability', 'vulnerabilities', 'cybersecurity', 'infosec', 'cryptography', 'encryption',
      'exploit', 'RCE', 'remote code execution', 'malware', 'ransomware', 'phishing', 'zero-day', '0-day', 'XSS', 'CSRF', 'sql injection', 'backdoor',
      // 추가
      '보안 엔지니어', '보안관제', '보안 관제',
    ],
    weak: ['보안', 'security'], // 소문자라 대소문자 구분 없이 한 번만 센다
  },
  system_network: {
    strong: [
      '클라우드', '리눅스', '운영체제', '컴퓨터 네트워크', '네트워크 엔지니어', '네트워크 관리', '시스템 엔지니어', '데브옵스',
      'Linux', 'Unix', 'kernel', 'operating system', 'operating systems', 'Kubernetes', 'Docker', 'TCP', 'DNS', 'BGP',
      'AWS', 'Azure', 'GCP', 'cloud computing', 'cloud-native', 'DevOps', 'SRE', 'distributed systems',
      // 추가
      'IT 인프라', '인프라 엔지니어',
    ],
    weak: ['네트워크', '인프라'],
  },
  embedded_iot: {
    strong: [
      '임베디드', '펌웨어', '사물인터넷', 'IoT', 'RTOS', 'firmware', 'embedded', 'microcontroller', 'microcontrollers',
      'Arduino', 'Raspberry Pi', 'FPGA', 'ESP32', 'STM32',
    ],
    weak: [],
  },
  game: {
    strong: [
      '게임 개발', '게임개발', '게임 프로그래밍', '게임 엔진', '게임잼', '게임 잼', '인디게임', '인디 게임', '게임 공모전', '컴퓨터 그래픽스',
      'video game', 'video games', 'game engine', 'game development', 'gamedev', 'game jam', 'Unity', 'Unreal Engine', 'Godot',
      'OpenGL', 'Vulkan', 'shader', 'shaders', 'computer graphics',
    ],
    weak: ['게임'],
  },
  uiux: {
    strong: [
      '사용자 경험', '사용성', '디자인 시스템', 'UI 디자인', 'UX 디자인', '서비스 디자인',
      'UX', 'UI/UX', 'UX/UI', 'Figma', 'usability', 'user experience', 'UI design', 'design system', 'design systems',
    ],
    weak: [],
  },
}

// interest-tags.ts와 같은 맞춤 규칙
// - 영어 단어는 앞뒤가 영문/숫자가 아닐 때만 맞는다. (예: 'AI'는 'MAIL'에 맞지 않음)
// - 대문자가 들어간 단어(React, AI, Unity…)는 대소문자까지 같아야 맞는다. 소문자 단어는 대소문자를 가리지 않는다.
// - 한글 단어는 제목 안에 포함되면 맞는다.
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const isAscii = (text) => /^[ -~]+$/.test(text)
function toPattern(word) {
  const flags = /[A-Z]/.test(word) ? '' : 'i'
  const body = isAscii(word) ? `(?<![A-Za-z0-9])${escape(word)}(?![A-Za-z0-9])` : escape(word)
  return new RegExp(body, flags)
}

const RULES = Object.entries(FIELD_KEYWORDS).map(([field, { strong, weak }]) => ({
  field,
  strong: strong.map(toPattern),
  weak: weak.map(toPattern),
}))

// 분야별 점수 (디버깅·테스트용)
export function fieldScores(title) {
  const text = String(title ?? '')
  const scores = {}
  for (const rule of RULES) {
    const score = rule.strong.filter((p) => p.test(text)).length * 2 + rule.weak.filter((p) => p.test(text)).length
    if (score > 0) scores[rule.field] = score
  }
  return scores
}

// 제목에 직무 이름 자체가 명시됐는지 (대소문자 무시, 하이픈·공백·붙여 쓰기 모두)
//   백엔드: 백엔드 / Back-end / Back end / Backend    프론트엔드: 프론트엔드 / Front-end / Front end / Frontend
const EXPLICIT = {
  backend: /백엔드|(?<![A-Za-z0-9])back[\s-]?end(?![A-Za-z0-9])/i,
  frontend: /프론트\s?엔드|(?<![A-Za-z0-9])front[\s-]?end(?![A-Za-z0-9])/i,
}
const explicitFields = (text) => Object.keys(EXPLICIT).filter((field) => EXPLICIT[field].test(text))

// 제목 → 분야 키 하나 (근거가 부족하면 'other')
// 백엔드·프론트엔드 중 하나만 명시됐으면, 다른 분야와 점수가 같아도 명시된 쪽을 고른다.
export function classifyField(title) {
  const text = String(title ?? '')
  const explicit = explicitFields(text)
  const scores = fieldScores(text)
  for (const field of explicit) scores[field] = (scores[field] ?? 0) + 1 // 명시된 직무에 가산점
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1])
  const [first, second] = ranked
  if (!first || first[1] < 2) return OTHER_FIELD
  if (second && second[1] === first[1]) return OTHER_FIELD
  return first[0]
}

// 제목 → 화면에 붙일 분야 키 목록
// - 백엔드와 프론트엔드가 둘 다 명시되면 둘 다 (예: '웹 서비스(Back-end, Front-end) 개발' → 백엔드, 프론트엔드)
// - 그 밖에는 classifyField의 한 분야 (근거가 없으면 'other')
export function classifyFields(title) {
  const explicit = explicitFields(String(title ?? ''))
  if (explicit.length === 2) return explicit
  return [classifyField(title)]
}

// 제목 → 화면에 붙일 분야명 목록 (예: ['백엔드', '프론트엔드'], ['정보보안'], ['기타'])
export function fieldLabelsOf(title) {
  return classifyFields(title).map((field) => FIELD_LABELS[field])
}
