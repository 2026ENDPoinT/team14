// 로드맵 Mock Data (docs/API.md 4.3 "로드맵 조회 결과" 형식과 같게 작성)
// 실제 API 연결 전까지 RoadmapPage에서 사용한다.

const semesterNames = [
  '1학년 1학기', '1학년 2학기', '2학년 1학기', '2학년 2학기',
  '3학년 1학기', '3학년 2학기', '4학년 1학기', '4학년 2학기',
]

export const mockPeriods = semesterNames.map((name, i) => ({
  id: `p_${i + 1}`,
  type: 'semester',
  name,
  order: i,
}))

// position: 학기 컬럼 왼쪽 위 기준 좌표 (React Flow 좌표 기준은 협의 필요)
function node(id, title, theme, periodId, x, y, extra = {}) {
  return {
    id,
    title,
    theme,
    periodId,
    position: periodId ? { x, y } : null,
    status: periodId ? 'placed' : 'stored',
    source: 'user',
    originKey: null,
    completed: false,
    createdAt: '2026-11-09T12:00:00+09:00',
    ...extra,
  }
}

function course(id, title, periodId, x, key) {
  return node(id, title, 'major', periodId, x, 158, {
    source: 'recommended',
    originKey: `course:${key}`,
  })
}

export const mockNodes = [
  course('n_1', '자료구조', 'p_3', 120, 'cs2026-2-1-01'),
  node('n_2', '알고리즘 스터디', 'project', 'p_3', 240, 320),
  course('n_3', '캡스톤디자인', 'p_7', 170, 'cs2026-4-1-01'),
  course('n_4', '데이터베이스', 'p_7', 370, 'cs2026-4-1-02'),
  node('n_5', '캡스톤 프로젝트', 'project', 'p_7', 300, 300),
  node('n_6', '해커톤 참가', 'external', 'p_7', 310, 490),
  node('n_7', '인턴 지원', 'career', 'p_7', 260, 660),
  course('n_8', '졸업작품', 'p_8', 110, 'cs2026-4-2-01'),
  course('n_9', '운영체제 심화', 'p_8', 305, 'cs2026-4-2-02'),
  node('n_10', '포트폴리오 정리', 'career', 'p_8', 160, 470),
  node('n_11', '동아리 활동', 'event', null),
]

export const mockEdges = [
  { id: 'e_1', sourceNodeId: 'n_1', targetNodeId: 'n_2' },
  { id: 'e_2', sourceNodeId: 'n_3', targetNodeId: 'n_5' },
  { id: 'e_3', sourceNodeId: 'n_5', targetNodeId: 'n_6' },
  { id: 'e_4', sourceNodeId: 'n_8', targetNodeId: 'n_10' },
]

// 노드 문서 (NodeDocument). nodeId → 문서
export const mockDocuments = {
  n_5: { nodeId: 'n_5', content: { format: 'plain', body: '프로젝트를 하면서 배운 내용 정리' }, updatedAt: '2026-11-09T12:00:00+09:00' },
  n_6: { nodeId: 'n_6', content: { format: 'plain', body: '교내 해커톤 본선 진출' }, updatedAt: '2026-11-09T12:00:00+09:00' },
}
