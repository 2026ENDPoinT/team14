// 펫 Mock 조회 함수 (DB 연결 전 임시, 2-9 때 services 함수로 교체)
// 메모리에만 있으므로 새로고침하면 mockPet 값으로 돌아간다.
import mockPet from '../../data/mockPet.js'
import { getEnergyToNextStage, getStageInfo } from './petStages.js'

let pet = { ...mockPet }

export function getPet() {
  return { ...pet }
}

// ※ 서버(save_diary RPC) 흉내 전용. 화면 컴포넌트에서 부르지 않는다.
//   실제로는 서버가 보상 이력 추가 + 온기 증가를 한 번에 처리한다.
export function mockServerAddWarmth(amount) {
  const energy = pet.energy + amount
  pet = {
    ...pet,
    energy,
    stage: getStageInfo(energy).stage,
    energyToNextStage: getEnergyToNextStage(energy),
  }
  return getPet()
}
