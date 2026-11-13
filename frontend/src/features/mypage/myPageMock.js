// 마이페이지 Mock 데이터 (DB 연결 전 화면 개발용)
// [미확정] 마이페이지는 아직 SPEC에 없어, 항목·형식은 팀 확정 후 API.md에 맞춰 바꾼다.
// 로그인 정보(이메일·로그인 방식)는 Supabase Auth가 관리한다. (API.md 2장)
export const mockProfile = {
  nickname: '홍길동',
  university: '○○대학교',
  email: 'student@example.com',
  loginProvider: 'google', // 'email' | 'google'
  grade: 2,
  semester: 2,
  desiredJob: 'backend', // jobGroups.js의 직무 id
  bio: '',
}

// 알림·화면 설정 기본값
export const mockSettings = {
  diaryReminder: false, // 켤 때 브라우저 알림 권한을 묻는다
  diaryReminderTime: '21:00',
  weekStart: 'sun', // 'sun' | 'mon'
  theme: 'light', // 'light' | 'dark' | 'sunset'
}
