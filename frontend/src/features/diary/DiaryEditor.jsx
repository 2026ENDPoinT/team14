import { useEffect, useState } from 'react'
import { countCharsWithoutSpaces, REWARD_MIN_CHARS } from './countChars.js'
import { getTodayKST } from './dateUtils.js'
import { deleteDiary, getDiaryByDate, saveDiary } from './diaryMock.js'
import './DiaryEditor.css'

// 일기 작성 화면: 날짜 선택 → 내용 입력 → 저장/수정/삭제 (2-7, 2-8, 2-16)
// 기분 선택은 mood 목록이 [미확정]이라 아직 넣지 않는다.
export default function DiaryEditor() {
  const today = getTodayKST()
  const [date, setDate] = useState(today)
  const [content, setContent] = useState('')
  const [isExisting, setIsExisting] = useState(false) // 이 날짜에 이미 일기가 있는지
  const [message, setMessage] = useState('')

  // 날짜가 바뀌면 그 날짜의 일기를 불러온다
  useEffect(() => {
    const diary = getDiaryByDate(date)
    setContent(diary ? diary.content : '')
    setIsExisting(Boolean(diary))
    setMessage('')
  }, [date])

  const charCount = countCharsWithoutSpaces(content)
  const meetsLength = charCount >= REWARD_MIN_CHARS

  function handleSave() {
    const result = saveDiary({ date, content })
    if (result.error) {
      setMessage(result.error.message)
      return
    }
    setIsExisting(true)
    setMessage(isExisting ? '일기를 수정했습니다.' : '일기를 저장했습니다.')
  }

  function handleDelete() {
    if (!window.confirm(`${date} 일기를 삭제할까요?`)) return
    const result = deleteDiary(date)
    if (result.error) {
      setMessage(result.error.message)
      return
    }
    setContent('')
    setIsExisting(false)
    setMessage('일기를 삭제했습니다.')
  }

  return (
    <section className="diary-editor">
      <label className="diary-editor__field">
        날짜
        {/* max: 달력에서 오늘 이후 날짜를 고를 수 없게 한다 (저장 함수에서도 한 번 더 막음) */}
        <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
      </label>
      {date > today && <p className="diary-editor__message">미래 날짜에는 일기를 쓸 수 없어요.</p>}

      <label className="diary-editor__field">
        내용
        <textarea
          rows={10}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="오늘 있었던 일을 자유롭게 적어 보세요."
        />
      </label>

      {/* 공백 제외 글자 수 (보상 조건 표시용, 실제 판단은 서버) */}
      <p className="diary-editor__count">
        공백 제외 {charCount}자 / {REWARD_MIN_CHARS}자
        {meetsLength
          ? ' · 보상 조건을 채웠어요'
          : ` · ${REWARD_MIN_CHARS - charCount}자 더 쓰면 보상 조건을 채워요`}
      </p>
      <p className="diary-editor__hint">
        {REWARD_MIN_CHARS}자보다 짧아도 저장할 수 있어요. 일기 보상은 하루 한 번만 받을 수 있어요.
      </p>

      <div className="diary-editor__actions">
        <button type="button" onClick={handleSave} disabled={date > today}>
          {isExisting ? '수정 저장' : '저장'}
        </button>
        {/* 저장된 일기가 있을 때만 삭제 버튼을 보여 준다 */}
        {isExisting && (
          <button type="button" onClick={handleDelete}>
            삭제
          </button>
        )}
      </div>

      {message && <p className="diary-editor__message">{message}</p>}
    </section>
  )
}
