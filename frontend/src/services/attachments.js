import { supabase } from './supabaseClient.js'

// 로드맵 활동 노드 첨부: 링크 · 파일 (migration 20261114002400)
// - 링크: http·https 주소만, 노드당 10개. 이름은 비우면 주소를 그대로 쓴다.
// - 파일: 비공개 Storage 버킷 'attachments', 경로 '<내 id>/node/<노드 id>/<첨부 id>.<확장자>'
//         문서·이미지·압축만, 장당 5MB, 노드당 5개. 내려받을 때만 서명 URL을 만든다 (저장하지 않음)
// - 기존 노드 사진은 services/photos.js (photos 테이블·버킷)에 그대로 있다.

const BUCKET = 'attachments'
export const FILE_MAX_COUNT = 5
export const LINK_MAX_COUNT = 10
export const FILE_MAX_BYTES = 5 * 1024 * 1024

// 확장자 → 저장할 형식 (브라우저마다 hwp·md 형식을 다르게 알려 주므로 확장자로 정한다. 버킷 허용 목록과 같음)
const FILE_TYPES = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  hwp: 'application/x-hwp',
  hwpx: 'application/vnd.hancom.hwpx',
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  zip: 'application/zip',
}
export const FILE_ACCEPT = Object.keys(FILE_TYPES).map((ext) => `.${ext}`).join(',')

const extOf = (fileName) => fileName.split('.').pop().toLowerCase()
const fail = (message, code = 'SERVER_ERROR') => ({ error: { code, message } })

async function currentUserId() {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

// 파일 검사. 문제가 없으면 null
export function checkAttachmentFile(file) {
  if (!FILE_TYPES[extOf(file.name)]) return '문서(pdf·doc·ppt·xls·hwp·txt·md·csv)·이미지·zip 파일만 첨부할 수 있어요.'
  if (file.size > FILE_MAX_BYTES) return '파일 하나는 5MB까지 첨부할 수 있어요.'
  return null
}

// 링크 검사: http·https 주소만. 정리한 주소 또는 { error }
export function normalizeLink(text) {
  const value = text.trim()
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol) || /\s/.test(value)) throw new Error()
    if (value.length > 2000) return { error: '주소가 너무 길어요.' }
    return { url: value }
  } catch {
    return { error: 'http:// 또는 https://로 시작하는 주소를 입력해 주세요.' }
  }
}

const toAttachment = (row) => ({
  id: row.id,
  kind: row.kind,
  name: row.name,
  url: row.url,
  path: row.storage_path,
  size: row.size_bytes,
  createdAt: row.created_at,
})

// 노드의 첨부 목록 (링크·파일, 만든 순서)
export async function listAttachments(nodeId) {
  if (!(await currentUserId())) return fail('로그인이 필요합니다.', 'UNAUTHENTICATED')
  const { data, error } = await supabase
    .from('node_attachments')
    .select('id, kind, name, url, storage_path, size_bytes, created_at')
    .eq('node_id', nodeId)
    .order('created_at')
  if (error) return fail('첨부를 불러오지 못했어요.')
  return { data: data.map(toAttachment) }
}

const insertRow = async (values) => {
  const { data, error } = await supabase.from('node_attachments').insert(values).select('id, kind, name, url, storage_path, size_bytes, created_at').single()
  if (error) return { error }
  return { data: toAttachment(data) }
}
const limitMessage = (error, fallback) => (error.message === 'VALIDATION_ERROR' && error.details ? error.details : fallback)

// 링크 추가 → { data: 첨부 } 또는 { error }
export async function addLink(nodeId, { url, name }) {
  if (!(await currentUserId())) return fail('로그인이 필요합니다.', 'UNAUTHENTICATED')
  const checked = normalizeLink(url)
  if (checked.error) return fail(checked.error, 'VALIDATION_ERROR')
  const result = await insertRow({ node_id: nodeId, kind: 'link', url: checked.url, name: (name?.trim() || checked.url).slice(0, 200) })
  if (result.error) return fail(limitMessage(result.error, '링크를 저장하지 못했어요.'))
  return result
}

// 파일 올리기: Storage에 올린 뒤 DB에 연결. DB 연결에 실패하면 올린 파일을 지운다.
export async function uploadAttachment(nodeId, file) {
  const userId = await currentUserId()
  if (!userId) return fail('로그인이 필요합니다.', 'UNAUTHENTICATED')
  const problem = checkAttachmentFile(file)
  if (problem) return fail(problem, 'VALIDATION_ERROR')
  const ext = extOf(file.name)
  const path = `${userId}/node/${nodeId}/${crypto.randomUUID()}.${ext}`
  const uploaded = await supabase.storage.from(BUCKET).upload(path, file, { contentType: FILE_TYPES[ext], upsert: false })
  if (uploaded.error) return fail('파일을 올리지 못했어요.')
  const result = await insertRow({
    node_id: nodeId,
    kind: 'file',
    name: file.name.slice(0, 200),
    storage_path: path,
    content_type: FILE_TYPES[ext],
    size_bytes: file.size,
  })
  if (result.error) {
    await supabase.storage.from(BUCKET).remove([path])
    return fail(limitMessage(result.error, '파일을 저장하지 못했어요.'))
  }
  return result
}

// 첨부 지우기: DB 연결을 먼저 지우고, 파일이면 Storage에서도 지운다
export async function deleteAttachment(attachment) {
  if (!(await currentUserId())) return fail('로그인이 필요합니다.', 'UNAUTHENTICATED')
  const { error } = await supabase.from('node_attachments').delete().eq('id', attachment.id)
  if (error) return fail('첨부를 지우지 못했어요.')
  if (attachment.path) await supabase.storage.from(BUCKET).remove([attachment.path])
  return { data: { deleted: attachment.id } }
}

// 파일 열기(내려받기)용 서명 URL — 1분짜리, 누를 때마다 새로 만든다
export async function fileDownloadUrl(attachment) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(attachment.path, 60, { download: attachment.name })
  if (error) return fail('파일을 열지 못했어요. 다시 시도해 주세요.')
  return { data: data.signedUrl }
}

// 노드를 지울 때: 지우기 전에 파일 경로를 받아 두고, 삭제가 성공하면 파일도 지운다 (DB 행은 외래키로 함께 삭제)
export async function deleteWithAttachments(nodeId, deleteFn) {
  let paths = []
  if (supabase && nodeId) {
    const { data } = await supabase.from('node_attachments').select('storage_path').eq('node_id', nodeId).eq('kind', 'file')
    paths = (data ?? []).map((r) => r.storage_path)
  }
  const result = await deleteFn()
  if (!result.error && paths.length > 0) await supabase.storage.from(BUCKET).remove(paths)
  return result
}
