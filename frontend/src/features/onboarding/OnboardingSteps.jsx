import { useState } from 'react'
import { ActionBar, Bubble, Chip, Hint, StepTitle } from './OnboardingParts.jsx'
import { CAREERS, EXPERIENCE_GROUPS, SETUP_MODES, TERMS } from './onboardingOptions.js'

// 온보딩 단계별 화면. 상태와 저장은 OnboardingPage가 맡고, 여기서는 화면만 그린다.

export const NICKNAME_MAX = 8

// 글자 수 (한글·이모지도 1글자로 센다)
export function countChars(text) {
  return Array.from(text).length
}

// ───── 1. 프로필: 닉네임 → 학년·학기 (대화형) ─────
// Semester Selection 프레임 순서: 위 줄 x-1, 아래 줄 x-2
const TERM_GRID = [...TERMS.filter((t) => t.semester === 1), ...TERMS.filter((t) => t.semester === 2)]

export function ProfileStep({ nickname, nicknameDone, term, onNicknameSubmit, onNicknameEdit, onTermSelect, onTermEdit, onNext }) {
  const [draft, setDraft] = useState(nickname)

  const submit = (event) => {
    event.preventDefault()
    // 앞뒤 공백을 지우고 최대 8자 (입력 중 IME로 넘친 글자도 여기서 자른다)
    onNicknameSubmit(Array.from(draft.trim()).slice(0, NICKNAME_MAX).join(''))
  }
  const handleChange = (event) => {
    const value = event.target.value
    // 한글 조합 중에는 자르지 않는다 (조합이 끝난 뒤 submit에서 정리)
    setDraft(event.nativeEvent.isComposing ? value : Array.from(value).slice(0, NICKNAME_MAX).join(''))
  }

  return (
    <>
      <StepTitle>먼저, 당신에 대해 알려주세요</StepTitle>
      <div className="ob-chat">
        <Bubble>닉네임을 설정하세요. (최대 {NICKNAME_MAX}자)</Bubble>

        {nicknameDone && (
          <Bubble from="me" muted={!nickname} onClick={() => { setDraft(nickname); onNicknameEdit() }} label="닉네임 다시 입력">
            {nickname || '나중에 정할게요'}
          </Bubble>
        )}

        {nicknameDone && (
          <>
            <Bubble>재학중인 학년과 학기를 알려주세요.</Bubble>
            {term ? (
              <Bubble from="me" onClick={onTermEdit} label="학년·학기 다시 선택">{term}</Bubble>
            ) : (
              <div className="ob-term">
                <div className="ob-term__grid">
                  {TERM_GRID.map((t) => (
                    <Chip key={t.id} size="term" onClick={() => onTermSelect(t.id)}>{t.id}</Chip>
                  ))}
                </div>
                <Hint>현재 휴학 중이시라면, 휴학 전 마지막으로 재학했던 학기를 선택해 주세요.</Hint>
              </div>
            )}
          </>
        )}
      </div>

      {!nicknameDone && (
        <form className="ob-input" onSubmit={submit}>
          <input
            type="text"
            value={draft}
            onChange={handleChange}
            placeholder="입력"
            aria-label="닉네임 (최대 8자, 선택)"
            autoFocus
          />
          <span className="ob-input__count" aria-hidden="true">{countChars(draft)}/{NICKNAME_MAX}</span>
          <button type="submit" className="ob-input__send" aria-label="닉네임 확인">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </form>
      )}

      {nicknameDone && term && <ActionBar onConfirm={onNext} />}
    </>
  )
}

