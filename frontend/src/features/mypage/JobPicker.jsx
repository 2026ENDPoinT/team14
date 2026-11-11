import { useEffect, useRef, useState } from 'react'
import { findJob, JOB_GROUPS } from './jobGroups.js'
import { Icon } from './ui.jsx'

// 희망 직무 선택: 처음엔 상위 분류 5개만 보이고,
// 분류에 마우스를 올리면(또는 누르면) 옆에 하위 직무가 펼쳐진다.
export default function JobPicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const [activeGroup, setActiveGroup] = useState(null) // 하위 목록을 펼친 분류 id
  const boxRef = useRef(null)
  const current = findJob(value)

  // 바깥을 누르거나 ESC를 누르면 닫는다
  useEffect(() => {
    if (!open) return
    function handleDown(e) {
      if (!boxRef.current?.contains(e.target)) setOpen(false)
    }
    function handleKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleDown)
    window.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleDown)
      window.removeEventListener('keydown', handleKey)
    }
  }, [open])

  function toggle() {
    setOpen((v) => !v)
    setActiveGroup(current?.group.id ?? null) // 열 때 지금 직무의 분류를 펼쳐 둔다
  }

  function pick(jobId) {
    onChange(jobId)
    setOpen(false)
  }

  return (
    <div className="mp-job" ref={boxRef}>
      <button
        type="button"
        className={`dy-input mp-input mp-job__field ${open ? 'is-open' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
      >
        <span>
          {current ? (
            <>
              <span className="mp-job__group">{current.group.title}</span>
              {current.job.title}
            </>
          ) : '직무를 골라 주세요'}
        </span>
        <span className="mp-job__caret" aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className="mp-job__menu" role="menu">
          {JOB_GROUPS.map((group) => {
            const isActive = activeGroup === group.id
            return (
              <div
                key={group.id}
                className="mp-job__group-item"
                onMouseEnter={() => setActiveGroup(group.id)}
              >
                <button
                  type="button"
                  className={`mp-job__cat ${isActive ? 'is-active' : ''} ${current?.group.id === group.id ? 'is-current' : ''}`}
                  aria-expanded={isActive}
                  onClick={() => setActiveGroup(group.id)}
                  onFocus={() => setActiveGroup(group.id)}
                >
                  {group.title}
                  <Icon name="chevron" size={16} />
                </button>

                {/* 하위 직무: 분류 오른쪽에 펼쳐짐 */}
                {isActive && (
                  <div className="mp-job__sub" role="menu" aria-label={group.title}>
                    {group.jobs.map((job) => (
                      <button
                        key={job.id}
                        type="button"
                        role="menuitemradio"
                        aria-checked={job.id === value}
                        className={`mp-job__item ${job.id === value ? 'is-selected' : ''}`}
                        onClick={() => pick(job.id)}
                      >
                        {job.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
