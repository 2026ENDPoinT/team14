// 로드맵 캔버스 크기·좌표 계산 (화면 배치 전용 값)

export const COLUMN_WIDTH = 630 // 학기 컬럼 하나의 너비
export const CANVAS_LEFT = 120 // 첫 학기 원의 x 위치
export const TIMELINE_Y = 200 // 가로 타임라인의 y 위치
export const CANVAS_HEIGHT = 900

// 노드 테마 (SPEC 6.4)
export const THEMES = [
  { id: 'major', label: '전공·학업' },
  { id: 'project', label: '프로젝트' },
  { id: 'external', label: '대외활동' },
  { id: 'career', label: '진로·취업' },
  { id: 'research', label: '연구·진학' },
  { id: 'event', label: '대학생활 이벤트' },
  { id: 'free', label: '자유 노드' },
]

export function themeLabel(themeId) {
  return THEMES.find((t) => t.id === themeId)?.label ?? themeId
}

// 교과목 노드는 타임라인 위의 작은 카드로 보여 준다
export function isCourse(node) {
  return node.originKey?.startsWith('course:')
}

export function cardSize(node) {
  return isCourse(node) ? { w: 166, h: 84 } : { w: 226, h: 120 }
}

// "1-1" 같은 짧은 학기 표시
export function periodLabel(period) {
  if (period.type !== 'semester') return period.name
  const match = period.name.match(/(\d)학년 (\d)학기/)
  return match ? `${match[1]}-${match[2]}` : period.name
}

export function columnX(order) {
  return CANVAS_LEFT + order * COLUMN_WIDTH
}

// 캔버스 전체 기준 노드 위치
export function nodeBox(node, periods) {
  const period = periods.find((p) => p.id === node.periodId)
  if (!period || !node.position) return null
  const { w, h } = cardSize(node)
  return { x: columnX(period.order) + node.position.x, y: node.position.y, w, h }
}

// 새 노드를 학기 컬럼의 빈 아래쪽에 배치
export function nextPosition(nodes, periodId) {
  const bottoms = nodes
    .filter((n) => n.periodId === periodId && !isCourse(n))
    .map((n) => n.position.y + cardSize(n).h)
  const y = Math.max(300, ...bottoms.map((b) => b + 40))
  return { x: 240, y: Math.min(y, CANVAS_HEIGHT - 140) }
}

// ───────── 노드 드래그 (2단계) ─────────

// 캔버스 좌표 (x, y)가 속한 학기. 학기 영역 밖이면 null
// 학기 영역: 기준 원(columnX)부터 다음 학기 기준 원 직전까지, 높이는 캔버스 전체
export function findPeriodAt(x, y, periods) {
  if (y < 0 || y > CANVAS_HEIGHT) return null
  return periods.find((p) => x >= columnX(p.order) && x < columnX(p.order) + COLUMN_WIDTH) ?? null
}

const GAP = 16 // 노드 사이 최소 간격

function overlaps(a, b) {
  return (
    a.x < b.x + b.w + GAP && a.x + a.w + GAP > b.x &&
    a.y < b.y + b.h + GAP && a.y + a.h + GAP > b.y
  )
}

// 다른 노드와 겹치면 가까운 빈 자리로 살짝 옮긴다. (겹치지 않으면 그대로)
// box: 캔버스 좌표 { x, y, w, h } / others: 다른 노드들의 box 목록
// 옮긴 뒤에도 노드 중심이 같은 학기 안에 있어야 한다.
export function resolveOverlap(box, others, period) {
  const isFree = (b) =>
    b.y >= 0 && b.y + b.h <= CANVAS_HEIGHT &&
    findPeriodAt(b.x + b.w / 2, b.y + b.h / 2, [period]) &&
    others.every((o) => !overlaps(b, o))

  if (isFree(box)) return box
  // 가까운 거리부터 8방향으로 찾아본다
  for (let d = 12; d <= 480; d += 12) {
    const tries = [
      [0, d], [0, -d], [d, 0], [-d, 0],
      [d, d], [-d, d], [d, -d], [-d, -d],
    ]
    for (const [dx, dy] of tries) {
      const candidate = { ...box, x: box.x + dx, y: box.y + dy }
      if (isFree(candidate)) return candidate
    }
  }
  return box // 빈 자리를 못 찾으면 놓은 자리 그대로
}
