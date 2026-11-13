import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import usePresence from '../usePresence.js'
import { isMemo, isPill, nodeBox } from '../layout.js'
import { ROADMAP_TUTORIAL_STEPS } from './tutorialSteps.js'
import './tutorial.css'

const MARGIN = 16 // 설명창이 화면 가장자리에서 떨어지는 최소 거리
const GAP = 16 // 강조 영역과 설명창 사이 거리

// 단계별 강조 영역 모양: 여백(pad)과 모서리 둥글기(radius)
const SPOT_STYLE = {
  canvas: { pad: 0, radius: 28 },
  node: { pad: 10, radius: 48 },
  dot: { pad: 10, radius: 999 },
  default: { pad: 8, radius: 999 },
}

// 첫 접속 로드맵 튜토리얼 (화면을 어둡게 하고 실제 UI를 강조하는 가이드)
// - open이 true일 때만 보인다. 끝나거나 건너뛰면 onClose 호출 (기록은 부모가 한다)
// - 튜토리얼이 켜져 있는 동안 화면 전체를 덮어서 노드 이동·완료 변경 같은 실수 조작을 막는다
// - 예시 노드가 화면에 보이도록 캔버스를 잠시 옮기고, 끝나면 원래 화면 위치로 되돌린다
// ReactFlowProvider 안에서만 쓸 수 있다.
export default function RoadmapTutorial({ open, nodes, layout, onClose, steps = ROADMAP_TUTORIAL_STEPS }) {
  const { setCenter, getViewport, setViewport } = useReactFlow()
  const { mounted, visible } = usePresence(open, 250)
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState(null) // 강조할 영역 (화면 좌표)
  const dialogRef = useRef(null)
  const savedViewport = useRef(null)

  // 터치 화면이면 "휠" 대신 "두 손가락" 안내
  const touch = useMemo(() => window.matchMedia?.('(pointer: coarse)').matches ?? false, [])

  // 예시 노드: 학기에 배치된 일반 활동 노드 중 가장 앞 학기 (없으면 교과목 노드)
  const demoNode = useMemo(() => {
    if (!open) return null
    const placed = nodes.filter((n) => n.status === 'placed' && !isMemo(n) && nodeBox(n, layout)) // 메모는 예시 노드로 쓰지 않음
    const order = (n) => [layout.cols[n.periodId].x + n.position.x, n.position.y]
    const sorted = [...placed].sort((a, b) => order(a)[0] - order(b)[0] || order(a)[1] - order(b)[1])
    return sorted.find((n) => !isPill(n)) ?? sorted[0] ?? null
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // 열 때: 처음 단계로 + 현재 화면 위치 저장 / 닫을 때: 원래 화면 위치로
  useEffect(() => {
    if (open) {
      setStep(0)
      savedViewport.current = getViewport()
    } else if (savedViewport.current) {
      setViewport(savedViewport.current, { duration: 300 })
      savedViewport.current = null
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const current = steps[step]

  // 강조할 실제 UI의 화면 위치 계산
  const measureTarget = useCallback(() => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    if (current.target === 'canvas') {
      // 상단 메뉴와 아래쪽 버튼을 뺀 캔버스 영역
      const top = Math.min(110, vh * 0.15)
      return { x: MARGIN, y: top, w: vw - MARGIN * 2, h: Math.max(160, vh - top - 140) }
    }
    let selector = current.target
    if (current.target === 'node' || current.target === 'dot') {
      if (!demoNode) return null
      selector = `[data-id="${demoNode.id}"] ${current.target === 'node' ? '.rm-card' : '.rm-dot'}`
    }
    const el = document.querySelector(selector)
    if (!el) return null
    const r = el.getBoundingClientRect()
    const { pad, radius } = SPOT_STYLE[current.target] ?? SPOT_STYLE.default
    return { x: r.x - pad, y: r.y - pad, w: r.width + pad * 2, h: r.height + pad * 2, radius }
  }, [current, demoNode])

  // 단계가 바뀔 때: (노드 단계면) 예시 노드를 화면 가운데로 옮긴 뒤 강조 영역 계산
  useEffect(() => {
    if (!open) return undefined
    let cancelled = false
    const run = async (duration) => {
      if ((current.target === 'node' || current.target === 'dot') && demoNode) {
        const box = nodeBox(demoNode, layout)
        // 설명창이 아래에 들어갈 수 있게 노드를 화면 위쪽(40%)에 둔다
        const shiftDown = window.innerHeight * 0.1
        await setCenter(box.x + box.w / 2, box.y + box.h / 2 + shiftDown, { zoom: 1, duration })
      }
      requestAnimationFrame(() => {
        if (!cancelled) setRect(measureTarget())
      })
    }
    run(400)
    // 화면 크기가 바뀌면 다시 계산
    let timer
    const onResize = () => {
      clearTimeout(timer)
      timer = setTimeout(() => run(0), 120)
    }
    window.addEventListener('resize', onResize)
    return () => {
      cancelled = true
      clearTimeout(timer)
      window.removeEventListener('resize', onResize)
    }
  }, [open, step]) // eslint-disable-line react-hooks/exhaustive-deps

  // 설명창 위치: 강조 영역 아래 → 위 → 옆 → 화면 아래 순서로, 화면 밖으로 나가지 않게
  useLayoutEffect(() => {
    const el = dialogRef.current
    if (!el) return
    const vw = window.innerWidth
    const vh = window.innerHeight
    const w = el.offsetWidth
    const h = el.offsetHeight
    let left
    let top
    if (!rect || current.target === 'canvas') {
      left = (vw - w) / 2
      top = rect ? rect.y + rect.h / 2 - h / 2 : (vh - h) / 2
    } else if (rect.y + rect.h + GAP + h <= vh - MARGIN) {
      top = rect.y + rect.h + GAP
    } else if (rect.y - GAP - h >= MARGIN) {
      top = rect.y - GAP - h
    } else if (rect.x + rect.w + GAP + w <= vw - MARGIN) {
      left = rect.x + rect.w + GAP
      top = rect.y + rect.h / 2 - h / 2
    } else if (rect.x - GAP - w >= MARGIN) {
      left = rect.x - GAP - w
      top = rect.y + rect.h / 2 - h / 2
    } else {
      top = vh - h - MARGIN
    }
    if (left === undefined) left = rect.x + rect.w / 2 - w / 2
    const clamp = (v, max) => Math.max(MARGIN, Math.min(v, max))
    el.style.left = `${clamp(left, vw - w - MARGIN)}px`
    el.style.top = `${clamp(top, vh - h - MARGIN)}px`
  })

  // 열리면 설명창에 포커스 (화면 읽기 프로그램이 내용을 읽고, Enter·방향키·Tab이 바로 동작)
  useEffect(() => {
    if (open && !dialogRef.current?.contains(document.activeElement)) {
      dialogRef.current?.focus({ preventScroll: true })
    }
  }, [open, step, visible])

  const isLast = step === steps.length - 1
  const next = () => (isLast ? onClose('done') : setStep((s) => s + 1))
  const prev = () => setStep((s) => Math.max(0, s - 1))

  // 키보드: Esc 건너뛰기, Enter·→ 다음, ← 이전, Tab은 설명창 안에서만 돈다 (아래 화면 조작 방지)
  const onKeyDown = (e) => {
    if (e.key === 'Enter' && e.target === dialogRef.current) {
      e.preventDefault()
      next()
    } else if (e.key === 'Escape') {
      e.stopPropagation()
      onClose('skip')
    } else if (e.key === 'ArrowRight') next()
    else if (e.key === 'ArrowLeft') prev()
    else if (e.key === 'Tab') {
      const buttons = [...dialogRef.current.querySelectorAll('button:not([disabled])')]
      const i = buttons.indexOf(document.activeElement)
      e.preventDefault()
      const nextIndex = e.shiftKey ? (i <= 0 ? buttons.length - 1 : i - 1) : (i + 1) % buttons.length
      buttons[nextIndex]?.focus()
    }
  }

  if (!mounted) return null
  const lines = (touch && current.touchLines) || current.lines
  const spotRadius = rect?.radius ?? SPOT_STYLE[current.target]?.radius ?? 28

  return (
    <div
      className={`rm-tour ${visible ? 'is-visible' : ''}`}
      onKeyDown={onKeyDown}
      // 튜토리얼 중에는 아래 캔버스·메뉴로 마우스·휠·터치가 전달되지 않게 막는다
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      {/* 강조 영역: 큰 그림자로 주변을 어둡게 하고 이 영역만 밝게 남긴다 */}
      <div
        className={`rm-tour__spot ${rect ? '' : 'is-empty'}`}
        style={rect ? { left: rect.x, top: rect.y, width: rect.w, height: rect.h, borderRadius: spotRadius } : undefined}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        className="rm-tour__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rm-tour-title"
        aria-describedby="rm-tour-desc"
        tabIndex={-1}
      >
        <p className="rm-tour__eyebrow">
          HOW TO USE <span>{step + 1} / {steps.length}</span>
        </p>
        <h2 id="rm-tour-title" className="rm-tour__title">{current.title}</h2>
        <div id="rm-tour-desc" className="rm-tour__desc">
          {lines.map((line) => <p key={line}>{line}</p>)}
        </div>
        <div className="rm-tour__dots" aria-hidden="true">
          {steps.map((s, i) => <span key={s.title} className={i === step ? 'is-active' : ''} />)}
        </div>
        <div className="rm-tour__actions">
          <button type="button" className="rm-tour__skip" onClick={() => onClose('skip')}>건너뛰기</button>
          <div className="rm-tour__nav">
            {step > 0 && <button type="button" className="rm-tour__prev" onClick={prev}>이전</button>}
            <button type="button" className="rm-tour__next" onClick={next}>
              {isLast ? '완료' : '다음'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
