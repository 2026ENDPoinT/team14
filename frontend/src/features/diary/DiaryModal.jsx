import { useCallback, useEffect, useRef, useState } from 'react'
import { TrashIcon } from '../roadmap/icons.jsx'
import { countChars, REWARD_MIN_CHARS } from './countChars.js'
import { deleteDiary, getDiaryByDate, hasDiaryRewardToday, saveDiary } from './diaryStore.js'
import { getTodayKST } from './dateUtils.js'
import PhotoModal from './PhotoModal.jsx'
import WarmthEffect from './WarmthEffect.jsx'

const WEEKDAYS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']

// 저장은 됐지만 온기를 받지 못한 이유별 안내 (일기 저장 성공과 보상 결과를 나눠서 알려 준다)
const NO_REWARD_NOTE = {
  NOT_TODAY: ' 지난 날짜 일기는 온기를 받지 않아요.',
  ALREADY_REWARDED: ' 오늘 일기 온기는 이미 받았어요.',
  TOO_SHORT: ' 20자 이상이 되면 오늘 온기를 받을 수 있어요.',
}

// '2026-11-01' → '11월 1일 일요일'
function formatDateLong(date) {
  const [y, m, d] = date.split('-').map(Number)
  return `${m}월 ${d}일 ${WEEKDAYS[new Date(y, m - 1, d).getDay()]}`
}

// 날짜를 눌렀을 때 뜨는 일기 팝업 (2-7, 2-8, 2-16)
// - 이미 쓴 일기는 먼저 읽기만 하고, '수정하기'를 눌러야 고칠 수 있다.
// - 저장·삭제는 서버에 한다 (diaryStore → services/diary.js). 실패하면 입력한 내용은 그대로 두고 다시 시도할 수 있다.
// onChanged: 저장·삭제 후 달력(노란 점)을 다시 그리게 알린다.
export default function DiaryModal({ date, activities = [], onClose, onChanged }) {
  const [content, setContent] = useState(() => getDiaryByDate(date)?.content ?? '')
  const [isExisting, setIsExisting] = useState(() => Boolean(getDiaryByDate(date)))
  const [editing, setEditing] = useState(false) // 이미 쓴 일기를 고치는 중인지
  const [photoOpen, setPhotoOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [reward, setReward] = useState(null) // 받은 온기 양 (연출 중일 때만 값이 있음)
  const [busy, setBusy] = useState(false) // 저장·삭제 요청 중 (중복 클릭 방지)
  const [saveError, setSaveError] = useState('') // 저장 실패 안내 (사라지지 않고 다시 시도할 때까지 남는다)
  const textareaRef = useRef(null)
  const endReward = useCallback(() => setReward(null), [])

  const readOnly = isExisting && !editing
  const isToday = date === getTodayKST() // 온기는 오늘(KST) 날짜 일기에만
  const charCount = countChars(content)
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

  async function handleSave() {
    if (busy) return
    setBusy(true)
    setSaveError('')
    const result = await saveDiary({ date, content })
    setBusy(false)
    if (result.error) {
      // 저장 실패: 입력한 내용은 그대로 두고, 보상도 없다 (서버가 저장과 보상을 한 번에 처리)
      setSaveError(`${result.error.message} 입력한 내용은 그대로 있어요.`)
      return
    }
    // 온기를 받았으면 연기 연출, 아니면 저장 안내 + 받지 못한 이유
    // (일기는 저장됐는데 보상 처리만 실패한 경우도 구분해서 알려 준다)
    if (result.reward?.rewarded) setReward(result.reward.amount)
    else if (result.reward?.error) setToast('일기는 저장했어요. 온기 지급은 실패했어요. 잠시 후 다시 확인해 주세요.')
    else setToast(`${isExisting ? '일기를 수정했어요.' : '일기를 저장했어요.'}${NO_REWARD_NOTE[result.reward?.reason] ?? ''}`)
    setIsExisting(true)
    setEditing(false)
    onChanged()
  }

  // 수정 취소: 저장된 내용으로 되돌린다
  function handleCancel() {
    setContent(getDiaryByDate(date)?.content ?? '')
    setEditing(false)
  }

  async function handleDelete() {
    if (busy || !window.confirm(`${formatDateLong(date)} 일기를 삭제할까요?`)) return
    setBusy(true)
    const result = await deleteDiary(date)
    setBusy(false)
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

        {/* 이날 마감·목표일인 주요 활동 (로드맵 노드, 읽기만) */}
        {activities.length > 0 && (
          <div className="dp-acts">
            <p className="dp-acts__label">이날의 활동</p>
            <ul className="dp-acts__list">
              {activities.map((node) => (
                <li key={node.id} className="dp-acts__item">
                  <span className={`dp-acts__dot ${node.completed ? 'is-done' : ''}`} aria-hidden="true" />
                  <span className="dp-acts__title">{node.title}</span>
                  <span className="dp-acts__kind">{node.dueDate ? '목표일' : '마감일'}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

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
        {/* 새로 쓸 때, 그리고 오늘 일기를 고칠 때 (오늘 일기는 수정으로 20자를 채워도 온기를 받음) */}
        {!readOnly && (!isExisting || isToday) && (
          <div className="rm-field">
            <div className="dy-count">
              <span className="rm-eyebrow">글자 수</span>
              <span className={`dy-count__num ${meetsLength ? 'is-done' : ''}`}>
                {charCount}자 / {REWARD_MIN_CHARS}자
              </span>
            </div>
            <div className="dy-bar" aria-hidden="true">
              <div className={`dy-bar__fill ${meetsLength ? 'is-done' : ''}`} style={{ width: `${progress}%` }} />
            </div>
            <p className="rm-muted dy-hint">
              {!isToday
                ? '지난 날짜의 일기는 온기 없이 저장돼요. 온기는 오늘 일기에만 받을 수 있어요.'
                : hasDiaryRewardToday()
                  ? '오늘 일기 온기는 이미 받았어요. 고친 내용은 그대로 저장돼요.'
                  : meetsLength
                    ? '저장하면 온기를 받을 수 있어요.'
                    : `${REWARD_MIN_CHARS - charCount}자 더 쓰면 온기를 받을 수 있어요.`}
            </p>
          </div>
        )}

        <button type="button" className="dp-photo-add" onClick={() => setPhotoOpen(true)}>
          <span className="dp-photo-add__icon" aria-hidden="true">+</span>
          사진 추가
        </button>

        {saveError && <p className="dp-save-error" role="alert">{saveError}</p>}

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
              <button type="button" className="dp-btn dp-btn--accent" onClick={handleSave} disabled={busy}>
                {busy ? '저장 중…' : saveError ? '다시 시도' : isExisting ? '수정 저장' : '저장'}
              </button>
            </>
          )}
        </div>

        {/* 온기 획득 연출 (팝업 카드 위를 덮음) */}
        {reward !== null && <WarmthEffect amount={reward} onDone={endReward} />}
      </section>

      {photoOpen && <PhotoModal onClose={() => setPhotoOpen(false)} />}
      <div className={`rm-toast dy-toast ${toast ? 'is-visible' : ''}`} role="status">{toast}</div>
    </div>
  )
}
