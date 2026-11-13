import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { useSearchParams } from 'react-router-dom'
import { mockDocuments, mockEdges, mockNodes, mockPeriods } from '../data/roadmapMock.js'
import RoadmapCanvas from '../features/roadmap/RoadmapCanvas.jsx'
import FabMenu from '../features/roadmap/FabMenu.jsx'
import InboxPanel from '../features/roadmap/InboxPanel.jsx'
import AddNodeModal from '../features/roadmap/AddNodeModal.jsx'
import NodeDetailModal from '../features/roadmap/NodeDetailModal.jsx'
import NodeFilter from '../features/roadmap/NodeFilter.jsx'
import CourseGuidePanel from '../features/courses/CourseGuidePanel.jsx'
import AiGuideButton from '../features/career/guide/AiGuideButton.jsx'
import AiGuidePanel from '../features/career/guide/AiGuidePanel.jsx'
import { hasSameTitle } from '../features/career/guide/guideData.js'
import { BASE_CATEGORIES, nodeCategoryId } from '../features/roadmap/nodeCategories.js'
import RoadmapTutorial from '../features/roadmap/tutorial/RoadmapTutorial.jsx'
import { hasSeenRoadmapTutorial, markRoadmapTutorialSeen } from '../features/roadmap/tutorial/tutorialStorage.js'
import { useOptionalAuth } from '../features/auth/AuthProvider.jsx'
import { linkProblem } from '../features/roadmap/edgeRules.js'
import { computeLayout, nextPosition, placeNode } from '../features/roadmap/layout.js'
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

