import { useCallback, useEffect, useRef, useState } from 'react'
import { TrashIcon } from '../roadmap/icons.jsx'
import { countChars, REWARD_MIN_CHARS } from './countChars.js'
import { deleteDiary, DIARY_REWARD, getDiaryByDate, hasDiaryRewardToday, saveDiary } from './diaryStore.js'
import { getTodayKST } from './dateUtils.js'
import PhotoField from '../photos/PhotoField.jsx'
import usePhotoDraft from '../photos/usePhotoDraft.js'
import WarmthEffect from './WarmthEffect.jsx'
import FootprintField, { FOOTPRINT_MAX } from './FootprintField.jsx'
import { isFootprintReady } from '../../services/diary.js'
import AiReflection from './AiReflection.jsx'
import { PHOTO_MAX_COUNT } from '../../services/photos.js'
import './DiaryModal.css'

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
// - 사진: 저장 버튼을 누르면 일기 글을 먼저 저장하고(글이 바뀌었을 때만) 사진을 올린다.
//   사진만 바꾸거나 실패한 사진을 다시 올릴 때는 일기 저장(save_diary)을 부르지 않아 온기가 다시 지급되지 않는다.
//   올리기에 실패한 사진은 '실패'로 표시되고, 글과 이미 저장된 사진은 그대로 둔다.
// onChanged: 저장·삭제 후 달력(노란 점)을 다시 그리게 알린다.
export default function DiaryModal({ date, activities = [], onClose, onChanged }) {
  const [content, setContent] = useState(() => getDiaryByDate(date)?.content ?? '')
  // 오늘의 발자취 (선택): 글 + 연결한 로드맵 노드
  const [footprint, setFootprint] = useState(() => getDiaryByDate(date)?.footprint ?? '')
  const [linkedNodeId, setLinkedNodeId] = useState(() => getDiaryByDate(date)?.linkedNodeId ?? null)
  const [isExisting, setIsExisting] = useState(() => Boolean(getDiaryByDate(date)))
  const [editing, setEditing] = useState(false) // 이미 쓴 일기를 고치는 중인지
  // 처음 열 때 일기가 있으면 그 사진을 불러온다 (새로 쓴 일기는 저장 뒤 commit에 일기 id를 넘긴다)
  const [openedDiaryId] = useState(() => getDiaryByDate(date)?.id ?? null)
  const photos = usePhotoDraft(openedDiaryId ? { diaryId: openedDiaryId } : null)
  const [toast, setToast] = useState('')
  const [reward, setReward] = useState(null) // 받은 온기 양 (연출 중일 때만 값이 있음)
  const [busy, setBusy] = useState(false) // 저장·삭제 요청 중 (중복 클릭 방지)
  const [saveError, setSaveError] = useState('') // 저장 실패 안내 (사라지지 않고 다시 시도할 때까지 남는다)
  const textareaRef = useRef(null)
  const photoInputRef = useRef(null) // 이야기 칸 안 사진 추가 동그라미가 여는 파일 선택 창
  const [photoNotice, setPhotoNotice] = useState('') // 사진 추가 안내 (형식·크기·장수 초과)
  const endReward = useCallback(() => setReward(null), [])

  const readOnly = isExisting && !editing
  const isToday = date === getTodayKST() // 온기는 오늘(KST) 날짜 일기에만
  const charCount = countChars(content)
  const meetsLength = charCount >= REWARD_MIN_CHARS

  // 글자 수 안내 (보상 판단은 서버가 다시 한다)
  const rewardHint = !isToday
    ? '지난 날짜의 일기는 온기 없이 저장돼요.'
    : hasDiaryRewardToday()
      ? '오늘 일기 온기는 이미 받았어요.'
      : meetsLength
        ? '저장하면 온기를 받을 수 있어요.'
        : `${REWARD_MIN_CHARS - charCount}자 더 쓰면 온기를 받을 수 있어요.`

  // 20자 게이지: 오늘 일기를 쓰거나 고칠 때, 아직 오늘 일기 온기를 받지 않았을 때만 (보상 판단은 서버가 다시 함)
  const showGoal = !readOnly && isToday && !hasDiaryRewardToday()

  // 사진 고르기 (이야기 칸 안 동그라미 버튼). 저장 버튼을 눌러야 올라간다
  function pickPhotos(e) {
    setPhotoNotice(photos.addFiles(e.target.files) || '')
    e.target.value = '' // 같은 파일을 다시 고를 수 있게
    setSaveError('')
  }

  // 쓸 수 있는 상태가 되면 입력칸에 바로 커서를 둔다
  useEffect(() => {
    if (!readOnly) textareaRef.current?.focus()
  }, [readOnly])

  // ESC: 일기 팝업을 닫는다
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

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
    const stored = getDiaryByDate(date)
    // 글(이야기·발자취·연결 활동)이 바뀌었거나 새 일기일 때만 일기 저장(보상 판정 포함). 사진만 바뀌었으면 건너뛴다
    const textChanged = !stored || stored.content !== content || stored.footprint !== footprint || (stored.linkedNodeId ?? null) !== linkedNodeId
    const writeText = textChanged || !photos.dirty
    let diaryId = stored?.id
    let reward = null
    let footprintReward = null
    if (writeText) {
      const result = await saveDiary({ date, content, footprint, linkedNodeId })
      if (result.error) {
        // 저장 실패: 입력한 내용은 그대로 두고, 보상도 없다 (서버가 저장과 보상을 한 번에 처리)
        setBusy(false)
        setSaveError(`${result.error.message} 입력한 내용은 그대로 있어요.`)
        return
      }
      diaryId = result.diary.id
      reward = result.reward
      footprintReward = result.footprintReward
      setIsExisting(true)
      onChanged()
    }
    // 사진: 새 사진 올리기·지운 사진 삭제
    const photoResult = photos.dirty ? await photos.commit({ diaryId }) : { failed: 0 }
    setBusy(false)
    // 받은 온기 연출: 일기(+200)와 발자취(+100) 보상은 따로 판정되고, 함께 받으면 합쳐서 보여 준다
    const earned = (reward?.rewarded ? reward.amount : 0) + (footprintReward?.rewarded ? footprintReward.amount : 0)
    if (earned > 0) setReward(earned)
    if (photoResult.failed > 0) {
      // 글은 저장됨. 실패한 사진만 표시해 두고 수정 상태를 유지한다 → '다시 시도'는 사진만 다시 올린다
      setSaveError(`${writeText ? '일기 글은 저장했어요. ' : ''}사진 ${photoResult.failed}장을 처리하지 못했어요. '다시 시도'를 누르면 그 사진만 다시 올려요. ${photoResult.message}`)
      if (!editing) setEditing(true)
      return
    }
    // 온기를 받았으면 연기 연출, 아니면 저장 안내 + 받지 못한 이유
    // (일기는 저장됐는데 보상 처리만 실패한 경우도 구분해서 알려 준다)
    if (!writeText) setToast('사진을 저장했어요.')
    else if (earned > 0) { /* 연출로 알림 */ }
    else if (reward?.error) setToast('일기는 저장했어요. 온기 지급은 실패했어요. 잠시 후 다시 확인해 주세요.')
    else setToast(`${stored ? '일기를 수정했어요.' : '일기를 저장했어요.'}${NO_REWARD_NOTE[reward?.reason] ?? ''}`)
    setIsExisting(true)
    setEditing(false)
  }

  // 수정 취소: 저장된 내용으로 되돌린다
  function handleCancel() {
    const stored = getDiaryByDate(date)
    setContent(stored?.content ?? '')
    setFootprint(stored?.footprint ?? '')
    setLinkedNodeId(stored?.linkedNodeId ?? null)
    photos.reset()
    setSaveError('')
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
    setFootprint('')
    setLinkedNodeId(null)
    photos.clear()
    setIsExisting(false)
    setEditing(false)
    setToast('일기를 삭제했어요.')
    onChanged()
  }

  return (
    <div className="dp-modal" role="dialog" aria-modal="true" aria-label={`${formatDateLong(date)} 일기`}>
      <div className="dp-modal__backdrop" onClick={onClose} />
      <section className="dp-modal__card dm-card">
        <header className="dp-modal__head">
          <div className="dm-head">
            <p className="rm-eyebrow">나의 하루</p>
            <div className="dm-head__row">
              <h2 className="dp-modal__title dm-title">{formatDateLong(date)}</h2>
              {/* 이날 마감·목표일인 주요 활동 (로드맵 노드, 읽기만): 날짜 옆에 작게 */}
              {activities.length > 0 && (
                <ul className="dm-acts" aria-label="이날의 활동">
                  {activities.map((node) => (
                    <li key={node.id} className="dm-act" title={`${node.title} (${node.dueDate ? '목표일' : '마감일'})`}>
                      <span className={`dm-act__dot ${node.completed ? 'is-done' : ''}`} aria-hidden="true" />
                      <span className="dm-act__title">{node.title}</span>
                      <span className="dm-act__kind">{node.dueDate ? '목표일' : '마감일'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
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

        {/* 오늘의 이야기: 입력칸 안 왼쪽 아래에 사진 추가 동그라미, 고른 사진은 칸 안에 작게 */}
        <section className="dm-story" aria-label="오늘의 이야기">
          <div className="dm-story__head">
            <h3 className="dm-story__title">오늘의 이야기</h3>
          </div>
          {readOnly ? (
            <p className="dp-story">{content || '(내용 없음)'}</p>
          ) : (
            // 일기 입력칸 (로드맵 노드 카드 모양, 20자를 채우면 왼쪽 점이 노랗게). 사진 추가 동그라미는 칸 안 아래 줄
            <div className="dy-node dy-node--top dm-story__node">
              <span className={`dy-node__dot ${meetsLength ? 'is-done' : ''}`} aria-hidden="true" />
              {/* 입력칸 모양 상자: 글은 위쪽에만 쓰이고, 사진 줄은 그 아래 따로 (글이 사진 버튼 뒤로 가지 않게) */}
              <div className="dy-input dm-story__card">
                <textarea
                  ref={textareaRef}
                  className="dm-story__input"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="오늘은 어떤 하루였나요? 자유롭게 이야기해 주세요."
                  aria-label="오늘의 이야기"
                />
                <div className="dm-story__foot">
                  {photos.items.length < PHOTO_MAX_COUNT && !photos.loading && (
                    <button
                      type="button"
                      className="dm-photo-btn"
                      onClick={() => photoInputRef.current?.click()}
                      aria-label="사진 추가"
                      title={`사진 추가 (jpg·png·webp·gif, 한 장 5MB까지 최대 ${PHOTO_MAX_COUNT}장)`}
                    >
                      <PhotoPlusIcon />
                    </button>
                  )}
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    multiple
                    hidden
                    onChange={pickPhotos}
                  />
                  {photos.items.length === 0 && <span className="dm-story__hint">사진은 저장할 때 함께 올라가요</span>}
                  {photos.items.length > 0 && (
                    <div className="dm-story__photos">
                      <PhotoField draft={photos} allowAdd={false} onChange={() => setSaveError('')} />
                    </div>
                  )}
                  {showGoal && <GoalRing count={charCount} goal={REWARD_MIN_CHARS} />}
                </div>
              </div>
            </div>
          )}
          {/* 게이지가 없을 때(지난 날짜·오늘 온기를 이미 받음)만 안내 한 줄 */}
          {!readOnly && !showGoal && (!isExisting || isToday) && <p className="rm-muted dm-hint">{rewardHint}</p>}
          {photoNotice && <p className="dm-hint is-error" role="alert">{photoNotice}</p>}
          {/* 읽기 상태: 저장된 사진 */}
          {readOnly && (photos.items.length > 0 || photos.loading || photos.loadError) && (
            <PhotoField draft={photos} readOnly />
          )}
        </section>

        {/* 오늘의 발자취 (선택): 이야기 바로 아래. 공부·활동 기록 + 로드맵 활동 연결 */}
        {(!readOnly || footprint || linkedNodeId) && (
          <FootprintField
            text={footprint}
            onTextChange={setFootprint}
            nodeId={linkedNodeId}
            onNodeChange={setLinkedNodeId}
            readOnly={readOnly}
            // AI 회고 인터뷰: '오늘의 발자취'(공부·활동 기록)만 AI에 보낸다. '오늘의 이야기'는 읽거나 보내지 않는다
            // 답은 발자취 끝에 [회고]로 덧붙임 (저장은 아래 저장 버튼). 발자취 칸이 서버에 있을 때만
            extra={!readOnly && isFootprintReady() ? (
              <AiReflection
                date={date}
                content={footprint}
                onAppend={(text) => {
                  const next = `${footprint.trimEnd()}\n\n${text}`
                  if ([...next].length > FOOTPRINT_MAX) return `발자취는 ${FOOTPRINT_MAX}자까지 쓸 수 있어요. 답을 줄여 주세요.`
                  setFootprint(next)
                  return null
                }}
              />
            ) : null}
          />
        )}

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

      <div className={`rm-toast dy-toast ${toast ? 'is-visible' : ''}`} role="status">{toast}</div>
    </div>
  )
}

// 사진 추가 아이콘 (액자 + 작은 +)
function PhotoPlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="M20 16l-4-4-8 8" />
      <path d="M18 3v6M15 6h6" />
    </svg>
  )
}

// 20자 게이지: 글을 쓸수록 동그라미가 노랗게 차오르고, 다 채우면 체크 + '온기 받을 준비 완료!'
const RING_R = 10
const RING_LEN = 2 * Math.PI * RING_R
function GoalRing({ count, goal }) {
  const done = count >= goal
  const ratio = Math.min(1, count / goal)
  const label = done ? '온기 받을 준비 완료!' : `${goal - count}자 더 쓰면 온기 +${DIARY_REWARD}`
  return (
    <div className={`dm-goal ${done ? 'is-done' : ''}`} role="status" aria-label={`글자 수 ${count}자 / ${goal}자. ${label}`}>
      <span className="dm-goal__label" aria-hidden="true">{label}</span>
      <span className="dm-goal__ring" aria-hidden="true">
        <svg width="26" height="26" viewBox="0 0 26 26">
          <circle className="dm-goal__track" cx="13" cy="13" r={RING_R} />
          <circle
            className="dm-goal__fill"
            cx="13"
            cy="13"
            r={RING_R}
            strokeDasharray={RING_LEN}
            strokeDashoffset={RING_LEN * (1 - ratio)}
          />
        </svg>
        <span className="dm-goal__num">{done ? '✓' : count}</span>
      </span>
    </div>
  )
}
