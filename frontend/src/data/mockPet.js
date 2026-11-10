// 펫 Mock 데이터 (docs/API.md 2장 Pet 형식, camelCase)
// DB 연결 전까지 화면 개발용으로만 사용한다.
// type: 직무별 외형 키가 [미확정]이라 아직 null로 둔다.
const mockPet = {
  id: 'pet_1',
  type: null,
  stage: 2, // 누적 70 → 2단계(아기, 50 이상)
  energy: 70,
  energyToNextStage: 150, // 다음 단계(성장기)의 누적 기준값
  updatedAt: '2026-11-09T21:00:00+09:00',
}

export default mockPet
