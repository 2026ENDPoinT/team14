import { supabase } from './supabaseClient.js'

// 데이터 작업 함수 모음 (docs/API.md 4장)
// - 컴포넌트에는 camelCase 데이터를 돌려준다. DB의 snake_case 변환은 여기서만 한다.
// - 결과 형식: 성공 { data }, 실패 { error: { code, message } } (API.md 1.5)

const ERROR_CODES = ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'CONFLICT']

// Supabase 오류를 공통 오류 형식으로 바꾼다.
// DB 함수(RPC)는 message에 오류 코드, details에 한글 설명을 담아 보낸다.
function toError(error) {
  if (ERROR_CODES.includes(error.message)) {
    return { code: error.message, message: error.details || error.message }
  }
  if (error.code === '42501') {
    return { code: 'FORBIDDEN', message: '접근 권한이 없습니다.' }
  }
  return { code: 'SERVER_ERROR', message: '잠시 후 다시 시도해 주세요.' }
}

// 로그인 세션 확인 (연결 설정·로그인이 안 되어 있으면 오류)
async function requireSession() {
  if (!supabase) {
    return { code: 'SERVER_ERROR', message: 'Supabase 연결 설정(.env)이 없습니다.' }
  }
  const { data } = await supabase.auth.getSession()
  if (!data.session) {
    return { code: 'UNAUTHENTICATED', message: '로그인이 필요합니다.' }
  }
  return null
}

// ---- DB 행(snake_case) → 화면용 데이터(camelCase) ----

function toUser(row) {
  return {
    id: row.id,
    email: row.email,
    nickname: row.nickname,
    grade: row.grade,
    onboardingCompleted: row.onboarding_completed,
    interests: row.interests,
    createdAt: row.created_at,
  }
}

function toPeriod(row) {
  return { id: row.id, type: row.type, name: row.name, order: row.sort_order }
}

function toNode(row) {
  return {
    id: row.id,
    title: row.title,
    theme: row.theme,
    periodId: row.period_id,
    position: { x: row.position_x, y: row.position_y },
    status: row.status,
    source: row.source,
    originKey: row.origin_key,
    completed: row.completed,
    createdAt: row.created_at,
  }
}

// energyToNextStage는 단계 기준값 관리 방식이 [미확정]이라 아직 넣지 않는다.
function toPet(row) {
  return {
    id: row.id,
    type: row.type,
    stage: row.stage,
    energy: row.energy,
    updatedAt: row.updated_at,
  }
}

// ---- 인증 · 내 정보 (API.md 4.1) ----

// Google 로그인: Google 화면으로 이동했다가 redirectPath(예: '/login')로 돌아온다.
export async function signInWithGoogle(redirectPath) {
  if (!supabase) {
    return { error: { code: 'SERVER_ERROR', message: 'Supabase 연결 설정(.env)이 없습니다.' } }
  }
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + redirectPath },
  })
  if (error) return { error: { code: 'SERVER_ERROR', message: error.message } }
  return { data: null }
}

// Supabase 인증 오류 → 화면에 보여줄 한글 메시지
const AUTH_MESSAGES = {
  invalid_credentials: '이메일 또는 비밀번호가 올바르지 않아요.',
  email_not_confirmed: '이메일 인증을 먼저 완료해 주세요.',
  user_already_exists: '이미 가입된 이메일이에요.',
  weak_password: '비밀번호가 너무 짧거나 쉬워요. (6자 이상)',
  same_password: '이전과 다른 비밀번호를 입력해 주세요.',
  over_email_send_rate_limit: '메일을 너무 자주 보냈어요. 잠시 후 다시 시도해 주세요.',
  over_request_rate_limit: '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.',
  validation_failed: '이메일 형식을 확인해 주세요.',
}

function toAuthError(error) {
  return {
    code: 'VALIDATION_ERROR',
    message: AUTH_MESSAGES[error.code] || error.message,
  }
}

// .env 설정이 되어 있는지 (화면에서 안내용)
export const isSupabaseConfigured = Boolean(supabase)

const NO_CLIENT_ERROR ={ code: 'SERVER_ERROR', message: 'Supabase 연결 설정(.env)이 없습니다.' }

// 이메일 로그인
export async function signInWithEmail(email, password) {
  if (!supabase) return { error: NO_CLIENT_ERROR }
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: toAuthError(error) }
  return { data: null }
}

