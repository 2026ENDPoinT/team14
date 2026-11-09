import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Controls, ReactFlow, applyNodeChanges } from '@xyflow/react'
import '@xyflow/react/dist/base.css' // React Flow 동작에 필요한 최소 스타일 (디자인은 roadmap.css)
import TimelineNode from './TimelineNode.jsx'
import CardNode from './CardNode.jsx'
import RoadmapEdge from './RoadmapEdge.jsx'
import { DropTargetContext } from './dropTarget.js'
import { CANVAS_HEIGHT, cardSize, columnX, findPeriodAt, nodeBox, placeNode } from './layout.js'

// React Flow에 등록할 노드·연결선 종류 (컴포넌트 밖에 두어야 매번 새로 만들지 않는다)
const nodeTypes = { timeline: TimelineNode, card: CardNode }
const edgeTypes = { roadmap: RoadmapEdge }
const CLICK_DISTANCE = 4 // 이 거리(px) 이하로 움직이면 클릭으로 판정

// 노드 중심점 (캔버스 좌표)
function centerOf(position, node) {
  const { w, h } = cardSize(node)
  return { x: position.x + w / 2, y: position.y + h / 2 }
}

// 가로형 로드맵 캔버스 (React Flow)
// - 데이터는 학기(periodId) 기준 상대 좌표, 화면에는 캔버스 좌표로 바꿔서 그린다. (layout.js nodeBox)
// - 빈 공간 드래그: 이동 / 휠·핀치: 확대·축소 / 노드 드래그: 위치 이동·학기 재배정
export default function RoadmapCanvas({
  periods, nodes, edges, getSubtitle, onNodeClick, onNodeMove, onEdgeDelete,
  dropPeriodId, onDropTargetChange, // 드래그 중 강조할 학기 (보관함 드래그와 함께 쓰려고 페이지에서 관리)
}) {
  const sorted = useMemo(() => [...periods].sort((a, b) => a.order - b.order), [periods])
  const width = columnX(sorted.length) + 200

  const [resetKey, setResetKey] = useState(0) // 영역 밖에 놓았을 때 원래 위치로 되돌리기용
  const draggedRef = useRef(false) // 드래그 직후의 클릭은 무시하기 위한 표시
  const dragStartRef = useRef(null) // 드래그를 시작한 마우스 위치 (화면 좌표)

  // 드래그 직후에는 상세 창을 열지 않는다
  const handleCardClick = useCallback(
    (id) => {
      if (draggedRef.current) return
      onNodeClick(id)
    },
    [onNodeClick],
  )

  // 데이터 → React Flow 노드 목록
  const builtNodes = useMemo(() => {
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
          data: { node: n, subtitle: getSubtitle(n.id), onClick: handleCardClick },
          style: { pointerEvents: 'all' }, // 선택 기능을 꺼도 카드 클릭·Hover는 받도록
        }
      })
      .filter(Boolean)

    return [background, ...cards]
  }, [nodes, periods, sorted, width, getSubtitle, handleCardClick])

  // React Flow가 드래그 위치·크기 측정값을 기록할 수 있도록 노드를 상태로 관리한다.
  // 데이터가 바뀌면 다시 만들되, 이미 측정한 크기(measured)는 이어서 쓴다.
  const [flowNodes, setFlowNodes] = useState(builtNodes)
  useEffect(() => {
    setFlowNodes((prev) => {
      const measured = new Map(prev.map((n) => [n.id, n.measured]))
      return builtNodes.map((n) => (measured.get(n.id) ? { ...n, measured: measured.get(n.id) } : n))
    })
  }, [builtNodes, resetKey])

  const onNodesChange = useCallback(
    (changes) => setFlowNodes((nds) => applyNodeChanges(changes, nds)),
    [],
  )

  const onNodeDragStart = useCallback((event) => {
    dragStartRef.current = { x: event.clientX, y: event.clientY }
  }, [])

  // 드래그 중: 노드 중심이 있는 학기를 강조
  const onNodeDrag = useCallback(
    (event, flowNode) => {
      // 마우스가 CLICK_DISTANCE보다 많이 움직였으면 "드래그"로 본다 (손떨림은 클릭으로 처리)
      const start = dragStartRef.current
      if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > CLICK_DISTANCE) {
        draggedRef.current = true
      }
      const center = centerOf(flowNode.position, flowNode.data.node)
      onDropTargetChange(findPeriodAt(center.x, center.y, periods)?.id ?? null)
    },
    [periods, onDropTargetChange],
  )

  // 드롭: 학기 판정 → 겹침 보정 → periodId와 상대 좌표 저장 (layout.js placeNode)
  const onNodeDragStop = useCallback(
    (_, flowNode) => {
      onDropTargetChange(null)
      const placement = placeNode(flowNode.data.node, flowNode.position, nodes, periods)
      if (!placement) {
        setResetKey((k) => k + 1) // 학기 영역 밖이거나 빈 자리가 없음 → 원래 자리로
        return
      }
      onNodeMove(flowNode.data.node.id, placement)
    },
    [nodes, periods, onNodeMove, onDropTargetChange],
  )

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
    <DropTargetContext.Provider value={dropPeriodId}>
      {/* 새로 누를 때마다 "드래그 직후" 표시를 지운다 */}
      <div className="rm-canvas" onPointerDownCapture={() => { draggedRef.current = false }}>
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          onNodesChange={onNodesChange}
          onNodeDragStart={onNodeDragStart}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
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
          nodesDraggable // 노드 드래그 → 위치 이동
          nodeDragThreshold={0} // 0이어야 노드가 마우스를 정확히 따라온다 (값이 있으면 그만큼 뒤처짐)
          nodeClickDistance={CLICK_DISTANCE} // 살짝 흔들린 클릭도 클릭으로 인정
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
    </DropTargetContext.Provider>
  )
}
