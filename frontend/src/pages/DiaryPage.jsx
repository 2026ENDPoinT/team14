import RoadmapNav from '../features/roadmap/RoadmapNav.jsx'
import DiaryEditor from '../features/diary/DiaryEditor.jsx'
// 로드맵과 같은 디자인을 쓰기 위해 로드맵 스타일(rm-*)을 함께 불러온다. (수정하지 않고 사용만)
import '../features/roadmap/roadmap.css'
import '../features/diary/DiaryEditor.css'

// 일기 작성 페이지 (/diary)
export default function DiaryPage() {
  return (
    <div className="diary-page">
      <RoadmapNav />
      <main className="dy-main">
        <DiaryEditor />
      </main>
    </div>
  )
}
