import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { useSearchParams } from 'react-router-dom'
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
import { BASE_CATEGORIES } from '../features/roadmap/nodeCategories.js'
import {
  createEdge,
  createNode,
  createNodeCategory,
  deleteEdge,
  deleteNode,
  getRoadmap,
  isSupabaseConfigured,
  listNodeCategories,
  moveNodes,
  saveNodeDetail,
  setNodeCompleted,
  updateEdge,
} from '../services/api.js'
import '../features/roadmap/roadmap.css'

const UNDO_MS = 5000 // 실행 취소 안내가 보이는 시간. 이 시간이 지나면 삭제를 DB에 저장한다

// 서버의 사용자 정의 종류(NodeCategory) → 종류 선택 칩 형식
const toPickerCategory = (category) => ({
  id: category.id,
  label: category.name,
  theme: category.baseTheme,
  details: [], // 사용자 정의 종류에는 세부 활동이 없다
  custom: true,
})

// 노드의 종류 이름: 기본 종류 라벨 또는 내가 만든 종류 이름. 없으면 null (→ 카드에 theme 이름)
function categoryLabelOf(categoryId, customCategories) {
  if (!categoryId) return null
  return [...BASE_CATEGORIES, ...customCategories].find((c) => c.id === categoryId)?.label ?? null
}

