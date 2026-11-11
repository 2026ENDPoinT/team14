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
