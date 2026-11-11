import { createClient } from '@supabase/supabase-js'

// Supabase 연결은 이 파일 한 곳에서만 만든다. (docs/API.md 6장)
// 컴포넌트는 이 파일을 직접 쓰지 않고 services/api.js의 함수를 쓴다.
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// .env가 없으면 앱 전체가 멈추지 않도록 null로 두고, 서비스 함수에서 오류로 알려준다.
export const supabase = url && key ? createClient(url, key) : null

if (!supabase) {
  console.warn('frontend/.env에 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY를 설정하세요.')
}
