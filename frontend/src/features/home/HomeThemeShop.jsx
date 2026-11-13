import { useEffect, useState } from 'react'
import { applyHomeThemeToDisplay, getDisplayTheme } from '../mypage/settingsStore.js'

// 상점 미구현 버전: 구매/차감 없이 홈에서 7종 테마를 자유롭게 적용한다.
export const PET_THEMES = [
  { id: 'light', name: '라이트', description: '화사하고 산뜻한 기본 화면', emoji: '☀️' },
  { id: 'dark', name: '다크', description: '눈이 편안한 어두운 기본 화면', emoji: '🌙' },
  { id: 'sunset', name: '노을', description: '포근한 노을빛 전체 화면', emoji: '🌇' },
  { id: 'ocean', name: '바다', description: '시원한 푸른 바다 전체 화면', emoji: '🌊' },
  { id: 'blossom', name: '벚꽃 정원', description: '분홍빛 꽃잎이 흩날리는 오후', emoji: '🌸' },
  { id: 'forest', name: '초록 숲', description: '푸르른 숲속의 작은 쉼터', emoji: '🌿' },
  { id: 'night', name: '별빛 밤', description: '반짝이는 별과 깊은 밤하늘', emoji: '✨' },
]

function storageKey(userId) {
  return `momentree:home-theme:${userId}`
}

function isTheme(value) {
  return PET_THEMES.some((theme) => theme.id === value)
}

function readTheme(userId) {
  if (userId) {
    try {
      const stored = localStorage.getItem(storageKey(userId))
      if (isTheme(stored)) return stored
    } catch { /* 저장소 차단 시 기본 화면 모드 사용 */ }
  }
  return getDisplayTheme()
}

export function useHomeThemeShop(userId) {
  const [equippedTheme, setEquippedTheme] = useState(() => readTheme(userId))

  useEffect(() => {
    if (!userId) return
    const selected = readTheme(userId)
    setEquippedTheme(selected)
    applyHomeThemeToDisplay(selected)
  }, [userId])

  function equip(id) {
    if (!isTheme(id)) return
    setEquippedTheme(id)
    applyHomeThemeToDisplay(id)
    if (userId) {
      try { localStorage.setItem(storageKey(userId), id) }
      catch { /* 저장이 차단되어도 현재 화면에는 적용 */ }
    }
  }

  return { equippedTheme, equip }
}

export default function HomeThemeShop({ panel, onClose, themeShop }) {
  const { equippedTheme, equip } = themeShop

  useEffect(() => {
    if (panel !== 'themes') return undefined
    function onKeyDown(event) { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [panel, onClose])

  if (panel !== 'themes') return null
  return (
    <section id="hm-side-panel" className="hm-side-panel hm-side-panel--right" aria-label="내 테마">
      <div className="hm-side-panel__header">
        <div>
          <span className="hm-side-panel__eyebrow">MOMENTREE</span>
          <h2>내 테마</h2>
          <p>원하는 테마를 자유롭게 적용해 보세요.</p>
        </div>
        <button type="button" className="hm-side-panel__close" aria-label="테마 패널 닫기" title="닫기" onClick={onClose}>×</button>
      </div>
      <div className="hm-side-panel__items">
        {PET_THEMES.map((theme) => {
          const equipped = equippedTheme === theme.id
          return (
            <article className="hm-theme-card" key={theme.id}>
              <div className={`hm-theme-card__preview hm-theme-card__preview--${theme.id}`} aria-hidden="true"><span>{theme.emoji}</span></div>
              <div className="hm-theme-card__info">
                <h3>{theme.name}</h3>
                <p>{theme.description}</p>
              </div>
              <button type="button" className="hm-theme-card__action" disabled={equipped} onClick={() => equip(theme.id)}>{equipped ? '적용 중' : '적용'}</button>
            </article>
          )
        })}
      </div>
    </section>
  )
}
