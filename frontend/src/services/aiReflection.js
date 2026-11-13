import { supabase } from './supabaseClient.js'

// 일기 AI (Edge Function recommend-career의 reflect·timecapsule 모드, supabase/functions/recommend-career/reflection.ts)
// - 사용자가 버튼을 눌렀을 때만 부른다. 결과·일기는 서버에 저장하지 않는다.
// - 보내는 글은 로그인한 본인 일기(RLS)에서 고른 것만, 길이를 잘라서 보낸다 (아래 LIMITS)
// 결과: { data } 또는 { error: { code, message } }
export const AI_LIMITS = {
  diaryText: 1500, // 회고 질문: 보내는 발자취 최대 글자
  entries: 4, // 타임캡슐: 과거·최근 각각 최대 편수
  entryText: 400, // 타임캡슐: 한 편 최대 글자
  gapDays: 30, // 타임캡슐: 과거·최근 사이 최소 간격(일)
}

const cut = (text, max) => [...(text ?? '').trim()].slice(0, max).join('')
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000)

async function invoke(payload) {
  if (!supabase) return { error: { code: 'CONFIG_ERROR', message: 'Supabase 연결 설정이 없어 AI를 쓸 수 없어요.' } }
  const { data: sessionData } = await supabase.auth.getSession()
  if (!sessionData?.session) return { error: { code: 'UNAUTHENTICATED', message: '로그인이 필요해요.' } }
  let response
  try {
    response = await supabase.functions.invoke('recommend-career', { body: payload })
  } catch {
    return { error: { code: 'NETWORK_ERROR', message: 'AI 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.' } }
  }
  if (response.error) {
    const status = response.error.context?.status ?? null
    let body = null
    try { body = await response.error.context?.json() } catch { /* 본문 없음 */ }
    const serverMessage = body?.error?.message ?? ''
    // 새 모드가 아직 배포되지 않은 함수는 mode를 거부한다
    if (status === 404 || (status === 400 && serverMessage.includes('mode'))) {
      return { error: { code: 'NOT_READY', message: '이 AI 기능이 아직 서버에 배포되지 않았어요.' } }
    }
    if (status === 429) return { error: { code: 'RATE_LIMITED', message: 'AI 사용 한도를 넘었어요. 잠시 후 다시 시도해 주세요.' } }
    if (status === 401) return { error: { code: 'UNAUTHENTICATED', message: '로그인이 만료됐어요. 다시 로그인해 주세요.' } }
    return { error: { code: body?.error?.code ?? 'AI_ERROR', message: serverMessage || 'AI 응답을 받지 못했어요. 잠시 후 다시 시도해 주세요.' } }
  }
  if (response.data?.mode !== payload.mode) {
    return { error: { code: 'NOT_READY', message: '이 AI 기능이 아직 서버에 배포되지 않았어요.' } }
  }
  return { data: response.data }
}

// AI 회고 질문: 지금 쓰고 있는 '오늘의 발자취'(diaries.footprint) 글만 → [{ question, basis }] (최대 2개, 비어 있으면 basis '')
export async function requestReflectQuestions({ date, content }) {
  // 글자 수 조건 없음: 비어 있으면 서버가 일반 회고 질문을 만든다
  const result = await invoke({ mode: 'reflect', date, content: cut(content, AI_LIMITS.diaryText) })
  if (result.error) return result
  const questions = (result.data.questions ?? []).slice(0, 2)
  if (questions.length === 0) return { error: { code: 'AI_ERROR', message: '회고 질문을 만들지 못했어요. 잠시 후 다시 시도해 주세요.' } }
  return { data: { questions } }
}

// 타임캡슐에 보낼 기록 고르기 (AI 호출 없음): 가장 오래된 기록들 vs 최근 30일 기록들, 사이가 30일 이상일 때만
// diaries: [{ date, content }] (본인 일기) → { past, recent } 또는 null(기록 부족)
export function pickTimeCapsuleEntries(diaries) {
  const list = (diaries ?? [])
    .filter((d) => d?.date && d.content?.trim())
    .sort((a, b) => a.date.localeCompare(b.date))
  if (list.length < 2) return null
  // 최근: 가장 최근 일기부터 30일 안의 기록(최대 4편) / 과거: 그 최근 묶음보다 30일 이상 앞선 가장 오래된 기록(최대 4편)
  const latest = list[list.length - 1].date
  const recent = list.filter((d) => daysBetween(d.date, latest) < AI_LIMITS.gapDays).slice(-AI_LIMITS.entries)
  const firstRecent = recent[0].date
  const past = list.filter((d) => daysBetween(d.date, firstRecent) >= AI_LIMITS.gapDays).slice(0, AI_LIMITS.entries)
  if (past.length === 0) return null
  const shape = (d) => ({ date: d.date, content: cut(d.content, AI_LIMITS.entryText) })
  return { past: past.map(shape), recent: recent.map(shape) }
}

// AI 타임캡슐: { message, changes: [{ past, recent, note }] }
export async function requestTimeCapsule({ past, recent }) {
  const result = await invoke({ mode: 'timecapsule', past, recent })
  if (result.error) return result
  const { message, changes } = result.data
  if (!message || !Array.isArray(changes) || changes.length === 0) {
    return { error: { code: 'AI_ERROR', message: '타임캡슐 메시지를 만들지 못했어요. 잠시 후 다시 시도해 주세요.' } }
  }
  return { data: { message, changes } }
}