// 이메일 회원가입
// 성공: { data: { needsEmailConfirm } } — true면 인증 메일 확인이 필요 (아직 로그인 안 됨)
export async function signUpWithEmail(email, password) {
  if (!supabase) return { error: NO_CLIENT_ERROR }
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: window.location.origin + '/login' },
  })
  if (error) return { error: toAuthError(error) }
  return { data: { needsEmailConfirm: !data.session } }
}

// 비밀번호 재설정 메일 보내기 (메일 링크 → /reset-password)
export async function sendPasswordResetEmail(email) {
  if (!supabase) return { error: NO_CLIENT_ERROR }
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/reset-password',
  })
  if (error) return { error: toAuthError(error) }
  return { data: null }
}

// 재설정 링크로 들어온 상태인지 (링크를 열면 임시 로그인 세션이 생긴다)
export async function hasRecoverySession() {
  if (!supabase) return { error: NO_CLIENT_ERROR }
  const { data } = await supabase.auth.getSession()
  return { data: Boolean(data.session) }
}

// 새 비밀번호 저장
export async function updatePassword(newPassword) {
  if (!supabase) return { error: NO_CLIENT_ERROR }
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) return { error: toAuthError(error) }
  return { data: null }
}

// 이 브라우저의 세션만 종료 (비밀번호 재설정 후 복구 세션 정리용)
// 종료 요청 결과가 아니라 "세션이 실제로 남아 있는지"로 성공을 판단한다.
// (local 종료는 서버 요청 전에 브라우저 세션을 먼저 지우므로, 서버 오류가 나도 종료됐을 수 있다)
export async function endCurrentSession() {
  if (!supabase) return { error: NO_CLIENT_ERROR }
  try {
    await supabase.auth.signOut({ scope: 'local' })
  } catch {
    // 아래에서 세션이 남았는지로 판단한다.
  }
  const { data } = await supabase.auth.getSession()
  if (data.session) {
    return { error: { code: 'SERVER_ERROR', message: '로그인 세션을 종료하지 못했어요.' } }
  }
  return { data: null }
}

// 로그아웃
export async function signOut() {
  if (!supabase) return { data: null }
  const { error } = await supabase.auth.signOut()
  if (error) return { error: { code: 'SERVER_ERROR', message: error.message } }
  return { data: null }
}

// 로그인 상태 변화 구독 (로그인·로그아웃·비밀번호 재설정 링크 등)
// callback(event, userId): event는 Supabase 이벤트 이름, userId는 로그아웃이면 null
// 반환: 구독 해제 함수
export function subscribeAuthChange(callback) {
  if (!supabase) return () => {}
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session?.user?.id ?? null)
  })
  return () => data.subscription.unsubscribe()
}

// 내 정보 조회: 로그인 안 했으면 { data: null }
export async function getMyProfile() {
  if (!supabase) {
    return { error: { code: 'SERVER_ERROR', message: 'Supabase 연결 설정(.env)이 없습니다.' } }
  }
  const { data: sessionData } = await supabase.auth.getSession()
  const session = sessionData.session
  if (!session) return { data: null }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .maybeSingle()

  if (error) return { error: toError(error) }
  if (!data) return { error: { code: 'NOT_FOUND', message: '프로필이 없습니다.' } }
  return { data: toUser({ ...data, email: session.user.email }) }
}

// 내 희망 직무 변경 (마이페이지): profiles.interests를 [jobKey] 하나로 바꾼다.
// 본인 행의 interests만 수정할 수 있다 (RLS profiles_update_own + 컬럼 권한, migration 00200).
// 펫 온기·성장 단계·보상 기록은 건드리지 않는다. HOME 펫 종류는 이 값으로 정해진다.
// 성공: { data: User }
export async function updateMyDesiredJob(jobKey) {
  const sessionError = await requireSession()
  if (sessionError) return { error: sessionError }
  if (typeof jobKey !== 'string' || !jobKey.trim()) {
    return { error: { code: 'VALIDATION_ERROR', message: '희망 직무를 골라 주세요.' } }
  }
  const { data: sessionData } = await supabase.auth.getSession()
  const session = sessionData.session

  const { data, error } = await supabase
    .from('profiles')
    .update({ interests: [jobKey] })
    .eq('id', session.user.id)
    .select('*')
    .maybeSingle()
  if (error) return { error: toError(error) }
  if (!data) return { error: { code: 'NOT_FOUND', message: '프로필이 없습니다.' } }
  return { data: toUser({ ...data, email: session.user.email }) }
}

