import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import { MEMO_MAX, MEMO_MIN, cardSize } from './layout.js'
import './memo.css'

// 메모 색 (모멘트리 톤: 버터 옐로 · 세이지 그린 · 연핑크 · 화이트)
export const MEMO_COLORS = [
  { id: 'butter', label: '버터 옐로' },
  { id: 'sage', label: '세이지 그린' },
  { id: 'pink', label: '연핑크' },
  { id: 'white', label: '화이트' },
]
const SAVE_DELAY = 700 // 입력을 멈추고 이만큼 지나면 자동 저장
// 본문 글씨 크기 (제목은 그대로). 저장값이 없으면 기본 16px
const FONT = { base: 16, min: 12, max: 28, step: 2 }

const STATUS = {
  idle: '',
  saving: '저장 중…',
  saved: '저장됨',
  error: '저장하지 못했어요',
  local: '예시 화면이라 저장되지 않아요',
}
const clamp = (v, min, max) => Math.min(max, Math.max(min, v))

// 캔버스 위 메모 위젯 (CardNode가 메모 노드일 때 그린다 → 연결·배치 규칙은 일반 카드와 같다)
// 동작을 요소별로 나눈다 (서로 겹치지 않게):
// - 제목·내용 입력 칸: 편집만 (nodrag·nowheel → 끌기·확대가 시작되지 않음)
// - 색 점: 색만 바꾸기 / ×: 삭제
// - 오른쪽 위 모서리 핸들: 크기 바꾸기만 (nodrag·nopan, 왼쪽 아래 모서리 고정). 놓으면 서버 저장
// - 그 밖의 영역(위쪽 손잡이·테두리): 노드 이동 (다른 노드 위에 놓으면 관계선 — 일반 카드와 같은 규칙)
// - CONNECT 모드: 카드를 끌면 관계선 그리기 (onConnectPointerDown)
export default function MemoNode({ node, memo, onSave, onDelete, onResize, linkClass = '', onConnectPointerDown }) {
  const { getZoom } = useReactFlow()
  const [title, setTitle] = useState(memo?.title ?? '')
  const [body, setBody] = useState(memo?.body ?? '')
  const [color, setColor] = useState(memo?.color ?? 'butter')
  const [fontSize, setFontSize] = useState(clamp(Number(memo?.fontSize) || FONT.base, FONT.min, FONT.max))
  const [status, setStatus] = useState('idle')
  const [errorText, setErrorText] = useState('')
  const [live, setLive] = useState(null) // 크기 바꾸는 중의 { w, h } (화면에만)
  const [active, setActive] = useState(false) // 터치 화면: 눌러서 고른 메모에 크기 핸들 보이기
  const dirty = useRef(false)
  const timer = useRef(null)
  const latest = useRef({ title, body, color, fontSize })
  latest.current = { title, body, color, fontSize }
  const size = cardSize(node)
  const titleRef = useRef(null)

  const save = async () => {
    clearTimeout(timer.current)
    if (!dirty.current) return
    dirty.current = false
    setStatus('saving')
    const result = await onSave(node.id, latest.current)
    if (dirty.current) return // 저장하는 사이 또 고쳤으면 다음 저장 결과로 표시
    setErrorText(result?.error ?? '')
    setStatus(result?.ok ? 'saved' : result?.local ? 'local' : 'error')
  }
  const change = (setter) => (value) => {
    setter(value)
    dirty.current = true
    setStatus('idle')
    clearTimeout(timer.current)
    timer.current = setTimeout(save, SAVE_DELAY)
  }
  useEffect(() => () => {
    if (dirty.current) save()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 오른쪽 위 핸들로 크기 바꾸기: 화면 이동량 ÷ 배율 = 캔버스 크기 변화. 오른쪽 → 너비↑, 위 → 높이↑ (아래쪽 고정)
  const startResize = (e) => {
    e.stopPropagation()
    e.preventDefault()
    const el = e.currentTarget
    el.setPointerCapture?.(e.pointerId)
    const zoom = getZoom() || 1
    const start = { x: e.clientX, y: e.clientY, ...size }
    let next = null
    const move = (ev) => {
      next = {
        w: Math.round(clamp(start.w + (ev.clientX - start.x) / zoom, MEMO_MIN.w, MEMO_MAX.w)),
        h: Math.round(clamp(start.h - (ev.clientY - start.y) / zoom, MEMO_MIN.h, MEMO_MAX.h)),
      }
      setLive(next)
    }
    const end = async () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', end)
      el.removeEventListener('pointercancel', end)
      if (!next || (next.w === size.w && next.h === size.h)) {
        setLive(null)
        return
      }
      setStatus('saving')
      const result = await onResize(node.id, next)
      setLive(null) // 성공하면 새 크기(부모가 저장 후 반영), 실패하면 이전 크기로
      setErrorText(result?.error ?? '')
      setStatus(result?.ok ? 'saved' : result?.local ? 'local' : 'error')
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', end)
    el.addEventListener('pointercancel', end)
  }

  const shown = live ?? size
  // 제목 칸 높이를 글 줄 수에 맞춘다 (긴 제목은 줄바꿈, 글씨 크기·메모 너비가 바뀌어도 다시 맞춤)
  useLayoutEffect(() => {
    const el = titleRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [title, fontSize, shown.w])
  // 크기를 바꾸는 동안 왼쪽 아래 모서리를 고정: 높이가 늘어난 만큼 위로 올려 보여 준다
  const lift = live ? live.h - size.h : 0

  return (
    <div
      className={`rm-memo is-${color} ${live ? 'is-resizing' : ''} ${active ? 'is-active' : ''} ${onConnectPointerDown ? 'nodrag' : ''} ${linkClass}`}
      style={{ width: shown.w, height: shown.h, transform: lift ? `translateY(${-lift}px)` : undefined }}
      data-memo-id={node.id}
      onPointerDown={(e) => {
        setActive(true)
        // CONNECT 모드: 입력 칸·버튼이 아닌 곳을 끌면 관계선 그리기
        if (onConnectPointerDown && !e.target.closest('input, textarea, button')) onConnectPointerDown(e)
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setActive(false)
      }}
    >
      <div className="rm-memo__bar" title="끌어서 옮기기">
        <span className="rm-memo__grip" aria-hidden="true" />
        <span className={`rm-memo__status is-${status}`} role="status" aria-live="polite" title={errorText}>
          {status === 'error' && errorText ? errorText : STATUS[status]}
        </span>
        <div className="rm-memo__colors nodrag" role="radiogroup" aria-label="메모 색">
          {MEMO_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={color === c.id}
              aria-label={c.label}
              title={c.label}
              className={`rm-memo__swatch is-${c.id} ${color === c.id ? 'is-on' : ''}`}
              onClick={() => change(setColor)(c.id)}
            />
          ))}
        </div>
        {/* 본문 글씨 크기: A− / A+ (마우스를 올리거나 메모를 고르면 보임) */}
        <div className="rm-memo__font nodrag nopan" role="group" aria-label="본문 글씨 크기">
          <button
            type="button"
            className="rm-memo__font-btn"
            aria-label="글씨 작게"
            title={`글씨 작게 (${fontSize}px)`}
            disabled={fontSize <= FONT.min}
            onClick={() => change(setFontSize)(Math.max(FONT.min, fontSize - FONT.step))}
          >
            A−
          </button>
          <button
            type="button"
            className="rm-memo__font-btn is-up"
            aria-label="글씨 크게"
            title={`글씨 크게 (${fontSize}px)`}
            disabled={fontSize >= FONT.max}
            onClick={() => change(setFontSize)(Math.min(FONT.max, fontSize + FONT.step))}
          >
            A+
          </button>
        </div>
        <button type="button" className="rm-memo__delete nodrag" aria-label="메모 삭제" title="메모 삭제" onClick={() => onDelete(node.id)}>
          ×
        </button>
      </div>
      {/* 제목: 한 줄 입력이지만 길면 줄바꿈해서 보인다 (Enter 줄바꿈은 막음). 글씨 크기는 본문과 같다 */}
      <textarea
        ref={titleRef}
        rows={1}
        className="rm-memo__title nodrag nowheel"
        value={title}
        placeholder="제목 (선택)"
        maxLength={40}
        aria-label="메모 제목"
        style={{ fontSize }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.preventDefault()
        }}
        onChange={(e) => change(setTitle)(e.target.value.replace(/\n/g, ' '))}
        onBlur={save}
      />
      <textarea
        className="rm-memo__body nodrag nowheel"
        value={body}
        placeholder="메모를 적어 보세요"
        aria-label="메모 내용"
        style={{ fontSize }}
        onChange={(e) => change(setBody)(e.target.value)}
        onBlur={save}
      />
      {/* 크기 조절 핸들 (오른쪽 위 모서리) */}
      <button
        type="button"
        className="rm-memo__resize nodrag nopan"
        aria-label="메모 크기 조절"
        title="끌어서 크기 조절"
        onPointerDown={startResize}
      />
    </div>
  )
}
