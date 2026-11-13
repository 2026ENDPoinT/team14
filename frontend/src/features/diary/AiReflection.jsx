import { useRef, useState } from 'react'
import { AI_LIMITS, requestReflectQuestions } from '../../services/aiReflection.js'
import './aiDiary.css'

const ANSWER_MAX = 500

// 일기 창의 AI 회고 인터뷰
// - 버튼을 눌렀을 때만 지금 쓰고 있는 이 일기 글을 AI에 보낸다 (30자 이상일 때만)
// - 질문(최대 2개)에 답하고 '일기에 추가'를 누르면 본문 끝에 [회고] 형식으로 덧붙인다 (기존 글은 그대로)
// - 저장은 일기 창의 기존 저장 버튼으로 (여기서는 저장하지 않는다)
export default function AiReflection({ date, content, onAppend }) {
  const [state, setState] = useState({ status: 'idle', questions: [], error: '' })
  const [answers, setAnswers] = useState([])
  const [notice, setNotice] = useState('')
  const busyRef = useRef(false)
  const length = [...(content ?? '').trim()].length
  const enough = length >= AI_LIMITS.minChars

  async function ask() {
    if (busyRef.current || !enough) return
    busyRef.current = true
    setNotice('')
    setState({ status: 'loading', questions: [], error: '' })
    const result = await requestReflectQuestions({ date, content })
    busyRef.current = false
    if (result.error) return setState({ status: 'error', questions: [], error: result.error.message })
    setAnswers(result.data.questions.map(() => ''))
    setState({ status: 'ready', questions: result.data.questions, error: '' })
  }

  function append() {
    const pairs = state.questions
      .map((q, i) => ({ q: q.question, a: answers[i]?.trim() }))
      .filter((p) => p.a)
    if (pairs.length === 0) return
    onAppend(pairs.map((p) => `[회고] ${p.q}\n${p.a}`).join('\n\n'))
    setState({ status: 'idle', questions: [], error: '' })
    setAnswers([])
    setNotice('일기 끝에 회고를 추가했어요. 저장 버튼을 눌러야 저장돼요.')
  }

  const hasAnswer = answers.some((a) => a.trim())

  return (
    <div className="ai-diary" aria-live="polite">
      {state.status !== 'ready' && (
        <>
          <button type="button" className="ai-diary__btn" onClick={ask} disabled={!enough || state.status === 'loading'}>
            {state.status === 'loading' ? '질문을 만드는 중…' : 'AI 회고 질문 받기'}
          </button>
          <p className="ai-diary__note">
            {enough
              ? `누르면 지금 쓰고 있는 이 일기 글(최대 ${AI_LIMITS.diaryText}자)만 AI에 보내요. 일기에 적힌 경험으로만 질문을 만들고, 보낸 글은 저장하지 않아요.`
              : `일기를 ${AI_LIMITS.minChars}자 이상 쓰면 회고 질문을 받을 수 있어요. (지금 ${length}자)`}
          </p>
        </>
      )}
      {state.status === 'error' && <p className="ai-diary__error" role="alert">{state.error}</p>}
      {notice && <p className="ai-diary__note is-done" role="status">{notice}</p>}

      {state.status === 'ready' && (
        <div className="ai-diary__qa">
          {state.questions.map((q, i) => (
            <label key={q.question} className="ai-diary__item">
              <span className="ai-diary__q">{q.question}</span>
              <span className="ai-diary__basis">일기 속 “{q.basis}”에서</span>
              <textarea
                className="dy-input ai-diary__answer"
                rows={2}
                maxLength={ANSWER_MAX}
                value={answers[i] ?? ''}
                placeholder="떠오르는 대로 답해 보세요 (비워 두면 추가하지 않아요)"
                onChange={(e) => setAnswers((prev) => prev.map((a, j) => (j === i ? e.target.value : a)))}
              />
            </label>
          ))}
          <div className="ai-diary__actions">
            <button type="button" className="ai-diary__btn is-primary" onClick={append} disabled={!hasAnswer}>
              일기에 추가
            </button>
            <button
              type="button"
              className="ai-diary__btn"
              onClick={() => setState({ status: 'idle', questions: [], error: '' })}
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
