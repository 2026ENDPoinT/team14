import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider.jsx'
import { curriculum } from '../../onboarding/courseRecommendationSlot.js'
import { CAREERS } from '../../onboarding/onboardingOptions.js'
import { petChangeOf, saveDesiredJob } from '../../mypage/desiredJob.js'
import DeadlineBadge from '../../explore/DeadlineBadge.jsx'
import { getMyRecentDiaries, requestAiGuide } from '../../../services/careerRecommendation.js'
import { listOpenJobPostings } from '../../../services/api.js'
import {
  activityMemo,
  buildGuidePayload,
  collectGuideSources,
  DIARY_MAX,
  diaryExcerpt,
  GRADES,
  GUIDE_MODES,
  INTERESTS,
  nodeTypeOf,
  relatedPostings,
  STATUS_LABEL,
  summarizeSources,
} from './guideData.js'
import { SparkleIcon } from './AiGuideButton.jsx'
import './aiGuide.css'

// AI 길잡이 (로드맵 오른쪽 패널)
// - 기존 AI 진로 추천 함수(recommend-career)의 길잡이 모드를 부른다. 새 AI API를 만들지 않는다.
// - 로그인한 사용자의 실제 로드맵(과목·활동·메모)만 쓴다. 예시 로드맵(로그인 전)으로는 분석하지 않는다.
// - 성적·흥미도·일기는 이번 요청에만 쓰고 저장하지 않는다. 일기는 사용자가 켜고 고른 것만 보낸다.
// - 추천 결과로 희망 직무·펫·로드맵을 자동으로 바꾸지 않는다. 사용자가 버튼을 누를 때만 바꾼다.
//
// props
//   signedIn: 내 로드맵(DB)을 보고 있는지
//   nodes, documents: 로드맵 노드·노드 문서 (화면에 있는 값 그대로)
//   onAddActivity({ title, theme, categoryId, memo }): 보관함에 추가 → { ok } 또는 { error }
//   hasActivity(title): 로드맵에 같은 이름 활동이 있는지

const careerTitle = (key) => CAREERS.find((c) => c.id === key)?.title ?? key

