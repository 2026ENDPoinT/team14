// 채용 공고 제목으로 컴퓨터공학 관련 직무인지 판단한다.
//
// 고용24 공채속보 목록 응답에는 공고별 직종 코드·직무 분류가 없다 (2026-11-12 실제 응답 확인).
// 그래서 제목에 들어 있는 "구체적인 직무 표현"만 근거로 쓴다.
//   - 포함: 아래 분야별 직무 표현이 하나라도 있는 공고
//   - 제외: 비개발 직무 표현(영업·마케팅·기획자·경비·간호·안전관리 등)이 함께 있는 공고
//   - 판단 근거가 없는 공고(예: "2026년 신입사원 채용", "(IT)", "기술직")는 모호하므로 제외
// '보안', '기술', '개발', 'IT' 같은 한 단어만으로는 포함하지 않는다.

// 분야 → 직무 표현 (대소문자 구분 없음). 위에서부터 확인하므로 구체적인 분야를 먼저, 웹·앱·SW 일반을 마지막에 둔다
const CS_JOB_PATTERNS = {
  ai_data: [
    /\bai\s*(엔지니어|개발|연구원|리서처|에이전트|모델)|인공\s*지능\s*(개발|엔지니어|연구)/i,
    /머신\s*러닝|딥\s*러닝|machine\s*learning|deep\s*learning|\bmlops\b|\bllm\b/i,
    /데이터\s*(엔지니어|사이언티스트|과학자|분석가|플랫폼\s*개발)|data\s*(engineer|scientist|analyst)/i,
  ],
  security: [
    /정보\s*보안|사이버\s*보안|정보\s*보호|침해\s*(사고\s*)?대응|모의\s*해킹|화이트\s*해커/i,
    /보안\s*(엔지니어|관제|컨설턴트|솔루션\s*개발|개발)/i,
  ],
  system_network: [
    /클라우드\s*(엔지니어|아키텍트|개발|인프라|운영)|cloud\s*(engineer|architect)/i,
    /\bit\s*인프라|인프라\s*(엔지니어|운영)|네트워크\s*(엔지니어|관리|운영|담당)/i,
    /시스템\s*(엔지니어|관리자|개발)|devops|데브옵스|\bsre\b|\bdba\b/i,
  ],
  embedded_iot: [
    /임베디드|embedded|펌웨어|firmware|\biot\b|사물\s*인터넷|\bbsp\b|\brtos\b/i,
  ],
  game: [
    /게임\s*(개발|프로그래머|클라이언트|서버|엔진)|game\s*(developer|programmer)|유니티|unity|언리얼|unreal/i,
  ],
  uiux: [
    /ui\s*\/?\s*ux|ux\s*\/?\s*ui|(ui|ux)\s*디자이너|프로덕트\s*디자이너|product\s*designer/i,
  ],
  web_app: [
    /백엔드|back[\s-]?end|프론트\s*엔드|front[\s-]?end|풀\s*스택|full[\s-]?stack/i,
    /(웹|앱|모바일|어플리케이션|애플리케이션|ios|android|안드로이드)\s*(서비스\s*)?(개발|프로그래머|엔지니어)/i,
    /(web|app|mobile|ios|android)\s*(developer|engineer)/i,
    /(소프트웨어|\bsw|s\/w|서버|플랫폼)\s*(개발|엔지니어|프로그래머)/i,
    /software\s*(developer|engineer)/i,
    /전산\s*(직|개발|운영)/i,
  ],
}

// 이 표현이 있으면 컴공 직무 표현이 함께 있어도 제외한다
const NON_CS_PATTERN =
  /영업|세일즈|sales|마케팅|marketing|기획자|서비스\s*기획|사업\s*기획|경비|경호|간호|안전\s*관리|안전\s*보건|보건\s*관리|채용\s*대행|강사/i

// 컴공 관련이면 분야 키(web_app, ai_data, …), 아니면 null
export function csJobCategory(title) {
  const text = String(title ?? '')
  if (!text.trim() || NON_CS_PATTERN.test(text)) return null
  for (const [category, patterns] of Object.entries(CS_JOB_PATTERNS)) {
    if (patterns.some((pattern) => pattern.test(text))) return category
  }
  return null
}

// 컴공 관련 공고만 순서를 유지한 채 골라 최대 limit건
export function pickCsJobs(jobs, limit = 50) {
  return jobs.filter((job) => csJobCategory(job.title)).slice(0, limit)
}
