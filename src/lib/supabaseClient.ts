// -----------------------------------------------------------------
// 파일 1: Supabase 클라이언트 설정 (환경변수 검증 포함)
// 경로: src/lib/supabaseClient.ts
// -----------------------------------------------------------------
import { createClient } from '@supabase/supabase-js'

// 환경변수 안전 검증
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL 환경변수가 설정되지 않았습니다.')
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable')
}

if (!supabaseAnonKey) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_ANON_KEY 환경변수가 설정되지 않았습니다.')
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable')
}

console.log('🔧 Supabase 설정 확인:')
console.log('- URL:', supabaseUrl ? '✅ 설정됨' : '❌ 누락')
console.log('- Key:', supabaseAnonKey ? '✅ 설정됨' : '❌ 누락')

// Supabase 클라이언트 생성 및 내보내기
export const supabase = createClient(supabaseUrl, supabaseAnonKey)