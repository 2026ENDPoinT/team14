// Supabase Edge Function: 온보딩 AI 진로 추천 (Gemini Flash-Lite)
//
// 배포: supabase functions deploy recommend-career   (JWT 확인을 켠 기본 배포)
//   + 함수 안에서 auth.getUser로 로그인한 사용자인지 한 번 더 확인한다. (anon 키만으로는 호출할 수 없다)
//
// 요청: POST { keywords: string[] }   — 우선순위 순 역량 키워드 (아래 KEYWORDS 중에서만, 1~15개)
//   성적·이름·이메일·사용자 ID·이수 과목 목록은 받지 않는다. 브라우저가 성적으로 키워드 순서만 정해서 보낸다.
// 응답: { job, reason, basedOn, model, recommendedAt, saved }
//   job: 아래 JOBS 키 하나 / reason: 한국어 추천 이유 / basedOn: 근거로 쓴 키워드 (보낸 키워드 중에서만)
//   saved: 마지막 결과 저장 성공 여부
// 저장: 추천에 성공하면 public.career_recommendations에 직무·이유·시각만 upsert한다 (사용자별 1행).
//   호출한 사용자 본인의 JWT로 저장하므로 RLS(본인 행만)가 그대로 적용된다. 실패한 추천은 저장하지 않는다.
//   희망 직무(profiles.interests)와 로드맵 노드는 건드리지 않는다.
// 오류: { error: { code, message } }
//   401 UNAUTHENTICATED · 400 VALIDATION_ERROR · 429 RATE_LIMITED(Gemini 한도 초과) · 502 AI_ERROR · 500 SERVER_ERROR
//
// 필요한 환경 변수: GEMINI_API_KEY (Supabase secrets), SUPABASE_URL·SUPABASE_ANON_KEY (자동 제공)
// 로그: 요청 내용(키워드)과 키는 남기지 않는다. 실패 시 모델 이름과 HTTP 상태만 남긴다.

import { createClient } from 'jsr:@supabase/supabase-js@2'

// 무료 한도가 있는 Flash-Lite 모델. 앞의 모델이 없거나(404), 한도를 넘었거나(429),
// Gemini 서버가 일시적으로 응답하지 못하면(500·502·503·504, 시간 초과·네트워크 오류) 다음 모델을 쓴다.
const MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite']
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
const TRY_NEXT = new Set([404, 429, 500, 502, 503, 504])
const MODEL_TIMEOUT_MS = 12000 // 모델 하나당 대기 시간 (두 모델 모두 시도해도 함수 제한 시간 안에 끝나게)

// 온보딩 희망 직무 10개 (frontend/src/features/onboarding/onboardingOptions.js CAREERS와 같은 키·이름)
const JOBS: Record<string, string> = {
  backend: '백엔드 개발자',
  frontend: '프론트엔드 개발자',
  mobile: '모바일 앱 개발자',
  ai: 'AI·머신러닝 엔지니어',
  data: '데이터 분석',
  security: '정보보안',
  system_network: '시스템·네트워크·클라우드',
  embedded_iot: '임베디드·IoT',
  game: '게임 개발자',
  uiux: 'UI/UX 엔지니어',
}

// 받을 수 있는 역량 키워드 (frontend/src/data/course-competencies.json keywords와 같아야 한다)
const KEYWORDS = new Set([
  '컴퓨터공학 기초', '프로그래밍 기초', '객체지향 설계', '자료구조·알고리즘', '수학적 사고', '확률·통계', '선형대수',
  '데이터베이스', '데이터 분석', '대용량 데이터 처리', '머신러닝', '컴퓨터 비전', '자연어 처리', '웹 개발',
  '모바일 앱 개발', '운영체제', '시스템 프로그래밍', '리눅스·유닉스', '컴퓨터 구조', '디지털 회로', '네트워크',
  '정보보안', '암호학', '소프트웨어 설계·공학', '오픈소스 협업', '프로그래밍 언어 이론', '컴퓨터 그래픽스',
  '게임 개발', '임베디드 시스템', '사물인터넷', '팀 프로젝트', '현장 실무',
])
const MAX_KEYWORDS = 15
const REASON_MAX = 200

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' } })
const fail = (status: number, code: string, message: string) => json({ error: { code, message } }, status)

const SYSTEM_PROMPT = `당신은 컴퓨터공학과 학생의 진로 탐색을 돕는 도우미입니다.
입력으로 학생의 강점 역량 키워드 목록이 주어집니다. 앞에 있을수록 더 강한 역량입니다.
아래 직무 중 하나만 골라 job에 직무 키를 넣으세요.
${Object.entries(JOBS).map(([key, name]) => `- ${key}: ${name}`).join('\n')}
reason에는 입력 키워드에 근거한 추천 이유를 한국어 1~2문장(120자 이내)으로 쓰세요. 근거로 쓴 키워드를 문장에 그대로 포함하세요.
basedOn에는 근거로 쓴 입력 키워드를 1~3개 넣으세요.
입력에 없는 경험·성적·자격을 지어내지 마세요.`

