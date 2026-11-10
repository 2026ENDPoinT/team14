// 한국 시간(KST) 기준 오늘 날짜를 'YYYY-MM-DD'로 돌려준다 (API.md 1.3)
// 일기 날짜 기본값용이다. 보상 날짜는 서버가 따로 계산한다.
export function getTodayKST() {
  // 'en-CA' 형식은 2026-11-10처럼 YYYY-MM-DD로 나온다
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date())
}
