import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import DeadlineBadge from '../features/explore/DeadlineBadge.jsx'
import { canAddToRoadmap, sourceName } from '../features/explore/contestInfo.js'
import {
  addContestToRoadmap,
  getMyContestNodeIds,
  isSupabaseConfigured,
  listOpenContests,
  listTechArticles,
} from '../services/api.js'
import '../features/roadmap/roadmap.css' // 로드맵과 같은 색·글꼴
import '../features/explore/explore.css'

// 탐색: 대외활동 공고(접수 중, 마감 임박순)와 기술 글(최신순)을 나눠 보여 준다.
// 두 목록 모두 내 관심 분야와 맞는 글이 먼저 온다. [공모전] 공고만 '내 로드맵에 추가' 버튼이 있다.
export default function ExplorePage() {
  const [state, setState] = useState(isSupabaseConfigured ? 'loading' : 'no-config') // loading | ready | login | error | no-config
  const [contests, setContests] = useState([])
  const [articles, setArticles] = useState([])
  const [addedNodes, setAddedNodes] = useState({}) // contestId → 로드맵 노드 id
  const [pending, setPending] = useState({}) // contestId → true (저장 중)
  const [errors, setErrors] = useState({}) // contestId → 오류 문구
  const pendingRef = useRef(new Set()) // 연속 클릭 막기 (화면 갱신 전 두 번째 클릭도 막는다)

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined
    let cancelled = false
    Promise.all([listOpenContests(50), listTechArticles(30), getMyContestNodeIds()]).then(([c, a, mine]) => {
      if (cancelled) return
      const failed = [c, a, mine].find((r) => r.error)
      if (failed) {
        setState(failed.error.code === 'UNAUTHENTICATED' ? 'login' : 'error')
        return
      }
      setContests(c.data)
      setArticles(a.data)
      setAddedNodes(mine.data)
      setState('ready')
    })
    return () => { cancelled = true }
  }, [])

  const handleAdd = useCallback(async (contestId) => {
    if (pendingRef.current.has(contestId)) return
    pendingRef.current.add(contestId)
    setPending((p) => ({ ...p, [contestId]: true }))
    setErrors((e) => ({ ...e, [contestId]: null }))
    const result = await addContestToRoadmap(contestId)
    pendingRef.current.delete(contestId)
    setPending((p) => ({ ...p, [contestId]: false }))
    if (result.error) {
      setErrors((e) => ({ ...e, [contestId]: result.error.message }))
      return
    }
    setAddedNodes((m) => ({ ...m, [contestId]: result.data.nodeId }))
  }, [])

  return (
    <div className="roadmap-page explore-page">
      <main className="ex-main">
        <header className="ex-head">
          <p className="rm-eyebrow">대외활동 · 기술 소식</p>
          <h1 className="ex-title">기회 탐색</h1>
          <p className="rm-muted">내 관심 분야와 맞는 글이 먼저 보여요.</p>
        </header>

        {state === 'loading' && <p className="rm-muted" role="status">불러오는 중…</p>}
        {state === 'no-config' && <p className="rm-muted">Supabase 연결 설정(.env)이 없어 목록을 불러올 수 없어요.</p>}
        {state === 'error' && <p className="rm-muted">목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>}
        {state === 'login' && (
          <p className="rm-muted">
            로그인하면 공고와 기술 글을 볼 수 있어요. <Link to="/login">로그인하기</Link>
          </p>
        )}

        {state === 'ready' && (
          <div className="ex-sections">
            <section className="ex-section" aria-labelledby="ex-contests">
              <h2 id="ex-contests" className="ex-section__title">대외활동 공고 <span className="rm-muted">접수 중 · 마감 임박순</span></h2>
              {contests.length === 0 && <p className="rm-muted">지금 접수 중인 공고가 없어요.</p>}
              <ul className="ex-list">
                {contests.map((c) => (
                  <li key={c.id} className="ex-card" data-testid="contest-card" data-contest-id={c.id}>
                    <div className="ex-card__meta">
                      {c.sourceTag && <span className="ex-tag">{c.sourceTag}</span>}
                      <DeadlineBadge deadline={c.deadline} status={c.sourceStatus} />
                      {c.matchesInterest && <span className="ex-interest">관심 분야</span>}
                    </div>
                    <a className="ex-card__title" href={c.url} target="_blank" rel="noopener noreferrer">{c.title}</a>
                    <p className="ex-card__sub">{sourceName(c.source)} · 마감 {c.deadline ?? '정보 없음'}</p>
                    {canAddToRoadmap(c) && (
                      <div className="ex-card__actions">
                        {addedNodes[c.id] ? (
                          <>
                            <span className="ex-added" role="status">추가됨</span>
                            <Link className="ex-link" to={`/roadmap?node=${addedNodes[c.id]}`}>로드맵에서 보기</Link>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="ex-add"
                            disabled={pending[c.id]}
                            onClick={() => handleAdd(c.id)}
                          >
                            {pending[c.id] ? '추가하는 중…' : '내 로드맵에 추가'}
                          </button>
                        )}
                        {errors[c.id] && <span className="ex-error" role="alert">{errors[c.id]}</span>}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>

            <section className="ex-section" aria-labelledby="ex-articles">
              <h2 id="ex-articles" className="ex-section__title">기술 글 <span className="rm-muted">최신순</span></h2>
              {articles.length === 0 && <p className="rm-muted">아직 기술 글이 없어요.</p>}
              <ul className="ex-list">
                {articles.map((a) => (
                  <li key={a.id} className="ex-card ex-card--article" data-testid="article-card">
                    <div className="ex-card__meta">
                      <span className="ex-tag">{a.sourceName}</span>
                      {a.matchesInterest && <span className="ex-interest">관심 분야</span>}
                    </div>
                    <a className="ex-card__title" href={a.url} target="_blank" rel="noopener noreferrer">{a.title}</a>
                    <p className="ex-card__sub">{formatKst(a.publishedAt)}</p>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </main>
    </div>
  )
}

// 게시 시각을 한국 시간 'M월 D일 HH:mm'으로
function formatKst(iso) {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso))
}
