// 펫 성장 단계 기준 (SPEC.md 8장, API.md 2장 Pet)
// 누적 에너지 0 / 50 / 150 / 300에 도달하면 각 단계가 된다. 성장해도 에너지는 차감하지 않는다.
// 화면 표시용이다. 실제 단계는 서버가 계산한 pet.stage를 우선 사용한다.
export const PET_STAGES = [
  { stage: 1, name: '알', minEnergy: 0 },
  { stage: 2, name: '아기', minEnergy: 50 },
  { stage: 3, name: '성장기', minEnergy: 150 },
  { stage: 4, name: '성체', minEnergy: 300 },
]

export const MAX_STAGE = PET_STAGES[PET_STAGES.length - 1].stage

// 누적 에너지로 현재 단계 정보를 찾는다
export function getStageInfo(energy) {
  const safeEnergy = Math.max(0, energy || 0)
  // 기준을 넘은 단계 중 가장 높은 단계
  return [...PET_STAGES].reverse().find((s) => safeEnergy >= s.minEnergy)
}

// 단계 번호(1~4)로 단계 정보를 찾는다 (없으면 1단계)
export function getStageByNumber(stage) {
  return PET_STAGES.find((s) => s.stage === stage) || PET_STAGES[0]
}

// 다음 단계의 누적 에너지 기준값 (API.md energyToNextStage와 같은 뜻). 최대 단계면 null
export function getEnergyToNextStage(energy) {
  const current = getStageInfo(energy)
  const next = PET_STAGES.find((s) => s.stage === current.stage + 1)
  return next ? next.minEnergy : null
}

// 게이지용: 현재 단계 안에서 얼마나 찼는지 0~100 (최대 단계면 100)
export function getStageProgress(energy) {
  const safeEnergy = Math.max(0, energy || 0)
  const current = getStageInfo(safeEnergy)
  const nextMin = getEnergyToNextStage(safeEnergy)
  if (nextMin === null) return 100
  const percent = ((safeEnergy - current.minEnergy) / (nextMin - current.minEnergy)) * 100
  return Math.round(percent)
}
