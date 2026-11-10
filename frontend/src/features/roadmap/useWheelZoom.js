import { useEffect } from 'react'
import { useReactFlow } from '@xyflow/react'

// Ctrl/⌘ + 휠, 트랙패드 핀치 → 마우스 위치를 중심으로 확대·축소
// - Mac 트랙패드 핀치는 브라우저가 "Ctrl이 눌린 휠"로 보낸다
// - React Flow 기본 처리는 Mac에서 Ctrl 휠 값을 10배로 키워서 마우스 휠 한 칸에 4배씩 바뀌므로 직접 처리한다
// - 일반 휠·두 손가락 스크롤은 건드리지 않는다 (React Flow panOnScroll이 캔버스 이동으로 처리)
const RATE = 0.02 // 휠 값 1당 배율 변화 (2의 거듭제곱 지수)
const MAX_STEP = 0.25 // 한 번에 최대 약 19%까지만 바뀌게 (마우스 휠 한 칸)

// 화면이 이동 가능 범위(extent) 밖으로 나가지 않게 (React Flow translateExtent와 같은 규칙)
function clampAxis(t, k, size, lo, hi) {
  const min = size - hi * k
  const max = -lo * k
  return min > max ? (min + max) / 2 : Math.min(max, Math.max(min, t))
}

// ref: 캔버스를 감싼 요소 / extent: [[왼쪽, 위], [오른쪽, 아래]] 캔버스 좌표
export default function useWheelZoom(ref, { minZoom, maxZoom, extent }) {
  const { getViewport, setViewport } = useReactFlow()

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault() // 브라우저 페이지 확대 막기
      e.stopPropagation() // React Flow 기본 확대 처리로 넘기지 않음
      const unit = e.deltaMode === 1 ? 20 : 1 // Firefox는 줄 단위
      const step = Math.max(-MAX_STEP, Math.min(MAX_STEP, -e.deltaY * unit * RATE))
      const { x, y, zoom } = getViewport()
      const next = Math.min(maxZoom, Math.max(minZoom, zoom * 2 ** step))
      if (next === zoom) return
      const r = el.getBoundingClientRect()
      const px = e.clientX - r.left
      const py = e.clientY - r.top
      const [[x0, y0], [x1, y1]] = extent
      setViewport({
        x: clampAxis(px - ((px - x) * next) / zoom, next, r.width, x0, x1),
        y: clampAxis(py - ((py - y) * next) / zoom, next, r.height, y0, y1),
        zoom: next,
      })
    }
    // capture: React Flow보다 먼저 받기 / passive false: preventDefault 가능하게
    el.addEventListener('wheel', onWheel, { capture: true, passive: false })
    return () => el.removeEventListener('wheel', onWheel, { capture: true })
  }, [ref, getViewport, setViewport, minZoom, maxZoom, extent])
}
