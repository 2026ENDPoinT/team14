import { supabase } from './supabaseClient.js'

function errorMessage(error, fallback) {
  if (error?.code === 'PGRST202' || error?.code === '42P01') return '상점 기능이 아직 서버에 설치되지 않았어요. Supabase 마이그레이션 적용이 필요합니다.'
  if (error?.message === 'INSUFFICIENT_WARMTH') return '보유 온기가 부족해요.'
  if (error?.message === 'ALREADY_OWNED') return '이미 보유한 테마예요.'
  if (error?.message === 'NOT_OWNED') return '보유하지 않은 테마예요.'
  return error?.details || fallback
}

export async function getMyThemes() {
  if (!supabase) return { error: { message: 'Supabase 설정이 필요합니다.' } }
  const { data, error } = await supabase.rpc('get_my_pet_themes')
  if (error) return { error: { message: errorMessage(error, '테마를 불러오지 못했어요.'), setupRequired: ['PGRST202', '42P01', '42883'].includes(error.code) } }
  return { data: { owned: Array.isArray(data?.owned) ? data.owned : [], equipped: data?.equipped === 'classic' ? 'light' : (data?.equipped || 'light') } }
}

export async function purchaseMyTheme(themeId) {
  if (!supabase) return { error: { message: 'Supabase 설정이 필요합니다.' } }
  const { data, error } = await supabase.rpc('purchase_pet_theme', { p_theme_id: themeId })
  if (error) return { error: { message: errorMessage(error, '구매하지 못했어요.'), setupRequired: ['PGRST202', '42P01', '42883'].includes(error.code) } }
  return { data }
}

export async function equipMyTheme(themeId) {
  if (!supabase) return { error: { message: 'Supabase 설정이 필요합니다.' } }
  const { data, error } = await supabase.rpc('equip_pet_theme', { p_theme_id: themeId })
  if (error) return { error: { message: errorMessage(error, '테마를 적용하지 못했어요.'), setupRequired: ['PGRST202', '42P01', '42883'].includes(error.code) } }
  return { data }
}
