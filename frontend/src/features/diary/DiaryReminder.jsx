import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.jsx'
import { getDiaryByDate, loadDiaries } from './diaryStore.js'
import { getTodayKST } from './dateUtils.js'
import { loadSettings } from '../mypage/settingsStore.js'

// 일기 쓰기 알림 (브라우저 알림)
// - 마이페이지 '알림'에서 켜고 시간을 정하면, 그 시간이 지났을 때 오늘 일기가 없으면 한 번 알려 준다.
// - 서버 없이 브라우저가 보내는 알림이라, 우리 사이트가 탭에 열려 있을 때만 온다.
// - 화면에는 아무것도 그리지 않는다. App.jsx에서 한 번만 쓴다.
const CHECK_MS = 30 * 1000 // 30초마다 확인
const SENT_KEY = 'campus-roadmap:diary-reminder-sent' // 오늘 이미 보냈는지 (날짜 저장)

// 한국 시간 'HH:MM'
function nowTimeKST() {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date())
}

function readSent() {
  try { return localStorage.getItem(SENT_KEY) } catch { return null }
}
function markSent(date) {
  try { localStorage.setItem(SENT_KEY, date) } catch { /* 저장 못 해도 계속 */ }
}

export function canNotify() {
  return typeof window !== 'undefined' && 'Notification' in window
}

// 알림 띄우기 (누르면 그날 일기 화면으로)
export function showDiaryNotification(onOpen) {
  if (!canNotify() || Notification.permission !== 'granted') return false
  const notification = new Notification('오늘의 일기를 남겨 보세요', {
    body: '하루 한 줄도 충분해요. 일기를 쓰면 펫이 온기를 받아요.',
    tag: 'diary-reminder', // 같은 알림이 여러 개 쌓이지 않게
  })
  notification.onclick = () => {
    window.focus()
    onOpen?.()
    notification.close()
  }
  return true
}

export default function DiaryReminder() {
  const auth = useAuth()
  const navigate = useNavigate()
  const signedIn = auth.status === 'ready' && auth.profile?.onboardingCompleted

  useEffect(() => {
    if (!signedIn || !canNotify()) return

    async function check() {
      const settings = loadSettings()
      if (!settings.diaryReminder || Notification.permission !== 'granted') return
      const today = getTodayKST()
      if (readSent() === today) return // 오늘 이미 알림
      if (nowTimeKST() < settings.diaryReminderTime) return // 아직 시간 전
      await loadDiaries() // 이미 불러왔으면 다시 부르지 않는다
      if (getDiaryByDate(today)) return // 오늘 일기를 이미 씀
      if (showDiaryNotification(() => navigate(`/diary?date=${today}`))) markSent(today)
    }

    check()
    const timer = setInterval(check, CHECK_MS)
    return () => clearInterval(timer)
  }, [signedIn, navigate])

  return null
}
