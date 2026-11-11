// 일기 보상(온기) 기준: 공백을 포함한 본문 글자 수 20자 이상
// ※ SPEC 8장·API.md는 아직 '공백 제외 30자'로 적혀 있음 → 문서 담당이 바꿔야 함
// 화면 표시용이다. 실제 보상 여부는 서버(save_diary RPC)가 다시 세어서 판단한다.
export const REWARD_MIN_CHARS = 20

// 띄어쓰기·줄바꿈까지 포함한 글자 수
export function countChars(text) {
  if (!text) return 0
  // [...문자열]로 세면 이모지도 1글자로 센다
  return [...text].length
}

export function meetsRewardLength(text) {
  return countChars(text) >= REWARD_MIN_CHARS
}

// 예전 기준(공백 제외). 지금은 쓰지 않는 DiaryEditor.jsx가 불러오고 있어 남겨 둔다.
export function countCharsWithoutSpaces(text) {
  if (!text) return 0
  return [...text.replace(/\s/g, '')].length
}
