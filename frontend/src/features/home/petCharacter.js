// HOME 펫 외형: 직무 → 펫 종류, 펫 종류·단계 → 캐릭터 이미지
// - 펫 종류 키: penguin · otter · black_cat · hamster · rabbit (기본 이름 포·루·밤·뭉·솜)
// - pets.type(외형 키)은 문서상 [미확정]이고 온보딩 RPC는 아직 비워 둔다(null).
//   그래서 pets.type → (펫 키 또는 직무 키) → profile.interests[0](희망 직무) 순서로 찾는다.
// - undecided(아직 정하지 않음)는 온보딩에서 직접 고른 펫을 쓰기로 했지만, 고르는 단계·저장 칸이
//   아직 없다 → 고른 값이 없으면 null (화면은 "펫 종류 미정" 대체 상태)

export const PET_CHARACTERS = {
  penguin: { name: '포', label: '펭귄' },
  otter: { name: '루', label: '수달' },
  black_cat: { name: '밤', label: '검은 고양이' },
  hamster: { name: '뭉', label: '햄스터' },
  rabbit: { name: '솜', label: '토끼' },
}

// 희망 직무 키(온보딩 CAREERS) → 펫 종류
export const JOB_TO_PET = {
  backend: 'penguin',
  frontend: 'penguin',
  mobile: 'penguin',
  ai: 'otter',
  data: 'otter',
  security: 'black_cat',
  system_network: 'black_cat',
  embedded_iot: 'hamster',
  game: 'hamster',
  uiux: 'rabbit',
}

// 펫 종류 키 찾기 (없으면 null)
export function resolvePetCharacter(pet, interests = []) {
  const type = pet?.type
  if (type && PET_CHARACTERS[type]) return type // 이미 펫 키로 저장된 경우 (온보딩에서 고른 펫 포함)
  if (type && JOB_TO_PET[type]) return JOB_TO_PET[type] // 직무 키로 저장된 경우 (API.md 예시 "backend")
  for (const job of interests ?? []) {
    if (JOB_TO_PET[job]) return JOB_TO_PET[job]
  }
  return null // undecided·other 이면서 고른 펫이 없음
}

// ───── 캐릭터 이미지 (투명 배경 PNG) ─────
// 파일을 frontend/src/assets/pets/ 에 넣으면 코드 수정 없이 바로 쓰인다.
//   1단계(공통 새싹): sprout.png
//   2~4단계: <펫 키>-<단계>.png  예) penguin-2.png, black_cat-4.png
// ※ 2~4단계 파일은 docs/references/figma/Pet/<동물>/0N_transprent.png(투명 배경)를 복사한 것.
//   같은 폴더의 01·02·03·04.png는 HOME 전체 화면 스크린샷(배경 포함, 1440×900)이라 쓰지 않는다.
const files = import.meta.glob('../../assets/pets/*.png', { eager: true, import: 'default' })
const ASSETS = Object.fromEntries(Object.entries(files).map(([path, url]) => [path.split('/').pop().replace('.png', ''), url]))

export function petAssetName(character, stage) {
  if (stage <= 1) return 'sprout'
  return character ? `${character}-${stage}` : null
}

// 이미지 주소 (아직 파일이 없으면 null)
export function petAssetUrl(character, stage) {
  const name = petAssetName(character, stage)
  return name ? ASSETS[name] ?? null : null
}

// 필요한 파일 목록 (누락 보고·테스트용)
export const REQUIRED_PET_ASSETS = [
  'sprout',
  ...Object.keys(PET_CHARACTERS).flatMap((key) => [2, 3, 4].map((stage) => `${key}-${stage}`)),
]
export const MISSING_PET_ASSETS = REQUIRED_PET_ASSETS.filter((name) => !ASSETS[name])