type Recommendation = { job: string; reason: string; basedOn: string[] }

// Gemini 응답 검증: 직무 키, 이유(한국어·길이), 근거 키워드(보낸 키워드 중에서만)
function validate(raw: unknown, keywords: string[]): Recommendation | null {
  if (!raw || typeof raw !== 'object') return null
  const { job, reason, basedOn } = raw as Record<string, unknown>
  if (typeof job !== 'string' || !(job in JOBS)) return null
  if (typeof reason !== 'string') return null
  const text = reason.trim()
  if (text.length < 10 || text.length > REASON_MAX || !/[가-힣]/.test(text) || /https?:\/\//.test(text)) return null
  if (!Array.isArray(basedOn)) return null
  const grounded = [...new Set(basedOn.filter((k): k is string => typeof k === 'string' && keywords.includes(k)))]
  if (grounded.length === 0) return null
  return { job, reason: text, basedOn: grounded.slice(0, 3) }
}

async function askGemini(model: string, apiKey: string, keywords: string[]) {
  const response = await fetch(`${API_BASE}/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: JSON.stringify({ keywords }) }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            job: { type: 'STRING', enum: Object.keys(JOBS) },
            reason: { type: 'STRING' },
            basedOn: { type: 'ARRAY', items: { type: 'STRING', enum: keywords } },
          },
          required: ['job', 'reason', 'basedOn'],
        },
      },
    }),
  })
  if (!response.ok) {
    await response.body?.cancel()
    return { status: response.status }
  }
  const data = await response.json()
  const text = (data?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('')
  try {
    return { status: 200, result: validate(JSON.parse(text), keywords) }
  } catch {
    return { status: 200, result: null }
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (request.method !== 'POST') return fail(405, 'VALIDATION_ERROR', 'POST만 지원합니다.')

  // 1. 로그인한 사용자인지 확인 (사용자 정보는 확인에만 쓰고 저장·전송하지 않는다)
  const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  // 사용자 본인 권한 클라이언트: 로그인 확인과 결과 저장(RLS 적용)에 쓴다
  const auth = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: userData, error: userError } = await auth.auth.getUser(token)
  if (userError || !userData?.user) return fail(401, 'UNAUTHENTICATED', '로그인이 필요합니다.')

  // 2. 입력 확인: 정해진 역량 키워드만, 중복 제거
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return fail(400, 'VALIDATION_ERROR', '요청 형식이 올바르지 않습니다.')
  }
  const raw = (body as { keywords?: unknown })?.keywords
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_KEYWORDS) {
    return fail(400, 'VALIDATION_ERROR', `keywords는 1~${MAX_KEYWORDS}개여야 합니다.`)
  }
  if (!raw.every((k) => typeof k === 'string' && KEYWORDS.has(k))) {
    return fail(400, 'VALIDATION_ERROR', '허용되지 않은 키워드가 있습니다.')
  }
  const keywords = [...new Set(raw as string[])]

  // 3. Gemini 호출
  const apiKey = (Deno.env.get('GEMINI_API_KEY') ?? '').trim()
  if (!apiKey) return fail(500, 'SERVER_ERROR', 'AI 추천 설정이 없습니다.')

  let lastStatus = 0
  for (const model of MODELS) {
    let answer
    try {
      answer = await askGemini(model, apiKey, keywords)
    } catch {
      // 시간 초과·네트워크 오류: 다음 모델을 시도한다
      console.error(`recommend-career: ${model} 요청 실패(시간 초과·네트워크) → 다음 모델`)
      lastStatus = 504
      continue
    }
    lastStatus = answer.status
    if (TRY_NEXT.has(answer.status)) {
      console.error(`recommend-career: ${model} HTTP ${answer.status} → 다음 모델`)
      continue
    }
    if (answer.status !== 200) {
      console.error(`recommend-career: ${model} HTTP ${answer.status}`)
      return fail(502, 'AI_ERROR', 'AI 추천을 받지 못했습니다.')
    }
    if (!answer.result) {
      console.error(`recommend-career: ${model} 응답 검증 실패`)
      return fail(502, 'AI_ERROR', 'AI 추천 결과가 올바르지 않습니다.')
    }
    // 마지막 성공 결과 저장 (저장에 실패해도 추천 결과는 돌려준다)
    const recommendedAt = new Date().toISOString()
    const { error: saveError } = await auth
      .from('career_recommendations')
      .upsert({ job: answer.result.job, reason: answer.result.reason, recommended_at: recommendedAt }, { onConflict: 'user_id' })
    if (saveError) console.error(`recommend-career: 결과 저장 실패 (${saveError.code})`)
    return json({ ...answer.result, model, recommendedAt, saved: !saveError })
  }
  if (lastStatus === 429) return fail(429, 'RATE_LIMITED', 'AI 추천 사용 한도를 넘었습니다. 잠시 후 다시 시도해 주세요.')
  if (lastStatus >= 500) return fail(502, 'AI_ERROR', 'AI 추천 서버가 잠시 응답하지 않습니다.')
  return fail(502, 'AI_ERROR', '사용할 수 있는 AI 모델이 없습니다.')
})
