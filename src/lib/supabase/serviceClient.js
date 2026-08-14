// 서버 전용 Supabase 클라이언트. RLS를 우회하는 진짜 관리자 키(SUPABASE_SERVICE_ROLE_KEY)를
// 쓰므로, 이 파일은 절대 브라우저 코드에서 import하면 안 되고 서버(API Route)에서만 써야 한다.
// (portfolio_chunks는 owner도 브라우저에서 직접 조회할 수 있는 select 정책을 두지 않았으므로,
//  이 서버 클라이언트를 거치는 것이 유일한 쓰기/전체 조회 경로다.)
import { createClient } from "@supabase/supabase-js";

let client;

export function getSupabaseServiceClient() {
  if (!client) {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.");
    }
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );
  }
  return client;
}
