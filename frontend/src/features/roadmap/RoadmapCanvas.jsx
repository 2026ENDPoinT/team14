import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Controls, ReactFlow, ViewportPortal, applyNodeChanges, useReactFlow } from '@xyflow/react'
import '@xyflow/react/dist/base.css' // React Flow 동작에 필요한 최소 스타일 (디자인은 roadmap.css)
import TimelineNode from './TimelineNode.jsx'
import CardNode from './CardNode.jsx'
import RoadmapEdge from './RoadmapEdge.jsx'
import { DropTargetContext } from './dropTarget.js'
import { LinkContext } from './linkContext.js'
import useLinkDrag from './useLinkDrag.js'
import { CANVAS_HEIGHT, cardSize, findPeriodAt, nodeBox, placeNode } from './layout.js'

// React Flow에 등록할 노드·연결선 종류 (컴포넌트 밖에 두어야 매번 새로 만들지 않는다)
const nodeTypes = { timeline: TimelineNode, card: CardNode }
const edgeTypes = { roadmap: RoadmapEdge }
const CLICK_DISTANCE = 4 // 이 거리(px) 이하로 움직이면 클릭으로 판정

// 관계선 미리보기: 출발 노드 오른쪽 → 도착 노드 왼쪽 점 가장자리 (부드러운 곡선)
function previewPath(s, t) {
  const dx = Math.max(40, Math.abs(t.x - s.x) / 2)
  return `M ${s.x} ${s.y} C ${s.x + dx} ${s.y}, ${t.x - dx} ${t.y}, ${t.x} ${t.y}`
}

// 노드 중심점 (캔버스 좌표)
function centerOf(position, node) {
  const { w, h } = cardSize(node)
  return { x: position.x + w / 2, y: position.y + h / 2 }
}

