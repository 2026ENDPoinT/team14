// 목표 직무 소개: 마이페이지에 저장되는 직무 ID를 기준으로 안내한다.
// 직무 설명은 일반적인 역할 안내이며 개인의 실제 취업 가능성이나 AI 적합도 판정이 아니다.
export const GOAL_JOB_INFO = {
  backend: { title: '백엔드 개발자', description: '서비스의 서버와 API, 데이터베이스를 설계하고 안정적으로 운영하는 개발자예요.', tasks: ['서버 API 및 비즈니스 로직 구현', '데이터베이스 설계와 성능 개선', '인증·보안·서비스 안정성 관리'], skills: ['Java / Spring 또는 Node.js', 'SQL 및 데이터베이스', 'HTTP·REST API·서버 운영'] },
  frontend: { title: '프론트엔드 개발자', description: '사용자가 직접 보고 조작하는 웹 화면을 구현하고 사용 경험을 개선해요.', tasks: ['화면과 인터랙션 구현', 'API 연동 및 상태 관리', '접근성·반응형 디자인·성능 개선'], skills: ['HTML / CSS / JavaScript', 'React 등 프론트엔드 프레임워크', 'UI/UX 및 웹 접근성'] },
  mobile: { title: '모바일 앱 개발자', description: '휴대전화와 태블릿에서 사용하는 앱을 만들고 앱의 성능과 사용성을 관리해요.', tasks: ['Android·iOS 앱 기능 개발', '서버와 앱 데이터 연동', '앱 테스트 및 배포'], skills: ['Kotlin / Swift 또는 Flutter', '모바일 UI 개발', '앱 아키텍처 및 테스트'] },
  ai: { title: 'AI·머신러닝 엔지니어', description: '데이터를 활용해 머신러닝 모델을 만들고, 학습된 모델을 실제 서비스에 적용해요.', tasks: ['데이터 전처리와 모델 학습', '모델 성능 평가 및 개선', 'AI 모델 배포와 모니터링'], skills: ['Python 및 머신러닝 라이브러리', '선형대수·확률·통계', '데이터 처리와 MLOps 기초'] },
  data: { title: '데이터 분석가·데이터 엔지니어', description: '데이터를 분석해 의사결정에 도움을 주거나, 분석에 필요한 데이터 파이프라인을 구축해요.', tasks: ['데이터 수집·정제·분석', '데이터 파이프라인과 저장소 구성', '지표 시각화 및 분석 결과 전달'], skills: ['SQL·Python', '통계 및 데이터 모델링', 'ETL·데이터 시각화'] },
  security: { title: '정보보안 엔지니어', description: '시스템과 네트워크의 보안 위험을 발견하고 공격에 대비할 수 있는 방어 체계를 구축해요.', tasks: ['취약점 점검과 보안 정책 수립', '침해 탐지 및 사고 대응', '인증·접근제어·보안 도구 운영'], skills: ['운영체제·네트워크', '보안 기초·암호학', '로그 분석 및 스크립팅'] },
  system_network: { title: '시스템·네트워크·클라우드 엔지니어', description: '서비스가 안정적으로 실행되도록 서버·네트워크·클라우드 인프라를 설계하고 운영해요.', tasks: ['서버 및 클라우드 환경 구성', '배포 자동화와 모니터링', '장애 대응 및 확장성 개선'], skills: ['Linux·네트워크', 'AWS 등 클라우드 서비스', 'Docker·CI/CD·인프라 자동화'] },
  embedded_iot: { title: '임베디드·IoT 개발자', description: '기기 안에서 동작하는 소프트웨어와 센서·네트워크를 연결하는 시스템을 개발해요.', tasks: ['마이크로컨트롤러 펌웨어 개발', '센서·통신 장치 연동', '하드웨어와 소프트웨어 통합 테스트'], skills: ['C / C++', '디지털 회로 및 컴퓨터 구조', '임베디드 운영체제·통신 프로토콜'] },
  game: { title: '게임 개발자', description: '게임의 플레이, 그래픽, 엔진, 서버 등의 기능을 구현해 몰입감 있는 경험을 만들어요.', tasks: ['게임 플레이 로직 구현', '엔진을 활용한 콘텐츠 개발', '성능 최적화와 테스트'], skills: ['C# / C++', 'Unity 또는 Unreal Engine', '자료구조·수학·게임 개발 패턴'] },
  uiux: { title: 'UI/UX 엔지니어', description: '사용자 경험을 설계하고 이를 일관되고 사용하기 편한 인터페이스로 구현해요.', tasks: ['사용자 흐름과 인터랙션 설계', '디자인 시스템 구현', '사용성 테스트 및 개선'], skills: ['HTML·CSS·JavaScript', '프로토타이핑 및 디자인 시스템', '접근성·사용성 평가'] },
}

const aliases = {
  '머신러닝 엔지니어': 'ai', 'AI/ML 엔지니어': 'ai', 'AI/머신러닝 엔지니어': 'ai',
  '데이터 엔지니어': 'data', '데이터 분석가': 'data',
  '클라우드 엔지니어': 'system_network', 'DevOps 엔지니어': 'system_network',
  '임베디드 개발자': 'embedded_iot', 'UI/UX 개발자': 'uiux',
}

export function careerGoalInfo(value) {
  const key = typeof value === 'string' ? value.trim() : ''
  if (!key || key === 'undecided') return null
  const match = GOAL_JOB_INFO[key] || GOAL_JOB_INFO[aliases[key]] || Object.values(GOAL_JOB_INFO).find((item) => item.title === key)
  return match || { title: key, description: '관심 있는 직무의 실제 업무와 필요한 역량을 탐색해 보세요. 구체적인 직무 정보는 추후 업데이트할 예정이에요.', tasks: [], skills: [] }
}
