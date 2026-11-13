import { useCallback, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import { linkProblem } from './edgeRules.js'

// 관계선 드래그 (새로 만들기 + 끝점 옮기기)
// - 놓은 곳 아래의 노드 카드를 찾아 연결한다. (카드 어디에 놓아도 됨)
// - 놓은 곳이 노드가 아니거나 규칙에 어긋나면 아무것도 바꾸지 않는다. (기존 관계 유지)
// info: { mode, fixedId, edgeId }
//   mode 'create' → fixedId(출발 노드)에서 새 선 / 'source' 또는 'target' → edgeId 선의 그 끝을 옮김
//   fixedId: 움직이지 않는 쪽 노드
// onDone(info, nodeId): 연결 확정 / onReject(message): 안내 문구 표시
// startLink: 누르자마자 선 그리기 시작 (연결 핸들·연결선 끝 핸들)
// startLinkOnMove: START_DISTANCE보다 많이 움직였을 때 시작 (CONNECT 모드 카드 몸통. 그 전에 떼면 클릭)
// ReactFlowProvider 안에서만 쓸 수 있다.
const START_DISTANCE = 4 // RoadmapCanvas의 CLICK_DISTANCE와 같은 값 (클릭·드래그 구분 기준)

export default function useLinkDrag({ edges, onDone, onReject }) {
  const { screenToFlowPosition } = useReactFlow()
  const [link, setLink] = useState(null) // 드래그 중 정보 + pointer(캔버스 좌표) + target

  const beginLink = useCallback(
    (event, info) => {
      event.preventDefault()
      event.stopPropagation() // 캔버스 이동·노드 드래그가 시작되지 않게

      // 마우스 아래의 노드 카드 id
      const nodeAt = (e) =>
        document.elementFromPoint(e.clientX, e.clientY)?.closest('.react-flow__node-card')?.dataset.id ?? null

      // 이 노드에 연결해도 되는지
      const evaluate = (e) => {
        const id = nodeAt(e)
        if (!id) return { id: null, valid: false, problem: null }
        // 원래 연결돼 있던 노드에 다시 놓은 경우: 바뀌는 것 없음
        const current = edges.find((x) => x.id === info.edgeId)
        if (current && id === (info.mode === 'source' ? current.sourceNodeId : current.targetNodeId)) {
          return { id, valid: false, problem: null }
        }
        const [s, t] = info.mode === 'source' ? [id, info.fixedId] : [info.fixedId, id]
        const problem = linkProblem(edges, s, t, info.edgeId)
        return { id, valid: !problem, problem }
      }

      const toFlow = (e) => screenToFlowPosition({ x: e.clientX, y: e.clientY })
      setLink({ ...info, pointer: toFlow(event), target: null })

      const handleMove = (e) => {
        const r = evaluate(e)
        setLink((l) => l && { ...l, pointer: toFlow(e), target: r.id ? { id: r.id, valid: r.valid } : null })
      }
      const handleUp = (e) => {
        window.removeEventListener('pointermove', handleMove)
        window.removeEventListener('pointerup', handleUp)
        window.removeEventListener('pointercancel', handleUp)
        setLink(null)
        if (e.type !== 'pointerup') return
        const r = evaluate(e)
        if (r.valid) onDone(info, r.id)
        else if (r.problem) onReject(r.problem)
      }
      window.addEventListener('pointermove', handleMove)
      window.addEventListener('pointerup', handleUp)
      window.addEventListener('pointercancel', handleUp)
    },
    [edges, onDone, onReject, screenToFlowPosition],
  )

  const startLink = useCallback(
    (event, info) => {
      if (event.button !== 0) return
      beginLink(event, info)
    },
    [beginLink],
  )

  const startLinkOnMove = useCallback(
    (event, info) => {
      if (event.button !== 0) return
      const start = { x: event.clientX, y: event.clientY }
      const stop = () => {
        window.removeEventListener('pointermove', handleMove)
        window.removeEventListener('pointerup', stop)
        window.removeEventListener('pointercancel', stop)
      }
      const handleMove = (e) => {
        if (Math.hypot(e.clientX - start.x, e.clientY - start.y) <= START_DISTANCE) return
        stop()
        beginLink(e, info)
      }
      window.addEventListener('pointermove', handleMove)
      window.addEventListener('pointerup', stop)
      window.addEventListener('pointercancel', stop)
    },
    [beginLink],
  )

  return { link, startLink, startLinkOnMove }
}
