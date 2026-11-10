import { useEffect, useRef, useState } from 'react'
import { SaveIcon, TrashIcon } from '../roadmap/icons.jsx'
import { countCharsWithoutSpaces, REWARD_MIN_CHARS } from './countChars.js'
import { getTodayKST } from './dateUtils.js'
import { deleteDiary, getDiaryByDate, saveDiary } from './diaryMock.js'

// 일기 작성 화면: 날짜 선택 → 내용 입력 → 저장/수정/삭제 (2-7, 2-8, 2-16)
// 이미 쓴 일기는 먼저 읽기 전용으로 보여 주고, '수정하기'를 눌러야 고칠 수 있다.
// 디자인은 로드맵 노드 상세 창과 같은 형식(rm-* 스타일)을 따른다.
// 기분 선택은 mood 목록이 [미확정]이라 아직 넣지 않는다.
// initialDate: 처음 열 날짜 (추억 보관소에서 날짜를 눌러 들어온 경우). 없으면 오늘
// onBack(date): 있으면 왼쪽 위에 돌아가기 화살표를 보여 준다 (추억 보관소에서 들어온 경우)
export default function DiaryEditor({ initialDate, onBack }) {
  const today = getTodayKST()
  const [date, setDate] = useState(initialDate || today)
  const [content, setContent] = useState('')
  const [isExisting, setIsExisting] = useState(false) // 이 날짜에 이미 일기가 있는지
  const [editing, setEditing] = useState(false) // 이미 쓴 일기를 수정 중인지
  const [saved, setSaved] = useState(false) // '저장됨' 표시
  const [toast, setToast] = useState('')
  const textareaRef = useRef(null)

  // 날짜가 바뀌면 그 날짜의 일기를 불러온다
  useEffect(() => {
    const diary = getDiaryByDate(date)
    setContent(diary ? diary.content : '')
    setIsExisting(Boolean(diary))
    setEditing(false) // 다른 날짜를 열면 다시 읽기 전용
    setSaved(false)
  }, [date])

  // '수정하기'를 누르면 입력칸에 바로 커서를 둔다
  useEffect(() => {
    if (editing) textareaRef.current?.focus()
  }, [editing])

  // 안내 메시지는 2초 뒤 사라짐 (로드맵과 같은 방식)
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 2000)
    return () => clearTimeout(timer)
  }, [toast])

  const charCount = countCharsWithoutSpaces(content)
  const meetsLength = charCount >= REWARD_MIN_CHARS
  const progress = Math.min(100, Math.round((charCount / REWARD_MIN_CHARS) * 100))
  const isFuture = date > today
  const readOnly = isExisting && !editing // 이미 쓴 일기를 보기만 하는 상태

  function handleSave() {
    const result = saveDiary({ date, content })
    if (result.error) {
      setToast(result.error.message)
      return
    }
    setToast(isExisting ? '일기를 수정했어요.' : '일기를 저장했어요.')
    setIsExisting(true)
    setEditing(false) // 저장하면 다시 읽기 전용
    setSaved(true)
  }

  function handleDelete() {
    if (!window.confirm(`${date} 일기를 삭제할까요?`)) return
    const result = deleteDiary(date)
    if (result.error) {
      setToast(result.error.message)
      return
    }
    setContent('')
    setIsExisting(false)
    setEditing(false)
    setSaved(false)
    setToast('일기를 삭제했어요.')
  }

  return (
    <section className="dy-card rm-form" aria-label="일기 작성">
      <header className="rm-modal__head">
        <div>
          {onBack && (
            <button type="button" className="rm-icon-btn dy-back" aria-label="추억 보관소로 돌아가기" onClick={() => onBack(date)}>
              <BackIcon />
            </button>
          )}
          <p className="rm-eyebrow">{!isExisting ? 'WRITE NEW' : editing ? 'EDIT DIARY' : 'VIEW DIARY'}</p>
          <h1 className="rm-modal__title">MY DIARY</h1>
        </div>
        <div className="rm-modal__actions">
          {saved && <span className="rm-saved">저장됨</span>}
          {/* 저장 아이콘은 쓰거나 고칠 수 있을 때만 */}
          {!readOnly && (
            <button
              type="button"
              className="rm-icon-btn"
              aria-label={isExisting ? '수정 저장' : '저장'}
              onClick={handleSave}
              disabled={isFuture}
            >
              <SaveIcon />
            </button>
          )}
          {/* 저장된 일기가 있을 때만 삭제 버튼을 보여 준다 */}
          {isExisting && (
            <button type="button" className="rm-icon-btn" aria-label="삭제" onClick={handleDelete}>
              <TrashIcon />
            </button>
          )}
        </div>
      </header>
      <hr className="rm-divider" />

      <label className="rm-field">
        <span className="rm-eyebrow">DATE</span>
        {/* max: 달력에서 오늘 이후 날짜를 고를 수 없게 한다 (저장 함수에서도 한 번 더 막음) */}
        {/* 로드맵 노드 카드 모양 입력칸 (왼쪽 점 = 노드 표시등) */}
        <div className="dy-node">
          <span className="dy-node__dot" aria-hidden="true" />
          <input
            type="date"
            className="dy-input dy-input--date"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </label>
      {isFuture && <p className="rm-muted">미래 날짜에는 일기를 쓸 수 없어요.</p>}

      <label className="rm-field">
        <span className="rm-eyebrow">TODAY'S STORY</span>
        <div className="dy-node dy-node--top">
          {/* 30자(보상 조건)를 채우면 로드맵 완료 표시등처럼 노란색 */}
          <span className={`dy-node__dot ${meetsLength ? 'is-done' : ''}`} aria-hidden="true" />
          <textarea
            ref={textareaRef}
            className={`dy-input dy-textarea ${readOnly ? 'is-readonly' : ''}`}
            readOnly={readOnly}
            value={content}
            onChange={(e) => { setContent(e.target.value); setSaved(false) }}
            placeholder="오늘 있었던 일을 자유롭게 적어 보세요."
          />
        </div>
      </label>

      {/* 공백 제외 글자 수 (보상 조건 표시용, 실제 판단은 서버)
          보기만 할 때(추억 보기)는 숨기고, 쓰거나 고칠 때만 보여 준다 */}
      {!readOnly && (
      <div className="rm-field">
        <div className="dy-count">
          <span className="rm-eyebrow">LENGTH</span>
          <span className={`dy-count__num ${meetsLength ? 'is-done' : ''}`}>
            공백 제외 {charCount}자 / {REWARD_MIN_CHARS}자
          </span>
        </div>
        <div className="dy-bar" aria-hidden="true">
          <div className={`dy-bar__fill ${meetsLength ? 'is-done' : ''}`} style={{ width: `${progress}%` }} />
        </div>
        <p className="rm-muted dy-hint">
          {meetsLength
            ? '보상 조건을 채웠어요. '
            : `${REWARD_MIN_CHARS - charCount}자 더 쓰면 보상 조건을 채워요. `}
          {REWARD_MIN_CHARS}자보다 짧아도 저장할 수 있고, 일기 보상은 하루 한 번만 받을 수 있어요.
        </p>
      </div>
      )}

      {/* 읽기 전용이면 '수정하기' → 누르면 수정 가능 + '수정 저장' 버튼으로 바뀜 */}
      <div className="dy-actions">
        {readOnly ? (
          <button type="button" className="dy-btn dy-btn--soft" onClick={() => setEditing(true)}>
            <PencilIcon />
            수정하기
          </button>
        ) : (
          <button type="button" className="dy-btn dy-btn--fill" onClick={handleSave} disabled={isFuture}>
            <CheckIcon />
            {isExisting ? '수정 저장' : '저장'}
          </button>
        )}
      </div>

      <div className={`rm-toast dy-toast ${toast ? 'is-visible' : ''}`} role="status">{toast}</div>
    </section>
  )
}

// 버튼용 작은 선 아이콘 (로드맵 아이콘과 같은 선 굵기)
const iconProps = {
  width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
}
function PencilIcon() {
  return <svg {...iconProps}><path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" /></svg>
}
function BackIcon() {
  return <svg {...iconProps} width={22} height={22} strokeWidth={1.8}><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
}
function CheckIcon() {
  return <svg {...iconProps}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
}
