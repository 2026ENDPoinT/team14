import { useEffect, useState } from 'react'
import { SaveIcon, TrashIcon } from '../roadmap/icons.jsx'
import { countCharsWithoutSpaces, REWARD_MIN_CHARS } from './countChars.js'
import { getTodayKST } from './dateUtils.js'
import { deleteDiary, getDiaryByDate, saveDiary } from './diaryMock.js'

// 일기 작성 화면: 날짜 선택 → 내용 입력 → 저장/수정/삭제 (2-7, 2-8, 2-16)
// 디자인은 로드맵 노드 상세 창과 같은 형식(rm-* 스타일)을 따른다.
// 기분 선택은 mood 목록이 [미확정]이라 아직 넣지 않는다.
export default function DiaryEditor() {
  const today = getTodayKST()
  const [date, setDate] = useState(today)
  const [content, setContent] = useState('')
  const [isExisting, setIsExisting] = useState(false) // 이 날짜에 이미 일기가 있는지
  const [saved, setSaved] = useState(false) // '저장됨' 표시
  const [toast, setToast] = useState('')

  // 날짜가 바뀌면 그 날짜의 일기를 불러온다
  useEffect(() => {
    const diary = getDiaryByDate(date)
    setContent(diary ? diary.content : '')
    setIsExisting(Boolean(diary))
    setSaved(false)
  }, [date])

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

  function handleSave() {
    const result = saveDiary({ date, content })
    if (result.error) {
      setToast(result.error.message)
      return
    }
    setToast(isExisting ? '일기를 수정했어요.' : '일기를 저장했어요.')
    setIsExisting(true)
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
    setSaved(false)
    setToast('일기를 삭제했어요.')
  }

  return (
    <section className="dy-card rm-form" aria-label="일기 작성">
      <header className="rm-modal__head">
        <div>
          <p className="rm-eyebrow">{isExisting ? 'EDIT DIARY' : 'WRITE NEW'}</p>
          <h1 className="rm-modal__title">MY DIARY</h1>
        </div>
        <div className="rm-modal__actions">
          {saved && <span className="rm-saved">저장됨</span>}
          <button
            type="button"
            className="rm-icon-btn"
            aria-label={isExisting ? '수정 저장' : '저장'}
            onClick={handleSave}
            disabled={isFuture}
          >
            <SaveIcon />
          </button>
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
            className="dy-input dy-textarea"
            value={content}
            onChange={(e) => { setContent(e.target.value); setSaved(false) }}
            placeholder="오늘 있었던 일을 자유롭게 적어 보세요."
          />
        </div>
      </label>

      {/* 공백 제외 글자 수 (보상 조건 표시용, 실제 판단은 서버) */}
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

      <button type="button" className="rm-primary-btn" onClick={handleSave} disabled={isFuture}>
        {isExisting ? '수정 저장' : '저장'}
      </button>

      <div className={`rm-toast dy-toast ${toast ? 'is-visible' : ''}`} role="status">{toast}</div>
    </section>
  )
}
