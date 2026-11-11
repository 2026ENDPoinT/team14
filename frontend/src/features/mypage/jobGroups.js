// 희망 직무: 상위 분류 5개 × 하위 직무 (총 10개)
// id는 온보딩 직무 목록(features/onboarding/onboardingOptions.js의 CAREERS id)과 같게 맞췄다.
// ※ 이름은 이번 기획안 기준이라 온보딩 목록(4번 담당)과 조금 다르다 → 4번과 맞춰야 함
export const JOB_GROUPS = [
  {
    id: 'software',
    title: '소프트웨어 개발',
    jobs: [
      { id: 'backend', title: '백엔드 개발자' },
      { id: 'frontend', title: '프론트엔드 개발자' },
      { id: 'mobile', title: '모바일 앱 개발자' },
    ],
  },
  {
    id: 'ai_data',
    title: 'AI·데이터',
    jobs: [
      { id: 'ai', title: '머신러닝 엔지니어' },
      { id: 'data', title: '데이터 분석가·데이터 엔지니어' },
    ],
  },
  {
    id: 'security_infra',
    title: '보안·인프라',
    jobs: [
      { id: 'security', title: '정보보안 엔지니어' },
      { id: 'system_network', title: '시스템·네트워크·클라우드 엔지니어' },
    ],
  },
  {
    id: 'special',
    title: '특화 소프트웨어',
    jobs: [
      { id: 'embedded_iot', title: '임베디드·IoT 개발자' },
      { id: 'game', title: '게임 개발자' },
    ],
  },
  {
    id: 'uiux',
    title: 'UI/UX 융합',
    jobs: [{ id: 'uiux', title: 'UI/UX 엔지니어' }],
  },
]

// 직무 id → { group, job } (없으면 null)
export function findJob(jobId) {
  for (const group of JOB_GROUPS) {
    const job = group.jobs.find((j) => j.id === jobId)
    if (job) return { group, job }
  }
  return null
}

export function jobTitle(jobId) {
  return findJob(jobId)?.job.title ?? '선택 안 함'
}
