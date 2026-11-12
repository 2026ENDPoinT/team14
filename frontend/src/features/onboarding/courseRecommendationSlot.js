// 과목 추천 데이터·함수 연결 (docs/API.md 4.4)
//
// - 교과과정 목록: frontend/src/data/curriculum-2026.json (2026 연계도의 공식 정보만, 48과목)
// - 직무 관련도: frontend/src/data/job-relevance.json (팀 판단, minScore 2)
// - 선정 함수: ./selectCourses.js

import curriculumData from '../../data/curriculum-2026.json'
import jobRelevanceData from '../../data/job-relevance.json'

// courses: [{ key, title, year, semester, category, area, needsCheck }]
export const curriculum = curriculumData

// jobs: { 직무 키: { 과목 키: 점수 } }
export const jobRelevance = jobRelevanceData

export { selectCourses } from './selectCourses.js'