// ---- 출석 (RPC check_in, docs/backend-pet-home.md 8장) ----
// 서버가 한국 날짜(KST)로 오늘 출석 여부를 판단하고, 처음일 때만 누적 온기·보유 온기를 +100 한다.
// 중복 지급 방지는 서버(reward_events 고유 제약 + 한 트랜잭션)가 한다. 프론트는 결과만 보여 준다.
// 성공: { data: { rewarded, energy, date, pet: { energy, warmthBalance, stage } } }
//   rewarded=false면 오늘 이미 출석함 (energy 0)
// RPC가 아직 없으면: { error: { code: 'NOT_READY' } }
export async function checkInToday() {
  const sessionError = await requireSession()
  if (sessionError) return { error: sessionError }

  const { data, error } = await supabase.rpc('check_in')
  if (error) {
    // PGRST202: 함수를 찾을 수 없음 (아직 migration 미적용)
    if (error.code === 'PGRST202' || error.code === '42883') {
      return { error: { code: 'NOT_READY', message: '출석 기능은 서버 준비 중이에요.' } }
    }
    return { error: toError(error) }
  }
  // 응답 모양이 다르면 지급으로 처리하지 않는다
  const pet = data?.pet
  if (typeof data?.rewarded !== 'boolean' || !pet || !Number.isFinite(pet.energy) || !Number.isFinite(pet.warmth_balance)) {
    return { error: { code: 'SERVER_ERROR', message: '출석 결과를 확인하지 못했어요.' } }
  }
  return {
    data: {
      rewarded: data.rewarded,
      energy: data.rewarded ? data.energy : 0,
      date: data.date ?? null,
      pet: { energy: pet.energy, warmthBalance: pet.warmth_balance, stage: pet.stage },
    },
  }
}

// ---- 온보딩 (API.md 4.2) ----

// input: { nickname, grade, experiences, completedCourses, interests, roadmapMode, courseNodes }
// 성공: { data: { user, periods, nodes, pet } }
export async function completeOnboarding(input) {
  const sessionError = await requireSession()
  if (sessionError) return { error: sessionError }

  const { data, error } = await supabase.rpc('complete_onboarding', {
    grade: input.grade,
    nickname: input.nickname || null,
    experiences: input.experiences ?? [],
    completed_courses: input.completedCourses ?? [],
    interests: input.interests ?? [],
    roadmap_mode: input.roadmapMode ?? 'auto',
    course_nodes: (input.courseNodes ?? []).map((node) => ({
      course_key: node.courseKey,
      title: node.title,
      year: node.year,
      semester: node.semester,
      completed: node.completed,
    })),
  })

  if (error) return { error: toError(error) }

  return {
    data: {
      user: toUser(data.user),
      periods: data.periods.map(toPeriod),
      nodes: data.nodes.map(toNode),
      pet: toPet(data.pet),
    },
  }
}

// ---- 로드맵 (API.md 4.3) ----
// DB와 연결된 것: 학기·노드·연결선·노드 문서 조회, 노드 생성·이동·수정(이름·종류·기록)·완료 표시·삭제, 연결선 추가·변경·삭제
// 아직 화면에서만 바뀌는 것: 학기 가지선 표시 설정(branchVisibility, DB 컬럼 없음), 학기 추가·삭제(RPC 미구현)

// 로드맵 화면용 노드
// - 보관함 노드는 position을 null로 둔다 (화면 배치 규칙과 같게)
// - categoryId: 사용자 정의 종류 id(category_id) 또는 기본 종류 키(category_key). 둘 다 없으면 null → theme으로 표시
function toRoadmapNode(row) {
  const node = toNode(row)
  return {
    ...node,
    position: node.status === 'placed' ? node.position : null,
    categoryId: row.category_id ?? row.category_key ?? null,
    detailId: row.detail_key ?? null,
    contestId: row.contest_id ?? null,
    contest: toNodeContest(row.contest), // 탐색에서 추가한 대외활동 노드의 공고 정보 (없으면 null)
    jobPostingId: row.job_posting_id ?? null,
    job: toNodeJob(row.job), // 탐색에서 추가한 채용 노드의 공고 정보 (없으면 null)
    branchVisibility: null, // 학기 가지선 설정은 아직 DB에 없다 (화면에서만 유지)
  }
}

