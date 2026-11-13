// AI 길잡이 (로드맵 페이지): recommend-career 함수의 확장 모드
//
// index.ts가 요청 본문에 mode가 있으면 이 파일의 함수로 처리한다. (mode가 없으면 기존 온보딩 추천 그대로)
// 이 파일은 Deno·Supabase에 의존하지 않는 순수 함수만 둔다 → Node로도 단위 테스트할 수 있다.
//
// 요청: POST {
//   mode: 'both' | 'career' | 'activities',
//   grade: 1~4 | null, currentJob: 직무 키 | null,
//   keywords: 역량 키워드[] (0~15, 정해진 목록 중에서만),
//   courses: [{ title, status: 'done' | 'planned', grade?, interest? }] (0~40)
//   activities: [{ title, category, status: 'done' | 'planned' | 'idea', memo? }] (0~40)
//   diary: [{ date, text }] (0~5, 사용자가 동의하고 고른 것만. 없으면 빈 배열)
// }
// 응답: { mode, careers?: Career[], activities?: Activity[], model, recommendedAt }
//   길잡이 결과·일기·성적은 저장하지 않는다.

export const GUIDE_MODES = ['both', 'career', 'activities'] as const
export type GuideMode = (typeof GUIDE_MODES)[number]

export const GRADES = ['A+', 'A0', 'B+', 'B0', 'C+', 'C0', 'D+', 'D0', 'F']
// 활동 추천의 종류 (frontend nodeCategories.js BASE_CATEGORIES id, 전공·학업 제외)
export const ACTIVITY_CATEGORIES: Record<string, string> = {
  project: '프로젝트',
  contest: '공모전·대회',
  club: '동아리·커뮤니티',
  external: '대외활동',
  career: '연구·진로',
  study: '학업·자기계발',
  campus: '교내활동',
  free: '자유',
}
export const DIFFICULTIES = ['입문', '중급', '도전']

export const LIMITS = {
  bodyChars: 20000, // 요청 본문 전체 글자 수
  courses: 40,
  activities: 40,
  diary: 5,
  title: 40,
  category: 20,
  memo: 120,
  diaryText: 300,
  keywords: 15,
}
export const NO_EVIDENCE = '확인된 기록 없음' // 근거로 쓸 기록이 없을 때만 고르는 값

export type GuideInput = {
  mode: GuideMode
  grade: number | null
  currentJob: string | null
  keywords: string[]
  courses: { title: string; status: 'done' | 'planned'; grade?: string; interest?: number }[]
  activities: { title: string; category: string; status: 'done' | 'planned' | 'idea'; memo?: string }[]
  diary: { date: string; text: string }[]
}

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')
// 같은 활동인지 비교할 때: 공백·기호 무시, 소문자
export const normalizeTitle = (t: string) => t.toLowerCase().replace(/[\s\-_·.,()[\]/]/g, '')

// 요청 확인. 성공 { input } / 실패 { error }
export function parseGuideInput(body: unknown, jobs: Record<string, string>, keywordSet: Set<string>):
  { input: GuideInput } | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>
  if (!GUIDE_MODES.includes(b.mode as GuideMode)) return { error: 'mode가 올바르지 않습니다.' }
  const grade = b.grade == null ? null : Number(b.grade)
  if (grade !== null && !(Number.isInteger(grade) && grade >= 1 && grade <= 4)) return { error: 'grade는 1~4입니다.' }
  const currentJob = b.currentJob == null ? null : String(b.currentJob)
  if (currentJob !== null && !(currentJob in jobs)) return { error: 'currentJob이 올바르지 않습니다.' }

  const keywords = Array.isArray(b.keywords) ? b.keywords : []
  if (keywords.length > LIMITS.keywords || !keywords.every((k) => typeof k === 'string' && keywordSet.has(k))) {
    return { error: '허용되지 않은 키워드가 있습니다.' }
  }

  const rawCourses = Array.isArray(b.courses) ? b.courses : []
  const rawActivities = Array.isArray(b.activities) ? b.activities : []
  const rawDiary = Array.isArray(b.diary) ? b.diary : []
  if (rawCourses.length > LIMITS.courses || rawActivities.length > LIMITS.activities || rawDiary.length > LIMITS.diary) {
    return { error: '보낼 수 있는 항목 수를 넘었습니다.' }
  }

  const courses: GuideInput['courses'] = []
  for (const c of rawCourses as Record<string, unknown>[]) {
    const title = clean(c?.title, LIMITS.title)
    if (!title || (c.status !== 'done' && c.status !== 'planned')) return { error: '과목 형식이 올바르지 않습니다.' }
    const item: GuideInput['courses'][number] = { title, status: c.status }
    if (c.grade != null) {
      // 성적은 '완료(done)'한 과목에만 받는다 (수강하지 않은 과목의 성적은 받지 않음)
      if (c.status !== 'done' || !GRADES.includes(String(c.grade))) return { error: '성적 형식이 올바르지 않습니다.' }
      item.grade = String(c.grade)
    }
    if (c.interest != null) {
      const interest = Number(c.interest)
      if (!Number.isInteger(interest) || interest < 1 || interest > 5) return { error: '흥미도는 1~5입니다.' }
      item.interest = interest
    }
    courses.push(item)
  }

  const activities: GuideInput['activities'] = []
  for (const a of rawActivities as Record<string, unknown>[]) {
    const title = clean(a?.title, LIMITS.title)
    if (!title || !['done', 'planned', 'idea'].includes(String(a.status))) return { error: '활동 형식이 올바르지 않습니다.' }
    const item: GuideInput['activities'][number] = {
      title,
      category: clean(a.category, LIMITS.category) || '기타',
      status: a.status as 'done' | 'planned' | 'idea',
    }
    const memo = clean(a.memo, LIMITS.memo)
    if (memo) item.memo = memo
    activities.push(item)
  }

  const diary: GuideInput['diary'] = []
  for (const d of rawDiary as Record<string, unknown>[]) {
    const date = String(d?.date ?? '')
    const text = clean(d?.text, LIMITS.diaryText)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !text) return { error: '일기 형식이 올바르지 않습니다.' }
    diary.push({ date, text })
  }

  return { input: { mode: b.mode as GuideMode, grade, currentJob, keywords, courses, activities, diary } }
}

