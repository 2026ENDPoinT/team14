import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import DeadlineBadge from '../features/explore/DeadlineBadge.jsx'
import { addBlockReason, sourceName } from '../features/explore/contestInfo.js'
import { pickCsJobs } from '../features/explore/csJobFilter.js'
import { fieldLabelsOf } from '../features/explore/jobField.js'
import {
  addContestToRoadmap,
  addJobPostingToRoadmap,
  getMyContestNodeIds,
  getMyJobPostingNodeIds,
  getTechArticle,
  isSupabaseConfigured,
  listOpenContests,
  listOpenJobPostings,
  listTechArticles,
} from '../services/api.js'
import '../features/roadmap/roadmap.css' // 로드맵과 같은 색·글꼴
import '../features/explore/explore.css'

// 상단 탭 3개. 처음에는 대외활동 탭을 보여 준다.
const TABS = [
  { key: 'contests', label: '대외활동' },
  { key: 'articles', label: '기술 뉴스' },
  { key: 'jobs', label: '채용' },
]
const JOB_LIMIT = 50 // 채용 탭에 보여 줄 최대 건수 (컴공 관련 공고를 고른 뒤 자른다)
const NEWS_SCROLL_KEY = 'campusRoadmap.explore.newsScroll' // 뉴스 상세로 가기 전 목록 스크롤 위치 (돌아오면 복원)

// 로드맵에 추가하는 함수 (종류별). 화면 상태 키는 '<종류>:<공고 id>'
const ADD_TO_ROADMAP = { contest: addContestToRoadmap, job: addJobPostingToRoadmap }

// 조회 결과 → 탭별 상태. 한 탭이 실패해도 다른 탭에는 영향이 없다.
const toList = (result) => {
  if (!result.error) return { state: 'ready', items: result.data }
  return { state: result.error.code === 'UNAUTHENTICATED' ? 'login' : 'error', items: [] }
}
const LOADING = { state: isSupabaseConfigured ? 'loading' : 'no-config', items: [] }

// { [공고 id]: 노드 id } → { '<종류>:<공고 id>': 노드 id }
const prefixKeys = (kind, map) => Object.fromEntries(Object.entries(map).map(([id, nodeId]) => [`${kind}:${id}`, nodeId]))