// 공고 노드에 붙는 공고 정보 (contests 행)
function toNodeContest(row) {
  if (!row) return null
  return {
    id: row.id,
    source: row.source,
    sourceTag: row.source_tag,
    sourceStatus: row.source_status,
    deadline: row.deadline, // 'YYYY-MM-DD' (KST) 또는 null
    url: row.url,
  }
}

// 채용 노드에 붙는 공고 정보 (job_postings 행)
function toNodeJob(row) {
  if (!row) return null
  return {
    id: row.id,
    source: row.source,
    title: row.title,
    company: row.company,
    deadline: row.deadline, // 'YYYY-MM-DD' (KST) 또는 null (원문에서 확인)
    url: row.url,
  }
}

// 노드 조회·생성 결과에 공고 정보를 함께 붙인다
// (nodes.contest_id → contests, nodes.job_posting_id → job_postings. migration 01400 필요)
const ROADMAP_NODE_SELECT =
  '*, contest:contests(id, source, source_tag, source_status, deadline, url), job:job_postings(id, source, title, company, deadline, url)'

function toNodeDocument(row) {
  return { nodeId: row.node_id, content: row.content, updatedAt: row.updated_at }
}

// 노드 저장 오류: 다른 사람 학기·종류(외래키), 규칙 위반을 알아볼 수 있는 문구로
function toNodeError(error) {
  if (error.code === '23503') return { code: 'VALIDATION_ERROR', message: '내 학기나 종류가 아니어서 저장할 수 없어요. 새로고침 후 다시 시도해 주세요.' }
  if (error.code === '23514') return { code: 'VALIDATION_ERROR', message: '활동 정보가 저장 규칙에 맞지 않아요.' }
  return toError(error)
}

function toEdge(row) {
  return { id: row.id, sourceNodeId: row.source_node_id, targetNodeId: row.target_node_id }
}

// 내 로드맵: { data: { periods, nodes, edges, documents } }  documents = { [nodeId]: NodeDocument }
export async function getRoadmap() {
  const sessionError = await requireSession()
  if (sessionError) return { error: sessionError }

  const [periods, nodes, edges, documents] = await Promise.all([
    supabase.from('timeline_periods').select('*').order('sort_order'),
    supabase.from('nodes').select(ROADMAP_NODE_SELECT).order('created_at'),
    supabase.from('edges').select('*').order('created_at'),
    supabase.from('node_documents').select('*'),
  ])
  const failed = [periods, nodes, edges, documents].find((r) => r.error)
  if (failed) return { error: toError(failed.error) }

  return {
    data: {
      periods: periods.data.map(toPeriod),
      nodes: nodes.data.map(toRoadmapNode),
      edges: edges.data.map(toEdge),
      documents: Object.fromEntries(documents.data.map((row) => [row.node_id, toNodeDocument(row)])),
    },
  }
}

// 바뀐 행이 0개면 NOT_FOUND (이미 지워졌거나 내 데이터가 아님 → RLS로 0행)
const notFound = (what) => ({ error: { code: 'NOT_FOUND', message: `${what}을(를) 찾을 수 없어요. 새로고침 후 다시 시도해 주세요.` } })

async function currentUserId() {
  const { data } = await supabase.auth.getSession()
  return data.session.user.id
}

// 노드 이동 저장: moves = [{ id, periodId, position: { x, y } }] → 학기에 배치(placed)
// 자리 교환은 두 노드를 함께 보낸다. 하나라도 실패하면 오류.
export async function moveNodes(moves) {
  const sessionError = await requireSession()
  if (sessionError) return { error: sessionError }
  const results = await Promise.all(
    moves.map((move) =>
      supabase
        .from('nodes')
        .update({ period_id: move.periodId, position_x: move.position.x, position_y: move.position.y, status: 'placed' })
        .eq('id', move.id)
        .select('id'),
    ),
  )
  const failed = results.find((r) => r.error || r.data.length === 0)
  if (failed) return failed.error ? { error: toNodeError(failed.error) } : notFound('활동')
  return { data: { moved: moves.length } }
}

// 완료 상태 저장
export async function setNodeCompleted(nodeId, completed) {
  const sessionError = await requireSession()
  if (sessionError) return { error: sessionError }
  const { data, error } = await supabase.from('nodes').update({ completed }).eq('id', nodeId).select('id')
  if (error) return { error: toNodeError(error) }
  if (data.length === 0) return notFound('활동')
  return { data: { completed } }
}

