// 한국 시간(KST) 기준 오늘 날짜를 'YYYY-MM-DD'로 돌려준다 (API.md 1.3)
// 일기 날짜 기본값용이다. 보상 날짜는 서버가 따로 계산한다.
export function getTodayKST() {
  // 'en-CA' 형식은 2026-11-10처럼 YYYY-MM-DD로 나온다
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date())
}

// 'YYYY-MM-DD' 형식의 실제 있는 날짜인지 확인 (주소창 ?date= 값 검사용)
export function isValidDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
}

// 숫자를 두 자리 문자열로 (3 → '03')
export function pad2(n) {
  return String(n).padStart(2, '0')
}

// 연·월·일 숫자 → 'YYYY-MM-DD'
export function toDateString(year, month, day) {
  return `${year}-${pad2(month)}-${pad2(day)}`
}
