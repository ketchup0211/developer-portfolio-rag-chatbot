// 브라우저(클라이언트)에서 Supabase에 직접 연결하기 위한 클라이언트입니다.
// PRD 7·8번 결정: Supabase URL과 anon(publishable) key는 노출돼도 안전한
// 공개용 값이므로 브라우저에서 직접 사용합니다. 실제 데이터 접근 권한은
// Supabase의 Row Level Security로 통제합니다. (OpenAI 키 같은 진짜 비밀
// 키는 이 파일에서 절대 다루지 않고, 서버 쪽 코드에서만 사용합니다.)
//
// 로그인 상태는 서버 세션(쿠키) 없이, 브라우저에 저장되는 방식(localStorage)으로
// 유지합니다. 로그인이 필요한 화면은 각자 클라이언트에서 로그인 여부를 확인합니다.
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

let browserClient;

// 여러 곳에서 매번 새로 만들지 않도록, 클라이언트를 한 번만 생성해 재사용합니다.
export function createClient() {
  if (browserClient) return browserClient;

  browserClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  return browserClient;
}
