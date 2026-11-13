import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { careerGoalInfo } from './careerGoalInfo.js'

// 로드맵 위 목표 직무를 클릭하면 나타나는 안내 팝업.
export default function CareerGoalModal({ job, onClose, onEdit }) {
  const closeRef = useRef(null)
  const info = careerGoalInfo(job)
  useEffect(() => {
    closeRef.current?.focus()
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return createPortal(
    <div className="rm-career-detail-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="rm-career-detail" role="dialog" aria-modal="true" aria-labelledby="rm-career-detail-title">
        <div className="rm-career-detail__top">
          <span className="rm-career-detail__label">★ MY CAREER GOAL</span>
          <button ref={closeRef} type="button" className="rm-career-detail__close" aria-label="직무 소개 닫기" onClick={onClose}>×</button>
        </div>
        <h2 id="rm-career-detail-title">{info?.title || '목표 직무를 정해보세요'}</h2>
        <p className="rm-career-detail__summary">{info?.description || '관심 있는 직무를 선택하면 이곳에서 해당 직무의 업무와 핵심 역량을 확인할 수 있어요.'}</p>
        {info?.tasks?.length > 0 && (
          <div className="rm-career-detail__section">
            <h3>주요 업무</h3>
            <ul>{info.tasks.map((task) => <li key={task}>{task}</li>)}</ul>
          </div>
        )}
        {info?.skills?.length > 0 && (
          <div className="rm-career-detail__section">
            <h3>필요한 핵심 역량</h3>
            <div className="rm-career-detail__skills">{info.skills.map((skill) => <span key={skill}>{skill}</span>)}</div>
          </div>
        )}
        <div className="rm-career-detail__actions">
          <button type="button" className="rm-career-detail__secondary" onClick={onClose}>닫기</button>
          <button type="button" className="rm-career-detail__primary" onClick={onEdit}>희망 직무 변경하기</button>
        </div>
      </section>
    </div>,
    document.body,
  )
}
