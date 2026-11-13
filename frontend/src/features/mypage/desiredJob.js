import { JOB_TO_PET, PET_CHARACTERS } from '../home/petCharacter.js'
import { updateMyDesiredJob } from '../../services/api.js'

// 희망 직무 변경 규칙 (마이페이지·AI 길잡이 공용)
// - 로그인했으면 DB(profiles.interests)에 저장하고, 성공했을 때만 화면(AuthProvider)에 반영한다.
// - HOME 펫 종류는 희망 직무로 정해진다. 온기·성장 단계는 그대로다.
// - '미정' 등 펫이 정해지지 않는 직무는 이전 펫을 저장할 곳(pets.type)이 아직 없어 막는다.

export const BLOCKED_JOB_MESSAGE = '지금은 펫을 유지한 채 미정으로 바꿀 수 없어요. 서버 준비 후 바꿀 수 있어요.'

// 바꾸면 펫이 어떻게 되는지 (저장 전 안내용). 바꿀 수 없으면 null
export function petChangeOf(fromJob, toJob) {
  const newPet = JOB_TO_PET[toJob]
  if (!newPet) return null
  const same = JOB_TO_PET[fromJob] === newPet
  const pet = PET_CHARACTERS[newPet]
  return {
    newPet,
    same,
    message: same ? `펫은 그대로 ${pet.name}예요.` : `펫이 ${pet.name}(${pet.label})로 바뀌었어요.`,
    preview: same ? `펫은 그대로 ${pet.name}예요.` : `펫이 ${pet.name}(${pet.label})로 바뀌어요.`,
  }
}

// 저장. 결과 { ok: true, petMessage } 또는 { error: 문구 }
// signedIn이 아니면 저장하지 않고 ok만 돌려준다 (마이페이지 예시 화면용)
export async function saveDesiredJob(fromJob, toJob, { signedIn, applyProfile }) {
  const change = petChangeOf(fromJob, toJob)
  if (!change) return { error: BLOCKED_JOB_MESSAGE }
  if (signedIn) {
    const result = await updateMyDesiredJob(toJob)
    if (result.error) return { error: `희망 직무를 저장하지 못했어요. ${result.error.message}` }
    applyProfile({ interests: result.data.interests })
  }
  return { ok: true, petMessage: change.message }
}
