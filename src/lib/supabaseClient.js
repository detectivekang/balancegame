import { createClient } from "@supabase/supabase-js";

// Supabase 프로젝트 설정 > API 에서 확인 가능한 값을 넣어주세요.
const SUPABASE_URL = "https://aldxgebgthzohmnobcdz.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_mK8CWQy_dRYD6cdQb-OFEw_JMYtIf0f";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    flowType: "pkce", // GitHub Pages(HashRouter)와 충돌 없이 OAuth 로그인하기 위해 PKCE 사용
    detectSessionInUrl: true,
    persistSession: true,
  },
});

// 관리자로 인정되는 이메일. 이 이메일로 이메일/비밀번호 로그인한 세션만 관리자 페이지 접근 가능.
// (일반 플레이어는 카카오 로그인을 사용하므로 이 값과 겹치지 않습니다)
export const ADMIN_EMAIL = "kangseabich@naver.com";
