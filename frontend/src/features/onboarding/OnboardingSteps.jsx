import { useState } from 'react'
import { ActionBar, Bubble, Chip, Hint, StepTitle } from './OnboardingParts.jsx'
import { CAREERS, EXPERIENCE_GROUPS, TERMS } from './onboardingOptions.js'
import { GRADE_OPTIONS, MIN_GRADED_COURSES } from './careerKeywords.js'

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

// ───── 3-1. AI 진로 추천: 이수 과목 중 고른 과목의 성적 → 추천 (건너뛰기 가능) ─────
// 성적은 화면 상태로만 가지고 있다. (저장·전송하지 않는다. 추천 요청에는 역량 키워드만 간다)
// ai: { status: 'idle' | 'loading' | 'result' | 'error', result, error }
// context: 'onboarding'(온보딩 단계) | 'home'(홈에서 다시 추천)
//   home에서는 결과 화면을 쓰지 않고(부모가 CareerAiResult로 보여 준다), 문구·버튼만 바뀐다.
//   home 전용 콜백: onAddCourses(이수 과목 3개 미만일 때), onShowPrevious(실패 시 직전 결과 보기, 없으면 null)
const COUNT_WORDS = ['', '한', '두', '세']

// 추천 결과 카드 (온보딩·홈 공통). label: 카드 위 작은 제목, time: 추천 시각 문구(선택)
export function CareerAiResult({ result, label = '추천 진로', time }) {
  const job = CAREERS.find((c) => c.id === result.job)
  return (
    <section className="ob-ai-result" aria-label="AI 추천 결과">
      <span className="ob-ai-result__label">{label}{time && ` · ${time}`}</span>
      <strong className="ob-ai-result__job">{job?.title ?? result.job}</strong>
      <p className="ob-ai-result__reason">{result.reason}</p>
      {result.basedOn?.length > 0 && (
        <div className="ob-picked__list" aria-label="근거 역량">
          {result.basedOn.map((k) => (
            <span key={k} className="ob-ai-result__keyword">{k}</span>
          ))}
        </div>
      )}
    </section>
  )
}

