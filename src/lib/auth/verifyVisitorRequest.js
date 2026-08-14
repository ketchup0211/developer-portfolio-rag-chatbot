// API Route에서 "초대 링크로 들어온 방문자가 보낸 요청인지"를 서버에서 직접 확인하는 헬퍼.
// verifyOwnerRequest.js와 형태는 같지만, 방문자는 Supabase 익명 로그인(anonymous sign-in)
// 계정이므로 is_anonymous 여부를 따지지 않고 유효한 로그인이면 그대로 방문자로 인정한다.
import { getSupabaseServiceClient } from "@/lib/supabase/serviceClient";

export async function getVisitorFromRequest(request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return null;

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;

  return data.user;
}