// 노드 상세 저장 (NODE DETAILS)
// input: { title, body, type } — type이 있으면 종류도 저장: { theme, categoryKey, categoryId, detailKey }
// 노드(이름·종류)를 먼저 고치고, 기록은 node_documents에 upsert(노드당 1개). 성공: { data: { document } }
export async function saveNodeDetail(nodeId, { title, body, type }) {
  const sessionError = await requireSession()
  if (sessionError) return { error: sessionError }

  const patch = { title }
  if (type) {
    Object.assign(patch, {
      theme: type.theme,
      category_key: type.categoryKey ?? null,
      category_id: type.categoryId ?? null,
      detail_key: type.detailKey ?? null,
    })
  }
  const updated = await supabase.from('nodes').update(patch).eq('id', nodeId).select('id')
  if (updated.error) return { error: toNodeError(updated.error) }
  if (updated.data.length === 0) return notFound('활동')

  const { data, error } = await supabase
    .from('node_documents')
    .upsert({ node_id: nodeId, user_id: await currentUserId(), content: { format: 'plain', body } }, { onConflict: 'node_id' })
    .select('*')
    .single()
  if (error) return { error: toError(error) }
  return { data: { document: toNodeDocument(data) } }
}

// 노드 삭제: 노드 문서·연결선은 DB에서 함께 지워진다 (외래키 on delete cascade)
export async function deleteNode(nodeId) {
  const sessionError = await requireSession()
  if (sessionError) return { error: sessionError }
  const { data, error } = await supabase.from('nodes').delete().eq('id', nodeId).select('id')
  if (error) return { error: toError(error) }
  if (data.length === 0) return notFound('활동')
  return { data: { deleted: true } }
}

// 연결선 추가: 내 노드끼리만 (DB 복합 외래키). 성공: { data: Edge }
export async function createEdge(sourceNodeId, targetNodeId) {
  const sessionError = await requireSession()
  if (sessionError) return { error: sessionError }
  const { data, error } = await supabase
    .from('edges')
    .insert({ user_id: await currentUserId(), source_node_id: sourceNodeId, target_node_id: targetNodeId })
    .select('*')
    .single()
  if (error) return { error: toNodeError(error) }
  return { data: toEdge(data) }
}

// 연결선 끝점 바꾸기. 성공: { data: Edge }
export async function updateEdge(edgeId, { sourceNodeId, targetNodeId }) {
  const sessionError = await requireSession()
  if (sessionError) return { error: sessionError }
  const { data, error } = await supabase
    .from('edges')
    .update({ source_node_id: sourceNodeId, target_node_id: targetNodeId })
    .eq('id', edgeId)
    .select('*')
  if (error) return { error: toNodeError(error) }
  if (data.length === 0) return notFound('연결선')
  return { data: toEdge(data[0]) }
}

// 연결선 삭제
export async function deleteEdge(edgeId) {
  const sessionError = await requireSession()
  if (sessionError) return { error: sessionError }
  const { data, error } = await supabase.from('edges').delete().eq('id', edgeId).select('id')
  if (error) return { error: toError(error) }
  if (data.length === 0) return notFound('연결선')
  return { data: { deleted: true } }
}

// 노드 생성 (ADD NODE)
// input: { title, theme, periodId, position, categoryKey, categoryId, detailKey, memo }
//   periodId가 있으면 학기에 배치(placed, position 필요), 없으면 보관함(stored)
//   categoryKey(기본 종류)와 categoryId(사용자 정의 종류)는 하나만. detailKey는 기본 종류일 때만
// 성공: { data: { node, document } }  document는 메모가 있을 때만 (메모 저장 실패 시 documentError)
export async function createNode(input) {
  const sessionError = await requireSession()
  if (sessionError) return { error: sessionError }
  const { data: sessionData } = await supabase.auth.getSession()
  const userId = sessionData.session.user.id

  const placed = Boolean(input.periodId)
  const { data, error } = await supabase
    .from('nodes')
    .insert({
      user_id: userId,
      title: input.title,
      theme: input.theme,
      period_id: placed ? input.periodId : null,
      position_x: placed ? input.position.x : 0,
      position_y: placed ? input.position.y : 0,
      status: placed ? 'placed' : 'stored',
      source: 'user',
      category_key: input.categoryKey ?? null,
      category_id: input.categoryId ?? null,
      detail_key: input.detailKey ?? null,
    })
    .select('*')
    .single()
  if (error) return { error: toNodeError(error) }

  const node = toRoadmapNode(data)
  if (!input.memo) return { data: { node, document: null } }

  // 짧은 메모는 노드 문서로 저장 (노드는 이미 저장됨: 실패해도 노드는 남기고 오류만 알린다)
  const doc = await supabase
    .from('node_documents')
    .insert({ node_id: node.id, user_id: userId, content: { format: 'plain', body: input.memo } })
    .select('*')
    .single()
  if (doc.error) return { data: { node, document: null, documentError: toError(doc.error) } }
  return { data: { node, document: toNodeDocument(doc.data) } }
}

