import { useRef, useState } from 'react'
import { AI_LIMITS, requestReflectQuestions } from '../../services/aiReflection.js'
import './aiDiary.css'

// 일기 창 '오늘의 발자취'의 회고 질문 (질문만 보여 준다. 답은 사용자가 위 발자취 칸에 바로 쓴다)
// - 발자취가 비어 있을 때: 영역을 처음 열면 작성 질문 1개를 바로 보여 준다 (AI 호출 없음)
//   '다른 질문'을 누르면 다른 주제(배운 점·어려웠던 순간·작은 성취·다음에 해 볼 일·오늘 한 일)로 바뀐다 → 같은 질문이 연속으로 나오지 않음
// - 발자취를 쓴 뒤: 'AI 회고 질문 받기'를 누르면 지금 쓴 발자취 글만 AI에 보내 그 내용에 맞춘 질문(최대 2개)을 보여 준다
//   '오늘의 이야기'는 보내지 않는다. 보낸 글·질문은 저장하지 않는다
const STARTERS = [
  { topic: '배운 점', question: '오늘 새로 알게 된 것이나 배운 점 하나를 적어 볼까요?' },
  { topic: '어려웠던 순간', question: '오늘 공부나 활동에서 가장 막혔던 순간은 언제였나요? 어떻게 넘어갔는지도 적어 보세요.' },
  { topic: '작은 성취', question: '오늘 해낸 작은 일 하나를 떠올려 볼까요? 아무리 작아도 괜찮아요.' },
  { topic: '다음에 해 볼 일', question: '오늘을 돌아보면, 다음에 이어서 해 보고 싶은 일은 무엇인가요?' },
  { topic: '오늘 한 일', question: '오늘 어떤 공부나 활동을 했나요? 한 가지만 적어도 좋아요.' },
]

// 지금과 다른 주제 중 하나 (연속으로 같은 질문이 나오지 않게)
const nextStarter = (current) => {
  const others = STARTERS.map((_, i) => i).filter((i) => i !== current)
  return others[Math.floor(Math.random() * others.length)]
}

export default function AiReflection({ date, content }) {
  const [starter, setStarter] = useState(() => Math.floor(Math.random() * STARTERS.length))
  const [state, setState] = useState({ status: 'idle', questions: [], error: '' })
  const busyRef = useRef(false)
  const hasText = Boolean(content?.trim())

  async function ask() {
    if (busyRef.current) return
    busyRef.current = true
    setState({ status: 'loading', questions: [], error: '' })
    const result = await requestReflectQuestions({ date, content })
    busyRef.current = false
    if (result.error) return setState({ status: 'error', questions: [], error: result.error.message })
    setState({ status: 'ready', questions: result.data.questions, error: '' })
  }

  // 발자취가 비어 있으면: 작성 질문 1개 (처음 열 때 바로)
  if (!hasText) {
    const s = STARTERS[starter]
    return (
      <div className="ai-diary" aria-live="polite">
        <div className="ai-diary__qa">
          <div className="ai-diary__item" data-topic={s.topic}>
            <span className="ai-diary__topic">{s.topic}</span>
            <span className="ai-diary__q">{s.question}</span>
          </div>
          <div className="ai-diary__actions">
            <button type="button" className="ai-diary__btn" onClick={() => setStarter(nextStarter)}>
              다른 질문
            </button>
          </div>
        </div>
        <p className="ai-diary__note">위 발자취 칸에 바로 적어 보세요. 글을 쓰면 그 내용에 맞춘 질문도 받을 수 있어요.</p>
      </div>
    )
  }

  // 발자취를 쓴 뒤: 내용에 맞춘 AI 질문
  return (
    <div className="ai-diary" aria-live="polite">
      {state.status !== 'ready' && (
        <>
          <button type="button" className="ai-diary__btn" onClick={ask} disabled={state.status === 'loading'}>
            {state.status === 'loading' ? '질문을 만드는 중…' : 'AI 회고 질문 받기'}
          </button>
          <p className="ai-diary__note">
            {`누르면 위 발자취 글(최대 ${AI_LIMITS.diaryText}자)만 AI에 보내요. '오늘의 이야기'는 보내지 않고, 발자취에 적힌 경험으로만 질문을 만들어요. 보낸 글은 저장하지 않아요.`}
          </p>
        </>
      )}
      {state.status === 'error' && <p className="ai-diary__error" role="alert">{state.error}</p>}

      {state.status === 'ready' && (
        <div className="ai-diary__qa">
          {state.questions.map((q) => (
            <div key={q.question} className="ai-diary__item">
              <span className="ai-diary__q">{q.question}</span>
              {q.basis && <span className="ai-diary__basis">발자취 속 “{q.basis}”에서</span>}
            </div>
          ))}
          <p className="ai-diary__note">답은 위 발자취 칸에 이어서 적으면 돼요.</p>
          <div className="ai-diary__actions">
            <button type="button" className="ai-diary__btn" onClick={ask}>다시 받기</button>
            <button type="button" className="ai-diary__btn" onClick={() => setState({ status: 'idle', questions: [], error: '' })}>
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