// 노드 배치가 바뀐 학기 id 목록 (이전·새 노드 비교: 추가·삭제·이동·학기 변경)
function changedPeriodIds(prev, next) {
  const ids = new Set()
  const before = new Map(prev.map((n) => [n.id, n]))
  const key = (n) => (n.status === 'placed' ? `${n.periodId}:${n.position?.x}:${n.position?.y}` : 'stored')
  for (const n of next) {
    const old = before.get(n.id)
    before.delete(n.id)
    if (old === n || (old && key(old) === key(n))) continue
    if (old?.status === 'placed') ids.add(old.periodId)
    if (n.status === 'placed') ids.add(n.periodId)
  }
  for (const old of before.values()) if (old.status === 'placed') ids.add(old.periodId) // 지운 노드
  return ids
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
  const [guideOpen, setGuideOpen] = useState(false) // AI 길잡이 패널
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

  // 종류 필터: 보이게 할 카테고리 id 목록 (비어 있으면 전체). 화면 표시만 바꾸고 노드 데이터는 그대로
  const [filterOpen, setFilterOpen] = useState(false)
  const [filterIds, setFilterIds] = useState([])
  const categories = useMemo(() => [...BASE_CATEGORIES, ...customCategories], [customCategories])
  // 노드의 카테고리: 고른 카테고리(categoryId)가 있으면 그것, 없으면 theme에 맞는 기본 카테고리
  const isShown = useCallback(
    (node) => filterIds.length === 0 || filterIds.includes(nodeCategoryId(node, categories)),
    [filterIds, categories],
  )
  // 필터 목록에 보일 종류: 학기에 배치된 활동이 실제로 쓰는 종류만 (기본·직접 추가 종류 같은 규칙)
  // - 필터 적용 전 전체 노드 기준이라, 필터로 숨긴 종류도 목록에 남는다
  // - 보관함에만 있는 활동의 종류는 넣지 않는다
  const usedCategories = useMemo(() => {
    const used = new Set(nodes.filter((n) => n.status === 'placed').map((n) => nodeCategoryId(n, categories)))
    return categories.filter((c) => used.has(c.id))
  }, [nodes, categories])
  const usedKey = usedCategories.map((c) => c.id).join('|')
  // 쓰는 종류가 바뀌면 필터 선택을 바로 맞춘다 (그리는 중에 맞춰서 한 프레임도 어긋나지 않게)
  // - 없어진 종류는 선택에서 빼고, 남은 선택이 없으면 전체 보기로
  // - 새로 생긴(또는 다시 생긴) 종류는 걸러 보는 중이어도 보이게 선택에 넣는다
  const [prevUsedKey, setPrevUsedKey] = useState(usedKey)
  if (prevUsedKey !== usedKey) {
    setPrevUsedKey(usedKey)
    if (filterIds.length > 0) {
      const prev = prevUsedKey.split('|')
      const now = usedCategories.map((c) => c.id)
      const kept = filterIds.filter((id) => now.includes(id))
      const added = now.filter((id) => !prev.includes(id) && !kept.includes(id))
      setFilterIds(kept.length > 0 ? [...kept, ...added] : [])
    }
  }
  const visibleIds = useMemo(
    () => (filterIds.length === 0 ? null : new Set(nodes.filter(isShown).map((n) => n.id))),
    [filterIds, nodes, isShown],
  )
  // 배치 후에도 필터로 숨겨지는지 (처음 생기는 종류는 위에서 자동으로 보이게 하므로 숨겨지지 않음)
  const staysHidden = useCallback(
    (node) => {
      const id = nodeCategoryId(node, categories)
      return filterIds.length > 0 && !filterIds.includes(id) && usedCategories.some((c) => c.id === id)
    },
    [filterIds, categories, usedCategories],
  )
  const closeFilter = useCallback(() => setFilterOpen(false), [])
  const HIDDEN_NOTE = ' (지금 필터로 숨긴 종류라 화면에는 보이지 않아요)'

  // 처음 접속했을 때만 튜토리얼 자동 표시 (계정별 기록: 같은 브라우저의 다른 계정도 처음이면 나온다)
  // - 로드맵을 다 불러와 캔버스(학기·카드)가 그려진 뒤에 시작한다 (불러오는 중·오류 화면에서는 시작하지 않음)
  // - 로그인했으면 계정 id가 확인된 뒤에 판단한다 (로그인 전 예시 로드맵은 예전 공용 기록)
  const auth = useOptionalAuth()
  const tutorialUserId = mode === 'db' ? auth?.profile?.id ?? null : null
  const tutorialReady = (mode === 'db' && Boolean(tutorialUserId)) || mode === 'mock'
  const autoTried = useRef(false)
  useEffect(() => {
    if (!tutorialReady || autoTried.current) return undefined
    if (hasSeenRoadmapTutorial(tutorialUserId)) {
      autoTried.current = true
      return undefined
    }
    let tries = 0
    let timer
    const start = () => {
      // 캔버스가 실제로 그려졌는지 확인하고 시작 (아직이면 잠시 뒤 다시, 최대 약 5초)
      if (document.querySelector('.react-flow__viewport') || tries > 20) {
        autoTried.current = true
        setTutorialOpen(true)
        return
      }
      tries += 1
      timer = setTimeout(start, 250)
    }
    timer = setTimeout(start, 500) // 캔버스가 자리 잡을 시간을 조금 준다
    return () => clearTimeout(timer)
  }, [tutorialReady, tutorialUserId])

  // 건너뛰거나 완료하면 기록해서 다시 자동으로 나타나지 않게 한다 (계정별)
  const closeTutorial = useCallback(() => {
    markRoadmapTutorialSeen(tutorialUserId)
    setTutorialOpen(false)
  }, [tutorialUserId])

  // 학기 컬럼 배치 (가로 자동 확장): 노드 배치로부터 학기별 x·너비를 매번 다시 계산한다
  // - 노드를 오른쪽에 놓으면 그 학기가 넓어지고 뒤 학기는 밀린다. 노드를 빼거나 지우면 필요한 만큼으로 줄어든다
  // - holdRef: 넓어진 학기에서 뒤 학기로 노드를 옮기면 앞 학기 너비를 붙잡아 둔다
  //   (바로 줄면 뒤 학기가 왼쪽으로 당겨져 방금 놓은 노드가 튀어 보임).
  //   그 학기 자체가 바뀔 때(노드를 넣거나 빼거나 옮기거나 지울 때)만 풀어서 노드 기준으로 줄인다
  //   → 다른 학기에서 작업하는 동안 화면이 갑자기 당겨지지 않는다
  const holdRef = useRef({ widths: {}, prevNodes: null, keep: null })
  const layout = useMemo(() => {
    const hold = holdRef.current
    if (hold.prevNodes && hold.prevNodes !== nodes) {
      for (const id of changedPeriodIds(hold.prevNodes, nodes)) {
        if (!(hold.keep?.nodes === nodes && hold.keep.ids.includes(id))) delete hold.widths[id]
      }
    }
    hold.prevNodes = nodes
    return computeLayout(periods, nodes, hold.widths)
  }, [periods, nodes])
  const layoutRef = useRef(layout)
  layoutRef.current = layout

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
      if (guideOpen) setGuideOpen(false)
      else if (detailId) setDetailId(null)
      else if (addOpen) setAddOpen(false)
      else if (fabOpen) setFabOpen(false)
      else if (filterOpen) setFilterOpen(false)
      else if (connectMode) setConnectMode(false)
      else if (inboxOpen) setInboxOpen(false)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [guideOpen, detailId, addOpen, fabOpen, filterOpen, connectMode, inboxOpen])

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
    const next = before.map((n) => {
      const move = moves.find((m) => m.id === n.id)
      return move ? { ...n, periodId: move.periodId, position: move.position, status: 'placed' } : n
    })
    // 뒤 학기로 옮겨 간 노드의 원래 학기 너비는 이번 한 번만 그대로 둔다 (놓은 자리가 왼쪽으로 튀지 않게)
    const { cols, periods: ordered } = layoutRef.current
    const order = (id) => ordered.findIndex((p) => p.id === id)
    const widths = {}
    for (const move of moves) {
      const old = before.find((n) => n.id === move.id)
      if (old?.status === 'placed' && cols[old.periodId] && order(old.periodId) < order(move.periodId)) {
        widths[old.periodId] = cols[old.periodId].width
      }
    }
    Object.assign(holdRef.current.widths, widths)
    holdRef.current.keep = { nodes: next, ids: Object.keys(widths) }
    setNodes(next)
    if (!isDb) return
    moveNodes(moves).then((result) => {
      if (!result.error) return
      const ids = new Set(moves.map((m) => m.id))
      setNodes((prev) => prev.map((n) => (ids.has(n.id) ? before.find((b) => b.id === n.id) ?? n : n)))
      setToast(`위치를 저장하지 못해 되돌렸어요. ${result.error.message}`)
    })
  }, [isDb])
  const handleNodeMove = useCallback(
    (nodeId, placement) => handleNodesMove([{ id: nodeId, ...placement }]),
    [handleNodesMove],
  )
  // 보관함 → 학기 배치. 필터로 숨긴 종류면 사라진 것처럼 보이지 않게 안내
  const handleInboxPlace = useCallback(
    (nodeId, placement) => {
      handleNodeMove(nodeId, placement)
      const node = nodes.find((n) => n.id === nodeId)
      if (node && staysHidden(node)) setToast(`학기에 배치했어요.${HIDDEN_NOTE}`)
    },
    [handleNodeMove, nodes, staysHidden],
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

  // '수강 필요'에서 추가한 과목 노드를 화면에 반영 (이미 있던 노드면 그 노드를 최신 값으로)
  const handleCourseAdded = useCallback((node) => {
    setNodes((prev) => (prev.some((n) => n.id === node.id) ? prev.map((n) => (n.id === node.id ? { ...n, ...node } : n)) : [...prev, node]))
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
  // courseKey: 전공·학업에서 연결한 교과목 키 — DB 컬럼이 아직 없어 세션 전용
  // 로그인 상태(DB)면 DB에 먼저 저장하고, 성공했을 때만 화면에 넣는다.
  // 반환: 성공 null / 실패 오류 문구 (ADD NODE 창이 입력값을 유지한 채 보여 준다)
  const handleCreate = async ({ theme, title, periodId, memo, categoryId = null, detailId = null, categoryLabel = null, courseKey = null }) => {
    const id = `n_${Date.now()}`
    const newNode = {
      id,
      title,
      theme,
      categoryId,
      detailId,
      categoryLabel,
      courseKey, // 전공·학업에서 연결한 교과목 키 (세션 전용)
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
      if (result.error) return `활동을 저장하지 못했어요. ${result.error.message}`
      created = { ...result.data.node, categoryLabel: categoryLabelOf(result.data.node.categoryId, customCategories), courseKey }
      document = result.data.document
      memoFailed = Boolean(result.data.documentError)
    }

    setNodes((prev) => [...prev, created])
    // 짧은 메모는 노드 문서(NodeDocument)의 내용으로 저장
    if (document) setDocuments((prev) => ({ ...prev, [created.id]: document }))
    setAddOpen(false)
    if (!placement) setInboxOpen(true) // 보관함에 넣었으면 보관함을 열어 보여 준다
    if (memoFailed) setToast('활동은 저장했지만 메모는 저장하지 못했어요.')
    else if (placement) setToast(`활동을 학기에 추가했어요.${staysHidden(created) ? HIDDEN_NOTE : ''}`)
    else if (periodId) setToast('학기에 빈 자리가 없어 보관함에 넣었어요.')
    else setToast('활동을 보관함에 추가했어요.')
    return null
  }

  // AI 길잡이 추천 활동 → 보관함 (사용자가 카드의 버튼을 눌렀을 때만)
  // 기존 노드 생성 함수(createNode)로 저장하고, 성공했을 때만 화면에 넣는다. 학기에 자동 배치하지 않는다.
  // 같은 이름의 활동이 이미 있으면 저장하지 않는다. 기존 활동은 바꾸거나 지우지 않는다.
  // 반환 { ok } 또는 { error: 문구 }
  const addGuideActivity = useCallback(async ({ title, theme, categoryId, memo }) => {
    if (mode !== 'db') return { error: '로그인하면 보관함에 추가할 수 있어요.' }
    if (hasSameTitle(nodesRef.current, title)) return { error: '이미 로드맵에 같은 이름의 활동이 있어요.' }
    const result = await createNode({ title, theme, categoryKey: categoryId, memo })
    if (result.error) return { error: `보관함에 추가하지 못했어요. ${result.error.message}` }
    const node = { ...result.data.node, categoryLabel: categoryLabelOf(result.data.node.categoryId, customCategories) }
    setNodes((prev) => [...prev, node])
    if (result.data.document) setDocuments((prev) => ({ ...prev, [node.id]: result.data.document }))
    return { ok: true }
  }, [mode, customCategories])
  const guideHasActivity = useCallback((title) => hasSameTitle(nodesRef.current, title), [])

  // 상세 창 저장: 제목·기록, 그리고 종류를 바꿨으면 종류(type)
  // type: { theme, categoryId, detailId, categoryLabel }
  // 학기·좌표·완료 상태·연결선·originKey 등 다른 값은 그대로 둔다
  // 반환 { ok, message } — 상세 창은 ok일 때만 '저장됨'을 표시한다. DB면 저장에 성공한 뒤에만 화면 값을 바꾼다.
  // dueDate: 목표일 'YYYY-MM-DD' 또는 null — DB 컬럼이 아직 없어 세션 전용. undefined면(교과목) 기존 값을 건드리지 않는다
  const handleSave = async (nodeId, { title, body, type, dueDate }) => {
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
    setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, title, ...(type ?? {}), ...(dueDate !== undefined ? { dueDate } : {}) } : n)))
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
    setToast('활동을 삭제했어요.')
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
    setToast('활동을 삭제했어요.')
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
        setToast({ text: '활동을 삭제할게요.', undo })
      } else {
        setToast({ text: '활동을 삭제했어요.', undo })
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
          visibleIds={visibleIds}
        />


        <NodeFilter
          open={filterOpen}
          onToggle={() => setFilterOpen((v) => !v)}
          onClose={closeFilter}
          categories={usedCategories}
          selected={filterIds}
          onChange={setFilterIds}
        >
          <AiGuideButton open={guideOpen} onClick={() => { setFilterOpen(false); setGuideOpen(true) }} />
          {/* 튜토리얼 다시 보기 (기록과 상관없이 언제든 열린다) */}
          <button
            type="button"
            className="rm-help"
            onClick={() => { setFilterOpen(false); setTutorialOpen(true) }}
            aria-label="로드맵 사용법 다시 보기"
            title="로드맵 사용법 다시 보기"
          >
            ?
          </button>
        </NodeFilter>

        {/* 수강 필요: 놓친 저학년 필수·핵심 과목 안내, 보관함 추가·학기 배치 (features/courses) */}
        <CourseGuidePanel nodes={nodes} periods={periods} layout={layout} enabled={isDb} onAdded={handleCourseAdded} onToast={setToast} />

        {/* 비어 있는 로드맵 안내 (누를 수 없는 안내 문구) */}
        {(periods.length === 0 || nodes.length === 0) && (
          <div className="rm-empty-hint" role="status">
            {periods.length === 0 ? (
              <>
                <strong>아직 학기가 없어요</strong>
                <span>온보딩을 마치면 1학년 1학기부터 4학년 2학기까지 학기가 만들어져요.</span>
              </>
            ) : (
              <>
                <strong>아직 활동이 없어요</strong>
                <span>오른쪽 아래 + 버튼에서 ‘활동 추가’를 눌러 첫 활동을 만들어 보세요.</span>
              </>
            )}
          </div>
        )}

        <InboxPanel
          open={inboxOpen}
          nodes={nodes.filter((n) => n.status === 'stored')}
          allNodes={nodes}
          layout={layout}
          getSubtitle={getSubtitle}
          onNodeClick={openDetail}
          onAdd={openAdd}
          onPlace={handleInboxPlace}
          onDelete={handleQuickDelete}
          onTargetChange={setDropPeriodId}
        />

        {connectMode && (
          <div className="rm-connect-banner" role="status">
            <span>연결 모드 · 활동은 그대로 두고, 끌어서 다른 활동에 놓으면 관계선만 이어져요</span>
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
          onClose={() => setDetailId(null)}
          onSave={handleSave}
          onDelete={handleDeleteNode}
          onOpenNode={openDetail}
          customCategories={customCategories}
          onAddCustomCategory={addCustomCategory}
        />

        {guideOpen && (
          <AiGuidePanel
            open
            onClose={() => setGuideOpen(false)}
            signedIn={isDb}
            nodes={nodes}
            documents={documents}
            onAddActivity={addGuideActivity}
            hasActivity={guideHasActivity}
          />
        )}

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
