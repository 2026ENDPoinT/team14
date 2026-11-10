import { useNavigate, useSearchParams } from 'react-router-dom'
import RoadmapNav from '../features/roadmap/RoadmapNav.jsx'
import DiaryEditor from '../features/diary/DiaryEditor.jsx'
import { getTodayKST, isValidDateString } from '../features/diary/dateUtils.js'
// 로드맵과 같은 디자인을 쓰기 위해 로드맵 스타일(rm-*)을 함께 불러온다. (수정하지 않고 사용만)
import '../features/roadmap/roadmap.css'
import '../features/diary/DiaryEditor.css'

// 일기 작성 페이지 (/diary)
// /diary?date=2026-11-08 처럼 들어오면 그 날짜의 일기를 연다. (추억 보관소 캘린더에서 이동)
// &from=memories 가 붙어 있으면 왼쪽 위에 추억 보관소로 돌아가는 화살표를 보여 준다.
export default function DiaryPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const fromMemories = searchParams.get('from') === 'memories'
  const dateParam = searchParams.get('date')
  // 형식이 틀리거나 미래 날짜면 무시하고 오늘로 연다
  const initialDate = isValidDateString(dateParam) && dateParam <= getTodayKST() ? dateParam : null

  return (
    <div className="diary-page">
      <RoadmapNav />
      <main className="dy-main">
        {/* key: 주소의 날짜가 바뀌면 편집기를 새로 그려 그 날짜로 연다 */}
        <DiaryEditor
          key={initialDate || 'today'}
          initialDate={initialDate}
          // 돌아가면 보고 있던 날짜의 달 달력을 연다 (예: 2026-11-08 → /memories?month=2026-11)
          onBack={fromMemories ? (date) => navigate(`/memories?month=${date.slice(0, 7)}`) : null}
        />
      </main>
    </div>
  )
}