export default function AiGuidePanel({ open, onClose, signedIn, nodes, documents, onAddActivity, hasActivity }) {
  const auth = useAuth()
  const profile = auth.profile
  const currentJob = profile?.interests?.find((j) => j && j !== 'undecided') ?? null

  const [mode, setMode] = useState('both')
  const [scores, setScores] = useState({}) // { [courseId]: { grade, interest } } — 화면에만
  const [scoresOpen, setScoresOpen] = useState(false)
  const [includeMemos, setIncludeMemos] = useState(true)
  const [diaryOn, setDiaryOn] = useState(false) // 기본 OFF, 요청마다 다시 끈다
  const [diaries, setDiaries] = useState({ status: 'idle', list: [], error: '' })
  const [pickedDates, setPickedDates] = useState([])
  const [view, setView] = useState('setup') // setup | loading | error | result
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [adds, setAdds] = useState({}) // { [활동 제목]: 'adding' | 'added' | 문구 }
  const [postings, setPostings] = useState({ status: 'idle', list: [] })
  const [jobAsk, setJobAsk] = useState(null) // 희망 직무 변경 확인 중인 직무 키
  const [jobNote, setJobNote] = useState('')
  const [savingJob, setSavingJob] = useState(false)
  const alive = useRef(true)
  const lastPayload = useRef(null)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const sources = useMemo(() => collectGuideSources(nodes, documents, curriculum), [nodes, documents])
  const summary = summarizeSources(sources)

  // 일기 동의를 켰을 때만 내 최근 일기를 불러온다 (끄면 목록·선택을 지운다)
  async function toggleDiary(on) {
    setDiaryOn(on)
    if (!on) {
      setDiaries({ status: 'idle', list: [], error: '' })
      setPickedDates([])
      return
    }
    setDiaries({ status: 'loading', list: [], error: '' })
    const res = await getMyRecentDiaries({ days: 30, limit: 10 })
    if (!alive.current) return
    if (res.error) {
      setDiaries({ status: 'error', list: [], error: res.error.message })
      return
    }
    setDiaries({ status: 'ready', list: res.data, error: '' })
    setPickedDates(res.data.slice(0, DIARY_MAX).map((d) => d.date))
  }

  const setScore = (courseId, key, value) =>
    setScores((prev) => ({ ...prev, [courseId]: { ...prev[courseId], [key]: value || undefined } }))

  async function analyze(payload) {
    if (view === 'loading') return
    lastPayload.current = payload
    setView('loading')
    setError('')
    // 일기 동의는 이번 요청에만: 보낸 뒤 바로 끈다 (다음 분석 때 다시 묻는다)
    setDiaryOn(false)
    setDiaries({ status: 'idle', list: [], error: '' })
    setPickedDates([])
    const res = await requestAiGuide(payload)
    if (!alive.current) return
    if (res.error) {
      setError(res.error.message)
      setView('error')
      return
    }
    setResult(res.data)
    setAdds({})
    setJobAsk(null)
    setJobNote('')
    setView('result')
    loadPostings(res.data)
  }

  function start() {
    const chosen = diaryOn ? diaries.list.filter((d) => pickedDates.includes(d.date)) : []
    analyze(buildGuidePayload({ mode, profile, sources, scores, includeMemos, diaries: chosen }))
  }

  // 관련 공고: 탐색에서 수집해 DB에 저장된 접수 중 공고에서만 고른다 (AI가 만든 공고가 아님)
  async function loadPostings(data) {
    const keys = data.careers.length ? data.careers.map((c) => c.job) : currentJob ? [currentJob] : []
    if (keys.length === 0) {
      setPostings({ status: 'none', list: [] })
      return
    }
    setPostings({ status: 'loading', list: [] })
    const res = await listOpenJobPostings()
    if (!alive.current) return
    if (res.error) {
      setPostings({ status: 'error', list: [] })
      return
    }
    setPostings({ status: 'ready', list: relatedPostings(res.data, keys) })
  }

  async function addActivity(activity) {
    if (adds[activity.title] === 'adding' || adds[activity.title] === 'added') return
    setAdds((prev) => ({ ...prev, [activity.title]: 'adding' }))
    const type = nodeTypeOf(activity.category)
    const res = await onAddActivity({ title: activity.title, theme: type.theme, categoryId: type.categoryId, memo: activityMemo(activity) })
    if (!alive.current) return
    setAdds((prev) => ({ ...prev, [activity.title]: res.ok ? 'added' : res.error }))
  }

  async function changeJob(job) {
    if (savingJob) return
    setSavingJob(true)
    try {
      const saved = await saveDesiredJob(currentJob, job, { signedIn: true, applyProfile: auth.applyProfile })
      if (!alive.current) return
      setJobAsk(null)
      setJobNote(saved.error ?? `희망 직무를 ${careerTitle(job)}(으)로 바꿨어요. ${saved.petMessage} 온기와 성장 단계는 그대로예요.`)
    } catch (err) {
      if (alive.current) setJobNote(`저장 중 오류가 발생했어요: ${err instanceof Error ? err.message : '다시 시도해 주세요.'}`)
    } finally {
      if (alive.current) setSavingJob(false)
    }
  }

  if (!open) return null

  return (
    <div className="ag-layer">
      <button type="button" className="ag-backdrop" aria-label="AI 길잡이 닫기" onClick={onClose} />
      <aside className="ag-panel" role="dialog" aria-modal="true" aria-label="AI 길잡이">
        <header className="ag-head">
          <span className="ag-head__title">
            <SparkleIcon />
            AI 길잡이
          </span>
          <button type="button" className="ag-close" onClick={onClose} aria-label="닫기">✕</button>
        </header>

        <div className="ag-body">
          {!signedIn ? (
            <div className="ag-empty" role="status">
              <strong>로그인하면 내 로드맵으로 분석할 수 있어요</strong>
              <span>지금 보이는 예시 로드맵으로는 AI 분석을 하지 않아요.</span>
            </div>
          ) : view === 'loading' ? (
            <div className="ag-empty" role="status" aria-live="polite">
              <span className="ag-spinner" aria-hidden="true" />
              <strong>로드맵을 살펴보는 중이에요…</strong>
              <span>보통 10초 안팎 걸려요.</span>
            </div>
          ) : view === 'error' ? (
            <div className="ag-empty" role="alert">
              <strong>AI 분석을 받지 못했어요</strong>
              <span>{error}</span>
              <div className="ag-row">
                <button type="button" className="ag-primary" onClick={() => analyze({ ...lastPayload.current, diary: [] })}>다시 시도</button>
                <button type="button" className="ag-ghost" onClick={() => setView('setup')}>설정으로</button>
              </div>
              <span className="ag-muted">다시 시도하면 일기는 보내지 않아요. 일기를 함께 보내려면 설정에서 다시 켜 주세요.</span>
            </div>
          ) : view === 'result' && result ? (
            <GuideResult
              result={result}
              currentJob={currentJob}
              adds={adds}
              hasActivity={hasActivity}
              onAdd={addActivity}
              postings={postings}
              jobAsk={jobAsk}
              jobNote={jobNote}
              onAskJob={(job) => { setJobAsk(job); setJobNote('') }}
              onCancelJob={() => setJobAsk(null)}
              onChangeJob={changeJob}
              onRestart={() => setView('setup')}
            />
          ) : (
            <>
              <section className="ag-section" aria-label="분석 방식">
                <h3 className="ag-label">무엇을 알아볼까요?</h3>
                <div className="ag-modes" role="radiogroup">
                  {GUIDE_MODES.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      role="radio"
                      aria-checked={mode === m.id}
                      className={`ag-mode ${mode === m.id ? 'is-selected' : ''}`}
                      onClick={() => setMode(m.id)}
                    >
                      <strong>{m.title}{m.id === 'both' && <em> 기본</em>}</strong>
                      <span>{m.desc}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="ag-section" aria-label="활용할 정보">
                <h3 className="ag-label">이 정보로 분석해요</h3>
                <ul className="ag-facts">
                  <li><span>학년</span>{Number.isInteger(profile?.grade) ? `${profile.grade}학년` : '정보 없음'}</li>
                  <li><span>희망 직무</span>{currentJob ? careerTitle(currentJob) : '아직 정하지 않음'}</li>
                  <li><span>전공</span>컴퓨터공학 교과과정 기준 (전공 정보는 따로 저장돼 있지 않아요)</li>
                  <li>
                    <span>전공 과목</span>
                    {summary.courses ? `${summary.courses}개 · 완료 ${summary.coursesDone} · 계획 ${summary.coursesPlanned}` : '없음'}
                  </li>
                  <li>
                    <span>활동</span>
                    {summary.activities
                      ? `${summary.activities}개 · 완료 ${summary.activitiesDone} · 계획 ${summary.activitiesPlanned} · 보관함 ${summary.activitiesIdea}`
                      : '없음'}
                  </li>
                </ul>
                <p className="ag-muted">완료로 표시한 것만 ‘해 본 경험’으로 보고, 학기에 놓인 것은 ‘계획’으로 봐요.</p>
                {summary.memos > 0 && (
                  <label className="ag-check">
                    <input type="checkbox" checked={includeMemos} onChange={(e) => setIncludeMemos(e.target.checked)} />
                    활동 메모 {summary.memos}개도 함께 보내기 (각 앞부분 120자)
                  </label>
                )}
              </section>

              <section className="ag-section" aria-label="성적·흥미도">
                <button
                  type="button"
                  className="ag-fold"
                  aria-expanded={scoresOpen}
                  onClick={() => setScoresOpen((v) => !v)}
                >
                  과목별 성적·흥미도 <em>선택</em>
                  <span aria-hidden="true">{scoresOpen ? '−' : '+'}</span>
                </button>
                {scoresOpen && (
                  <div className="ag-scores">
                    {sources.courses.length === 0 ? (
                      <p className="ag-muted">로드맵에 전공 과목이 없어요. 성적 없이도 분석할 수 있어요.</p>
                    ) : (
                      <>
                        <p className="ag-muted">
                          일부만 입력해도 돼요. 성적은 ‘완료’한 과목만 입력할 수 있고, 이번 분석에만 쓰고 저장하지 않아요.
                        </p>
                        {sources.courses.map((c) => (
                          <div key={c.id} className="ag-score">
                            <span className="ag-score__title">
                              {c.title}
                              <i className={`ag-pill is-${c.status}`}>{STATUS_LABEL[c.status]}</i>
                            </span>
                            {c.status === 'done' ? (
                              <select
                                aria-label={`${c.title} 성적`}
                                value={scores[c.id]?.grade ?? ''}
                                onChange={(e) => setScore(c.id, 'grade', e.target.value)}
                              >
                                <option value="">성적 미입력</option>
                                {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
                              </select>
                            ) : (
                              <span className="ag-score__na" title="완료로 표시한 과목만 성적을 입력할 수 있어요">수강 전</span>
                            )}
                            <select
                              aria-label={`${c.title} 흥미도`}
                              value={scores[c.id]?.interest ?? ''}
                              onChange={(e) => setScore(c.id, 'interest', Number(e.target.value) || undefined)}
                            >
                              <option value="">흥미 미입력</option>
                              {INTERESTS.map((n) => <option key={n} value={n}>흥미 {n}</option>)}
                            </select>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </section>

              <section className="ag-section" aria-label="일기 분석 동의">
                <label className="ag-check ag-check--strong">
                  <input type="checkbox" checked={diaryOn} onChange={(e) => toggleDiary(e.target.checked)} />
                  내 일기도 함께 분석하기
                </label>
                <p className="ag-muted">
                  켜면 최근 30일 일기 중 고른 것(최대 {DIARY_MAX}개, 각 300자)만 이번 분석에 보내요. 일기와 분석 결과는 저장하지 않아요.
                </p>
                {diaryOn && (
                  <div className="ag-diary">
                    {diaries.status === 'loading' && <p className="ag-muted">일기를 불러오는 중…</p>}
                    {diaries.status === 'error' && <p className="ag-warn" role="alert">{diaries.error} 일기 없이 분석해요.</p>}
                    {diaries.status === 'ready' && diaries.list.length === 0 && (
                      <p className="ag-muted">최근 30일에 저장된 일기가 없어요. 일기 없이 분석해요.</p>
                    )}
                    {diaries.status === 'ready' && diaries.list.length > 0 && (
                      <>
                        <p className="ag-muted">AI에 보낼 내용이에요. 보내지 않을 일기는 체크를 풀어 주세요.</p>
                        {diaries.list.map((d) => {
                          const checked = pickedDates.includes(d.date)
                          const full = !checked && pickedDates.length >= DIARY_MAX
                          return (
                            <label key={d.date} className={`ag-diary__item ${full ? 'is-disabled' : ''}`}>
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={full}
                                onChange={() => setPickedDates((prev) => (checked ? prev.filter((x) => x !== d.date) : [...prev, d.date]))}
                              />
                              <span>
                                <b>{d.date}</b>
                                {diaryExcerpt(d).text}
                              </span>
                            </label>
                          )
                        })}
                      </>
                    )}
                  </div>
                )}
              </section>

              <div className="ag-actions">
                <button type="button" className="ag-primary" onClick={start} disabled={diaryOn && diaries.status === 'loading'}>
                  <SparkleIcon />
                  분석하기
                </button>
                <span className="ag-muted">AI 결과는 참고용이에요. 희망 직무·펫·로드맵은 자동으로 바뀌지 않아요.</span>
              </div>
            </>
          )}
          {signedIn && view !== 'loading' && (
            <section className="ag-section ag-manual-careers" aria-label="전체 직무 직접 선택">
              <h3 className="ag-label">내가 원하는 직무 직접 선택하기</h3>
              <p className="ag-muted">AI 추천 여부와 상관없이 10개 직무 중 원하는 진로를 선택할 수 있어요. 선택 후 저장해야 희망 직무가 바뀝니다.</p>
              <div className="ag-manual-careers__grid">
                {CAREERS.filter((c) => c.id !== 'undecided').map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    className={`ag-manual-careers__option ${jobAsk === c.id ? 'is-selected' : ''} ${currentJob === c.id ? 'is-current' : ''}`}
                    aria-pressed={jobAsk === c.id}
                    onClick={() => { setJobAsk(c.id); setJobNote('') }}
                  >
                    <span>{c.title}</span>
                    {currentJob === c.id && <small>현재 선택</small>}
                  </button>
                ))}
              </div>
              {jobAsk && (
                <div className="ag-manual-careers__confirm">
                  {jobAsk === currentJob ? (
                    <span>이미 설정된 희망 직무예요.</span>
                  ) : (
                    <span>{careerTitle(jobAsk)}(으)로 변경할까요? {petChangeOf(currentJob, jobAsk)?.preview ?? ''} 온기와 성장 단계는 유지돼요.</span>
                  )}
                  <div className="ag-row">
                    <button type="button" className="ag-primary ag-small" disabled={savingJob || jobAsk === currentJob} onClick={() => changeJob(jobAsk)}>
                      {savingJob ? '저장 중…' : '이 직무로 저장'}
                    </button>
                    <button type="button" className="ag-ghost ag-small" disabled={savingJob} onClick={() => setJobAsk(null)}>취소</button>
                  </div>
                </div>
              )}
              {jobNote && <p className="ag-note" role="status">{jobNote}</p>}
            </section>
          )}
        </div>
      </aside>
    </div>
  )
}

function Evidence({ list }) {
  if (!list.length) return <p className="ag-muted ag-evidence">근거로 쓸 기록이 아직 적어서, 일반적인 제안이에요.</p>
  return (
    <div className="ag-evidence" aria-label="근거">
      <span>근거</span>
      {list.map((x) => <i key={x} className="ag-tag">{x}</i>)}
    </div>
  )
}

function GuideResult({
  result, currentJob, adds, hasActivity, onAdd, postings,
  jobAsk, jobNote, onAskJob, onCancelJob, onChangeJob, onRestart,
}) {
  return (
    <div className="ag-result">
      {result.careers.length > 0 && (
        <section className="ag-section" aria-label="추천 직무">
          <h3 className="ag-label">어울리는 직무</h3>
          {result.careers.map((c) => {
            const preview = petChangeOf(currentJob, c.job)
            return (
              <article key={c.job} className="ag-card">
                <header className="ag-card__head">
                  <strong>{careerTitle(c.job)}</strong>
                  {c.job === currentJob && <i className="ag-pill is-done">지금 희망 직무</i>}
                </header>
                <p>{c.reason}</p>
                <dl className="ag-dl">
                  <dt>강점</dt><dd>{c.strengths.join(' · ')}</dd>
                  <dt>보완하면 좋은 역량</dt><dd>{c.gaps.join(' · ')}</dd>
                  <dt>추천 학습·활동</dt><dd>{c.actions.join(' · ')}</dd>
                </dl>
                <Evidence list={c.basedOn} />
                {c.job !== currentJob && preview && (
                  jobAsk === c.job ? (
                    <div className="ag-confirm" role="group" aria-label="희망 직무 변경 확인">
                      <span>희망 직무를 {careerTitle(c.job)}(으)로 바꿀까요? {preview.preview} 모은 온기와 성장 단계는 그대로예요.</span>
                      <div className="ag-row">
                        <button type="button" className="ag-primary ag-small" onClick={() => onChangeJob(c.job)}>바꾸기</button>
                        <button type="button" className="ag-ghost ag-small" onClick={onCancelJob}>취소</button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" className="ag-ghost ag-small" onClick={() => onAskJob(c.job)}>희망 직무로 설정…</button>
                  )
                )}
              </article>
            )
          })}
        </section>
      )}

      {result.activities.length > 0 && (
        <section className="ag-section" aria-label="추천 활동">
          <h3 className="ag-label">앞으로 해 볼 활동</h3>
          {result.activities.map((a) => {
            const state = adds[a.title]
            const exists = state !== 'added' && hasActivity(a.title)
            return (
              <article key={a.title} className="ag-card">
                <header className="ag-card__head">
                  <strong>{a.title}</strong>
                  <i className={`ag-pill is-${a.difficulty}`}>{a.difficulty}</i>
                </header>
                <p className="ag-meta">{nodeTypeOf(a.category).label} · 권장 시점(제안): {a.timing.replace(/\s*\(제안\)\s*$/, '')}</p>
                <p>{a.reason}</p>
                <Evidence list={a.basedOn} />
                <dl className="ag-dl">
                  <dt>얻을 수 있는 것</dt><dd>{a.gains.join(' · ')}</dd>
                  <dt>지금 할 첫 단계</dt><dd>{a.firstStep}</dd>
                </dl>
                <div className="ag-row">
                  <button
                    type="button"
                    className={`ag-add ${state === 'added' ? 'is-added' : ''}`}
                    disabled={state === 'adding' || state === 'added' || exists}
                    onClick={() => onAdd(a)}
                  >
                    {state === 'added' ? '✓ 보관함에 추가됨' : state === 'adding' ? '추가하는 중…' : exists ? '이미 로드맵에 있어요' : '보관함에 추가'}
                  </button>
                  {state && state !== 'adding' && state !== 'added' && <span className="ag-warn" role="alert">{state}</span>}
                </div>
              </article>
            )
          })}
          <p className="ag-muted">보관함에 넣은 활동은 학기에 자동으로 놓이지 않아요. 원하는 학기로 직접 끌어 놓아 주세요.</p>
        </section>
      )}

      <section className="ag-section" aria-label="관련 채용 공고">
        <h3 className="ag-label">관련 채용 공고</h3>
        {postings.status === 'loading' && <p className="ag-muted">공고를 찾는 중…</p>}
        {postings.status === 'error' && <p className="ag-muted">공고를 불러오지 못했어요.</p>}
        {postings.status === 'none' && <p className="ag-muted">희망 직무가 정해지면 관련 공고를 보여 드려요.</p>}
        {postings.status === 'ready' && postings.list.length === 0 && <p className="ag-muted">지금 접수 중인 관련 공고가 없어요.</p>}
        {postings.status === 'ready' && postings.list.map((p) => (
          <a key={p.id} className="ag-posting" href={p.url} target="_blank" rel="noopener noreferrer">
            <span className="ag-posting__title">{p.title}</span>
            <span className="ag-posting__meta">
              {p.company && <span>{p.company}</span>}
              <DeadlineBadge deadline={p.deadline} small />
              <span aria-hidden="true">↗</span>
            </span>
          </a>
        ))}
        <p className="ag-muted">탐색에서 수집한 고용24 공고 중 마감 전인 것만 보여 줘요. AI가 만든 공고가 아니에요.</p>
      </section>

      <div className="ag-actions">
        <button type="button" className="ag-ghost" onClick={onRestart}>다시 분석하기</button>
        <span className="ag-muted">이 결과는 저장되지 않아요. 창을 닫으면 사라져요.</span>
      </div>
    </div>
  )
}
