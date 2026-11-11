// 펫 성장 단계 기준 (보상 이름: 온기)
// 누적 온기 0 / 1,200 / 2,800 / 5,000에 도달하면 각 단계가 된다. 성장해도 온기는 차감하지 않는다.
// ※ 새 기준(팀 확정). SPEC 8장·API.md는 아직 0/50/150/300 → 문서 담당이 바꿔야 함
// 화면 표시용이다. 실제 단계는 서버가 계산한 pet.stage를 우선 사용한다.
export const PET_STAGES = [
  { stage: 1, name: '알 / 아기 펫', minEnergy: 0 },
  { stage: 2, name: '어린 펫', minEnergy: 1200 },
  { stage: 3, name: '성장한 펫', minEnergy: 2800 },
  { stage: 4, name: '최종 성장 펫', minEnergy: 5000 },
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