// 탐색: [대외활동] [기술 뉴스] [채용] 탭 중 선택한 탭의 목록만 보여 준다.
// - 대외활동: 접수 중, 마감 임박순. 분류와 상관없이 모두 '내 로드맵에 추가'할 수 있다.
// - 기술 뉴스: 최신순. 내 관심 분야와 맞는 글이 먼저 온다.
// - 채용: 고용24 공채속보 중 컴퓨터공학 관련 직무만, 마감 임박순 최대 50건. 제목을 누르면 원문, 버튼으로 로드맵 추가.
// 주소: /explore?tab=<탭> (탭을 주소에 둬서 뒤로 가기·새로고침 때 같은 탭으로 돌아온다)
//       /explore?tab=articles&news=<글 id> → 기술 뉴스 상세 (App.jsx 라우트를 바꾸지 않고 이 화면 안에서 연다)
export default function ExplorePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const tabParam = searchParams.get('tab')
  const tab = TABS.some((t) => t.key === tabParam) ? tabParam : 'contests'
  const newsId = searchParams.get('news')
  const setTab = useCallback((key) => setSearchParams({ tab: key }, { replace: true }), [setSearchParams])
  const scrollRef = useRef(null) // 이 화면의 스크롤 영역 (.explore-page)
  const [contests, setContests] = useState(LOADING)
  const [articles, setArticles] = useState(LOADING)
  const [jobs, setJobs] = useState(LOADING)
  const [addedNodes, setAddedNodes] = useState({}) // '<종류>:<공고 id>' → 로드맵 노드 id
  const [pending, setPending] = useState({}) // '<종류>:<공고 id>' → true (저장 중)
  const [errors, setErrors] = useState({}) // '<종류>:<공고 id>' → 오류 문구
  const pendingRef = useRef(new Set()) // 연속 클릭 막기 (화면 갱신 전 두 번째 클릭도 막는다)
  const tabRefs = useRef({})

  // 세 목록을 한꺼번에 따로따로 불러온다 (탭을 바꿀 때 기다리지 않게)
  useEffect(() => {
    if (!isSupabaseConfigured) return undefined
    let cancelled = false
    Promise.all([listOpenContests(50), getMyContestNodeIds()]).then(([c, mine]) => {
      if (cancelled) return
      const failed = [c, mine].find((r) => r.error)
      setContests(toList(failed ?? c))
      if (!failed) setAddedNodes((m) => ({ ...m, ...prefixKeys('contest', mine.data) }))
    })
    listTechArticles(30).then((a) => { if (!cancelled) setArticles(toList(a)) })
    Promise.all([listOpenJobPostings(), getMyJobPostingNodeIds()]).then(([j, mine]) => {
      if (cancelled) return
      const failed = [j, mine].find((r) => r.error)
      const list = toList(failed ?? j)
      setJobs({ ...list, items: pickCsJobs(list.items, JOB_LIMIT) })
      if (!failed) setAddedNodes((m) => ({ ...m, ...prefixKeys('job', mine.data) }))
    })
    return () => { cancelled = true }
  }, [])

  const handleAdd = useCallback(async (kind, id) => {
    const key = `${kind}:${id}`
    if (pendingRef.current.has(key)) return
    pendingRef.current.add(key)
    setPending((p) => ({ ...p, [key]: true }))
    setErrors((e) => ({ ...e, [key]: null }))
    const result = await ADD_TO_ROADMAP[kind](id)
    pendingRef.current.delete(key)
    setPending((p) => ({ ...p, [key]: false }))
    if (result.error) {
      setErrors((e) => ({ ...e, [key]: result.error.message }))
      return
    }
    setAddedNodes((m) => ({ ...m, [key]: result.data.nodeId }))
  }, [])

  // 카드의 [내 로드맵에 추가] 영역 (대외활동·채용 공통)
  const addButton = (kind, item, blockReason) => {
    const key = `${kind}:${item.id}`
    return (
      <AddToRoadmap
        nodeId={addedNodes[key]}
        pending={pending[key]}
        error={errors[key]}
        blockReason={blockReason}
        onAdd={() => handleAdd(kind, item.id)}
      />
    )
  }

  // 뉴스 상세 열기: 지금 목록 스크롤 위치를 기억해 두고 상세 주소로 이동 (뒤로 가기로 돌아올 수 있게 기록을 남긴다)
  const rememberNewsScroll = () => {
    try { sessionStorage.setItem(NEWS_SCROLL_KEY, String(scrollRef.current?.scrollTop ?? 0)) } catch { /* 저장 못 해도 이동은 한다 */ }
  }

  // 상세 → 목록: 목록에서 들어왔으면 브라우저 뒤로 가기와 같게, 주소로 바로 들어왔으면 기술 뉴스 탭으로
  const backToNews = () => {
    if (location.state?.fromNewsList) navigate(-1)
    else navigate('/explore?tab=articles', { replace: true })
  }

  // 상세를 열면 맨 위부터, 목록으로 돌아오면 기억한 스크롤 위치로 (목록이 그려진 뒤에)
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (newsId) { el.scrollTop = 0; return }
    if (tab !== 'articles' || articles.state !== 'ready') return
    let saved = null
    try { saved = sessionStorage.getItem(NEWS_SCROLL_KEY); sessionStorage.removeItem(NEWS_SCROLL_KEY) } catch { /* 없음 */ }
    if (saved !== null) el.scrollTop = Number(saved) || 0
  }, [newsId, tab, articles.state])

  // 탭 키보드 이동: ←/→ 로 옆 탭, Home/End 로 처음/끝 탭
  const handleTabKey = (event) => {
    const index = TABS.findIndex((t) => t.key === tab)
    const next = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: TABS.length - 1 }[event.key]
    if (next === undefined) return
    event.preventDefault()
    const key = TABS[(next + TABS.length) % TABS.length].key
    setTab(key)
    tabRefs.current[key]?.focus()
  }

  if (newsId) {
    return (
      <div className="roadmap-page explore-page" ref={scrollRef}>
        <main className="ex-main">
          <NewsDetail id={newsId} fromList={articles.items.find((a) => a.id === newsId)} onBack={backToNews} />
        </main>
      </div>
    )
  }

  return (
    <div className="roadmap-page explore-page" ref={scrollRef}>
      <main className="ex-main">
        <header className="ex-head">
          <p className="rm-eyebrow">대외활동 · 기술 소식</p>
          <h1 className="ex-title">기회 탐색</h1>
          <p className="rm-muted">내 관심 분야와 맞는 글이 먼저 보여요.</p>
        </header>

        <div className="ex-tabs" role="tablist" aria-label="탐색 목록" onKeyDown={handleTabKey}>
          {TABS.map((t) => (
            <button
              key={t.key}
              ref={(el) => { tabRefs.current[t.key] = el }}
              type="button"
              role="tab"
              id={`ex-tab-${t.key}`}
              className="ex-tab"
              aria-selected={tab === t.key}
              aria-controls={`ex-panel-${t.key}`}
              tabIndex={tab === t.key ? 0 : -1}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <section id="ex-panel-contests" role="tabpanel" aria-labelledby="ex-tab-contests" className="ex-panel" hidden={tab !== 'contests'}>
          <p className="ex-panel__hint">접수 중 · 마감 임박순</p>
          <ListStatus list={contests} empty="지금 접수 중인 공고가 없어요." />
          <ul className="ex-list">
            {contests.items.map((c) => (
              <li key={c.id} className="ex-card" data-testid="contest-card" data-contest-id={c.id}>
                <div className="ex-card__meta">
                  {c.sourceTag && <span className="ex-tag">{c.sourceTag}</span>}
                  <DeadlineBadge deadline={c.deadline} status={c.sourceStatus} />
                  {c.matchesInterest && <span className="ex-interest">관심 분야</span>}
                </div>
                <a className="ex-card__title" href={c.url} target="_blank" rel="noopener noreferrer"><FieldTitle title={c.title} /></a>
                <p className="ex-card__sub">{sourceName(c.source)} · 마감 {c.deadline ?? '정보 없음'}</p>
                {addButton('contest', c, addBlockReason({ deadline: c.deadline, status: c.sourceStatus }))}
              </li>
            ))}
          </ul>
        </section>

        <section id="ex-panel-articles" role="tabpanel" aria-labelledby="ex-tab-articles" className="ex-panel" hidden={tab !== 'articles'}>
          <p className="ex-panel__hint">최신순</p>
          <ListStatus list={articles} empty="아직 기술 뉴스가 없어요." />
          <ul className="ex-list">
            {articles.items.map((a) => (
              <li key={a.id} className="ex-card ex-card--article" data-testid="article-card">
                <div className="ex-card__meta">
                  <span className="ex-tag">{a.sourceName}</span>
                  {a.matchesInterest && <span className="ex-interest">관심 분야</span>}
                </div>
                {/* [분야] 원제. 누르면 서비스 안의 뉴스 상세 */}
                <Link
                  className="ex-card__title"
                  to={`/explore?tab=articles&news=${a.id}`}
                  state={{ fromNewsList: true }}
                  onClick={rememberNewsScroll}
                >
                  <FieldTitle title={a.title} />
                </Link>
                <p className="ex-card__sub">{formatKst(a.publishedAt)}</p>
              </li>
            ))}
          </ul>
        </section>

        <section id="ex-panel-jobs" role="tabpanel" aria-labelledby="ex-tab-jobs" className="ex-panel" hidden={tab !== 'jobs'}>
          <p className="ex-panel__hint">고용24 공채속보 중 컴퓨터공학 관련 직무 · 마감 임박순</p>
          <ListStatus list={jobs} empty="현재 접수 중인 컴공 관련 채용 공고가 없어요." />
          <ul className="ex-list">
            {jobs.items.map((job) => (
              <li key={job.id} className="ex-card" data-testid="job-card" data-job-id={job.id}>
                {job.deadline && (
                  <div className="ex-card__meta">
                    <DeadlineBadge deadline={job.deadline} />
                  </div>
                )}
                {/* 제목을 누르면 원문이 새 탭에서 열린다 (원문 링크가 없으면 제목만 표시) */}
                {job.url ? (
                  <a className="ex-card__title" href={job.url} target="_blank" rel="noopener noreferrer"><FieldTitle title={job.title} /></a>
                ) : (
                  <p className="ex-card__title ex-card__title--plain"><FieldTitle title={job.title} /></p>
                )}
                <p className="ex-card__sub">
                  {job.company ?? '기업명 정보 없음'}
                  {job.deadline && ` · 마감 ${job.deadline}`}
                </p>
                {!job.deadline && <p className="ex-card__note">마감일은 원문에서 확인해 주세요.</p>}
                {!job.url && <p className="ex-card__note">원문 링크가 없어요.</p>}
                {addButton('job', job, addBlockReason({ deadline: job.deadline }))}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  )
}

// 제목 앞에 직무 분야 [분야명]을 붙여 보여 준다. (저장된 제목은 그대로, 화면에서만 붙임)
// 분야가 둘이면 [백엔드] [프론트엔드]처럼 나란히 붙인다
function FieldTitle({ title }) {
  return (
    <>
      {fieldLabelsOf(title).map((label) => (
        <span key={label} className="ex-field" data-field={label}>[{label}] </span>
      ))}
      {title}
    </>
  )
}

// 기술 뉴스 상세: [기술 뉴스 목록으로], 출처·게시 시각, [분야] 원제, [원문 보기](새 탭)
// fromList: 목록에서 이미 받은 글 (없으면 = 주소로 바로 들어오거나 새로고침 → 한 건 조회)
function NewsDetail({ id, fromList, onBack }) {
  const [loaded, setLoaded] = useState({ id: null, state: 'loading', article: null })
  useEffect(() => {
    if (fromList) return undefined
    let cancelled = false
    getTechArticle(id).then((result) => {
      if (cancelled) return
      if (result.error) setLoaded({ id, state: result.error.code === 'NOT_FOUND' ? 'missing' : 'error', article: null })
      else setLoaded({ id, state: 'ready', article: result.data })
    })
    return () => { cancelled = true }
  }, [id, fromList])

  const article = fromList ?? (loaded.id === id ? loaded.article : null)
  const state = fromList ? 'ready' : loaded.id === id ? loaded.state : 'loading'

  return (
    <article className="ex-news" data-testid="news-detail">
      <button type="button" className="ex-back" onClick={onBack}>← 기술 뉴스 목록으로</button>
      {state === 'loading' && <p className="rm-muted" role="status">불러오는 중…</p>}
      {state === 'missing' && <p className="rm-muted">글을 찾을 수 없어요.</p>}
      {state === 'error' && <p className="rm-muted" role="alert">글을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>}
      {article && (
        <>
          <p className="ex-news__meta">{article.sourceName} · {formatKst(article.publishedAt)}</p>
          <h1 className="ex-news__title">
            <FieldTitle title={article.title} />
          </h1>
          <a className="ex-add ex-news__original-link" href={article.url} target="_blank" rel="noopener noreferrer">원문 보기</a>
        </>
      )}
    </article>
  )
}

// [내 로드맵에 추가] → 저장 중 → [추가됨] [로드맵에서 보기]. 추가할 수 없는 공고는 이유를 보여 준다.
function AddToRoadmap({ nodeId, pending, error, blockReason, onAdd }) {
  return (
    <div className="ex-card__actions">
      {nodeId ? (
        <>
          <span className="ex-added" role="status">추가됨</span>
          <Link className="ex-link" to={`/roadmap?node=${nodeId}`}>로드맵에서 보기</Link>
        </>
      ) : blockReason ? (
        <span className="ex-card__note" data-testid="add-blocked">{blockReason}</span>
      ) : (
        <button type="button" className="ex-add" disabled={pending} onClick={onAdd}>
          {pending ? '추가하는 중…' : '내 로드맵에 추가'}
        </button>
      )}
      {error && <span className="ex-error" role="alert">{error}</span>}
    </div>
  )
}

// 탭별 불러오는 중·오류·로그인 필요·빈 목록 안내
function ListStatus({ list, empty }) {
  if (list.state === 'loading') return <p className="rm-muted" role="status">불러오는 중…</p>
  if (list.state === 'no-config') return <p className="rm-muted">Supabase 연결 설정(.env)이 없어 목록을 불러올 수 없어요.</p>
  if (list.state === 'error') return <p className="rm-muted" role="alert">목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>
  if (list.state === 'login') {
    return <p className="rm-muted">로그인하면 볼 수 있어요. <Link to="/login">로그인하기</Link></p>
  }
  if (list.items.length === 0) return <p className="rm-muted">{empty}</p>
  return null
}

// 게시 시각을 한국 시간 'M월 D일 HH:mm'으로
function formatKst(iso) {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso))
}
