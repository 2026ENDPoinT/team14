// 글 제목 → 관심 분야 태그 (온보딩 희망 직무 키와 같은 값)
//
// - 태그는 세부 직무 단위다. (예: 정보보안 security 와 시스템·네트워크·클라우드 system_network 는 별개)
// - 키는 onboardingOptions.js의 JOBS 키를 그대로 쓴다. 키가 아직 없는 직무(모바일 앱, 임베디드·IoT)는
//   태그를 붙이지 않는다. 키가 정해지면 아래 목록에 추가한다.
// - 제목만 보고 관련성이 뚜렷한 단어만 넣는다. 한 제목에 여러 태그가 붙을 수 있고, 맞는 단어가 없으면 빈 배열 = 미분류.
// - '대회', '해커톤', '공모전', 'hack', 회사 이름처럼 분야를 정하지 못하는 단어는 넣지 않는다.
// - 영어 단어는 앞뒤가 영문/숫자가 아닐 때만 맞는다. (예: 'AI'는 'MAIL'에 맞지 않음)
//   한글 단어는 제목 안에 포함되면 맞는다.

export const INTEREST_KEYWORDS: Record<string, string[]> = {
  // 백엔드 개발자: 서버 · API · 데이터 처리
  backend: [
    '백엔드', '서버 개발', '서버개발', '데이터베이스',
    'backend', 'back-end', 'API', 'APIs', 'REST API', 'GraphQL', 'gRPC', 'database', 'databases',
    'PostgreSQL', 'Postgres', 'MySQL', 'SQLite', 'Redis', 'Kafka', 'microservice', 'microservices',
    'Django', 'FastAPI', 'Spring Boot', 'Node.js',
  ],
  // 프론트엔드 개발자: 웹 UI · 사용자 화면 구현
  frontend: [
    '프론트엔드', '웹 퍼블리싱', '웹퍼블리싱',
    'frontend', 'front-end', 'React', 'Next.js', 'Vue', 'Svelte', 'CSS', 'HTML', 'JavaScript', 'TypeScript',
  ],
  // AI·머신러닝 엔지니어: 인공지능 모델 · 학습
  ai: [
    '인공지능', '머신러닝', '딥러닝', '생성형', '자연어처리', '강화학습', '컴퓨터 비전', '거대언어모델',
    'AI', 'LLM', 'LLMs', 'GPT', 'NLP', 'machine learning', 'deep learning', 'neural network', 'neural networks',
    'reinforcement learning', 'computer vision',
  ],
  // 데이터 분석가·엔지니어: 데이터 해석 · 파이프라인
  data: [
    '데이터 분석', '데이터분석', '빅데이터', '데이터 사이언스', '데이터 엔지니어', '데이터 시각화', '공공데이터', '데이터 활용',
    'data science', 'data scientist', 'data engineering', 'data engineer', 'data analysis', 'data analytics',
    'data pipeline', 'data pipelines', 'data warehouse', 'ETL', 'analytics', 'dataset', 'datasets',
  ],
  // 정보보안 엔지니어: 보호 · 암호 · 사이버 보안
  security: [
    '정보보호', '정보보안', '사이버보안', '사이버 보안', '보안', '취약점', '해킹대회', '해킹 대회', '모의해킹', '침해사고', '악성코드', '암호학',
    'CTF', 'CVE', 'OAuth', 'vulnerability', 'vulnerabilities', 'cybersecurity', 'infosec', 'cryptography', 'encryption',
    'exploit', 'RCE', 'remote code execution', 'malware', 'ransomware', 'phishing', 'zero-day', '0-day', 'XSS', 'CSRF', 'sql injection', 'backdoor',
  ],
  // 시스템·네트워크·클라우드 엔지니어: 운영체제 · 서버 · 네트워크
  system_network: [
    '클라우드', '리눅스', '운영체제', '컴퓨터 네트워크', '네트워크 엔지니어', '네트워크 관리', '시스템 엔지니어', '데브옵스',
    'Linux', 'Unix', 'kernel', 'operating system', 'operating systems', 'Kubernetes', 'Docker', 'TCP', 'DNS', 'BGP',
    'AWS', 'Azure', 'GCP', 'cloud computing', 'cloud-native', 'DevOps', 'SRE', 'distributed systems',
  ],
  // 게임 개발자: 그래픽스 · 상호작용 구현
  game: [
    '게임 개발', '게임개발', '게임 프로그래밍', '게임 엔진', '게임잼', '게임 잼', '인디게임', '인디 게임', '게임 공모전', '컴퓨터 그래픽스',
    'video game', 'video games', 'game engine', 'game development', 'gamedev', 'game jam', 'Unity', 'Unreal Engine', 'Godot',
    'OpenGL', 'Vulkan', 'shader', 'shaders', 'computer graphics',
  ],
  // UI/UX 엔지니어: 사용자 경험 · 인터페이스 구현
  uiux: [
    '사용자 경험', '사용성', '디자인 시스템', 'UI 디자인', 'UX 디자인', '서비스 디자인',
    'UX', 'UI/UX', 'UX/UI', 'Figma', 'usability', 'user experience', 'UI design', 'design system', 'design systems',
  ],
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const isAscii = (text: string) => /^[ -~]+$/.test(text) // 영문·숫자·기호·공백만 있는 단어

// 대문자가 들어간 단어(React, AI, Unity…)는 대소문자까지 같아야 맞는다.
// → 'react'(반응하다), 'unity'(통합) 같은 일반 영어 단어를 잘못 분류하지 않기 위해서.
// 소문자로만 적은 단어(kernel, analytics…)는 대소문자를 가리지 않는다.
function toPattern(word: string): RegExp {
  const flags = /[A-Z]/.test(word) ? '' : 'i'
  const body = isAscii(word) ? `(?<![A-Za-z0-9])${escape(word)}(?![A-Za-z0-9])` : escape(word)
  return new RegExp(body, flags)
}

// 분야별 정규식을 한 번만 만든다.
const RULES = Object.entries(INTEREST_KEYWORDS).map(([key, words]) => ({
  key,
  patterns: words.map(toPattern),
}))

export function tagTitle(title: string): string[] {
  return RULES.filter((rule) => rule.patterns.some((pattern) => pattern.test(title))).map((rule) => rule.key)
}
