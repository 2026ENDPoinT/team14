import { supabase } from './supabaseClient.js'

// AI 진로 추천 (Edge Function recommend-career)
// input: keywords — 우선순위 순 역량 키워드 (careerKeywords.js rankKeywords 결과). 성적·이름·이수 목록은 보내지 않는다.
// 결과: { data: { job, reason, basedOn, recommendedAt } } 또는 { error: { code, message } }
// 성공한 결과는 함수가 사용자별 마지막 결과(career_recommendations)로 저장한다. 희망 직무·로드맵은 바뀌지 않는다.
//   code: UNAUTHENTICATED · VALIDATION_ERROR · RATE_LIMITED · AI_ERROR · SERVER_ERROR
const MESSAGES = {
  UNAUTHENTICATED: '로그인이 필요합니다.',
  VALIDATION_ERROR: '추천에 쓸 역량 정보가 올바르지 않아요.',
  RATE_LIMITED: 'AI 추천 사용 한도를 넘었어요. 잠시 후 다시 시도해 주세요.',
  AI_ERROR: '지금은 AI 추천을 받을 수 없어요. 잠시 후 다시 시도해 주세요.',
  SERVER_ERROR: '지금은 AI 추천을 받을 수 없어요. 잠시 후 다시 시도해 주세요.',
}
const toError = (code) => ({ code, message: MESSAGES[code] ?? MESSAGES.AI_ERROR })

export async function recommendCareer(keywords) {
  if (!supabase) return { error: toError('SERVER_ERROR') }
  const { data: session } = await supabase.auth.getSession()
  if (!session.session) return { error: toError('UNAUTHENTICATED') }

  const { data, error } = await supabase.functions.invoke('recommend-career', { body: { keywords } })
  if (error) {
    // 함수가 보낸 오류 코드 (응답 본문을 읽지 못하면 AI_ERROR)
    let code = 'AI_ERROR'
    try {
      code = (await error.context.json())?.error?.code ?? code
    } catch {
      // 네트워크 오류 등
    }
    return { error: toError(code) }
  }
  if (!data?.job || !data?.reason) return { error: toError('AI_ERROR') }
  return { data: { job: data.job, reason: data.reason, basedOn: data.basedOn ?? [], recommendedAt: data.recommendedAt ?? null } }
}

// 마지막 성공 추천 (없으면 data: null). 본인 행만 RLS로 읽힌다.
// 결과: { data: { job, reason, recommendedAt } | null } 또는 { error }
export async function getLastCareerRecommendation() {
  if (!supabase) return { error: toError('SERVER_ERROR') }
  const { data, error } = await supabase
    .from('career_recommendations')
    .select('job, reason, recommended_at')
    .maybeSingle()
  if (error) return { error: { code: 'SERVER_ERROR', message: '지난 추천 결과를 불러오지 못했어요.' } }
  return { data: data && { job: data.job, reason: data.reason, recommendedAt: data.recommended_at } }
}

// 완료 표시된 내 노드 중 교과목이 될 수 있는 것 (이수 과목 찾기용)
// 결과: { data: [{ originKey, title, theme }] } 또는 { error }
export async function getMyCompletedNodes() {
  if (!supabase) return { error: toError('SERVER_ERROR') }
  const { data, error } = await supabase
    .from('nodes')
    .select('origin_key, title, theme')
    .eq('completed', true)
  if (error) return { error: { code: 'SERVER_ERROR', message: '이수 과목을 불러오지 못했어요.' } }
  return { data: data.map((row) => ({ originKey: row.origin_key, title: row.title, theme: row.theme })) }
}

// ---- AI 길잡이 (로드맵) — 같은 함수 recommend-career의 mode 요청 ----
// payload: features/career/guide/guideData.js buildGuidePayload 결과
//   { mode, grade, currentJob, keywords, courses, activities, diary }
//   diary는 사용자가 '일기도 함께 분석하기'를 켜고 고른 발췌만 들어 있다 (끄면 빈 배열).
// 결과: { data: { mode, careers, activities, recommendedAt } } 또는 { error: { code, message } }
//   결과는 저장하지 않는다. 희망 직무·펫·로드맵도 바뀌지 않는다.
export async function requestAiGuide(payload) {
  if (!supabase) return { error: toError('SERVER_ERROR') }
  const { data: session } = await supabase.auth.getSession()
  if (!session.session) return { error: toError('UNAUTHENTICATED') }

  const { data, error } = await supabase.functions.invoke('recommend-career', { body: payload })
  if (error) {
    let code = 'AI_ERROR'
    try {
      code = (await error.context.json())?.error?.code ?? code
    } catch {
      // 네트워크 오류·함수 없음 등
    }
    return { error: toError(code) }
  }
  // 응답 모양 확인: 모드에 맞는 결과가 없으면 성공으로 보지 않는다
  const careers = Array.isArray(data?.careers) ? data.careers : []
  const activities = Array.isArray(data?.activities) ? data.activities : []
  const needCareers = payload.mode !== 'activities'
  const needActivities = payload.mode !== 'career'
  if ((needCareers && careers.length < 2) || (needActivities && activities.length < 3)) {
    return { error: toError('AI_ERROR') }
  }
  return { data: { mode: payload.mode, careers, activities, recommendedAt: data.recommendedAt ?? null } }
}

// AI 길잡이용 내 최근 일기 (본인 행만 RLS로 읽힌다). 사용자가 동의를 켰을 때만 부른다.
// 날짜·글만 가져오고 사진·기분·연결 노드는 읽지 않는다. 저장하지 않는다.
// 결과: { data: [{ date, content }] } 또는 { error }
export async function getMyRecentDiaries({ days = 30, limit = 10 } = {}) {
  if (!supabase) return { error: toError('SERVER_ERROR') }
  const { data: session } = await supabase.auth.getSession()
  if (!session.session) return { error: toError('UNAUTHENTICATED') }
  const since = new Date(Date.now() + 9 * 3600 * 1000 - days * 86400 * 1000).toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('diaries')
    .select('date, content')
    .eq('user_id', session.session.user.id)
    .gte('date', since)
    .order('date', { ascending: false })
    .limit(limit)
  if (error) return { error: { code: 'SERVER_ERROR', message: '일기를 불러오지 못했어요.' } }
  return { data: data.filter((d) => d.content?.trim()).map((d) => ({ date: d.date, content: d.content })) }
}
