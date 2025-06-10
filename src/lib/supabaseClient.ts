// -----------------------------------------------------------------
// 파일 1: Supabase 클라이언트 설정
// 경로: src/lib/supabaseClient.ts
// -----------------------------------------------------------------
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!       // Supabase 프로젝트 URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! // Supabase 프로젝트의 'anon' public 키



// Supabase 클라이언트 생성 및 내보내기
export const supabase = createClient(supabaseUrl, supabaseAnonKey)