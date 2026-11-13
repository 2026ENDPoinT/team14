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

// 펫 그림별 입 위치 [x, y, 입 너비, cover] (그림 폭·높이에 대한 비율, 그림을 보고 잰 대략값)
// cover: 1이면 웃는 입이 크게 보여서 피부색으로 덮은 뒤 처진 입을 그린다 (펭귄 부리·고양이 코 아래는 덮지 않음)
export const MOUTHS = {
  sprout: [0.55, 0.69, 0.07, 1],
  'rabbit-2': [0.546, 0.574, 0.09, 1], 'rabbit-3': [0.503, 0.5, 0.08, 1], 'rabbit-4': [0.513, 0.48, 0.07, 1],
  'hamster-2': [0.593, 0.53, 0.12, 1], 'hamster-3': [0.516, 0.47, 0.09, 1], 'hamster-4': [0.51, 0.44, 0.08, 1],
  'otter-2': [0.506, 0.53, 0.09, 1], 'otter-3': [0.577, 0.386, 0.08, 1], 'otter-4': [0.52, 0.49, 0.05, 1],
  'penguin-2': [0.49, 0.54, 0.07, 0], 'penguin-3': [0.528, 0.53, 0.08, 0], 'penguin-4': [0.54, 0.43, 0.05, 0],
  'black_cat-2': [0.453, 0.51, 0.06, 0], 'black_cat-3': [0.51, 0.53, 0.08, 0], 'black_cat-4': [0.48, 0.51, 0.06, 0],
}
export const DEFAULT_MOUTH = [0.5, 0.55, 0.07, 0]

export function mouthOf(assetName) {
  return MOUTHS[assetName] ?? DEFAULT_MOUTH
}
