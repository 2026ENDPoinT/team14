// 교과목 선정 함수 테스트 (실행: frontend 폴더에서 node --test src/features/onboarding/selectCourses.test.mjs)
// 실제 교과과정·직무 관련도 데이터(frontend/src/data)로 확인한다. 직무 키는 앱의 키(ai, system_network …)를 쓴다.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { selectCourses } from './selectCourses.js'

const load = (name) => JSON.parse(readFileSync(new URL(`../../data/${name}`, import.meta.url), 'utf8'))
const curriculum = load('curriculum-2026.json')
const jobRelevance = load('job-relevance.json')
const titleOf = (key) => curriculum.courses.find((c) => c.key === key).title
const keyOf = (title) => curriculum.courses.find((c) => c.title === title).key
const run = (grade, jobs = [], completedTitles = []) =>
  selectCourses({ grade, jobs, completedCourseKeys: completedTitles.map(keyOf), curriculum, jobRelevance })
const titles = (list) => list.map((n) => n.title)
const future = (r) => r.courseNodes.filter((n) => !n.completed)
const missedTitles = (r) => titles(r.missedCourses)

test('3학년 백엔드: 2학년 핵심 과목을 안 들었으면 수강 필요에 나오고, 이유가 붙는다', () => {
  const r = run(3, ['backend'])
  for (const t of ['자료구조', '객체지향프로그래밍언어', '데이터베이스', '웹프로그래밍']) assert.ok(missedTitles(r).includes(t), t)
  const ds = r.missedCourses.find((c) => c.title === '자료구조')
  assert.deepEqual(ds.reasons.map((x) => x.label), ['백엔드 핵심 과목'])
  // 관련도 2점(유닉스시스템)은 놓친 과목 안내 대상이 아니다 (핵심 3점·전공필수·선수과목만)
  assert.ok(!missedTitles(r).includes('유닉스시스템'))
})

test('3학년 백엔드: 이미 이수한 핵심 과목은 수강 필요에서 빠지고 이수 완료로만 남는다', () => {
  const r = run(3, ['backend'], ['자료구조', '데이터베이스'])
  assert.ok(!missedTitles(r).includes('자료구조') && !missedTitles(r).includes('데이터베이스'))
  assert.deepEqual(titles(r.courseNodes.filter((n) => n.completed)), ['자료구조', '데이터베이스'])
})

test('놓친 전공필수는 직무와 관계없이 안내된다', () => {
  const r = run(3, ['backend'])
  for (const t of ['프로그래밍입문(1)', '프로그래밍입문(2)', '이산수학']) {
    const c = r.missedCourses.find((x) => x.title === t)
    assert.ok(c, t)
    assert.ok(c.reasons.some((x) => x.label === '전공필수'))
  }
})

test('남은 학년: 전공필수는 직무 점수와 무관하게 포함, 관련도 2점 미만 일반 과목은 제외', () => {
  const r = run(2, ['uiux'])
  const f = titles(future(r))
  assert.ok(f.includes('캡스톤디자인(1)') && f.includes('캡스톤디자인(2)'))
  assert.ok(f.includes('고급웹프로그래밍')) // uiux 2점
  for (const t of ['운영체제', '컴퓨터네트워크', '정보보호론', '형식언어및오토마타']) assert.ok(!f.includes(t), t) // uiux 0점
  assert.ok(future(r).every((n) => n.year > 2))
})

test('직무 미선택·미정·기타: 미래는 전공필수만, 놓친 과목도 전공필수만', () => {
  for (const jobs of [[], ['undecided'], ['other']]) {
    const r = run(3, jobs)
    assert.deepEqual(titles(future(r)), ['캡스톤디자인(1)', '캡스톤디자인(2)'], JSON.stringify(jobs))
    assert.deepEqual(missedTitles(r), ['프로그래밍입문(1)', '프로그래밍입문(2)', '이산수학'], JSON.stringify(jobs))
  }
})