// ---- 탐색 (공고 · 기술 글) ----
// 두 목록 모두 내 관심 분야와 태그가 겹치는 글이 먼저 온다. (migration 00700의 조회 함수)

// 접수 중인 대외활동 (한국 날짜 기준, 마감 임박순)
export async function listOpenContests(limit = 30) {
  const sessionError = await requireSession()
  if (sessionError) return { error: sessionError }

  const { data, error } = await supabase.rpc('list_open_contests_for_me', { p_limit: limit })
  if (error) return { error: toError(error) }
  return {
    data: data.map((row) => ({
      id: row.id,
      source: row.source,
      title: row.title,
      sourceTag: row.source_tag,
      sourceStatus: row.source_status,
      deadline: row.deadline,
      dDay: row.d_day,
      url: row.url,
      isPinned: row.is_pinned,
      tags: row.tags,
      matchesInterest: row.matches_interest,
    })),
  }
}

// 기술 글 (최신순)
export async function listTechArticles(limit = 30) {
  const sessionError = await requireSession()
  if (sessionError) return { error: sessionError }

  const { data, error } = await supabase.rpc('list_tech_articles_for_me', { p_limit: limit })
  if (error) return { error: toError(error) }
  return {
    data: data.map((row) => ({
      id: row.id,
      source: row.source,
      sourceName: row.source_name,
      title: row.title,
      url: row.url,
      publishedAt: row.published_at,
      tags: row.tags,
      matchesInterest: row.matches_interest,
    })),
  }
}

// 기술 글 한 건 (뉴스 상세를 주소로 바로 열거나 새로고침했을 때)
export async function getTechArticle(id) {
  const sessionError = await requireSession()
  if (sessionError) return { error: sessionError }

  const { data, error } = await supabase
    .from('tech_articles')
    .select('id, source, source_name, title, url, published_at, tags')
    .eq('id', id)
    .maybeSingle()
  if (error) return { error: toError(error) }
  if (!data) return { error: { code: 'NOT_FOUND', message: '글을 찾을 수 없습니다.' } }
  return {
    data: {
      id: data.id,
      source: data.source,
      sourceName: data.source_name,
      title: data.title,
      url: data.url,
      publishedAt: data.published_at,
      tags: data.tags,
    },
  }
}

// 채용 공고 (고용24 공채속보, migration 01200의 job_postings)
// 마감일이 오늘(한국 날짜) 이후이거나 마감일 정보가 없는 공고. 마감 임박순, 마감일 없는 공고는 뒤로
// 화면에서 컴공 관련 공고를 고른 뒤 자르므로, 접수 중인 공고를 넉넉히(기본 1000건) 받는다.
export async function listOpenJobPostings(limit = 1000) {
  const sessionError = await requireSession()
  if (sessionError) return { error: sessionError }

  const todayKst = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('job_postings')
    .select('id, source, title, company, deadline, url')
    .or(`deadline.gte.${todayKst},deadline.is.null`)
    .order('deadline', { ascending: true, nullsFirst: false })
    .order('first_seen_at', { ascending: false })
    .limit(limit)
  if (error) return { error: toError(error) }
  return {
    data: data.map((row) => ({
      id: row.id,
      source: row.source,
      title: row.title,
      company: row.company,
      deadline: row.deadline,
      url: row.url,
    })),
  }
}

// 내가 이미 로드맵에 추가한 공고: { data: { [contestId]: nodeId } }
export async function getMyContestNodeIds() {
  const sessionError = await requireSession()
  if (sessionError) return { error: sessionError }

  const { data, error } = await supabase.from('nodes').select('id, contest_id').not('contest_id', 'is', null)
  if (error) return { error: toError(error) }
  return { data: Object.fromEntries(data.map((row) => [row.contest_id, row.id])) }
}

