import { useMemo, useRef, useState } from 'react'
import { AI_LIMITS, pickTimeCapsuleEntries, requestTimeCapsule } from '../../services/aiReflection.js'
import './aiDiary.css'

const range = (list) => {
  const dates = list.map((e) => e.date)
  return dates.length === 1 ? dates[0] : `${dates[0]} ~ ${dates[dates.length - 1]}`
}

// 추억보관소의 AI 타임캡슐 '과거의 나 돌아보기'
// - 내 일기(이미 불러온 목록)에서 가장 오래된 기록과 가장 최근 기록을 고른다 (사이가 30일 이상일 때만)
// - 보낼 기록 범위를 먼저 보여 주고, 버튼을 눌렀을 때만 AI를 부른다. 결과는 저장하지 않는다
export default function TimeCapsule({ diaries, ready }) {
  const picked = useMemo(() => pickTimeCapsuleEntries(diaries), [diaries])
  const [state, setState] = useState({ status: 'idle', result: null, error: '' })
  const busyRef = useRef(false)

  async function run() {
    if (busyRef.current || !picked) return
    busyRef.current = true
    setState({ status: 'loading', result: null, error: '' })
    const result = await requestTimeCapsule(picked)
    busyRef.current = false
    if (result.error) setState({ status: 'error', result: null, error: result.error.message })
    else setState({ status: 'done', result: result.data, error: '' })
  }

  return (
    <div className="dp-stat ai-capsule">
      <p className="dp-stat__label">AI 타임캡슐</p>
      <p className="ai-capsule__title">과거의 나 돌아보기</p>

      {!ready ? (
        <p className="dp-stat__hint">일기를 불러오는 중…</p>
      ) : !picked ? (
        <p className="dp-stat__hint">
          {AI_LIMITS.gapDays}일 이상 떨어진 과거 일기와 최근 일기가 있어야 비교할 수 있어요. 일기가 조금 더 쌓이면 다시 와 주세요.
        </p>
      ) : (
        <>
          {state.status !== 'done' && (
            <p className="ai-diary__note">
              누르면 과거 일기 {picked.past.length}편({range(picked.past)})과 최근 일기 {picked.recent.length}편({range(picked.recent)})의
              글(한 편 {AI_LIMITS.entryText}자까지)을 AI에 보내 실제 기록에 적힌 변화만 비교해요. 보낸 글과 결과는 저장하지 않아요.
            </p>
          )}
          {state.status === 'done' && (
            <div className="ai-capsule__result">
              <p className="ai-capsule__message">{state.result.message}</p>
              <ul className="ai-capsule__changes">
                {state.result.changes.map((c) => (
                  <li key={`${c.past}-${c.recent}-${c.note}`}>
                    <span className="ai-capsule__dates">{c.past} → {c.recent}</span>
                    {c.note}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {state.status === 'error' && <p className="ai-diary__error" role="alert">{state.error}</p>}
          <button type="button" className="ai-diary__btn" onClick={run} disabled={state.status === 'loading'}>
            {state.status === 'loading' ? '돌아보는 중…' : state.status === 'done' ? '다시 돌아보기' : '과거의 나 돌아보기'}
          </button>
        </>
      )}
    </div>
  )
}