// 근거로 고를 수 있는 값: 보낸 과목·활동 이름, 역량 키워드, (일기를 보냈으면) '일기'
export function evidenceOptions(input: GuideInput): string[] {
  const refs = new Set<string>()
  for (const c of input.courses) refs.add(c.title)
  for (const a of input.activities) refs.add(a.title)
  for (const k of input.keywords) refs.add(k)
  if (input.diary.length > 0) refs.add('일기')
  refs.add(NO_EVIDENCE)
  return [...refs]
}

export function buildSystemPrompt(jobs: Record<string, string>, mode: GuideMode) {
  const wantCareer = mode !== 'activities'
  const wantActivities = mode !== 'career'
  return `당신은 컴퓨터공학과 학생의 로드맵을 보고 진로와 다음 활동을 제안하는 도우미입니다.
입력: 학년, 현재 희망 직무, 역량 키워드, 과목(done=완료, planned=계획), 활동(done=완료, planned=계획, idea=보관함 아이디어)과 메모, (선택) 일기 발췌.
과목의 grade는 사용자가 직접 입력한 성적, interest는 흥미도(1~5)입니다. 입력되지 않은 값은 모르는 것으로 둡니다.
규칙:
- 입력에 없는 경험·성적·수상·자격·인턴 경력을 지어내지 마세요. planned·idea 활동은 '계획'이지 해낸 경험이 아닙니다.
- 성적이 낮다는 이유만으로 어떤 진로를 배제하거나 부정적으로 말하지 마세요. 흥미와 경험을 함께 보세요.
- 일기는 관심사·즐거웠던 경험·활동 선호를 참고할 때만 쓰고, 성격·정신건강·감정 상태를 단정하지 마세요.
- 특정 회사·기관·공고·대회의 이름, 마감일, URL을 만들지 마세요. 활동은 일반적인 형태로 제안하세요.
- basedOn에는 근거로 쓴 입력 값을 주어진 목록에서만 고르세요. 근거가 없으면 '${NO_EVIDENCE}'만 넣으세요.
- 모든 문장은 한국어로, 짧고 구체적으로 쓰세요.
${wantCareer ? `careers: 아래 직무 중 어울리는 2~3개를 job 키로 고르세요. 각 직무에 reason(120자 이내), strengths(사용자 강점 1~3개), gaps(보완하면 좋은 역량 1~3개), actions(추천 학습·활동 1~3개)를 쓰세요.
${Object.entries(jobs).map(([k, v]) => `- ${k}: ${v}`).join('\n')}` : 'careers는 빈 배열로 두세요.'}
${wantActivities ? `activities: 앞으로 할 만한 활동 5개를 제안하세요. 이미 입력에 있는 활동과 같은 내용은 제안하지 마세요.
각 활동: title(30자 이내), category(${Object.entries(ACTIVITY_CATEGORIES).map(([k, v]) => `${k}=${v}`).join(', ')}), reason(120자 이내),
basedOn, timing(권장 시작 시점. 학기·방학 등 '제안'으로 30자 이내), difficulty(입문·중급·도전), gains(얻을 경험·기술 1~3개), firstStep(지금 바로 할 첫 단계 80자 이내).` : 'activities는 빈 배열로 두세요.'}`
}

