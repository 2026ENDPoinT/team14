import { useCallback, useEffect, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { mockDocuments, mockEdges, mockNodes, mockPeriods } from '../data/roadmapMock.js'
import RoadmapNav from '../features/roadmap/RoadmapNav.jsx'
import RoadmapCanvas from '../features/roadmap/RoadmapCanvas.jsx'
import FabMenu from '../features/roadmap/FabMenu.jsx'
import InboxPanel from '../features/roadmap/InboxPanel.jsx'
import AddNodeModal from '../features/roadmap/AddNodeModal.jsx'
import NodeDetailModal from '../features/roadmap/NodeDetailModal.jsx'
import { nextPosition } from '../features/roadmap/layout.js'
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
      else if (inboxOpen) setInboxOpen(false)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [detailId, addOpen, fabOpen, inboxOpen])

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

  const handleEdgeDelete = useCallback((edgeId) => {
    setEdges((prev) => prev.filter((e) => e.id !== edgeId))
  }, [])

  const openAdd = () => {
    setDetailId(null)
    setFabOpen(false)
    setAddOpen(true)
  }

  const handleFabSelect = (id) => {
    if (id === 'node') return openAdd()
    setFabOpen(false)
    // CONNECT·SEMESTER는 다음 작업(TASKS 1-9, 1-10)에서 구현
    setToast(id === 'connect' ? '연결선 추가는 준비 중이에요.' : '학기 추가는 준비 중이에요.')
  }

  const handleCreate = ({ theme, title, periodId, memo }) => {
    const id = `n_${Date.now()}`
    const newNode = {
      id,
      title,
      theme,
      periodId,
      position: periodId ? nextPosition(nodes, periodId) : null,
      status: periodId ? 'placed' : 'stored',
      source: 'user',
      originKey: null,
      completed: false,
      createdAt: new Date().toISOString(),
    }
    setNodes((prev) => [...prev, newNode])
    // 짧은 메모는 노드 문서(NodeDocument)의 내용으로 저장
    if (memo) {
      setDocuments((prev) => ({
        ...prev,
        [id]: { nodeId: id, content: { format: 'plain', body: memo }, updatedAt: newNode.createdAt },
      }))
    }
    setAddOpen(false)
    if (!periodId) setInboxOpen(true) // 보관함에 넣었으면 보관함을 열어 보여 준다
    setToast(periodId ? '노드를 학기에 추가했어요.' : '노드를 보관함에 추가했어요.')
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
          periods={periods}
          nodes={nodes}
          edges={edges}
          getSubtitle={getSubtitle}
          onNodeClick={openDetail}
          onNodeMove={handleNodeMove}
          onEdgeDelete={handleEdgeDelete}
          dropPeriodId={dropPeriodId}
          onDropTargetChange={setDropPeriodId}
        />

        <RoadmapNav />

        <InboxPanel
          open={inboxOpen}
          nodes={nodes.filter((n) => n.status === 'stored')}
          allNodes={nodes}
          periods={periods}
          getSubtitle={getSubtitle}
          onNodeClick={openDetail}
          onAdd={openAdd}
          onPlace={handleNodeMove}
          onTargetChange={setDropPeriodId}
        />

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
          onClose={() => setDetailId(null)}
          onSave={handleSave}
          onDelete={handleDeleteNode}
          onOpenNode={openDetail}
        />

        <div className={`rm-toast ${toast ? 'is-visible' : ''}`} role="status">{toast}</div>
      </div>
    </ReactFlowProvider>
  )
}
