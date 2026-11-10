import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Controls, ReactFlow, ViewportPortal, applyNodeChanges } from '@xyflow/react'
import '@xyflow/react/dist/base.css' // React Flow 동작에 필요한 최소 스타일 (디자인은 roadmap.css)
import TimelineNode from './TimelineNode.jsx'
import CardNode from './CardNode.jsx'
import RoadmapEdge from './RoadmapEdge.jsx'
import { DropTargetContext } from './dropTarget.js'
import { LinkContext } from './linkContext.js'
import { BranchContext, computeBranches } from './branchLines.js'
import useLinkDrag from './useLinkDrag.js'
import useWheelZoom from './useWheelZoom.js'
import { TrashIcon } from './icons.jsx'
import { routeBetween, routeEdges, routeToPoint } from './edgeRouting.js'
import { CANVAS_HEIGHT, cardSize, findPeriodAt, findSwapTarget, initialViewport, nodeBox, planDrop } from './layout.js'

// React Flow에 등록할 노드·연결선 종류 (컴포넌트 밖에 두어야 매번 새로 만들지 않는다)
const nodeTypes = { timeline: TimelineNode, card: CardNode }
const edgeTypes = { roadmap: RoadmapEdge }
const MIN_ZOOM = 0.25
const MAX_ZOOM = 1.6
const CLICK_DISTANCE = 4 // 이 거리(px) 이하로 움직이면 클릭으로 판정

// 마우스·터치 이벤트의 화면 좌표
function pointOf(event) {
  const p = event?.changedTouches?.[0] ?? event
  return p && typeof p.clientX === 'number' ? { x: p.clientX, y: p.clientY } : null
}

// 카드의 캔버스 위치·크기
function boxAt(position, node) {
  const { w, h } = cardSize(node)
  return { x: position.x, y: position.y, w, h }
}

