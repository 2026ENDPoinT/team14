import { useState } from 'react'
import CareerRecommendPanel from './CareerRecommendPanel.jsx'
import './career.css'

// 홈의 [AI 진로 추천] 버튼. 누르면 추천 화면을 전체 화면 팝업으로 연다.
// 홈 화면을 새로 만들 때 이 컴포넌트를 원하는 위치에 그대로 옮기면 된다.
export default function CareerEntryButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className="career-entry" onClick={() => setOpen(true)}>
        AI 진로 추천
      </button>
      {open && <CareerRecommendPanel onClose={() => setOpen(false)} />}
    </>
  )
}
