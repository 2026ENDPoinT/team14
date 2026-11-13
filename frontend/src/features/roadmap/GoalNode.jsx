// 로드맵 종착점. 일반 활동 데이터와 분리되어 편집·삭제·완료 처리 대상이 아니다.
export default function GoalNode({ data }) {
  const title = typeof data.job === 'string' ? data.job.trim() : ''
  return (
    <button
      type="button"
      className="rm-goal-node nodrag nopan"
      onClick={(event) => {
        event.stopPropagation()
        data.onClick?.()
      }}
      aria-label={title ? `나의 목표 직무: ${title}. 클릭해서 직무 소개 보기` : '목표 직무 설정 방법 보기'}
      title="직무 상세 설명 보기"
    >
      <span className="rm-goal-node__icon" aria-hidden="true">★</span>
      <span className="rm-goal-node__eyebrow">MY CAREER GOAL</span>
      <strong className="rm-goal-node__title">{title || '목표 직무 설정하기'}</strong>
      <span className="rm-goal-node__hint">{title ? '클릭해서 직무 알아보기' : '클릭해서 설정 방법 보기'}</span>
    </button>
  )
}
