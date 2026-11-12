import { useEffect, useState } from 'react'
import { HOME_QUOTES, pickQuoteIndex } from './homeQuotes.js'

const ROTATE_MS = 8000 // 자동으로 바뀌는 간격

// HOME 아래쪽 랜덤 한마디
// - 처음 들어오면 랜덤 문구, 8초마다 다른 문구 (바로 전과 같은 문구는 나오지 않음)
// - 누르면(클릭·터치·Enter·Space) 바로 다음 문구. 누른 뒤에는 8초를 다시 센다
// - HOME을 벗어나면 타이머 정리
export default function HomeQuote() {
  const [index, setIndex] = useState(() => pickQuoteIndex())

  // 문구가 바뀔 때마다 타이머를 새로 건다 (setTimeout 하나만 유지)
  useEffect(() => {
    const timer = setTimeout(() => setIndex((i) => pickQuoteIndex(i)), ROTATE_MS)
    return () => clearTimeout(timer)
  }, [index])

  return (
    <button
      type="button"
      className="hm-quote"
      onClick={() => setIndex((i) => pickQuoteIndex(i))}
      title="다른 한마디 보기"
    >
      {/* key가 바뀌면 새로 그려져 짧게 페이드 인 */}
      <span key={index} className="hm-quote__text">{HOME_QUOTES[index].text}</span>
    </button>
  )
}