// 가로형 로드맵 캔버스 (React Flow)
// - 데이터는 학기(periodId) 기준 상대 좌표, 화면에는 캔버스 좌표로 바꿔서 그린다. (layout.js nodeBox)
// - 빈 공간 드래그·휠·두 손가락 스크롤: 이동 / 핀치·Ctrl(⌘)+휠: 확대·축소 / 노드 드래그: 위치 이동·학기 재배정
// - 타임라인 위 카드(교과목·전공·학업)를 다른 선 위 카드에 놓으면: 자리 교환 (layout.js planDrop)
// - 관계선은 CONNECT 모드에서만 만든다: 카드 몸통이나 오른쪽 핸들을 끌어 다른 노드에 놓기
// - 왼쪽 아래 휴지통: 노드를 끌어 휴지통 위에서 놓으면 삭제 (화면에 고정된 휴지통의 실제 영역과 마우스 위치로 판정)
// - layout: 학기별 x·너비 (layout.js computeLayout). 데이터가 바뀔 때만 다시 계산되므로
//   드래그하는 동안에는 학기 경계가 고정되고, 놓은 뒤에 필요한 만큼만 학기가 넓어진다.
export default function RoadmapCanvas({
  layout, nodes, edges, getSubtitle, onNodeClick, onNodesMove, onNodeDelete, onEdgeDelete, onToggleComplete,
  dropPeriodId, onDropTargetChange, // 드래그 중 강조할 학기 (보관함 드래그와 함께 쓰려고 페이지에서 관리)
  connectMode, onEdgeCreate, onEdgeReconnect, onLinkReject, // 관계선 만들기·끝점 옮기기
}) {
  const width = layout.width + 200

  const [startViewport] = useState(() => initialViewport(window.innerWidth, window.innerHeight, layout, nodes)) // 첫 진입 화면 위치
  const [resetKey, setResetKey] = useState(0) // 원래 위치로 되돌리기용
  const wrapRef = useRef(null)
  const extent = useMemo(() => [[-600, -400], [width + 600, CANVAS_HEIGHT + 400]], [width]) // 화면 이동 가능 범위
  useWheelZoom(wrapRef, { minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM, extent })
  const [draggingId, setDraggingId] = useState(null) // 끌고 있는 노드 (연결선 애니메이션 끔, 가지선 잠시 숨김)
  const [swapId, setSwapId] = useState(null) // 드래그 중 자리를 바꿀 타임라인 위 카드
  const trashRef = useRef(null)
  const [overTrash, setOverTrash] = useState(false) // 드래그 중인 노드가 휴지통 위에 있는지
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

  // 지금 화면에 그려진 카드 위치 (드래그 중이면 드래그 위치) → 연결선·가지선이 실시간으로 따라감
  const liveCards = useMemo(
    () => flowNodes.filter((n) => n.type === 'card').map((n) => ({ node: n.data.node, box: boxAt(n.position, n.data.node) })),
    [flowNodes],
  )
  const liveBoxes = useMemo(() => new Map(liveCards.map((c) => [c.node.id, c.box])), [liveCards])

  // 노드 관계선 경로 (위·아래·오른쪽 중 알맞은 접점, 카드 관통 피하기, 접점 나누기)
  const routes = useMemo(() => routeEdges(edges, liveBoxes), [edges, liveBoxes])
  // 학기 가지선 (끌고 있는 노드는 놓을 때까지 잠시 숨김)
  const branches = useMemo(
    () => computeBranches(liveCards.filter((c) => c.node.id !== draggingId), edges, layout),
    [liveCards, edges, layout, draggingId],
  )

  // 마우스가 휴지통 위에 있는지: 캔버스 좌표가 아니라 화면 좌표로 비교하므로 확대·축소와 상관없다
  const isOverTrash = useCallback((event) => {
    const point = pointOf(event)
    const rect = trashRef.current?.getBoundingClientRect()
    if (!point || !rect) return false
    return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom
  }, [])

  const onNodeDragStart = useCallback((event, flowNode) => {
    dragStartRef.current = { x: event.clientX, y: event.clientY }
    setDraggingId(flowNode.id)
  }, [])

  // 드래그 중: 노드 중심이 있는 학기 강조 + 자리를 바꿀 타임라인 위 카드 강조
  const onNodeDrag = useCallback(
    (event, flowNode) => {
      // 마우스가 CLICK_DISTANCE보다 많이 움직였으면 "드래그"로 본다 (손떨림은 클릭으로 처리)
      const start = dragStartRef.current
      if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > CLICK_DISTANCE) {
        draggedRef.current = true
      }
      // 휴지통 위: 삭제 안내만 보여 주고 학기·자리 교환 강조는 끈다 (놓기 전까지는 삭제하지 않음)
      const inTrash = isOverTrash(event)
      setOverTrash(inTrash)
      if (inTrash) {
        setSwapId(null)
        onDropTargetChange(null)
        return
      }
      const swap = findSwapTarget(flowNode.data.node, flowNode.position, nodes, layout)
      setSwapId(swap?.id ?? null)
      const { x, y, w, h } = boxAt(flowNode.position, flowNode.data.node)
      onDropTargetChange(findPeriodAt(x + w / 2, y + h / 2, layout)?.id ?? null)
    },
    [nodes, layout, onDropTargetChange, isOverTrash],
  )

  // 드롭: 휴지통 위면 삭제 / 아니면 자리 교환 또는 학기 판정 → 겹침 보정 → periodId와 상대 좌표 저장 (layout.js planDrop)
  // 자리 교환은 두 노드를 한 번에 저장해서 중간에 겹치는 상태가 생기지 않게 한다
  const onNodeDragStop = useCallback(
    (event, flowNode) => {
      onDropTargetChange(null)
      setDraggingId(null)
      setSwapId(null)
      setOverTrash(false)
      if (isOverTrash(event)) {
        onNodeDelete(flowNode.id)
        return
      }
      const moves = planDrop(flowNode.data.node, flowNode.position, nodes, layout)
      if (!moves) {
        setResetKey((k) => k + 1) // 학기 영역 밖이거나 빈 자리가 없음 → 원래 자리로
        return
      }
      onNodesMove(moves)
    },
    [nodes, layout, onNodesMove, onNodeDelete, onDropTargetChange, isOverTrash],
  )

  // ───── 관계선 만들기(CONNECT 핸들)·끝점 옮기기 ─────
  const onLinkDone = useCallback(
    (info, nodeId) => {
      if (info.mode === 'create') onEdgeCreate(info.fixedId, nodeId)
      else onEdgeReconnect(info.edgeId, info.mode, nodeId)
    },
    [onEdgeCreate, onEdgeReconnect],
  )
  const { link, startLink, startLinkOnMove } = useLinkDrag({ edges, onDone: onLinkDone, onReject: onLinkReject })

  // 카드 오른쪽 연결 핸들 → 새 관계선
  const startConnect = useCallback((event, nodeId) => startLink(event, { mode: 'create', fixedId: nodeId }), [startLink])
  // CONNECT 모드 카드 몸통: 4px 넘게 끌면 새 관계선 (그 전에 떼면 클릭 → 상세 창)
  const startConnectDrag = useCallback(
    (event, nodeId) => startLinkOnMove(event, { mode: 'create', fixedId: nodeId }),
    [startLinkOnMove],
  )
  // 연결선 끝 핸들 → 그 끝을 다른 노드로 옮기기 (end: 'source' | 'target')
  const startReconnect = useCallback(
    (event, edge, end) =>
      startLink(event, { mode: end, edgeId: edge.id, fixedId: end === 'source' ? edge.targetNodeId : edge.sourceNodeId }),
    [startLink],
  )
  // 카드 강조: 관계선을 끄는 중이면 그 대상, 노드를 끄는 중이면 자리 교환 대상 (swap: '자리 바꾸기' 안내 표시)
  const linkTarget = link?.target ?? (swapId ? { id: swapId, valid: true, swap: true } : null)
  const linkValue = useMemo(
    () => ({ connectMode, startConnect, startConnectDrag, target: linkTarget }),
    [connectMode, startConnect, startConnectDrag, linkTarget?.id, linkTarget?.valid, linkTarget?.swap], // eslint-disable-line react-hooks/exhaustive-deps
  )

  // 드래그 중 미리보기 선: 연결할 수 있는 노드 위에서는 실제로 그려질 경로 그대로
  let preview = null
  if (link) {
    const fixed = liveBoxes.get(link.fixedId)
    const snapId = link.target?.valid ? link.target.id : null
    if (fixed && snapId) {
      const others = [...liveBoxes].filter(([id]) => id !== link.fixedId && id !== snapId).map(([, b]) => b)
      preview = link.mode === 'source'
        ? routeBetween(liveBoxes.get(snapId), fixed, others)
        : routeBetween(fixed, liveBoxes.get(snapId), others)
    } else if (fixed) {
      preview = routeToPoint(fixed, link.pointer)
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
          route: routes.get(e.id),
          onDelete: onEdgeDelete,
          onStartReconnect: (event, end) => startReconnect(event, e, end),
        },
      })),
    [edges, routes, onEdgeDelete, startReconnect, link?.edgeId],
  )

  const canvasClass = [
    'rm-canvas',
    draggingId ? 'is-node-dragging' : '',
    connectMode ? 'is-connect-mode' : '',
    link ? 'is-linking' : '',
    overTrash ? 'is-over-trash' : '',
  ].join(' ')

  return (
    <DropTargetContext.Provider value={dropPeriodId}>
    <LinkContext.Provider value={linkValue}>
    <BranchContext.Provider value={branches}>
      {/* 새로 누를 때마다 "드래그 직후" 표시를 지운다 */}
      <div
        ref={wrapRef}
        className={canvasClass}
        onPointerDownCapture={(e) => {
          draggedRef.current = false
          dragStartRef.current = { x: e.clientX, y: e.clientY }
        }}
        // 눌렀다 뗄 때까지 4px 넘게 움직였으면 클릭이 아닌 드래그로 본다 (CONNECT 모드에서 카드를 끌어도 상세 창이 안 열리게)
        onPointerUpCapture={(e) => {
          const start = dragStartRef.current
          if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > CLICK_DISTANCE) draggedRef.current = true
        }}
      >
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          onNodesChange={onNodesChange}
          onNodeDragStart={onNodeDragStart}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultViewport={startViewport}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          translateExtent={extent}
          panOnDrag // 빈 공간 드래그 → 이동
          panOnScroll // 휠·트랙패드 두 손가락 스크롤 → 상하·좌우 이동
          panOnScrollSpeed={1} // 손가락 움직인 만큼 그대로 이동 (기본 0.5는 느림)
          zoomOnScroll={false} // 휠은 이동에 쓴다. 확대·축소는 Ctrl/⌘+휠·핀치 (useWheelZoom)
          zoomOnPinch // 터치스크린 두 손가락 핀치 → 확대·축소
          zoomActivationKeyCode={null} // ⌘를 누른 휠도 useWheelZoom이 처리
          zoomOnDoubleClick={false}
          nodesDraggable // CONNECT 모드에서는 카드에 nodrag를 붙여 이동을 막는다 (CardNode). 이 값을 껐다 켜면 드래그가 다시 붙지 않는 문제가 있어 항상 켜 둔다
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
        {/* 휴지통: 화면 왼쪽 아래 고정 (확대·축소 버튼 오른쪽). 노드를 끄는 동안 강조, 위에 올리면 '삭제하기' */}
        <div
          ref={trashRef}
          className={`rm-trash ${draggingId ? 'is-armed' : ''} ${overTrash ? 'is-active' : ''}`}
          role="img"
          aria-label="휴지통: 노드를 끌어 여기에 놓으면 삭제돼요"
          title="노드를 끌어 여기에 놓으면 삭제돼요"
        >
          <TrashIcon width="17" height="17" />
          <span className="rm-trash__label">삭제하기</span>
        </div>
      </div>
    </BranchContext.Provider>
    </LinkContext.Provider>
    </DropTargetContext.Provider>
  )
}
