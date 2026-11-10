import { isCourse, themeLabel } from './layout.js'

// 노드 카드. 교과목은 작은 카드, 나머지는 종류·이름·부가 정보 카드
// subtitle: 노드 문서의 첫 줄 (한 줄 부가 정보)
// 왼쪽 점 = 완료 상태 표시등 (completed: true 노란색 / false 회색)
// hideDot: 캔버스에서는 클릭 가능한 표시등(CompleteDot)을 따로 그리므로 숨긴다
export default function NodeCard({
  node, subtitle, onClick, small = false, hideDot = false, style, className: extra = '', onPointerDown,
}) {
  const course = isCourse(node)
  const className = [
    'rm-card',
    course ? 'rm-card--course' : '',
    small ? 'rm-card--small' : '',
    `rm-theme-${node.theme}`,
    extra,
  ].join(' ')

  return (
    <button
      type="button"
      className={className}
      style={style}
      onClick={() => onClick?.(node.id)}
      onPointerDown={onPointerDown}
    >
      {!small && !hideDot && <span className={`rm-card__dot ${node.completed ? 'is-done' : ''}`} />}
      {course ? (
        <strong className="rm-card__title">{node.title}</strong>
      ) : (
        <>
          <span className="rm-card__kind">{themeLabel(node.theme)}</span>
          <strong className="rm-card__title">{node.title}</strong>
          <span className="rm-card__sub">{subtitle || '한 줄 부가 정보'}</span>
        </>
      )}
    </button>
  )
}
