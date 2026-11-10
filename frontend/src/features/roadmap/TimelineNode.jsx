import { useContext } from 'react'
import { DropTargetContext } from './dropTarget.js'
import { CANVAS_HEIGHT, TIMELINE_Y, periodLabel } from './layout.js'

// 캔버스 배경: 가로 타임라인 + 학기 컬럼(기준 원·세로 구분선).
// React Flow 노드로 넣어서 확대·이동할 때 노드와 함께 움직인다. (드래그·클릭 불가)
export default function TimelineNode({ data }) {
  const { layout, width } = data
  const dropPeriodId = useContext(DropTargetContext) // 드래그 중 놓일 학기
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
          <div className="rm-column__badge" style={{ top: TIMELINE_Y }}>
            {periodLabel(period)}
          </div>
        </div>
      ))}
    </div>
  )
}
