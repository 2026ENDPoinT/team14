import { useMemo } from 'react'
import { Controls, ReactFlow } from '@xyflow/react'
import '@xyflow/react/dist/base.css' // React Flow 동작에 필요한 최소 스타일 (디자인은 roadmap.css)
import TimelineNode from './TimelineNode.jsx'
import CardNode from './CardNode.jsx'
import RoadmapEdge from './RoadmapEdge.jsx'
import { CANVAS_HEIGHT, columnX, nodeBox } from './layout.js'

// React Flow에 등록할 노드·연결선 종류 (컴포넌트 밖에 두어야 매번 새로 만들지 않는다)
const nodeTypes = { timeline: TimelineNode, card: CardNode }
const edgeTypes = { roadmap: RoadmapEdge }

// 가로형 로드맵 캔버스 (React Flow)
// - 데이터는 학기(periodId) 기준 상대 좌표, 화면에는 캔버스 좌표로 바꿔서 그린다. (layout.js nodeBox)
// - 빈 공간 드래그: 이동 / 휠·핀치: 확대·축소
// - 노드 드래그·연결선 편집은 다음 단계에서 구현
export default function RoadmapCanvas({ periods, nodes, edges, getSubtitle, onNodeClick, onEdgeDelete }) {
  const sorted = useMemo(() => [...periods].sort((a, b) => a.order - b.order), [periods])
  const width = columnX(sorted.length) + 200

  const flowNodes = useMemo(() => {
    const background = {
      id: 'timeline',
      type: 'timeline',
      position: { x: 0, y: 0 },
      data: { periods: sorted, width },
      draggable: false,
      selectable: false,
      focusable: false,
      zIndex: -1,
      style: { pointerEvents: 'none' }, // 배경을 눌러도 캔버스 이동이 되도록
    }

    const cards = nodes
      .filter((n) => n.status === 'placed')
      .map((n) => {
        const box = nodeBox(n, periods)
        if (!box) return null
        return {
          id: n.id,
          type: 'card',
          position: { x: box.x, y: box.y }, // 학기 위치 + 상대 좌표 = 캔버스 좌표
          data: { node: n, subtitle: getSubtitle(n.id), onClick: onNodeClick },
          style: { pointerEvents: 'all' }, // 선택 기능을 꺼도 카드 클릭·Hover는 받도록
        }
      })
      .filter(Boolean)

    return [background, ...cards]
  }, [nodes, periods, sorted, width, getSubtitle, onNodeClick])

  const flowEdges = useMemo(
    () =>
      edges.map((e) => ({
        id: e.id,
        source: e.sourceNodeId,
        target: e.targetNodeId,
        type: 'roadmap',
        className: 'rm-edge',
        zIndex: 1, // 카드 위에 그려서 끝 핸들이 가려지지 않게
        data: { onDelete: onEdgeDelete },
      })),
    [edges, onEdgeDelete],
  )

  return (
    <div className="rm-canvas">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        minZoom={0.25}
        maxZoom={1.6}
        translateExtent={[[-600, -400], [width + 600, CANVAS_HEIGHT + 400]]}
        panOnDrag // 빈 공간 드래그 → 이동
        zoomOnScroll // 마우스 휠 → 확대·축소
        zoomOnPinch // 트랙패드 핀치 → 확대·축소
        zoomOnDoubleClick={false}
        nodesDraggable={false} // 노드 드래그는 다음 단계
        nodesConnectable={false}
        elementsSelectable={false}
        deleteKeyCode={null} // 키보드로 노드가 지워지지 않게
        attributionPosition="top-right"
      >
        <Controls
          position="bottom-left"
          showInteractive={false}
          fitViewOptions={{ padding: 0.08 }}
          className="rm-controls"
        />
      </ReactFlow>
    </div>
  )
}
