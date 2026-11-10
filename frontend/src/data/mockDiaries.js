// 샘플 일기 Mock 데이터 (docs/API.md 2장 Diary 형식, camelCase)
// DB 연결 전까지 화면 개발용으로만 사용한다.
// mood: 값 목록이 [미확정]이라 아직 null로 둔다.
const mockDiaries = [
  {
    id: 'd_1',
    date: '2026-11-03',
    mood: null,
    content: '자료구조 수업에서 스택과 큐를 배웠다. 직접 코드로 짜 보니 헷갈리던 부분이 이해됐다.',
    photoUrls: [],
    linkedNodeId: null,
    createdAt: '2026-11-03T21:10:00+09:00',
    updatedAt: '2026-11-03T21:10:00+09:00',
  },
  {
    id: 'd_2',
    date: '2026-11-06',
    mood: null,
    content: '동아리 회의.',
    photoUrls: [],
    linkedNodeId: null,
    createdAt: '2026-11-06T22:30:00+09:00',
    updatedAt: '2026-11-06T22:30:00+09:00',
  },
  {
    id: 'd_3',
    date: '2026-11-08',
    mood: null,
    content: '해커톤 팀원들과 아이디어 회의를 했다. 대학생 성장 기록 서비스를 만들기로 정했고 역할도 나눴다.',
    photoUrls: [],
    linkedNodeId: null,
    createdAt: '2026-11-08T23:00:00+09:00',
    updatedAt: '2026-11-08T23:40:00+09:00',
  },
]

export default mockDiaries
