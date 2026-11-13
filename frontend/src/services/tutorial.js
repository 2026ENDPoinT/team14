import { supabase } from './supabaseClient.js'

// 튜토리얼 최초 자동 실행 기록 (RPC mark_tutorial_seen, migration 20261114003000)
// kind: 'home' | 'roadmap'. 성공하면 그 계정은 어느 기기에서도 다시 자동으로 뜨지 않는다.
// 결과: { data: { seen: true } } 또는 { error: { code, message } } (RPC가 아직 없으면 NOT_READY)
export async function markTutorialSeen(kind) {
  if (!supabase) return { error: { code: 'SERVER_ERROR', message: 'Supabase 연결 설정(.env)이 없습니다.' } }
  const { data: session } = await supabase.auth.getSession()
  if (!session.session) return { error: { code: 'UNAUTHENTICATED', message: '로그인이 필요합니다.' } }
  const { error } = await supabase.rpc('mark_tutorial_seen', { p_kind: kind })
  if (error) {
    if (error.code === 'PGRST202' || error.code === '42883') {
      return { error: { code: 'NOT_READY', message: '튜토리얼 기록 기능은 서버 준비 중이에요.' } }
    }
    return { error: { code: 'SERVER_ERROR', message: error.details || '튜토리얼 기록을 저장하지 못했어요.' } }
  }
  return { data: { seen: true } }
}