// ───── 2. 기존 경험: 대분류 → 세부 항목 (복수 선택) ─────
export function ExperienceStep({ selectedIds, onToggle, hasUnsupported, onNext, onSkip }) {
  const [groupId, setGroupId] = useState(EXPERIENCE_GROUPS[0].id)
  const group = EXPERIENCE_GROUPS.find((g) => g.id === groupId)
  const countIn = (g) => g.items.filter((item) => selectedIds.includes(item.id)).length
  const selectedItems = EXPERIENCE_GROUPS.flatMap((g) => g.items).filter((item) => selectedIds.includes(item.id))

  return (
    <>
      <StepTitle>지금까지 어떤 경험을 해오셨나요?</StepTitle>
      <div className="ob-body">
        <div className="ob-chips ob-chips--groups" role="tablist" aria-label="경험 분류">
          {EXPERIENCE_GROUPS.map((g) => (
            <button
              key={g.id}
              type="button"
              role="tab"
              aria-selected={g.id === groupId}
              className={`ob-tab ${g.id === groupId ? 'is-active' : ''}`}
              onClick={() => setGroupId(g.id)}
            >
              {g.title}
              {countIn(g) > 0 && <span className="ob-chip__count">{countIn(g)}</span>}
            </button>
          ))}
        </div>

        <section className="ob-section" aria-label={group.title}>
          <h2 className="ob-section__title">{group.title}</h2>
          <div className="ob-chips">
            {group.items.map((item) => (
              <Chip key={item.id} selected={selectedIds.includes(item.id)} onClick={() => onToggle(item.id)}>
                {item.title}
              </Chip>
            ))}
          </div>
        </section>

        {selectedItems.length > 0 && (
          <div className="ob-picked">
            <span className="ob-picked__label">선택한 경험 {selectedItems.length}개</span>
            <div className="ob-picked__list">
              {selectedItems.map((item) => (
                <button key={item.id} type="button" className="ob-picked__item" onClick={() => onToggle(item.id)} aria-label={`${item.title} 선택 해제`}>
                  {item.title}
                  <span aria-hidden="true">×</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <Hint>선택한 경험은 로드맵의 보관함에 저장돼요. 학기에는 자동으로 배치되지 않아요.</Hint>
        {hasUnsupported && (
          <Hint tone="warn">아직 저장을 지원하지 않는 경험이 포함되어 있어요. 완료 전에 다시 안내해 드릴게요.</Hint>
        )}
      </div>
      <ActionBar onConfirm={onNext} onSkip={onSkip} />
    </>
  )
}

// ───── 3. 수강 과목: 학년·학기별 (복수 선택) ─────
// 실제로 이수한 과목을 직접 고른다. 선택은 페이지(OnboardingPage)에 모아 두어 단계를 오가도 유지된다.
export function CourseStep({ courses, selectedKeys, onToggle, onNext, onSkip }) {
  // 교과과정 데이터의 권장 학년·학기로 묶는다
  const groups = TERMS.map((t) => ({
    ...t,
    courses: courses.filter((c) => c.year === t.grade && c.semester === t.semester),
  })).filter((g) => g.courses.length > 0)
  const selectedCourses = courses.filter((c) => selectedKeys.includes(c.key))

  return (
    <>
      <StepTitle>지금까지의 배움을 돌아볼까요?</StepTitle>
      <div className="ob-body">
        {groups.length === 0 ? (
          <div className="ob-empty">
            <strong>교과과정 데이터 준비 중</strong>
            <span>교과과정 데이터가 연결되면 학기별 과목을 선택할 수 있어요.</span>
          </div>
        ) : (
          groups.map((g) => (
            <section key={g.id} className="ob-section" aria-label={`${g.grade}학년 ${g.semester}학기 과목`}>
              <h2 className="ob-section__title">{g.grade}학년 {g.semester}학기</h2>
              <div className="ob-chips">
                {g.courses.map((course) => (
                  <Chip key={course.key} selected={selectedKeys.includes(course.key)} onClick={() => onToggle(course.key)}>
                    {course.title}
                    {course.category === '전공필수' && <span className="ob-chip__tag">전공필수</span>}
                  </Chip>
                ))}
              </div>
            </section>
          ))
        )}

        {selectedCourses.length > 0 && (
          <div className="ob-picked">
            <span className="ob-picked__label">이수한 과목 {selectedCourses.length}개</span>
            <div className="ob-picked__list">
              {selectedCourses.map((course) => (
                <button key={course.key} type="button" className="ob-picked__item" onClick={() => onToggle(course.key)} aria-label={`${course.title} 선택 해제`}>
                  {course.title}
                  <span aria-hidden="true">×</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <Hint>고른 과목은 연계도의 권장 학기에 ‘이수 완료’로 배치돼요. 실제 이수 학기는 로드맵에서 나중에 수정할 수 있습니다.</Hint>
      </div>
      <ActionBar onConfirm={onNext} onSkip={onSkip} />
    </>
  )
}

// ───── 4. 희망 직무: 대표 1개 (필수, 건너뛰기 없음) ─────
export function CareerStep({ selectedId, onSelect, onNext }) {
  const selected = CAREERS.find((c) => c.id === selectedId)
  return (
    <>
      <StepTitle>
        관심 있는 직무를 하나만 선택해 주세요.
        <br />
        선택하신 분야를 바탕으로 학습 로드맵을 제안해 드릴게요.
      </StepTitle>
      <div className="ob-body">
        <div className="ob-chips ob-chips--career" role="radiogroup" aria-label="희망 직무">
          {CAREERS.map((c) => (
            <Chip key={c.id} selected={c.id === selectedId} onClick={() => onSelect(c.id === selectedId ? null : c.id)}>
              {c.title}
            </Chip>
          ))}
        </div>
        {selected && !selected.dbKey && (
          <Hint tone="warn">
            ‘{selected.title}’ 직무는 추천 데이터가 아직 연결되지 않아 지금은 저장할 수 없어요.
          </Hint>
        )}
      </div>
      {/* 직무를 하나 골라야 다음으로 갈 수 있다 ('아직 정하지 않음'도 하나의 선택지) */}
      <ActionBar onConfirm={onNext} disabled={!selectedId} />
    </>
  )
}

// ───── 5. 로드맵 구성 방식 ─────
export function SetupStep({ mode, onSelect, hasRecommendation, saving, error, onFix, onConfirm }) {
  return (
    <>
      <StepTitle>당신의 로드맵을 어떻게 시작할까요?</StepTitle>
      <div className="ob-body">
        <div className="ob-options" role="radiogroup" aria-label="로드맵 구성 방식">
          {SETUP_MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              role="radio"
              aria-checked={mode === m.key}
              className={`ob-option ${mode === m.key ? 'is-selected' : ''}`}
              onClick={() => onSelect(m.key)}
            >
              <strong>{m.title}</strong>
              <span>{m.description}</span>
            </button>
          ))}
        </div>
        {mode === 'auto' && !hasRecommendation && (
          <Hint>과목 추천 기능이 연결되기 전이라 지금은 추천 과목이 추가되지 않아요. 고른 이수 과목만 반영돼요.</Hint>
        )}

        {error && (
          <div className="ob-error" role="alert">
            <strong>저장하지 못했어요</strong>
            {error.messages.map((message) => (
              <p key={message}>{message}</p>
            ))}
            {error.fixes?.length > 0 && (
              <div className="ob-error__fixes">
                {error.fixes.map((fix) => (
                  <button key={fix.step} type="button" onClick={() => onFix(fix.step)}>
                    {fix.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <ActionBar onConfirm={onConfirm} confirmLabel={saving ? '저장 중…' : '확인'} disabled={saving} />
    </>
  )
}

// ───── 완료 ─────
// placement: 과목 위치 저장 결과. 실패하면 과목은 저장됐다고 알리고 위치 저장만 다시 시도하게 한다.
export function WelcomeStep({ onStart, placement, onRetryPlacement }) {
  const failed = placement?.status === 'failed' || placement?.status === 'retrying'
  const retrying = placement?.status === 'retrying'
  return (
    <div className="ob-welcome">
      <p className="ob-welcome__text">이제 당신만의 여정을 시작할 시간입니다!</p>
      {failed && (
        <div className="ob-error ob-placement" role="alert">
          <strong>과목 위치를 저장하지 못했어요</strong>
          <p>
            선택한 이수 과목 {placement.moves.length}개는 로드맵에 저장됐어요. 다만 학기 안 위치를 정하지 못해
            과목이 겹쳐 보일 수 있어요.
          </p>
          <div className="ob-error__fixes">
            <button type="button" onClick={onRetryPlacement} disabled={retrying}>
              {retrying ? '저장 중…' : '위치 다시 저장하기'}
            </button>
          </div>
        </div>
      )}
      {placement?.status === 'saved' && placement.retried && <Hint>과목 위치를 저장했어요.</Hint>}
      <button type="button" className="ob-primary" onClick={onStart} disabled={retrying}>
        시작하기
      </button>
    </div>
  )
}