const textList = { type: 'ARRAY', items: { type: 'STRING' } }
export function buildResponseSchema(jobs: Record<string, string>, refs: string[]) {
  const basedOn = { type: 'ARRAY', items: { type: 'STRING', enum: refs } }
  return {
    type: 'OBJECT',
    properties: {
      careers: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            job: { type: 'STRING', enum: Object.keys(jobs) },
            reason: { type: 'STRING' },
            strengths: textList,
            gaps: textList,
            actions: textList,
            basedOn,
          },
          required: ['job', 'reason', 'strengths', 'gaps', 'actions', 'basedOn'],
        },
      },
      activities: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            title: { type: 'STRING' },
            category: { type: 'STRING', enum: Object.keys(ACTIVITY_CATEGORIES) },
            reason: { type: 'STRING' },
            basedOn,
            timing: { type: 'STRING' },
            difficulty: { type: 'STRING', enum: DIFFICULTIES },
            gains: textList,
            firstStep: { type: 'STRING' },
          },
          required: ['title', 'category', 'reason', 'basedOn', 'timing', 'difficulty', 'gains', 'firstStep'],
        },
      },
    },
    required: ['careers', 'activities'],
  }
}

// Gemini 응답 검증 ───────────────────────────────────────

const URL_RE = /https?:\/\/|www\./i
const okText = (v: unknown, min: number, max: number) =>
  typeof v === 'string' && v.trim().length >= min && v.trim().length <= max && /[가-힣]/.test(v) && !URL_RE.test(v)
const okList = (v: unknown, max: number) =>
  Array.isArray(v)
    ? v.filter((x): x is string => okText(x, 1, max)).map((x) => x.trim()).slice(0, 3)
    : []
// 근거: 보낸 값 중에서만. '확인된 기록 없음'은 다른 근거와 섞이면 뺀다
function grounded(v: unknown, refs: string[]) {
  const list = Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && refs.includes(x)))] : []
  const real = list.filter((x) => x !== NO_EVIDENCE)
  return real.slice(0, 4)
}

export type Career = { job: string; reason: string; strengths: string[]; gaps: string[]; actions: string[]; basedOn: string[] }
export type Activity = {
  title: string; category: string; reason: string; basedOn: string[]; timing: string
  difficulty: string; gains: string[]; firstStep: string
}

// 결과: { careers, activities } 또는 null (형식이 맞지 않음)
export function validateGuideOutput(raw: unknown, input: GuideInput, jobs: Record<string, string>) {
  if (!raw || typeof raw !== 'object') return null
  const refs = evidenceOptions(input)
  const r = raw as Record<string, unknown>
  const wantCareer = input.mode !== 'activities'
  const wantActivities = input.mode !== 'career'

  const careers: Career[] = []
  if (wantCareer) {
    const seen = new Set<string>()
    for (const c of (Array.isArray(r.careers) ? r.careers : []) as Record<string, unknown>[]) {
      if (typeof c?.job !== 'string' || !(c.job in jobs) || seen.has(c.job)) continue
      if (!okText(c.reason, 10, 200)) continue
      const strengths = okList(c.strengths, 60)
      const gaps = okList(c.gaps, 60)
      const actions = okList(c.actions, 80)
      if (strengths.length === 0 || gaps.length === 0 || actions.length === 0) continue
      seen.add(c.job)
      careers.push({ job: c.job, reason: (c.reason as string).trim(), strengths, gaps, actions, basedOn: grounded(c.basedOn, refs) })
      if (careers.length === 3) break
    }
    if (careers.length < 2) return null
  }

  const activities: Activity[] = []
  if (wantActivities) {
    // 이미 로드맵에 있는 활동·과목과 같은 이름이면 뺀다 (같은 내용 반복 추천 방지)
    const existing = new Set([...input.activities, ...input.courses].map((x) => normalizeTitle(x.title)))
    for (const a of (Array.isArray(r.activities) ? r.activities : []) as Record<string, unknown>[]) {
      if (!okText(a?.title, 2, 40)) continue
      const title = (a.title as string).trim()
      const key = normalizeTitle(title)
      if (existing.has(key)) continue
      if (typeof a.category !== 'string' || !(a.category in ACTIVITY_CATEGORIES)) continue
      if (typeof a.difficulty !== 'string' || !DIFFICULTIES.includes(a.difficulty)) continue
      if (!okText(a.reason, 10, 200) || !okText(a.timing, 2, 40) || !okText(a.firstStep, 5, 120)) continue
      const gains = okList(a.gains, 40)
      if (gains.length === 0) continue
      existing.add(key)
      activities.push({
        title,
        category: a.category,
        reason: (a.reason as string).trim(),
        basedOn: grounded(a.basedOn, refs),
        timing: (a.timing as string).trim(),
        difficulty: a.difficulty,
        gains,
        firstStep: (a.firstStep as string).trim(),
      })
      if (activities.length === 5) break
    }
    if (activities.length < 3) return null
  }

  return { careers, activities }
}
