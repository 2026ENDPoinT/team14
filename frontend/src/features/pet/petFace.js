// 펫 그림별 눈 위치 [왼쪽 눈 x, 오른쪽 눈 x, 눈 y] (그림 폭·높이에 대한 비율, 대략값)
// HOME 효과(눈물)와 시무룩한 눈썹(SadBrows)이 같이 쓴다
export const EYES = {
  sprout: [0.44, 0.56, 0.66],
  'black_cat-2': [0.38, 0.57, 0.41], 'black_cat-3': [0.42, 0.58, 0.4], 'black_cat-4': [0.43, 0.57, 0.33],
  'hamster-2': [0.4, 0.58, 0.42], 'hamster-3': [0.4, 0.57, 0.4], 'hamster-4': [0.41, 0.56, 0.38],
  'otter-2': [0.49, 0.6, 0.42], 'otter-3': [0.45, 0.6, 0.33], 'otter-4': [0.44, 0.55, 0.38],
  'penguin-2': [0.4, 0.6, 0.38], 'penguin-3': [0.38, 0.62, 0.38], 'penguin-4': [0.45, 0.58, 0.3],
  'rabbit-2': [0.38, 0.6, 0.55], 'rabbit-3': [0.4, 0.58, 0.48], 'rabbit-4': [0.43, 0.57, 0.44],
}
export const DEFAULT_EYES = [0.4, 0.6, 0.4]

export function eyesOf(assetName) {
  return EYES[assetName] ?? DEFAULT_EYES
}
