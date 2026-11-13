import { supabase } from './supabaseClient.js'

// 로드맵 메모 노드 저장 (기존 표 그대로, migration 없음)
// - nodes 행: category_key = 'memo', theme = 'free', title = 메모 제목(없으면 '메모' — title 칸은 비울 수 없음)
// - node_documents.content: { format: 'memo', title, body, color }  (색: butter · sage · pink · white)
// - RLS로 본인 행만 읽고 쓴다. 컴포넌트는 Supabase를 직접 부르지 않고 이 함수만 쓴다.
// 결과: { data } 또는 { error: { code, message } }

const fail = (message, code = 'SERVER_ERROR') => ({ error: { code, message } })

async function sessionUserId() {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

// DB 행 → 로드맵 노드 (services/api.js toRoadmapNode와 같은 모양)
function toNode(row) {
  return {
    id: row.id,
    title: row.title,
    theme: row.theme,
    periodId: row.period_id,
    position: row.status === 'placed' ? { x: row.position_x, y: row.position_y } : null,
    status: row.status,
    source: row.source,
    originKey: row.origin_key,
    completed: row.completed,
    createdAt: row.created_at,
    categoryId: row.category_id ?? row.category_key ?? null,
    detailId: null,
    contestId: null,
    contest: null,
    jobPostingId: null,
    job: null,
    branchVisibility: null,
  }
}
const toDocument = (row) => ({ nodeId: row.node_id, content: row.content, updatedAt: row.updated_at })

// 메모 만들기: 노드 → 내용 순서로 저장. 내용 저장이 실패하면 방금 만든 노드를 지운다 (반쪽짜리 메모 방지)
export async function createMemoNode({ title, periodId, position, content }) {
  const userId = await sessionUserId()
  if (!userId) return fail('로그인이 필요합니다.', 'UNAUTHENTICATED')
  const { data, error } = await supabase
    .from('nodes')
    .insert({
      user_id: userId,
      title,
      theme: 'free',
      period_id: periodId,
      position_x: position.x,
      position_y: position.y,
      status: 'placed',
      source: 'user',
      category_key: 'memo',
    })
    .select('*')
    .single()
  if (error) return fail('메모를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.')

  const doc = await supabase
    .from('node_documents')
    .insert({ node_id: data.id, user_id: userId, content })
    .select('*')
    .single()
  if (doc.error) {
    await supabase.from('nodes').delete().eq('id', data.id)
    return fail('메모 내용을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.')
  }
  return { data: { node: toNode(data), document: toDocument(doc.data) } }
}

// 메모 고치기 (자동 저장): 제목은 nodes.title, 내용·색은 node_documents에
export async function saveMemo(nodeId, { title, content }) {
  const userId = await sessionUserId()
  if (!userId) return fail('로그인이 필요합니다.', 'UNAUTHENTICATED')
  const updated = await supabase.from('nodes').update({ title }).eq('id', nodeId).select('id')
  if (updated.error) return fail('메모를 저장하지 못했어요.')
  if (updated.data.length === 0) return fail('메모를 찾을 수 없어요. 새로고침해 주세요.', 'NOT_FOUND')
  const { data, error } = await supabase
    .from('node_documents')
    .upsert({ node_id: nodeId, user_id: userId, content }, { onConflict: 'node_id' })
    .select('*')
    .single()
  if (error) return fail('메모를 저장하지 못했어요.')
  return { data: { document: toDocument(data) } }
}
