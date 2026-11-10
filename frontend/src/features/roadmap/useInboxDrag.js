import { useCallback, useRef, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import { cardSize, findPeriodAt, placeNode } from './layout.js'

const CLICK_DISTANCE = 4 // 이 거리(px) 이하로 움직이면 클릭으로 판정
const RETURN_MS = 260 // 보관함으로 돌아가는 애니메이션 시간

// 보관함 노드를 캔버스로 끌어다 학기에 배치하는 훅.
// - 드래그 중에는 캔버스 배율에 맞춘 미리보기 카드(ghost)가 마우스를 따라온다.
// - 놓은 위치는 React Flow의 screenToFlowPosition으로 캔버스 좌표로 바꿔 계산한다. (확대·축소 반영)
// - 학기 판정·겹침 보정은 캔버스 드래그와 같은 placeNode를 쓴다.
// ReactFlowProvider 안에서만 쓸 수 있다.
export default function useInboxDrag({ nodes, layout, onPlace, onTargetChange }) {
  const { screenToFlowPosition, getZoom } = useReactFlow()
  const [ghost, setGhost] = useState(null) // { node, x, y, zoom, returning }
  const draggedRef = useRef(false)

  const startDrag = useCallback(
    (event, node) => {
      if (event.button !== 0) return
      draggedRef.current = false

      const source = event.currentTarget.getBoundingClientRect()
      // 카드의 어느 지점을 잡았는지 (비율) — 미리보기 카드도 같은 지점을 잡은 것처럼 보이게
      const grab = {
        x: (event.clientX - source.left) / source.width,
        y: (event.clientY - source.top) / source.height,
      }
      const start = { x: event.clientX, y: event.clientY }
      const { w, h } = cardSize(node)
      let dragging = false

      // 미리보기 카드의 화면 좌표(왼쪽 위)
      const screenTopLeft = (e, zoom) => ({ x: e.clientX - grab.x * w * zoom, y: e.clientY - grab.y * h * zoom })
      // 마우스가 캔버스 위에 있는지 (보관함·메뉴 위면 false)
      const overCanvas = (e) => Boolean(document.elementFromPoint(e.clientX, e.clientY)?.closest('.react-flow'))
      // 노드를 놓을 캔버스 좌표(왼쪽 위)
      const flowTopLeft = (e) => screenToFlowPosition(screenTopLeft(e, getZoom()))

      const handleMove = (e) => {
        if (!dragging) {
          if (Math.hypot(e.clientX - start.x, e.clientY - start.y) <= CLICK_DISTANCE) return
          dragging = true
          draggedRef.current = true
        }
        const zoom = getZoom()
        const pos = screenTopLeft(e, zoom)
        setGhost({ node, x: pos.x, y: pos.y, zoom, returning: false })

        let periodId = null
        if (overCanvas(e)) {
          const p = flowTopLeft(e)
          periodId = findPeriodAt(p.x + w / 2, p.y + h / 2, layout)?.id ?? null
        }
        onTargetChange(periodId)
      }

      const handleUp = (e) => {
        window.removeEventListener('pointermove', handleMove)
        window.removeEventListener('pointerup', handleUp)
        window.removeEventListener('pointercancel', handleUp)
        if (!dragging) return
        onTargetChange(null)

        const placement = e.type === 'pointerup' && overCanvas(e)
          ? placeNode(node, flowTopLeft(e), nodes, layout)
          : null
        if (placement) {
          onPlace(node.id, placement) // 같은 노드의 위치·상태만 바꾼다 (새로 만들지 않음)
          setGhost(null)
          return
        }
        // 유효하지 않은 곳 → 원래 보관함 카드 자리로 돌아가는 애니메이션
        setGhost((g) => g && { ...g, x: source.left, y: source.top, zoom: source.width / w, returning: true })
        setTimeout(() => setGhost(null), RETURN_MS)
      }

      window.addEventListener('pointermove', handleMove)
      window.addEventListener('pointerup', handleUp)
      window.addEventListener('pointercancel', handleUp)
    },
    [nodes, layout, onPlace, onTargetChange, screenToFlowPosition, getZoom],
  )

  // 드래그 직후의 클릭이면 true (상세 창을 열지 않기 위해)
  const wasDragged = useCallback(() => draggedRef.current, [])

  return { ghost, startDrag, wasDragged, returnMs: RETURN_MS }
}
