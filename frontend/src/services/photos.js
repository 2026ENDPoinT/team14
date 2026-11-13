import { supabase } from './supabaseClient.js'

// 사진 첨부 서비스 (로드맵 활동 노드 · 일기 공용, migration 20261113002200)
// - 원본: 비공개 Storage 버킷 'photos', 경로 '<내 id>/<node|diary>/<노드·일기 id>/<사진 id>.<확장자>'
// - DB photos 테이블: 사진 1장 = 행 1개 (노드 또는 일기 중 하나 ↔ Storage 경로)
// - 서명 URL은 볼 때만 만든다 (1시간). DB에 저장하지 않는다.
// target: { nodeId } 또는 { diaryId }

const BUCKET = 'photos'
export const PHOTO_MAX_COUNT = 5
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024
export const PHOTO_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }
const SIGNED_SECONDS = 60 * 60

async function currentUserId() {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

const column = (target) => (target.nodeId ? 'node_id' : 'diary_id')
const ownerId = (target) => target.nodeId ?? target.diaryId
const fail = (message, code = 'SERVER_ERROR') => ({ error: { code, message } })

// 올리기 전 파일 검사 (Storage 버킷 제한과 같은 값). 문제가 없으면 null
export function checkPhotoFile(file) {
  if (!PHOTO_TYPES[file.type]) return 'jpg·png·webp·gif 사진만 올릴 수 있어요.'
  if (file.size > PHOTO_MAX_BYTES) return '사진 한 장은 5MB까지 올릴 수 있어요.'
  return null
}

// 사진 목록 + 볼 수 있는 서명 URL → { data: [{ id, path, url }] }
export async function listPhotos(target) {
  if (!(await currentUserId())) return fail('로그인이 필요합니다.', 'UNAUTHENTICATED')
  const { data, error } = await supabase
    .from('photos')
    .select('id, storage_path, created_at')
    .eq(column(target), ownerId(target))
    .order('created_at')
  if (error) return fail('사진을 불러오지 못했어요.')
  if (data.length === 0) return { data: [] }
  const signed = await supabase.storage.from(BUCKET).createSignedUrls(data.map((r) => r.storage_path), SIGNED_SECONDS)
  if (signed.error) return fail('사진을 불러오지 못했어요.')
  const urlOf = Object.fromEntries(signed.data.map((s) => [s.path, s.signedUrl]))
  return { data: data.map((r) => ({ id: r.id, path: r.storage_path, url: urlOf[r.storage_path] ?? null })) }
}

// 사진 1장 올리기: Storage에 파일을 올린 뒤 DB에 연결한다. DB 연결에 실패하면 올린 파일을 지운다.
// → { data: { id, path } } 또는 { error }
export async function uploadPhoto(target, file) {
  const userId = await currentUserId()
  if (!userId) return fail('로그인이 필요합니다.', 'UNAUTHENTICATED')
  const problem = checkPhotoFile(file)
  if (problem) return fail(problem, 'VALIDATION_ERROR')
  const kind = target.nodeId ? 'node' : 'diary'
  const path = `${userId}/${kind}/${ownerId(target)}/${crypto.randomUUID()}.${PHOTO_TYPES[file.type]}`
  const uploaded = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false })
  if (uploaded.error) return fail('사진을 올리지 못했어요.')
  const { data, error } = await supabase
    .from('photos')
    .insert({ [column(target)]: ownerId(target), storage_path: path })
    .select('id, storage_path')
    .single()
  if (error) {
    await supabase.storage.from(BUCKET).remove([path])
    return fail(error.message === 'VALIDATION_ERROR' ? error.details || '사진은 5장까지 올릴 수 있어요.' : '사진을 저장하지 못했어요.')
  }
  return { data: { id: data.id, path: data.storage_path } }
}

// 사진 1장 지우기: DB 연결을 먼저 지우고(화면에서 바로 사라짐) 파일을 지운다
export async function deletePhoto(photo) {
  if (!(await currentUserId())) return fail('로그인이 필요합니다.', 'UNAUTHENTICATED')
  const { error } = await supabase.from('photos').delete().eq('id', photo.id)
  if (error) return fail('사진을 지우지 못했어요.')
  await supabase.storage.from(BUCKET).remove([photo.path]) // 실패해도 연결이 없어 다시 보이지 않는다
  return { data: { deleted: photo.id } }
}

// 노드·일기를 지울 때: 지우기 전에 사진 경로를 받아 두고, 삭제가 성공하면 파일도 지운다
// (DB 연결 행은 외래키로 함께 지워진다) deleteFn: 원래 삭제 함수 → 그 결과를 그대로 돌려준다
export async function deleteWithPhotos(target, deleteFn) {
  let paths = []
  if (supabase && ownerId(target)) {
    const { data } = await supabase.from('photos').select('storage_path').eq(column(target), ownerId(target))
    paths = (data ?? []).map((r) => r.storage_path)
  }
  const result = await deleteFn()
  if (!result.error && paths.length > 0) await supabase.storage.from(BUCKET).remove(paths)
  return result
}
