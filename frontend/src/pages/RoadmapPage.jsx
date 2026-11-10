import { useCallback, useEffect, useMemo, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { mockDocuments, mockEdges, mockNodes, mockPeriods } from '../data/roadmapMock.js'
import RoadmapNav from '../features/roadmap/RoadmapNav.jsx'
import RoadmapCanvas from '../features/roadmap/RoadmapCanvas.jsx'
import FabMenu from '../features/roadmap/FabMenu.jsx'
import InboxPanel from '../features/roadmap/InboxPanel.jsx'
import AddNodeModal from '../features/roadmap/AddNodeModal.jsx'
import NodeDetailModal from '../features/roadmap/NodeDetailModal.jsx'
import RoadmapTutorial from '../features/roadmap/tutorial/RoadmapTutorial.jsx'
import { hasSeenRoadmapTutorial, markRoadmapTutorialSeen } from '../features/roadmap/tutorial/tutorialStorage.js'
import { linkProblem } from '../features/roadmap/edgeRules.js'
import { autoBranchVisible } from '../features/roadmap/branchLines.js'
import { BASE_WIDTH, computeLayout, nextPosition, placeNode } from '../features/roadmap/layout.js'
import '../features/roadmap/roadmap.css'

// 로드맵 페이지: 하나의 화면에서 상태에 따라 메뉴·보관함·팝업이 나타나고 사라진다.
// 데이터는 아직 Mock Data (API 연결은 TASKS 1-14에서 진행)
export default function RoadmapPage() {
  const [periods] = useState(mockPeriods)
  const [nodes, setNodes] = useState(mockNodes)
  const [edges, setEdges] = useState(mockEdges)
  const [documents, setDocuments] = useState(mockDocuments)

  // 화면 상태 (모두 기본값은 닫힘)
  const [fabOpen, setFabOpen] = useState(false) // + 메뉴
  const [inboxOpen, setInboxOpen] = useState(false) // 노드 보관함
  const [addOpen, setAddOpen] = useState(false) // 노드 생성 창
  const [detailId, setDetailId] = useState(null) // 상세 창에 열린 노드 id
  const [toast, setToast] = useState('')
  const [dropPeriodId, setDropPeriodId] = useState(null) // 노드를 끄는 동안 강조할 학기
  const [tutorialOpen, setTutorialOpen] = useState(false) // 첫 접속 튜토리얼
  const [connectMode, setConnectMode] = useState(false) // CONNECT: 노드 오른쪽 핸들로 관계선 만들기

  // 처음 접속했을 때만 튜토리얼 자동 표시 (캔버스가 자리 잡을 시간을 조금 준다)
  useEffect(() => {
    if (hasSeenRoadmapTutorial()) return undefined
    const timer = setTimeout(() => setTutorialOpen(true), 500)
    return () => clearTimeout(timer)
  }, [])

  // 건너뛰거나 완료하면 기록해서 다시 자동으로 나타나지 않게 한다
  const closeTutorial = useCallback(() => {
    markRoadmapTutorialSeen()
    setTutorialOpen(false)
  }, [])

  // 학기 컬럼 배치 (자동 확장): 노드 배치로부터 학기별 x·너비 계산
  // keptWidths: 이번 세션에서 커졌던 너비. 노드를 빼내도 학기가 바로 줄지 않게 해서
  //             뒤 학기·노드가 갑자기 왼쪽으로 튀지 않게 한다. (새로고침하면 다시 계산)
  const [keptWidths, setKeptWidths] = useState({})
  const layout = useMemo(() => computeLayout(periods, nodes, keptWidths), [periods, nodes, keptWidths])
  useEffect(() => {
    setKeptWidths((prev) => {
      const grown = Object.entries(layout.cols).filter(
        ([id, col]) => col.width > BASE_WIDTH && col.width > (prev[id] ?? 0),
      )
      if (grown.length === 0) return prev
      return { ...prev, ...Object.fromEntries(grown.map(([id, col]) => [id, col.width])) }
    })
  }, [layout])

  const getBody = (nodeId) => documents[nodeId]?.content.body ?? ''
  // 캔버스가 불필요하게 다시 그려지지 않도록 useCallback으로 고정
  const getSubtitle = useCallback(
    (nodeId) => (documents[nodeId]?.content.body ?? '').split('\n')[0],
    [documents],
  )

  const closeFab = useCallback(() => setFabOpen(false), [])

  // ESC 키로 가장 위에 열린 것부터 닫기
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key !== 'Escape') return
      if (detailId) setDetailId(null)
      else if (addOpen) setAddOpen(false)
      else if (fabOpen) setFabOpen(false)
      else if (connectMode) setConnectMode(false)
      else if (inboxOpen) setInboxOpen(false)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [detailId, addOpen, fabOpen, connectMode, inboxOpen])

  // 안내 메시지는 2초 뒤 사라짐
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 2000)
    return () => clearTimeout(timer)
  }, [toast])

  const openDetail = useCallback((nodeId) => {
    setAddOpen(false)
    setFabOpen(false)
    setDetailId(nodeId)
  }, [])

  // 노드 드래그 후(캔버스 이동 또는 보관함 → 학기 배치):
  // 학기(periodId), 학기 기준 상대 좌표, 배치 상태만 바꾼다. (제목·종류·이수 상태·문서는 그대로)
  const handleNodeMove = useCallback((nodeId, { periodId, position }) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, periodId, position, status: 'placed' } : n)),
    )
  }, [])

  // 완료 상태 표시등 클릭: completed만 뒤집는다 (기존 필드 사용)
  const handleToggleComplete = useCallback((nodeId) => {
    setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, completed: !n.completed } : n)))
  }, [])

  const handleEdgeDelete = useCallback((edgeId) => {
    setEdges((prev) => prev.filter((e) => e.id !== edgeId))
  }, [])

  // 관계선 만들기: 자기 자신·중복(방향 무관)은 막는다. 노드 자체는 바꾸지 않는다.
  const handleEdgeCreate = useCallback((sourceId, targetId) => {
    setEdges((prev) => {
      if (linkProblem(prev, sourceId, targetId)) return prev
      return [...prev, { id: `e_${Date.now()}`, sourceNodeId: sourceId, targetNodeId: targetId }]
    })
    setToast('관계선을 연결했어요.')
  }, [])

  // 관계선 끝점 옮기기: end('source' | 'target') 쪽 노드만 바꾼다
  const handleEdgeReconnect = useCallback((edgeId, end, nodeId) => {
    setEdges((prev) => {
      const edge = prev.find((e) => e.id === edgeId)
      if (!edge) return prev
      const next = end === 'source' ? { ...edge, sourceNodeId: nodeId } : { ...edge, targetNodeId: nodeId }
      if (linkProblem(prev, next.sourceNodeId, next.targetNodeId, edgeId)) return prev
      return prev.map((e) => (e.id === edgeId ? next : e))
    })
    setToast('연결 대상을 바꿨어요.')
  }, [])

  const handleLinkReject = useCallback((message) => setToast(message), [])

  // 학기 가지선 표시 설정 (null 자동 / 'shown' / 'hidden')
  const handleBranchChange = useCallback((nodeId, value) => {
    setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, branchVisibility: value } : n)))
  }, [])

  const openAdd = () => {
    setDetailId(null)
    setFabOpen(false)
    setAddOpen(true)
  }

  const handleFabSelect = (id) => {
    if (id === 'node') return openAdd()
    setFabOpen(false)
    if (id === 'connect') {
      setConnectMode(true)
      return
    }
    // SEMESTER는 다음 작업(TASKS 1-10)에서 구현
    setToast('학기 추가는 준비 중이에요.')
  }

  const handleCreate = ({ theme, title, periodId, memo }) => {
    const id = `n_${Date.now()}`
    const newNode = {
      id,
      title,
      theme,
      periodId: null,
      position: null,
      status: 'stored',
      source: 'user',
      originKey: null,
      completed: false,
      branchVisibility: null, // 학기 가지선: 자동
      createdAt: new Date().toISOString(),
    }
    // 학기를 골랐으면: 기존 노드 아래쪽에서 시작해 드래그와 같은 겹침 보정 규칙으로 자리를 찾는다
    let placement = null
    // (자리가 없으면 학기를 최대 너비까지 넓혀 보고, 그래도 없을 때만 보관함으로)
    if (periodId) {
      const start = nextPosition(nodes, periodId)
      placement = placeNode(newNode, { x: layout.cols[periodId].x + start.x, y: start.y }, nodes, layout)
    }
    const created = placement ? { ...newNode, ...placement, status: 'placed' } : newNode
    setNodes((prev) => [...prev, created])
    // 짧은 메모는 노드 문서(NodeDocument)의 내용으로 저장
    if (memo) {
      setDocuments((prev) => ({
        ...prev,
        [id]: { nodeId: id, content: { format: 'plain', body: memo }, updatedAt: newNode.createdAt },
      }))
    }
    setAddOpen(false)
    if (!placement) setInboxOpen(true) // 보관함에 넣었으면 보관함을 열어 보여 준다
    if (placement) setToast('노드를 학기에 추가했어요.')
    else if (periodId) setToast('학기에 빈 자리가 없어 보관함에 넣었어요.')
    else setToast('노드를 보관함에 추가했어요.')
  }

  const handleSave = (nodeId, { title, body }) => {
    setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, title } : n)))
    setDocuments((prev) => ({
      ...prev,
      [nodeId]: { nodeId, content: { format: 'plain', body }, updatedAt: new Date().toISOString() },
    }))
  }

  const handleDeleteNode = (nodeId) => {
    setNodes((prev) => prev.filter((n) => n.id !== nodeId))
    setEdges((prev) => prev.filter((e) => e.sourceNodeId !== nodeId && e.targetNodeId !== nodeId))
    setDocuments((prev) => {
      const next = { ...prev }
      delete next[nodeId]
      return next
    })
    setDetailId(null)
  }

  const detailNode = nodes.find((n) => n.id === detailId) ?? null
  const connections = edges
    .filter((e) => e.sourceNodeId === detailId || e.targetNodeId === detailId)
    .map((e) => nodes.find((n) => n.id === (e.sourceNodeId === detailId ? e.targetNodeId : e.sourceNodeId)))
    .filter(Boolean)

  return (
    // ReactFlowProvider: 보관함 드래그에서도 캔버스 좌표 변환(screenToFlowPosition)을 쓰기 위해 감싼다
    <ReactFlowProvider>
      <div className="roadmap-page">
        <RoadmapCanvas
          layout={layout}
          nodes={nodes}
          edges={edges}
          getSubtitle={getSubtitle}
          onNodeClick={openDetail}
          onNodeMove={handleNodeMove}
          onEdgeDelete={handleEdgeDelete}
          onToggleComplete={handleToggleComplete}
          connectMode={connectMode}
          onEdgeCreate={handleEdgeCreate}
          onEdgeReconnect={handleEdgeReconnect}
          onLinkReject={handleLinkReject}
          dropPeriodId={dropPeriodId}
          onDropTargetChange={setDropPeriodId}
        />

        <RoadmapNav />

        <InboxPanel
          open={inboxOpen}
          nodes={nodes.filter((n) => n.status === 'stored')}
          allNodes={nodes}
          layout={layout}
          getSubtitle={getSubtitle}
          onNodeClick={openDetail}
          onAdd={openAdd}
          onPlace={handleNodeMove}
          onTargetChange={setDropPeriodId}
        />

        {connectMode && (
          <div className="rm-connect-banner" role="status">
            <span>연결 모드 · 노드 오른쪽 ● 을 다른 노드로 끌어 놓으세요</span>
            <button type="button" onClick={() => setConnectMode(false)}>완료</button>
          </div>
        )}

        <FabMenu
          open={fabOpen}
          onToggle={() => setFabOpen((v) => !v)}
          onClose={closeFab}
          onSelect={handleFabSelect}
          inboxOpen={inboxOpen}
          onInboxClick={() => setInboxOpen((v) => !v)}
        />

        <AddNodeModal
          open={addOpen}
          periods={periods}
          onClose={() => setAddOpen(false)}
          onCreate={handleCreate}
        />

        <NodeDetailModal
          node={detailNode}
          body={getBody(detailId)}
          connections={connections}
          branch={detailNode ? { value: detailNode.branchVisibility ?? null, autoVisible: autoBranchVisible(detailNode.id, edges) } : null}
          onBranchChange={handleBranchChange}
          onClose={() => setDetailId(null)}
          onSave={handleSave}
          onDelete={handleDeleteNode}
          onOpenNode={openDetail}
        />

        <RoadmapTutorial open={tutorialOpen} nodes={nodes} layout={layout} onClose={closeTutorial} />

        <div className={`rm-toast ${toast ? 'is-visible' : ''}`} role="status">{toast}</div>
      </div>
    </ReactFlowProvider>
  )
}