export function CareerAiStep({
  context = 'onboarding', courses, pickedKeys, grades, ai,
  onTogglePick, onGrade, onRequest, onAccept, onChooseOther, onSkip, onAddCourses, onShowPrevious,
}) {
  const home = context === 'home'
  const picked = courses.filter((c) => pickedKeys.includes(c.key))
  const gradedCount = picked.filter((c) => grades[c.key]).length
  const remaining = Math.max(0, MIN_GRADED_COURSES - gradedCount)
  const loading = ai.status === 'loading'

  if (!home && ai.status === 'result') {
    return (
      <>
        <StepTitle>AI가 추천하는 진로예요.</StepTitle>
        <div className="ob-body">
          <CareerAiResult result={ai.result} />
          <p className="ob-ai-question">이 진로로 로드맵을 구상할까요?</p>
          <Hint>AI 추천은 참고용이에요. 입력한 과목의 역량만 보고 고른 결과예요.</Hint>
        </div>
        <div className="ob-actions">
          <button type="button" className="ob-primary" onClick={onAccept}>이 진로로 계속</button>
          <button type="button" className="ob-skip" onClick={onChooseOther}>다른 진로 선택</button>
        </div>
      </>
    )
  }

  return (
    <>
      <StepTitle>
        성적을 바탕으로 어울리는 진로를 {home && onShowPrevious ? '다시 ' : ''}추천해 드릴게요.
        <br />
        진로 추천에 반영할 과목을 3개 이상 골라 주세요.
      </StepTitle>
      <div className="ob-body">
        {courses.length < MIN_GRADED_COURSES ? (
          <div className="ob-empty">
            <strong>이수 과목이 {MIN_GRADED_COURSES}개 미만이에요</strong>
            {home ? (
              <>
                <span>
                  AI 추천에는 이수 과목 {MIN_GRADED_COURSES}개 이상의 성적이 필요해요. 지금 이수 과목은 {courses.length}개예요.
                  로드맵에서 [+] → ‘전공·학업’으로 교과목을 추가하고 완료로 표시하면 여기에 나타나요.
                </span>
                <button type="button" className="ob-empty__action" onClick={onAddCourses}>로드맵에서 과목 추가하기</button>
              </>
            ) : (
              <span>AI 추천에는 {MIN_GRADED_COURSES}과목 이상의 성적이 필요해요. 건너뛰고 직접 직무를 골라 주세요.</span>
            )}
          </div>
        ) : (
          <>
            <section className="ob-section" aria-label="추천에 반영할 과목">
              <h2 className="ob-section__title">이수한 과목</h2>
              <div className="ob-chips">
                {courses.map((course) => (
                  <Chip key={course.key} selected={pickedKeys.includes(course.key)} onClick={() => onTogglePick(course.key)}>
                    {course.title}
                  </Chip>
                ))}
              </div>
            </section>

            {picked.length > 0 && (
              <section className="ob-section" aria-label="성적 입력">
                <h2 className="ob-section__title">성적 등급</h2>
                <div className="ob-grades">
                  {picked.map((course) => (
                    <label key={course.key} className="ob-grade">
                      <span>{course.title}</span>
                      <select
                        aria-label={`${course.title} 성적`}
                        value={grades[course.key] ?? ''}
                        onChange={(e) => onGrade(course.key, e.target.value)}
                      >
                        <option value="">등급 선택</option>
                        {GRADE_OPTIONS.map((g) => (
                          <option key={g.id} value={g.id}>{g.id}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </section>
            )}

            <p className="ob-ai-count" aria-live="polite">
              {remaining > 0
                ? `${COUNT_WORDS[remaining] ?? remaining} 과목 더 입력하면 추천을 받을 수 있어요. (입력 ${gradedCount}개)`
                : `성적을 입력한 ${gradedCount}과목으로 추천을 받을 수 있어요.`}
            </p>
          </>
        )}

        {ai.status === 'error' && (
          <div className="ob-error" role="alert">
            <strong>AI 추천을 받지 못했어요</strong>
            <p>{ai.error.message}</p>
            {home ? (
              onShowPrevious && (
                <div className="ob-error__fixes">
                  <button type="button" onClick={onShowPrevious}>직전 추천 결과 보기</button>
                </div>
              )
            ) : (
              <div className="ob-error__fixes">
                <button type="button" onClick={onChooseOther}>직무 직접 선택하기</button>
              </div>
            )}
          </div>
        )}
        <Hint>
          성적은 이 브라우저에서만 쓰고 저장하지 않아요. AI에는 과목에서 뽑은 역량 키워드만 보내요.
          {home && ' 추천을 받아도 희망 직무와 로드맵은 바뀌지 않아요.'}
        </Hint>
      </div>
      <ActionBar
        onConfirm={onRequest}
        confirmLabel={loading ? '추천 받는 중…' : 'AI 진로 추천 받기'}
        disabled={remaining > 0 || loading || courses.length < MIN_GRADED_COURSES}
        onSkip={onSkip}
        skipLabel={home ? '닫기' : undefined}
      />
    </>
  )
}

// ───── 4. 희망 직무: 대표 1개 (필수, 건너뛰기 없음) ─────
export function CareerStep({ selectedId, onSelect, onNext, onStartBasic }) {
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
        {/* 직무를 정하지 못했어도 시작할 수 있다: 전공 교과목 중심 기본 로드맵 (희망 직무는 나중에 마이페이지에서) */}
        {onStartBasic && (
          <div className="ob-undecided">
            <span>아직 관심 분야를 정하지 못했나요?</span>
            <button type="button" className="ob-undecided__btn" onClick={onStartBasic}>기본 로드맵으로 시작하기</button>
          </div>
        )}
      </div>
      {/* 직무를 하나 골라야 다음으로 갈 수 있다 ('아직 정하지 않음'도 하나의 선택지) */}
      <ActionBar onConfirm={onNext} disabled={!selectedId} />
    </>
  )
}

// ───── 5. 함께할 펫 (마지막 단계) ─────
// - 직무를 고른 사용자: 직무별로 배정된 펫(autoPet)을 보여 주고 바로 완료
// - 직무 미정(또는 펫이 정해지지 않는 직무): 5종 중 직접 고른다. 고르기 전에는 완료 버튼 비활성화
// 저장·완료 처리는 OnboardingPage가 맡는다 (로드맵 생성 + 고른 펫 저장)
export function PetStep({ autoPet, choice, onChoose, pets, saving, error, onFix, onConfirm }) {
  const choosing = !autoPet
  const shown = autoPet ? pets.filter((p) => p.key === autoPet) : pets
  const selected = autoPet ?? choice
  return (
    <>
      <StepTitle>앞으로 함께할 친구를 만나보세요</StepTitle>
      <div className="ob-body">
        <Hint>
          {choosing
            ? '아직 진로를 정하지 않아도 괜찮아요. 마음에 드는 친구와 함께 시작해 보세요.'
            : '선택한 관심 분야에 어울리는 친구가 기다리고 있어요.'}
        </Hint>
        <div className={`ob-pets ${choosing ? '' : 'is-single'}`} role={choosing ? 'radiogroup' : undefined} aria-label="함께할 펫">
          {shown.map((p) => (
            <button
              key={p.key}
              type="button"
              role={choosing ? 'radio' : undefined}
              aria-checked={choosing ? selected === p.key : undefined}
              className={`ob-pet ${selected === p.key ? 'is-selected' : ''}`}
              onClick={choosing ? () => onChoose(p.key) : undefined}
              disabled={!choosing}
            >
              {p.image ? <img className="ob-pet__img" src={p.image} alt="" draggable="false" /> : <span className="ob-pet__img" />}
              <strong>{p.label}</strong>
            </button>
          ))}
        </div>

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
      <ActionBar onConfirm={onConfirm} confirmLabel={saving ? '저장 중…' : '모멘트리 시작하기'} disabled={saving || !selected} />
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
