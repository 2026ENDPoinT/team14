import { useContext } from 'react'
import { DropTargetContext } from './dropTarget.js'
import { BranchContext } from './branchLines.js'
import { CANVAS_HEIGHT, TIMELINE_Y, periodLabel } from './layout.js'

// 캔버스 배경: 가로 타임라인 + 학기 컬럼(기준 원·세로 구분선) + 학기 가지선.
// 가지선은 카드보다 아래(배경)에 그려진다. 마우스 조작은 받지 않는다.
// React Flow 노드로 넣어서 확대·이동할 때 노드와 함께 움직인다. (드래그·클릭 불가)
export default function TimelineNode({ data }) {
  const { layout, width, timelineEnd } = data
  const dropPeriodId = useContext(DropTargetContext) // 드래그 중 놓일 학기
  const branches = useContext(BranchContext) // 학기 가지선 [{ id, d }]
  return (
    <div className="rm-timeline-bg" style={{ width, height: CANVAS_HEIGHT }}>
      <div className="rm-timeline" style={{ top: TIMELINE_Y, right: "auto", width: timelineEnd ?? width }} />
      {layout.periods.map((period) => (
        <div
          key={period.id}
          className={`rm-column ${period.id === dropPeriodId ? 'is-drop-target' : ''}`}
          style={{ left: layout.cols[period.id].x, width: layout.cols[period.id].width }}
        >
          <div className="rm-column__line" style={{ top: TIMELINE_Y }} />
          <div className="rm-column__badge" style={{ top: TIMELINE_Y }}>
            {periodLabel(period)}
          </div>
        </div>
      ))}
      <svg className="rm-branches" width={width} height={CANVAS_HEIGHT} aria-hidden="true">
        {branches.map((b) => (
          <path key={b.id} className="rm-branch" data-node={b.id} d={b.d} style={{ d: `path("${b.d}")` }} />
        ))}
      </svg>
    </div>
  )
}
