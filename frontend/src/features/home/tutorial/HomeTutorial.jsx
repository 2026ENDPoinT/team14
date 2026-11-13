import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import usePresence from '../../roadmap/usePresence.js'
import { HOME_TUTORIAL_STEPS } from './homeTutorialSteps.js'
import '../../roadmap/tutorial/tutorial.css' // 로드맵 튜토리얼과 같은 모양 (rm-tour)
import './homeTutorial.css'

const MARGIN = 16 // 설명창이 화면 가장자리에서 떨어지는 최소 거리
const GAP = 16 // 강조 영역과 설명창 사이 거리
const PAD = 10 // 강조 영역 여백

// HOME 튜토리얼: 화면을 어둡게 하고 실제 HOME 요소(펫·성장 점·이름·온기·한마디)를 차례로 강조한다
// - 로드맵 튜토리얼(RoadmapTutorial)과 같은 모양·키보드 조작. 캔버스 이동 대신 필요할 때만 스크롤
// - open일 때만 보인다. 끝나거나 건너뛰면 onClose('done' | 'skip') — 기록은 부모(HomePage)가 한다
// - 켜져 있는 동안 아래 화면 조작(펫 클릭·이름 수정 등)을 막고, 닫히면 그대로 돌아온다
export default function HomeTutorial({ open, onClose, steps = HOME_TUTORIAL_STEPS }) {
  const { mounted, visible } = usePresence(open, 250)
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState(null)
  const dialogRef = useRef(null)

  useEffect(() => {
    if (open) setStep(0)
  }, [open])

  const current = steps[step]

  const measure = useCallback(() => {
    const el = document.querySelector(current.target)
    if (!el) return null
    const r = el.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) return null
    const radius = Math.min(28, (r.height + PAD * 2) / 2)
    return { x: r.x - PAD, y: r.y - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2, radius }
  }, [current])

  // 단계가 바뀔 때: 요소가 화면 밖이면 그때만 스크롤해서 보이게 한 뒤 위치 계산
  useEffect(() => {
    if (!open) return undefined
    let cancelled = false
    const el = document.querySelector(current.target)
    if (el) {
      const r = el.getBoundingClientRect()
      if (r.top < 0 || r.bottom > window.innerHeight) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
    const update = () => {
      if (!cancelled) setRect(measure())
    }
    const raf = requestAnimationFrame(update)
    const late = setTimeout(update, 350) // 스크롤이 끝난 뒤 한 번 더
    let timer
    const onResize = () => {
      clearTimeout(timer)
      timer = setTimeout(update, 120)
    }
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onResize, true)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      clearTimeout(late)
      clearTimeout(timer)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onResize, true)
    }
  }, [open, step, measure]) // eslint-disable-line react-hooks/exhaustive-deps

  // 설명창 위치: 강조 영역 아래 → 위 → 옆 → 화면 아래 순서로, 화면 밖으로 나가지 않게 (로드맵 튜토리얼과 같은 규칙)
  useLayoutEffect(() => {
    const el = dialogRef.current
    if (!el) return
    const vw = window.innerWidth
    const vh = window.innerHeight
    const w = el.offsetWidth
    const h = el.offsetHeight
    let left
    let top
    if (!rect) {
      left = (vw - w) / 2
      top = (vh - h) / 2
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

  useEffect(() => {
    if (open && !dialogRef.current?.contains(document.activeElement)) {
      dialogRef.current?.focus({ preventScroll: true })
    }
  }, [open, step, visible])

  const isLast = step === steps.length - 1
  const next = () => (isLast ? onClose('done') : setStep((s) => s + 1))
  const prev = () => setStep((s) => Math.max(0, s - 1))

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

  return (
    <div
      className={`rm-tour hm-tour ${visible ? 'is-visible' : ''}`}
      onKeyDown={onKeyDown}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className={`rm-tour__spot ${rect ? '' : 'is-empty'}`}
        style={rect ? { left: rect.x, top: rect.y, width: rect.w, height: rect.h, borderRadius: rect.radius } : undefined}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        className="rm-tour__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hm-tour-title"
        aria-describedby="hm-tour-desc"
        tabIndex={-1}
      >
        <p className="rm-tour__eyebrow">
          HOME 사용법 <span>{step + 1} / {steps.length}</span>
        </p>
        <h2 id="hm-tour-title" className="rm-tour__title">{current.title}</h2>
        <div id="hm-tour-desc" className="rm-tour__desc">
          {current.lines.map((line) => <p key={line}>{line}</p>)}
        </div>
        <div className="rm-tour__dots" aria-hidden="true">
          {steps.map((s, i) => <span key={s.title} className={i === step ? 'is-active' : ''} />)}
        </div>
        <div className="rm-tour__actions">
          <button type="button" className="rm-tour__skip" onClick={() => onClose('skip')}>건너뛰기</button>
          <div className="rm-tour__nav">
            {step > 0 && <button type="button" className="rm-tour__prev" onClick={prev}>이전</button>}
            <button type="button" className="rm-tour__next" onClick={next}>{isLast ? '완료' : '다음'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