// 로드맵 페이지: 하나의 화면에서 상태에 따라 메뉴·보관함·팝업이 나타나고 사라진다.
// 데이터: 로그인했으면 내 학기·노드·연결선·노드 문서를 DB에서 불러오고,
//         노드 생성·이동·수정(이름·종류·기록)·완료 표시·삭제, 연결선 추가·변경·삭제를 DB에 저장한다.
//         저장에 실패하면 화면을 되돌리고 오류를 보여 준다 (성공처럼 보이지 않게).
//         로그인 전이거나 Supabase 설정(.env)이 없으면 예시(Mock Data)를 보여 준다. (예시는 DB에 넣지 않는다)
//         학기 가지선 표시 설정은 아직 화면에서만 바뀐다 (DB 컬럼 없음)
export default function RoadmapPage() {
  const [mode, setMode] = useState(isSupabaseConfigured ? 'loading' : 'mock') // 'loading' | 'db' | 'mock' | 'error'
  const [loadError, setLoadError] = useState('')
  const [periods, setPeriods] = useState(isSupabaseConfigured ? [] : mockPeriods)
  const [nodes, setNodes] = useState(isSupabaseConfigured ? [] : mockNodes)
  const [edges, setEdges] = useState(isSupabaseConfigured ? [] : mockEdges)
  const [documents, setDocuments] = useState(isSupabaseConfigured ? {} : mockDocuments)

  // 화면 상태 (모두 기본값은 닫힘)
  const [fabOpen, setFabOpen] = useState(false) // + 메뉴
  const [inboxOpen, setInboxOpen] = useState(false) // 노드 보관함
  const [addOpen, setAddOpen] = useState(false) // 노드 생성 창
  const [detailId, setDetailId] = useState(null) // 상세 창에 열린 노드 id
  const [toast, setToast] = useState('') // 안내 문구, 또는 { text, undo } (실행 취소 버튼이 있는 삭제 안내)
  const [dropPeriodId, setDropPeriodId] = useState(null) // 노드를 끄는 동안 강조할 학기
  const [tutorialOpen, setTutorialOpen] = useState(false) // 첫 접속 튜토리얼
  const [connectMode, setConnectMode] = useState(false) // CONNECT: 노드 오른쪽 핸들로 관계선 만들기
  // 직접 추가한 노드 종류 (ADD NODE·NODE DETAILS 공용). 로그인한 사용자의 종류를 DB(node_categories)에서 불러오고 저장한다.
  const [customCategories, setCustomCategories] = useState([])

  // 저장 실패 시 되돌리기·최신 값 비교용 (콜백 안에서 가장 최근 상태를 읽는다)
  const nodesRef = useRef(nodes)
  nodesRef.current = nodes
  const edgesRef = useRef(edges)
  edgesRef.current = edges
  const isDb = mode === 'db'
  // 실행 취소를 기다리는 삭제: nodeId → { timer, undo }. 시간이 지나면 DB에서 지운다
  const pendingDeletes = useRef(new Map())

  // 처음 열 때: 내 학기·노드·노드 문서와 내가 만든 종류를 함께 불러온다
  // 로그인 전이면 예시 로드맵, 불러오기 실패면 오류 화면 (예시로 바꿔치기하지 않음)
  const loadRoadmap = useCallback(async () => {
    setMode('loading')
    const [roadmap, categories] = await Promise.all([getRoadmap(), listNodeCategories()])
    if (roadmap.error?.code === 'UNAUTHENTICATED') {
      setPeriods(mockPeriods)
      setNodes(mockNodes)
      setEdges(mockEdges)
      setDocuments(mockDocuments)
      setCustomCategories([])
      setMode('mock')
      setToast('예시 로드맵이에요. 로그인하면 내 로드맵을 불러와요.')
      return
    }
    const failed = roadmap.error ?? categories.error
    if (failed) {
      setLoadError(failed.message)
      setMode('error')
      return
    }
    const custom = categories.data.map(toPickerCategory)
    setCustomCategories(custom)
    setPeriods(roadmap.data.periods)
    setNodes(roadmap.data.nodes.map((n) => ({ ...n, categoryLabel: categoryLabelOf(n.categoryId, custom) })))
    setEdges(roadmap.data.edges)
    setDocuments(roadmap.data.documents)
    setMode('db')
    if (roadmap.data.periods.length === 0) setToast('아직 학기 정보가 없어요. 온보딩을 마치면 학기가 만들어져요.')
  }, [])

  useEffect(() => {
    if (isSupabaseConfigured) loadRoadmap()
  }, [loadRoadmap])

  // 탐색의 '로드맵에서 보기'(/roadmap?node=…)로 들어오면 그 노드의 상세 창을 연다 (보관함 노드면 보관함도 연다)
  // 한 번 연 뒤에는 주소의 ?node=를 지운다 (새로고침할 때마다 다시 열리지 않게)
  const [searchParams, setSearchParams] = useSearchParams()
  const focusNodeId = searchParams.get('node')
  useEffect(() => {
    if (mode !== 'db' || !focusNodeId) return
    const target = nodes.find((n) => n.id === focusNodeId)
    if (target) {
      if (target.status === 'stored') setInboxOpen(true)
      setDetailId(target.id)
    }
    setSearchParams({}, { replace: true })
  }, [mode, focusNodeId, nodes, setSearchParams])

  // 종류 추가: DB에 저장된 뒤에만 목록에 넣는다. 반환 { id } 또는 { error: 문구 }
  // 저장 값(theme)은 자유 노드(free)
  const addCustomCategory = useCallback(async (name) => {
    const result = await createNodeCategory(name, 'free')
    if (result.error) return { error: result.error.message }
    const category = toPickerCategory(result.data)
    setCustomCategories((prev) => [...prev, category])
    return { id: category.id }
  }, [])

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

  // 안내 메시지는 2초 뒤 사라짐 (실행 취소가 있는 안내는 5초)
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), toast.undo ? 5000 : 2000)
    return () => clearTimeout(timer)
  }, [toast])

  const openDetail = useCallback((nodeId) => {
    setAddOpen(false)
    setFabOpen(false)
    setDetailId(nodeId)
  }, [])

  // 노드 드래그 후(캔버스 이동 또는 보관함 → 학기 배치):
  // 학기(periodId), 학기 기준 상대 좌표, 배치 상태만 바꾼다. (제목·종류·이수 상태·문서는 그대로)
  // 노드 위치 저장: moves = [{ id, periodId, position }] (자리 교환은 두 노드를 한 번에)
  // periodId·position·status만 바꾼다 (완료 상태·연결선·기록은 그대로)
  // 로그인 상태(DB)면 끌어 놓은 자리를 바로 보여 주고 저장한다. 저장에 실패하면 그 노드들만 원래 자리로 되돌린다.
  const handleNodesMove = useCallback((moves) => {
    const before = nodesRef.current
    setNodes((prev) =>
      prev.map((n) => {
        const move = moves.find((m) => m.id === n.id)
        return move ? { ...n, periodId: move.periodId, position: move.position, status: 'placed' } : n
      }),
    )
    if (!isDb) return
    moveNodes(moves).then((result) => {
      if (!result.error) return
      const ids = new Set(moves.map((m) => m.id))
      setNodes((prev) => prev.map((n) => (ids.has(n.id) ? before.find((b) => b.id === n.id) ?? n : n)))
      setToast(`위치를 저장하지 못해 원래 자리로 되돌렸어요. ${result.error.message}`)
    })
  }, [isDb])
  const handleNodeMove = useCallback(
    (nodeId, placement) => handleNodesMove([{ id: nodeId, ...placement }]),
    [handleNodesMove],
  )

  // 완료 상태 표시등 클릭: completed만 뒤집는다 (기존 필드 사용). DB면 저장에 성공한 뒤에 바꾼다
  const handleToggleComplete = useCallback(async (nodeId) => {
    const node = nodesRef.current.find((n) => n.id === nodeId)
    if (!node) return
    if (isDb) {
      const result = await setNodeCompleted(nodeId, !node.completed)
      if (result.error) return setToast(`완료 상태를 저장하지 못했어요. ${result.error.message}`)
    }
    setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, completed: !node.completed } : n)))
  }, [isDb])

  const handleEdgeDelete = useCallback(async (edgeId) => {
    if (isDb) {
      const result = await deleteEdge(edgeId)
      if (result.error) return setToast(`관계선을 지우지 못했어요. ${result.error.message}`)
    }
    setEdges((prev) => prev.filter((e) => e.id !== edgeId))
  }, [isDb])

  // 관계선 만들기: 자기 자신·중복(방향 무관)은 막는다. 노드 자체는 바꾸지 않는다.
  // DB면 저장에 성공한 뒤에만 선을 그리고 '연결했어요'를 보여 준다
  const handleEdgeCreate = useCallback(async (sourceId, targetId) => {
    if (linkProblem(edgesRef.current, sourceId, targetId)) return
    let edge = { id: `e_${Date.now()}`, sourceNodeId: sourceId, targetNodeId: targetId }
    if (isDb) {
      const result = await createEdge(sourceId, targetId)
      if (result.error) return setToast(`관계선을 저장하지 못했어요. ${result.error.message}`)
      edge = result.data
    }
    setEdges((prev) => (linkProblem(prev, sourceId, targetId) ? prev : [...prev, edge]))
    setToast('관계선을 연결했어요.')
  }, [isDb])

  // 관계선 끝점 옮기기: end('source' | 'target') 쪽 노드만 바꾼다
  const handleEdgeReconnect = useCallback(async (edgeId, end, nodeId) => {
    const edge = edgesRef.current.find((e) => e.id === edgeId)
    if (!edge) return
    const next = end === 'source' ? { ...edge, sourceNodeId: nodeId } : { ...edge, targetNodeId: nodeId }
    if (linkProblem(edgesRef.current, next.sourceNodeId, next.targetNodeId, edgeId)) return
    if (isDb) {
      const result = await updateEdge(edgeId, next)
      if (result.error) return setToast(`연결 대상을 저장하지 못했어요. ${result.error.message}`)
    }
    setEdges((prev) => prev.map((e) => (e.id === edgeId ? next : e)))
    setToast('연결 대상을 바꿨어요.')
  }, [isDb])

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

  // categoryId·detailId·categoryLabel: ADD NODE에서 고른 카테고리·세부 활동 (상세 창 종류 수정과 같은 값)
  // 로그인 상태(DB)면 DB에 먼저 저장하고, 성공했을 때만 화면에 넣는다.
  // 반환: 성공 null / 실패 오류 문구 (ADD NODE 창이 입력값을 유지한 채 보여 준다)
  const handleCreate = async ({ theme, title, periodId, memo, categoryId = null, detailId = null, categoryLabel = null }) => {
    const id = `n_${Date.now()}`
    const newNode = {
      id,
      title,
      theme,
      categoryId,
      detailId,
      categoryLabel,
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
    let created = placement ? { ...newNode, ...placement, status: 'placed' } : newNode
    let document = memo
      ? { nodeId: id, content: { format: 'plain', body: memo }, updatedAt: newNode.createdAt }
      : null
    let memoFailed = false

    if (mode === 'db') {
      // 사용자 정의 종류는 category_id, 기본 종류는 category_key(+ 세부 활동 detail_key)
      const isCustom = customCategories.some((c) => c.id === categoryId)
      const result = await createNode({
        title,
        theme,
        periodId: created.periodId,
        position: created.position,
        categoryKey: isCustom ? null : categoryId,
        categoryId: isCustom ? categoryId : null,
        detailKey: isCustom ? null : detailId,
        memo,
      })
      if (result.error) return `노드를 저장하지 못했어요. ${result.error.message}`
      created = { ...result.data.node, categoryLabel: categoryLabelOf(result.data.node.categoryId, customCategories) }
      document = result.data.document
      memoFailed = Boolean(result.data.documentError)
    }

    setNodes((prev) => [...prev, created])
    // 짧은 메모는 노드 문서(NodeDocument)의 내용으로 저장
    if (document) setDocuments((prev) => ({ ...prev, [created.id]: document }))
    setAddOpen(false)
    if (!placement) setInboxOpen(true) // 보관함에 넣었으면 보관함을 열어 보여 준다
    if (memoFailed) setToast('노드는 저장했지만 메모는 저장하지 못했어요.')
    else if (placement) setToast('노드를 학기에 추가했어요.')
    else if (periodId) setToast('학기에 빈 자리가 없어 보관함에 넣었어요.')
    else setToast('노드를 보관함에 추가했어요.')
    return null
  }

  // 상세 창 저장: 제목·기록, 그리고 종류를 바꿨으면 종류(type)
  // type: { theme, categoryId, detailId, categoryLabel }
  // 학기·좌표·완료 상태·연결선·originKey 등 다른 값은 그대로 둔다
  // 반환 { ok, message } — 상세 창은 ok일 때만 '저장됨'을 표시한다. DB면 저장에 성공한 뒤에만 화면 값을 바꾼다.
  const handleSave = async (nodeId, { title, body, type }) => {
    let document = { nodeId, content: { format: 'plain', body }, updatedAt: new Date().toISOString() }
    if (isDb) {
      const isCustom = type ? customCategories.some((c) => c.id === type.categoryId) : false
      const result = await saveNodeDetail(nodeId, {
        title,
        body,
        type: type && {
          theme: type.theme,
          categoryKey: isCustom ? null : type.categoryId,
          categoryId: isCustom ? type.categoryId : null,
          detailKey: isCustom ? null : type.detailId,
        },
      })
      if (result.error) return { ok: false, message: `저장하지 못했어요. ${result.error.message}` }
      document = result.data.document
    }
    setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, title, ...(type ?? {}) } : n)))
    setDocuments((prev) => ({ ...prev, [nodeId]: document }))
    return { ok: true }
  }

  // 노드 삭제: 노드와 연결된 관계선, 노드 문서를 함께 지운다 (다른 노드는 그대로)
  const removeNode = useCallback((nodeId) => {
    setNodes((prev) => prev.filter((n) => n.id !== nodeId))
    setEdges((prev) => prev.filter((e) => e.sourceNodeId !== nodeId && e.targetNodeId !== nodeId))
    setDocuments((prev) => {
      const next = { ...prev }
      delete next[nodeId]
      return next
    })
  }, [])

  // 상세 창의 삭제 버튼 (확인 창은 상세 창에서 띄운다)
  // DB면 DB에서 지운 뒤에만 화면에서 없애고 상세 창을 닫는다 (노드 문서·연결선은 DB에서 함께 삭제)
  const handleDeleteNode = async (nodeId) => {
    if (isDb) {
      const result = await deleteNode(nodeId)
      if (result.error) return setToast(`삭제하지 못했어요. ${result.error.message}`)
    }
    removeNode(nodeId)
    setDetailId(null)
    setToast('노드를 삭제했어요.')
  }

  // 지운 노드(ID·제목·종류·학기·위치·완료 상태)와 관계선, 문서를 원래 순서대로 되돌린다
  const restoreDeleted = useCallback((undo) => {
    const insertAt = (list, index, item) => [...list.slice(0, index), item, ...list.slice(index)]
    setNodes((prev) => (prev.some((n) => n.id === undo.node.id) ? prev : insertAt(prev, undo.index, undo.node)))
    setEdges((prev) => {
      const nodeIds = new Set([...nodesRef.current.map((n) => n.id), undo.node.id])
      return undo.edges.reduce((list, { edge, index }) => {
        // 이미 있거나, 그사이 상대 노드가 지워진 선은 되돌리지 않는다
        if (list.some((e) => e.id === edge.id)) return list
        if (!nodeIds.has(edge.sourceNodeId) || !nodeIds.has(edge.targetNodeId)) return list
        return insertAt(list, index, edge)
      }, prev)
    })
    if (undo.document) setDocuments((prev) => ({ ...prev, [undo.node.id]: undo.document }))
  }, [])

  // 실행 취소 시간이 지난 삭제를 DB에 저장한다. 실패하면 지우기 전 상태로 되돌린다.
  const commitDelete = useCallback(async (undo) => {
    pendingDeletes.current.delete(undo.node.id)
    const result = await deleteNode(undo.node.id)
    if (result.error) {
      restoreDeleted(undo)
      setToast(`삭제하지 못해 되돌렸어요. ${result.error.message}`)
      return
    }
    setToast('노드가 삭제되었습니다.')
  }, [restoreDeleted])

  // 화면을 떠나면 기다리던 삭제를 바로 보낸다 (실행 취소 시간 안에 다른 메뉴로 이동한 경우)
  useEffect(() => () => {
    for (const [nodeId, { timer }] of pendingDeletes.current) {
      clearTimeout(timer)
      deleteNode(nodeId)
    }
    pendingDeletes.current.clear()
  }, [])

  // 보관함 X 버튼·휴지통 드롭: 확인 없이 바로 화면에서 지우고, 실행 취소할 수 있게 지우기 전 상태를 기억한다
  // DB면 실행 취소 시간(5초)이 지난 뒤 DB에서 지우고, 성공해야 '삭제되었습니다'를 보여 준다
  const handleQuickDelete = useCallback(
    (nodeId) => {
      const index = nodes.findIndex((n) => n.id === nodeId)
      if (index < 0) return
      const undo = {
        node: nodes[index],
        index, // 목록 안의 원래 순서
        edges: edges
          .map((edge, i) => ({ edge, index: i }))
          .filter(({ edge }) => edge.sourceNodeId === nodeId || edge.targetNodeId === nodeId),
        document: documents[nodeId] ?? null,
      }
      removeNode(nodeId)
      setDetailId((id) => (id === nodeId ? null : id))
      if (isDb) {
        const timer = setTimeout(() => commitDelete(undo), UNDO_MS)
        pendingDeletes.current.set(nodeId, { timer, undo })
        setToast({ text: '노드를 삭제할게요.', undo })
      } else {
        setToast({ text: '노드가 삭제되었습니다.', undo })
      }
    },
    [nodes, edges, documents, removeNode, isDb, commitDelete],
  )

  // 실행 취소 버튼: DB면 아직 DB에서 지우기 전일 때만 되돌릴 수 있다
  const handleUndoDelete = () => {
    const undo = toast?.undo
    if (!undo) return
    if (isDb) {
      const pending = pendingDeletes.current.get(undo.node.id)
      if (!pending) return setToast('이미 삭제가 저장되어 되돌릴 수 없어요.')
      clearTimeout(pending.timer)
      pendingDeletes.current.delete(undo.node.id)
    }
    restoreDeleted(undo)
    setToast('삭제를 취소했어요.')
  }

  const detailNode = nodes.find((n) => n.id === detailId) ?? null
  const connections = edges
    .filter((e) => e.sourceNodeId === detailId || e.targetNodeId === detailId)
    .map((e) => nodes.find((n) => n.id === (e.sourceNodeId === detailId ? e.targetNodeId : e.sourceNodeId)))
    .filter(Boolean)

  // 캔버스는 처음 그릴 때의 노드로 첫 화면 위치를 정하므로, 불러오기가 끝난 뒤에 그린다
  if (mode === 'loading' || mode === 'error') {
    return (
      <div className="roadmap-page">
        <RoadmapNav />
        <div role={mode === 'error' ? 'alert' : 'status'} style={{ padding: '120px 32px' }}>
          {mode === 'loading' ? (
            <p className="rm-muted">내 로드맵을 불러오는 중…</p>
          ) : (
            <>
              <p>로드맵을 불러오지 못했어요. {loadError}</p>
              <button type="button" className="rm-chip" onClick={loadRoadmap}>다시 시도</button>
            </>
          )}
        </div>
      </div>
    )
  }

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
          onNodesMove={handleNodesMove}
          onNodeDelete={handleQuickDelete}
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
          onDelete={handleQuickDelete}
          onTargetChange={setDropPeriodId}
        />

        {connectMode && (
          <div className="rm-connect-banner" role="status">
            <span>연결 모드 · 노드를 끌어 다른 노드에 놓으면 연결돼요</span>
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
          customCategories={customCategories}
          onAddCustomCategory={addCustomCategory}
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
          customCategories={customCategories}
          onAddCustomCategory={addCustomCategory}
        />

        <RoadmapTutorial open={tutorialOpen} nodes={nodes} layout={layout} onClose={closeTutorial} />

        <div className={`rm-toast ${toast ? 'is-visible' : ''} ${toast?.undo ? 'has-action' : ''}`} role="status">
          {toast?.text ?? toast}
          {toast?.undo && (
            <button type="button" className="rm-toast__action" onClick={handleUndoDelete}>실행 취소</button>
          )}
        </div>
      </div>
    </ReactFlowProvider>
  )
}
