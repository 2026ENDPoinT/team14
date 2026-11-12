// Supabase Edge Function: 회원탈퇴 (본인 계정 삭제)
//
// 배포: supabase functions deploy delete-account   (JWT 확인을 켠 기본 배포)
// 요청: POST (본문 없음). 삭제할 계정은 요청한 로그인 세션(JWT)으로만 정한다 — 다른 사람 계정은 지울 수 없다.
// 응답: { deleted: true, removedFiles, alreadyDeleted? } / 오류 { error: { code, message } }
//
// 삭제 순서 (모두 성공해야 deleted: true)
//   1. Storage: 모든 버킷에서 '<사용자 ID>/' 폴더 아래 파일 삭제 (첨부 파일 저장 규칙: <버킷>/<사용자 ID>/...)
//   2. Auth 계정 삭제 (관리자 키는 이 함수 안에서만 쓴다)
//      → profiles(on delete cascade) → 로드맵(학기·노드·연결선·문서·종류), 일기, 펫, 온기·출석 이력,
//        AI 추천 결과가 연쇄 삭제된다. 공용 데이터(교과과정·공모전·채용 공고 등)는 남는다.
//   3. 확인: Auth에서 계정이 실제로 없어졌는지 다시 조회 (DB 기록은 같은 삭제 안에서 외래 키 연쇄로 지워진다)
// 재시도·동시 요청: 이미 삭제된 계정이면(응답을 못 받은 재시도, 두 요청이 겹친 경우) alreadyDeleted: true로 성공 처리한다.
// 로그: 사용자 ID·이메일 같은 개인정보는 남기지 않는다. 실패 단계와 오류 코드만 남긴다.

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' } })
const fail = (status: number, code: string, message: string) => json({ error: { code, message } }, status)

// JWT 본문의 sub (서명은 배포 설정의 JWT 확인이 이미 검사했다)
function tokenSubject(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload.sub === 'string' ? payload.sub : null
  } catch {
    return null
  }
}

// 버킷 하나에서 prefix 아래 파일 경로를 모두 모은다 (폴더는 안으로 들어간다)
async function listFiles(admin: SupabaseClient, bucket: string, prefix: string): Promise<string[]> {
  const files: string[] = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000, offset })
    if (error) throw new Error(`storage list: ${error.message}`)
    for (const item of data) {
      const path = `${prefix}/${item.name}`
      if (item.id === null) files.push(...(await listFiles(admin, bucket, path))) // 폴더
      else files.push(path)
    }
    if (data.length < 1000) break
  }
  return files
}

async function removeUserFiles(admin: SupabaseClient, userId: string): Promise<number> {
  const { data: buckets, error } = await admin.storage.listBuckets()
  if (error) throw new Error(`storage buckets: ${error.message}`)
  let removed = 0
  for (const bucket of buckets) {
    const files = await listFiles(admin, bucket.id, userId)
    for (let i = 0; i < files.length; i += 100) {
      const { error: removeError } = await admin.storage.from(bucket.id).remove(files.slice(i, i + 100))
      if (removeError) throw new Error(`storage remove: ${removeError.message}`)
    }
    removed += files.length
  }
  return removed
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (request.method !== 'POST') return fail(405, 'VALIDATION_ERROR', 'POST만 지원합니다.')

  const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const url = Deno.env.get('SUPABASE_URL')!
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false } })
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

  // 1. 삭제할 계정 = 요청한 로그인 사용자
  const { data: userData } = await userClient.auth.getUser(token)
  const userId = userData?.user?.id
  if (!userId) {
    // 이미 삭제된 계정의 재시도인지 확인 (anon 키 등 사용자 토큰이 아니면 sub가 없다)
    const sub = tokenSubject(token)
    if (sub && /^[0-9a-f-]{36}$/.test(sub)) {
      const { data: found, error } = await admin.auth.admin.getUserById(sub)
      if (!found?.user && error?.status === 404) return json({ deleted: true, alreadyDeleted: true, removedFiles: 0 })
    }
    return fail(401, 'UNAUTHENTICATED', '로그인이 필요합니다.')
  }

  // 2. 첨부 파일
  let removedFiles = 0
  try {
    removedFiles = await removeUserFiles(admin, userId)
  } catch (error) {
    console.error(`delete-account: 파일 삭제 실패 (${error instanceof Error ? error.message : 'unknown'})`)
    return fail(500, 'DELETE_FAILED', '첨부 파일을 삭제하지 못했어요. 계정은 그대로예요. 다시 시도해 주세요.')
  }

  // 3. Auth 계정 (DB 기록은 연쇄 삭제)
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId)
  const alreadyDeleted = deleteError?.status === 404 // 겹친 다른 요청이 먼저 지운 경우
  if (deleteError && !alreadyDeleted) {
    console.error(`delete-account: 계정 삭제 실패 (${deleteError.status ?? ''} ${deleteError.code ?? ''})`)
    return fail(500, 'DELETE_FAILED', '계정을 삭제하지 못했어요. 다시 시도해 주세요.')
  }

  // 4. 확인: 계정이 정말 없어졌는지 (404여야 성공)
  const { data: still, error: checkError } = await admin.auth.admin.getUserById(userId)
  if (still?.user || checkError?.status !== 404) {
    console.error(`delete-account: 삭제 확인 실패 (${checkError?.status ?? 'user exists'})`)
    return fail(500, 'DELETE_FAILED', '삭제를 확인하지 못했어요. 다시 시도해 주세요.')
  }

  return json({ deleted: true, removedFiles, ...(alreadyDeleted ? { alreadyDeleted: true } : {}) })
})
