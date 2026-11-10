// 로그인 화면용 아이콘·캐릭터 (인라인 SVG)

export function MailIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  )
}

export function LockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

export function EyeIcon({ off }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M4 4l16 16" />}
    </svg>
  )
}

export function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

// 로고 앞 새싹
export function SproutIcon() {
  return (
    <svg width="34" height="28" viewBox="0 0 34 28" aria-hidden="true">
      <path d="M17 26V13" stroke="#3D3226" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M17 14C12 4 3 5 3 10c0 5 9 6 14 4Z" fill="#F2CC6B" stroke="#3D3226" strokeWidth="2.2" />
      <path d="M17 13c4-9 13-9 14-4 1 5-8 7-14 4Z" fill="#F2CC6B" stroke="#3D3226" strokeWidth="2.2" />
    </svg>
  )
}

// 임시 캐릭터: 새싹을 단 고양이. 2번 담당의 펫 이미지(2-18)가 준비되면 이미지로 바꾼다.
export function BuddyMascot() {
  return (
    <svg className="login-mascot" viewBox="0 0 320 220" role="img" aria-label="잠자는 고양이 캐릭터">
      {/* 언덕 */}
      <ellipse cx="160" cy="205" rx="170" ry="28" fill="#C9D3A6" />
      {/* 책 */}
      <rect x="40" y="168" width="70" height="16" rx="3" fill="#8C8577" stroke="#3D3226" strokeWidth="2.5" />
      <rect x="48" y="153" width="62" height="15" rx="3" fill="#A6A090" stroke="#3D3226" strokeWidth="2.5" />
      {/* 몸 */}
      <path d="M95 190c-12-55 25-85 75-85s92 22 92 58c0 18-10 27-30 27Z"
        fill="#FFFDF7" stroke="#3D3226" strokeWidth="3" />
      {/* 꼬리 */}
      <path d="M248 175c30-5 40-30 22-42" fill="none" stroke="#3D3226" strokeWidth="3" strokeLinecap="round" />
      {/* 머리 */}
      <path d="M150 140c-35 0-55-20-50-48l-2-32 26 18c15-6 35-6 50 0l26-18-2 32c5 28-13 48-48 48Z"
        fill="#FFFDF7" stroke="#3D3226" strokeWidth="3" strokeLinejoin="round" />
      {/* 귀 무늬 */}
      <path d="M176 78l20-14-1 20Z" fill="#F6D878" />
      {/* 감은 눈 */}
      <path d="M122 103q7 6 14 0M164 103q7 6 14 0" fill="none" stroke="#3D3226" strokeWidth="3" strokeLinecap="round" />
      {/* 볼 */}
      <circle cx="118" cy="116" r="7" fill="#EAB8BE" opacity="0.8" />
      <circle cx="182" cy="116" r="7" fill="#EAB8BE" opacity="0.8" />
      {/* 입 */}
      <path d="M144 114q6 5 12 0" fill="none" stroke="#3D3226" strokeWidth="2.5" strokeLinecap="round" />
      {/* 앞발 */}
      <ellipse cx="135" cy="188" rx="18" ry="9" fill="#FFFDF7" stroke="#3D3226" strokeWidth="2.5" />
      {/* 새싹 */}
      <path d="M150 62V44" stroke="#3D3226" strokeWidth="3" strokeLinecap="round" />
      <path d="M150 46c-6-12-20-10-20-3s12 8 20 3Z" fill="#B7C48E" stroke="#3D3226" strokeWidth="2.5" />
      <path d="M150 46c6-12 20-10 20-3s-12 8-20 3Z" fill="#B7C48E" stroke="#3D3226" strokeWidth="2.5" />
    </svg>
  )
}