// 가로형 로드맵 캔버스 (React Flow)
// - 데이터는 학기(periodId) 기준 상대 좌표, 화면에는 캔버스 좌표로 바꿔서 그린다. (layout.js nodeBox)
// - 빈 공간 드래그: 이동 / 휠·핀치: 확대·축소 / 노드 드래그: 위치 이동·학기 재배정
// - layout: 학기별 x·너비 (layout.js computeLayout). 데이터가 바뀔 때만 다시 계산되므로
//   드래그하는 동안에는 학기 경계가 고정되고, 놓은 뒤에 필요한 만큼만 학기가 넓어진다.
export default function RoadmapCanvas({
  layout, nodes, edges, getSubtitle, onNodeClick, onNodeMove, onEdgeDelete, onToggleComplete,
  dropPeriodId, onDropTargetChange, // 드래그 중 강조할 학기 (보관함 드래그와 함께 쓰려고 페이지에서 관리)
  connectMode, onEdgeCreate, onEdgeReconnect, onLinkReject, // 관계선 만들기·끝점 옮기기
}) {
  const width = layout.width + 200

  const [resetKey, setResetKey] = useState(0) // 영역 밖에 놓았을 때 원래 위치로 되돌리기용
  const [nodeDragging, setNodeDragging] = useState(false) // 드래그 중에는 연결선 애니메이션을 끈다
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
      data: { layout, width },
      draggable: false,
      selectable: false,
      focusable: false,
      zIndex: -1,
      style: { pointerEvents: 'none' }, // 배경을 눌러도 캔버스 이동이 되도록
    }

    const cards = nodes
      .filter((n) => n.status === 'placed')
      .map((n) => {
        const box = nodeBox(n, layout)
        if (!box) return null
        return {
          id: n.id,
          type: 'card',
          position: { x: box.x, y: box.y }, // 학기 위치 + 상대 좌표 = 캔버스 좌표
          data: { node: n, subtitle: getSubtitle(n.id), onClick: handleCardClick, onToggleComplete },
          style: { pointerEvents: 'all' }, // 선택 기능을 꺼도 카드 클릭·Hover는 받도록
        }
      })
      .filter(Boolean)

    return [background, ...cards]
  }, [nodes, layout, width, getSubtitle, handleCardClick, onToggleComplete])

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
    setNodeDragging(true)
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
      onDropTargetChange(findPeriodAt(center.x, center.y, layout)?.id ?? null)
    },
    [layout, onDropTargetChange],
  )

  // 드롭: 학기 판정 → 겹침 보정 → periodId와 상대 좌표 저장 (layout.js placeNode)
  const onNodeDragStop = useCallback(
    (_, flowNode) => {
      onDropTargetChange(null)
      setNodeDragging(false)
      const placement = placeNode(flowNode.data.node, flowNode.position, nodes, layout)
      if (!placement) {
        setResetKey((k) => k + 1) // 학기 영역 밖이거나 빈 자리가 없음 → 원래 자리로
        return
      }
      onNodeMove(flowNode.data.node.id, placement)
    },
    [nodes, layout, onNodeMove, onDropTargetChange],
  )

  // ───── 관계선 만들기·끝점 옮기기 ─────
  const { getInternalNode } = useReactFlow()
  const onLinkDone = useCallback(
    (info, nodeId) => {
      if (info.mode === 'create') onEdgeCreate(info.fixedId, nodeId)
      else onEdgeReconnect(info.edgeId, info.mode, nodeId)
    },
    [onEdgeCreate, onEdgeReconnect],
  )
  const { link, startLink } = useLinkDrag({ edges, onDone: onLinkDone, onReject: onLinkReject })

  // 카드 오른쪽 연결 핸들 → 새 관계선
  const startConnect = useCallback((event, nodeId) => startLink(event, { mode: 'create', fixedId: nodeId }), [startLink])
  // 연결선 끝 핸들 → 그 끝을 다른 노드로 옮기기 (end: 'source' | 'target')
  const startReconnect = useCallback(
    (event, edge, end) =>
      startLink(event, { mode: end, edgeId: edge.id, fixedId: end === 'source' ? edge.targetNodeId : edge.sourceNodeId }),
    [startLink],
  )
  const linkValue = useMemo(
    () => ({ connectMode, startConnect, target: link?.target ?? null }),
    [connectMode, startConnect, link?.target],
  )

  // 드래그 중 미리보기 선 (캔버스 좌표). 연결할 수 있는 노드 위에서는 그 노드의 연결 위치에 붙는다.
  let preview = null
  if (link) {
    const boxOf = (id) => {
      const n = getInternalNode(id)
      if (!n?.measured?.width) return null
      const { x, y } = n.internals.positionAbsolute
      return { x, y, w: n.measured.width, h: n.measured.height }
    }
    const outOf = (b) => ({ x: b.x + b.w, y: b.y + b.h / 2 }) // 출발: 오른쪽 가운데
    const inOf = (b) => ({ x: b.x - 7, y: b.y + b.h / 2 }) // 도착: 왼쪽 점 가장자리
    const fixed = boxOf(link.fixedId)
    const snap = link.target?.valid ? boxOf(link.target.id) : null
    if (fixed) {
      preview = link.mode === 'source'
        ? previewPath(snap ? outOf(snap) : link.pointer, inOf(fixed))
        : previewPath(outOf(fixed), snap ? inOf(snap) : link.pointer)
    }
  }

  const flowEdges = useMemo(
    () =>
      edges.map((e) => ({
        id: e.id,
        source: e.sourceNodeId,
        target: e.targetNodeId,
        type: 'roadmap',
        // 끝점을 옮기는 중인 선은 흐리게 (놓기 전까지 기존 관계는 그대로)
        className: `rm-edge ${link?.edgeId === e.id ? 'is-reconnecting' : ''}`,
        zIndex: 1, // 카드 위에 그려서 끝 핸들이 가려지지 않게
        data: {
          onDelete: onEdgeDelete,
          onStartReconnect: (event, end) => startReconnect(event, e, end),
        },
      })),
    [edges, onEdgeDelete, startReconnect, link?.edgeId],
  )

  return (
    <DropTargetContext.Provider value={dropPeriodId}>
    <LinkContext.Provider value={linkValue}>
      {/* 새로 누를 때마다 "드래그 직후" 표시를 지운다 */}
      <div
        className={`rm-canvas ${nodeDragging ? 'is-node-dragging' : ''} ${connectMode ? 'is-connect-mode' : ''} ${link ? 'is-linking' : ''}`}
        onPointerDownCapture={() => { draggedRef.current = false }}>
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
          {preview && (
            <ViewportPortal>
              <svg className="rm-link-preview" width="1" height="1" aria-hidden="true">
                <path d={preview} />
              </svg>
            </ViewportPortal>
          )}
        </ReactFlow>
      </div>
    </LinkContext.Provider>
    </DropTargetContext.Provider>
  )
}
