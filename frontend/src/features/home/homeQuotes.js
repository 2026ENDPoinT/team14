// HOME 아래쪽에 랜덤으로 바뀌는 한마디 (게임 로딩 화면의 팁처럼)
// - 응원 · 대학생활/기록 · 개발 농담 · 이스터에그
// - rare: true 인 문구는 가끔만 나온다 (이스터에그)
// 문구를 추가·수정할 때는 이 목록만 고치면 된다.

export const HOME_QUOTES = [
  // 응원
  { text: '오늘의 작은 기록이 내일의 큰 추억이 될지도 몰라.' },
  { text: '로드맵은 바뀌어도 괜찮아. 네 속도가 중요하니까.' },
  { text: '오늘도 경험치 대신 추억을 쌓아볼까?' },
  { text: '오늘 공부한 거, 내일의 내가 고마워할 거야.' },
  { text: '잘 쉬는 것도 실력이야. 오늘은 충전 모드 어때?' },
  { text: '남의 로드맵 말고 내 로드맵 보기. 그게 제일 정확해.' },
  { text: '오늘 배운 걸 한 줄로 정리하면 뭐야?' },
  { text: '오늘의 TODO: 밥 잘 먹기 ✅' },

  // 대학생활 · 기록
  { text: '휴학도, 군대도, 교환학생도 다 네 로드맵의 일부야.' },
  { text: '동아리, 공모전, 스터디… 해 보는 만큼 넓어지는 게 대학생활!' },
  { text: '작은 프로젝트 하나가 큰 방향을 알려 주기도 해.' },
  { text: '과제 마감 D-1? 일단 물 한 잔 마시고 시작하자.' },
  { text: '시험 기간엔 펫도 같이 밤새는 중… 🌙' },
  { text: '혹시 지금 해야 할 일을 미루고 있는 건 아니지? 👀' },

  // 개발 농담
  { text: '운영체제는 어려워도, 오늘 하루는 네가 운영 중!' },
  { text: '404: 오늘의 의욕을 찾을 수 없습니다.' },
  { text: '네 인생의 main 브랜치는 네가 관리하는 거야.' },
  { text: '오늘 하루도 무사히 컴파일되길!' },
  { text: '커밋 메시지처럼, 오늘 한 줄만 남겨도 충분해.' },
  { text: '무한 루프 같은 하루라면 break; 한 번 걸어도 돼.' },
  { text: 'Ctrl+S는 자주, 걱정은 조금만.' },
  { text: 'git push 전에 심호흡 한 번.' },
  { text: '할 일이 스택처럼 쌓였다면, 하나씩 pop 하면 돼.' },
  { text: 'null이어도 괜찮아. 아직 값이 안 들어왔을 뿐이야.' },
  { text: '버그 없는 코드는 없어. 고칠 줄 아는 사람만 있을 뿐.' },
  { text: '오늘의 커밋이 쌓이면 언젠가 잔디밭이 돼 🌱' },

  // 이스터에그 (가끔만)
  { text: '🥚 이스터에그 발견! 오늘은 운이 좋은 날이야.', rare: true },
  { text: '펫이 방금 너한테 윙크했어. 못 봤어? 😉', rare: true },
  { text: 'sudo 행복해져라 — 권한 승인됨 ✨', rare: true },
]

const RARE_CHANCE = 0.3 // 이스터에그 문구가 뽑혔을 때 실제로 보여 줄 확률

// 다음 문구 번호: 바로 전 문구(current)와 다른 것 하나. random은 테스트에서 바꿔 끼울 수 있다.
export function pickQuoteIndex(current = -1, random = Math.random) {
  const count = HOME_QUOTES.length
  for (let tries = 0; tries < 20; tries += 1) {
    const index = Math.floor(random() * count)
    if (index === current) continue
    if (HOME_QUOTES[index].rare && random() > RARE_CHANCE) continue
    return index
  }
  return (current + 1) % count // 아주 드물게 위에서 못 고르면 다음 문구
}
