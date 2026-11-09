import NodeCard from './NodeCard.jsx'
import EdgeLayer from './EdgeLayer.jsx'
import { CANVAS_HEIGHT, COLUMN_WIDTH, TIMELINE_Y, columnX, nodeBox, periodLabel } from './layout.js'

// 가로형 로드맵 캔버스: 학기 컬럼 + 노드 카드 + 연결선
export default function RoadmapCanvas({ periods, nodes, edges, getSubtitle, onNodeClick, onEdgeDelete }) {
  const sorted = [...periods].sort((a, b) => a.order - b.order)
  const width = columnX(sorted.length) + 200
  const placed = nodes.filter((n) => n.status === 'placed')

  return (
    <div className="rm-canvas-scroll">
      <div className="rm-canvas" style={{ width, height: CANVAS_HEIGHT }}>
        {/* 가로 타임라인 */}
        <div className="rm-timeline" style={{ top: TIMELINE_Y }} />

        {/* 학기 컬럼: 기준 원 + 세로 구분선 */}
        {sorted.map((period) => (
          <div
            key={period.id}
            className="rm-column"
            style={{ left: columnX(period.order), width: COLUMN_WIDTH }}
          >
            <div className="rm-column__line" style={{ top: TIMELINE_Y }} />
            <div className="rm-column__badge" style={{ top: TIMELINE_Y }} title={period.name}>
              {periodLabel(period)}
            </div>
          </div>
        ))}

        {placed.map((node) => {
          const box = nodeBox(node, periods)
          if (!box) return null
          return (
            <NodeCard
              key={node.id}
              node={node}
              subtitle={getSubtitle(node.id)}
              onClick={onNodeClick}
              style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
            />
          )
        })}

        <EdgeLayer
          edges={edges}
          nodes={nodes}
          periods={periods}
          width={width}
          height={CANVAS_HEIGHT}
          onDelete={onEdgeDelete}
        />
      </div>
    </div>
  )
}
