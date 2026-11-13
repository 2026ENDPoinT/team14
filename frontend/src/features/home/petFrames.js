// 펫 부분 애니메이션용 프레임 (눈 깜빡임·손 흔들기)
//
// 지금 펫 PNG는 한 장으로 완성된 3D 렌더라 눈·손을 떼어 낼 수 없다.
// (손 뒤에 가려진 몸통이 그림에 없고, 감은 눈 모양도 원본에 없다 → 코드로 만들면 그림체가 달라진다)
// 그래서 디자인에서 만든 '같은 크기의 프레임 PNG'가 있을 때만 그 프레임으로 바꿔 보여 준다.
// 프레임이 없으면 아무 움직임도 추가하지 않는다 (원본 PNG 그대로).
//
// 파일 위치·이름 (frontend/src/assets/pets/frames/)
//   <펫>-<단계>-blink.png      눈 감은 한 장 (예: penguin-3-blink.png)
//   <펫>-<단계>-wave-1.png …   손 흔들기 순서대로 2장 이상 (예: penguin-3-wave-1.png, penguin-3-wave-2.png)
//   - 원본(assets/pets/<펫>-<단계>.png)과 캔버스 크기·캐릭터 위치가 완전히 같아야 한다 (다르면 쓰지 않음)
//   - 눈·손 말고는 원본과 같은 그림이어야 한다

const files = import.meta.glob('../../assets/pets/frames/*.png', { eager: true, import: 'default' })
const FRAMES = Object.fromEntries(Object.entries(files).map(([path, url]) => [path.split('/').pop().replace('.png', ''), url]))

// { blink: url | null, wave: [url, …] } — 파일이 없으면 빈 값
export function petFrames(assetName) {
  if (!assetName) return { blink: null, wave: [] }
  const wave = []
  for (let i = 1; FRAMES[`${assetName}-wave-${i}`]; i += 1) wave.push(FRAMES[`${assetName}-wave-${i}`])
  return { blink: FRAMES[`${assetName}-blink`] ?? null, wave: wave.length >= 2 ? wave : [] }
}