// 대외활동 공고를 내 보관함에 추가 (RPC add_contest_to_roadmap, migration 01000·01400). 이미 추가했으면 기존 노드 (added: false)
// 성공: { data: { added, nodeId } }
export async function addContestToRoadmap(contestId) {
  const sessionError = await requireSession()
  if (sessionError) return { error: sessionError }

  const { data, error } = await supabase.rpc('add_contest_to_roadmap', { p_contest_id: contestId })
  if (error) return { error: toError(error) }
  return { data: { added: data.added, nodeId: data.node.id } }
}

// 내가 이미 로드맵에 추가한 채용 공고: { data: { [jobPostingId]: nodeId } }
export async function getMyJobPostingNodeIds() {
  const sessionError = await requireSession()
  if (sessionError) return { error: sessionError }

  const { data, error } = await supabase.from('nodes').select('id, job_posting_id').not('job_posting_id', 'is', null)
  if (error) return { error: toError(error) }
  return { data: Object.fromEntries(data.map((row) => [row.job_posting_id, row.id])) }
}

// 채용 공고를 내 보관함에 추가 (RPC add_job_posting_to_roadmap, migration 01400). 이미 추가했으면 기존 노드 (added: false)
// 성공: { data: { added, nodeId } }
export async function addJobPostingToRoadmap(jobPostingId) {
  const sessionError = await requireSession()
  if (sessionError) return { error: sessionError }

  const { data, error } = await supabase.rpc('add_job_posting_to_roadmap', { p_job_posting_id: jobPostingId })
  if (error) return { error: toError(error) }
  return { data: { added: data.added, nodeId: data.node.id } }
}

// ---- 사용자 정의 노드 종류 (API.md NodeCategory, 4.3) ----
// 로그인한 사용자 본인의 종류만 조회·추가·수정·삭제된다 (RLS).

function toNodeCategory(row) {
  return { id: row.id, name: row.name, baseTheme: row.base_theme, createdAt: row.created_at }
}

// 종류 저장 오류: 이름 중복·규칙 위반을 알아볼 수 있는 문구로
function toCategoryError(error) {
  if (error.code === '23505') return { code: 'CONFLICT', message: '이미 있는 종류예요.' }
  if (error.code === '23514') return { code: 'VALIDATION_ERROR', message: '종류 이름은 1~12자로 입력해 주세요.' }
  return toError(error)
}

// 내 종류 목록 (만든 순서): { data: NodeCategory[] }
export async function listNodeCategories() {
  const sessionError = await requireSession()
  if (sessionError) return { error: sessionError }
  const { data, error } = await supabase.from('node_categories').select('*').order('created_at')
  if (error) return { error: toCategoryError(error) }
  return { data: data.map(toNodeCategory) }
}

// 종류 추가: user_id는 DB가 로그인 사용자로 채운다. { data: NodeCategory }
export async function createNodeCategory(name, baseTheme = 'free') {
  const sessionError = await requireSession()
  if (sessionError) return { error: sessionError }
  const { data, error } = await supabase
    .from('node_categories')
    .insert({ name: name.trim(), base_theme: baseTheme })
    .select('*')
    .single()
  if (error) return { error: toCategoryError(error) }
  return { data: toNodeCategory(data) }
}

// 종류 이름 변경: { data: NodeCategory }
export async function renameNodeCategory(id, name) {
  const sessionError = await requireSession()
  if (sessionError) return { error: sessionError }
  const { data, error } = await supabase
    .from('node_categories')
    .update({ name: name.trim() })
    .eq('id', id)
    .select('*')
  if (error) return { error: toCategoryError(error) }
  if (data.length === 0) return { error: { code: 'NOT_FOUND', message: '종류를 찾을 수 없어요.' } }
  return { data: toNodeCategory(data[0]) }
}

// 종류 삭제: 연결된 노드는 남고, 노드의 사용자 정의 종류 연결(category_id)만 비워진다. { data: { deleted: true } }
export async function deleteNodeCategory(id) {
  const sessionError = await requireSession()
  if (sessionError) return { error: sessionError }
  const { data, error } = await supabase.from('node_categories').delete().eq('id', id).select('id')
  if (error) return { error: toCategoryError(error) }
  if (data.length === 0) return { error: { code: 'NOT_FOUND', message: '종류를 찾을 수 없어요.' } }
  return { data: { deleted: true } }
}
