import { NICKNAME_COST, NICKNAME_MAX, NICKNAME_SERVER_READY } from '../../profile/nickname.js'
import { PET_STAGES } from '../../pet/petStages.js'

// HOME 튜토리얼 단계 (target: 강조할 실제 HOME 요소)
// 숫자는 실제 규칙 값에서 가져온다: 성장 기준(petStages.js), 출석 +100·일기 +200(서버 check_in·save_diary), 닉네임 규칙(nickname.js)
const [, baby, kid, adult] = PET_STAGES

export const HOME_TUTORIAL_STEPS = [
  {
    target: '.hm-pet',
    title: '나의 펫',
    lines: [
      '희망 직무에 따라 펭귄·수달·검은 고양이·햄스터·토끼 중 하나가 함께해요.',
      '출석하고 일기를 쓰며 온기를 모으면 새싹에서 점점 자라요.',
    ],
  },
  {
    target: '.hm-growth',
    title: '성장 단계',
    lines: [
      '왼쪽 큰 점은 지금 단계, 끝의 두 원은 다음 단계예요. 작은 점 15개가 다음 단계까지 얼마나 왔는지 채워져요.',
      `누적 온기 ${baby.minEnergy.toLocaleString()} · ${kid.minEnergy.toLocaleString()} · ${adult.minEnergy.toLocaleString()}에서 ${baby.name} · ${kid.name} · ${adult.name}으로 자라고, ${adult.name}이 되면 점이 모두 채워져요.`,
    ],
  },
  {
    target: '.hm-name',
    title: '이름 바꾸기',
    lines: [
      `이름 옆 연필을 누르면 닉네임을 바꿀 수 있어요. (최대 ${NICKNAME_MAX}자)`,
      `첫 변경은 무료, 두 번째부터는 온기 ${NICKNAME_COST}이 필요해요.`,
      ...(NICKNAME_SERVER_READY ? [] : ['지금은 서버 준비 중이라 바꿔도 저장되지 않고 "준비 중" 안내가 나와요. 온기도 쓰이지 않아요.']),
    ],
  },
  {
    target: '.hm-warmth',
    title: '온기',
    lines: [
      '하루 첫 출석에 +100, 오늘 일기를 20자 이상 쓰면 하루 한 번 +200을 받아요.',
      '여기 숫자는 쓸 수 있는 온기예요. 펫 성장은 지금까지 모은 누적 온기로 정해져서, 온기를 써도 단계는 내려가지 않아요.',
    ],
  },
  {
    target: '.hm-quote',
    title: '펫의 한마디',
    lines: ['펫이 건네는 짧은 응원이에요. 몇 초마다 바뀌고, 누르면 바로 다른 말을 해요.'],
  },
]