test('다중 직무: 과목별 최고 점수 기준, 이유는 해당 직무마다, 같은 과목은 한 번만', () => {
  const r = run(2, ['backend', 'security'])
  const os = r.courseNodes.find((n) => n.title === '운영체제')
  assert.deepEqual(os.reasons.map((x) => x.label), ['백엔드 핵심 과목', '정보보안 핵심 과목'])
  const keys = [...r.courseNodes, ...r.missedCourses].map((n) => n.courseKey)
  assert.equal(new Set(keys).size, keys.length)
  // 백엔드 0점이지만 정보보안 3점 → 포함
  assert.ok(titles(future(r)).includes('정보보호론'))
})

test('4학년: 미래 학년 추천이 비어도 놓친 저학년 과목은 안내한다', () => {
  const r = run(4, ['ai'])
  assert.equal(future(r).length, 0)
  assert.ok(missedTitles(r).includes('기계학습')) // 3학년 AI 핵심
  assert.ok(missedTitles(r).includes('선형대수학')) // 1학년 AI 핵심
  assert.ok(!missedTitles(r).includes('자연어처리')) // 4학년 = 현재 학년 → 놓친 과목 아님
})

test('현재 학년 미이수 과목은 미래 추천도 수강 필요도 아니다', () => {
  const r = run(2, ['backend'])
  const all = [...r.courseNodes, ...r.missedCourses]
  assert.ok(!all.some((n) => n.year === 2 && !n.completed))
})

test('학년이 앞서 있어도 이수했다고 고른 과목은 완료로 처리한다', () => {
  const r = run(1, ['backend'], ['운영체제', '캡스톤디자인(2)'])
  const done = r.courseNodes.filter((n) => n.completed)
  assert.deepEqual(titles(done), ['운영체제', '캡스톤디자인(2)'])
  assert.ok(!titles(future(r)).includes('운영체제'))
})

test('확인된 선수과목(데이터의 prerequisites)만 쓴다. 없으면 추정하지 않는다', () => {
  // 실제 데이터에는 선수관계가 없다 → 선수과목 이유가 하나도 없어야 한다
  const r = run(3, ['backend'])
  assert.ok(r.missedCourses.every((c) => c.reasons.every((x) => x.type !== 'prerequisite')))
  // 픽스처: 미래 추천 과목(운영체제)에 선수과목(유닉스시스템, 2학년·백엔드 2점)이 있다고 하면 그때만 안내
  const withPre = { ...curriculum, courses: curriculum.courses.map((c) => (c.title === '운영체제' ? { ...c, prerequisites: [keyOf('유닉스시스템')] } : c)) }
  const r2 = selectCourses({ grade: 2, jobs: ['backend'], completedCourseKeys: [], curriculum: withPre, jobRelevance })
  assert.ok(!missedTitles(r2).includes('유닉스시스템')) // 2학년이면 유닉스시스템(2학년)은 현재 학년 → 안내 안 함
  const r3 = selectCourses({ grade: 3, jobs: ['backend'], completedCourseKeys: [], curriculum: withPre, jobRelevance })
  const unix = r3.missedCourses.find((c) => c.title === '유닉스시스템')
  // 3학년이면 운영체제(3학년)는 미래가 아니라 추천 대상이 아니다 → 선수과목 안내도 없음
  assert.equal(unix, undefined)
  const r4 = selectCourses({ grade: 2, jobs: ['backend'], completedCourseKeys: [], curriculum: { ...withPre, courses: withPre.courses.map((c) => (c.title === '운영체제' ? { ...c, prerequisites: [keyOf('선형대수학')] } : c)) }, jobRelevance })
  const la = r4.missedCourses.find((c) => c.title === '선형대수학')
  assert.deepEqual(la?.reasons.map((x) => x.label), ['운영체제 선수과목'])
  assert.equal(titleOf(la.courseKey), '선형대수학')
})

test('결과 형식: courseNodes는 RPC 형식(courseKey·title·year·semester·completed), 과목 키는 저장된 형식 그대로', () => {
  const r = run(2, ['backend'], ['자료구조'])
  for (const n of r.courseNodes) {
    assert.match(n.courseKey, /^cs2026-[1-4]-[12]-\d{2}$/)
    assert.equal(typeof n.completed, 'boolean')
    if (!n.completed) assert.ok(n.year > 2) // complete_onboarding 검증: 추천은 year > grade
  }
})
