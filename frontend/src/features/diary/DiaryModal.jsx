import { useEffect, useRef, useState } from 'react'
import { TrashIcon } from '../roadmap/icons.jsx'
import { countCharsWithoutSpaces, REWARD_MIN_CHARS } from './countChars.js'
import { deleteDiary, getDiaryByDate, saveDiary } from './diaryMock.js'
import PhotoModal from './PhotoModal.jsx'

const WEEKDAYS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']

// '2026-11-01' → '11월 1일 일요일'
function formatDateLong(date) {
  const [y, m, d] = date.split('-').map(Number)
  return `${m}월 ${d}일 ${WEEKDAYS[new Date(y, m - 1, d).getDay()]}`
}

// 날짜를 눌렀을 때 뜨는 일기 팝업 (2-7, 2-8, 2-16)
// - 이미 쓴 일기는 먼저 읽기만 하고, '수정하기'를 눌러야 고칠 수 있다.
// - 저장·삭제는 Mock 함수 사용 (2-9 데이터 연동 때 services 함수로 교체)
// onChanged: 저장·삭제 후 달력(노란 점)을 다시 그리게 알린다.
export default function DiaryModal({ date, onClose, onChanged }) {
  const [content, setContent] = useState(() => getDiaryByDate(date)?.content ?? '')
  const [isExisting, setIsExisting] = useState(() => Boolean(getDiaryByDate(date)))
  const [editing, setEditing] = useState(false) // 이미 쓴 일기를 고치는 중인지
  const [photoOpen, setPhotoOpen] = useState(false)
  const [toast, setToast] = useState('')
  const textareaRef = useRef(null)

  const readOnly = isExisting && !editing
  const charCount = countCharsWithoutSpaces(content)
  const meetsLength = charCount >= REWARD_MIN_CHARS
  const progress = Math.min(100, Math.round((charCount / REWARD_MIN_CHARS) * 100))

  // 쓸 수 있는 상태가 되면 입력칸에 바로 커서를 둔다
  useEffect(() => {
    if (!readOnly) textareaRef.current?.focus()
  }, [readOnly])

  // ESC: 사진 팝업이 열려 있으면 그것만 닫고, 아니면 일기 팝업을 닫는다
  useEffect(() => {
    function handleKey(e) {
      if (e.key !== 'Escape') return
      if (photoOpen) setPhotoOpen(false)
      else onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [photoOpen, onClose])

  // 안내 메시지는 2초 뒤 사라짐
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 2000)
    return () => clearTimeout(timer)
  }, [toast])

  function handleSave() {
    const result = saveDiary({ date, content })
    if (result.error) {
      setToast(result.error.message)
      return
    }
    setToast(isExisting ? '일기를 수정했어요.' : '일기를 저장했어요.')
    setIsExisting(true)
    setEditing(false)
    onChanged()
  }

  // 수정 취소: 저장된 내용으로 되돌린다
  function handleCancel() {
    setContent(getDiaryByDate(date)?.content ?? '')
    setEditing(false)
  }

  function handleDelete() {
    if (!window.confirm(`${formatDateLong(date)} 일기를 삭제할까요?`)) return
    const result = deleteDiary(date)
    if (result.error) {
      setToast(result.error.message)
      return
    }
    setContent('')
    setIsExisting(false)
    setEditing(false)
    setToast('일기를 삭제했어요.')
    onChanged()
  }

  return (
    <div className="dp-modal" role="dialog" aria-modal="true" aria-label={`${formatDateLong(date)} 일기`}>
      <div className="dp-modal__backdrop" onClick={onClose} />
      <section className="dp-modal__card">
        <header className="dp-modal__head">
          <div>
            <p className="rm-eyebrow">나의 하루</p>
            <h2 className="dp-modal__title">{formatDateLong(date)}</h2>
            <p className="rm-muted dp-modal__sub">
              {isExisting ? '노란 점으로 남긴 하루' : '아직 비어 있는 하루'}
            </p>
          </div>
          <div className="rm-modal__actions">
            {isExisting && (
              <button type="button" className="rm-icon-btn" aria-label="삭제" onClick={handleDelete}>
                <TrashIcon />
              </button>
            )}
            <button type="button" className="dp-text-btn" onClick={onClose}>닫기</button>
          </div>
        </header>
        <hr className="rm-divider dp-divider" />

        <div className="rm-field">
          <span className="rm-eyebrow">오늘의 이야기</span>
          {readOnly ? (
            <p className="dp-story">{content || '(내용 없음)'}</p>
          ) : (
            // 로드맵 노드 카드 모양 입력칸 (30자를 채우면 왼쪽 점이 노랗게)
            <div className="dy-node dy-node--top">
              <span className={`dy-node__dot ${meetsLength ? 'is-done' : ''}`} aria-hidden="true" />
              <textarea
                ref={textareaRef}
                className="dy-input dy-textarea dp-textarea"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="오늘 있었던 일을 자유롭게 적어 보세요."
              />
            </div>
          )}
        </div>

        {/* 쓰거나 고칠 때만 글자 수 게이지를 보여 준다 (보상 판단은 서버가 다시 함) */}
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
          </div>
        )}

        <button type="button" className="dp-photo-add" onClick={() => setPhotoOpen(true)}>
          <span className="dp-photo-add__icon" aria-hidden="true">+</span>
          사진 추가
        </button>

        <div className="dp-actions">
          {readOnly ? (
            <>
              <button type="button" className="dp-btn dp-btn--soft" onClick={() => setEditing(true)}>
                수정하기
              </button>
              <button type="button" className="dp-btn dp-btn--accent" onClick={onClose}>
                캘린더로 돌아가기
              </button>
            </>
          ) : (
            <>
              {isExisting && (
                <button type="button" className="dp-btn dp-btn--soft" onClick={handleCancel}>
                  취소
                </button>
              )}
              <button type="button" className="dp-btn dp-btn--accent" onClick={handleSave}>
                {isExisting ? '수정 저장' : '저장'}
              </button>
            </>
          )}
        </div>
      </section>

      {photoOpen && <PhotoModal onClose={() => setPhotoOpen(false)} />}
      <div className={`rm-toast dy-toast ${toast ? 'is-visible' : ''}`} role="status">{toast}</div>
    </div>
  )
}
