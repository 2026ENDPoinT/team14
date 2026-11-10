// 일기 보상 기준: 공백을 뺀 본문 글자 수 30자 이상 (SPEC.md 8장)
// 화면 표시용이다. 실제 보상 여부는 서버(save_diary RPC)가 다시 세어서 판단한다.
export const REWARD_MIN_CHARS = 30

// 띄어쓰기·줄바꿈·탭 등 모든 공백을 뺀 글자 수
export function countCharsWithoutSpaces(text) {
  if (!text) return 0
  // [...문자열]로 세면 이모지도 1글자로 센다
  return [...text.replace(/\s/g, '')].length
}

export function meetsRewardLength(text) {
  return countCharsWithoutSpaces(text) >= REWARD_MIN_CHARS
}
