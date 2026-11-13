import { useContext } from 'react'
import { DropTargetContext } from './dropTarget.js'
import { BranchContext } from './branchLines.js'
import { CANVAS_HEIGHT, TIMELINE_Y, periodLabel } from './layout.js'

// 캔버스 배경: 가로 타임라인 + 학기 컬럼(기준 원·세로 구분선) + 학기 가지선.
// 가지선은 카드보다 아래(배경)에 그려진다. 마우스 조작은 받지 않는다.
// React Flow 노드로 넣어서 확대·이동할 때 노드와 함께 움직인다. (드래그·클릭 불가)
export default function TimelineNode({ data }) {
  const { layout, width } = data
  const dropPeriodId = useContext(DropTargetContext) // 드래그 중 놓일 학기
  const branches = useContext(BranchContext) // 학기 가지선 [{ id, d }]
  return (
    <div className="rm-timeline-bg" style={{ width, height: CANVAS_HEIGHT }}>
      <div className="rm-timeline" style={{ top: TIMELINE_Y }} />
      {layout.periods.map((period) => (
        <div
          key={period.id}
          className={`rm-column ${period.id === dropPeriodId ? 'is-drop-target' : ''}`}
          style={{ left: layout.cols[period.id].x, width: layout.cols[period.id].width }}
        >
          <div className="rm-column__line" style={{ top: TIMELINE_Y }} />
          {/* 휴학·군휴학·교환학생 같은 학기 외 칸은 이름이 길어 글자를 작게 */}
          <div className={`rm-column__badge ${period.type !== 'semester' ? 'is-text' : ''}`} style={{ top: TIMELINE_Y }}>
            {periodLabel(period)}
          </div>
        </div>
      ))}
      <svg className="rm-branches" width={width} height={CANVAS_HEIGHT} aria-hidden="true">
        {branches.map((b) => (
          <path key={b.id} className="rm-branch" data-node={b.id} d={b.d} style={{ d: `path("${b.d}")` }} />
        ))}
        {/* 가지선 시작점: 타임라인 위 작은 점 (줄기가 여럿이 함께 쓰면 하나만) — 관계선과 구분되게 */}
        {[...new Set(branches.map((b) => b.sx))].map((x) => (
          <circle key={x} className="rm-branch__root" cx={x} cy={TIMELINE_Y} r="3" />
        ))}
      </svg>
    </div>
  )
}
