import { useEffect, useState } from 'react'

// 열고 닫을 때 애니메이션이 끝날 때까지 화면에 남겨 두는 훅
// mounted: 화면에 그릴지 / visible: 보이는 상태(CSS 클래스)인지
export default function usePresence(open, duration = 220) {
  const [mounted, setMounted] = useState(open)
  const [visible, setVisible] = useState(open)

  useEffect(() => {
    if (open) {
      setMounted(true)
      // 다음 프레임에 visible을 켜야 등장 애니메이션이 보인다
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
      return () => cancelAnimationFrame(id)
    }
    setVisible(false)
    const timer = setTimeout(() => setMounted(false), duration)
    return () => clearTimeout(timer)
  }, [open, duration])

  return { mounted, visible }
}
