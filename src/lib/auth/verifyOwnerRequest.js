// API Route에서 "로그인한 owner가 보낸 요청인지"를 서버에서 직접 확인하는 헬퍼.
// 브라우저는 Authorization: Bearer <supabase access token> 헤더로 로그인 토큰을 보내고,
// 여기서 그 토큰이 실제로 유효한지 Supabase에 검증받는다.
//
// 방문자 익명 로그인(PLAN 10번)을 쓰려면 Supabase 프로젝트의 "새 사용자 가입 허용"을
// 켜야 하는데(꺼두면 익명 로그인도 함께 막힘), 그러면 이론적으로 누구나 이메일 회원가입
// API를 직접 호출해 "익명이 아닌 로그인 사용자"를 만들 수 있다. owner 계정은 딱 1개만
// Supabase에 미리 등록해두는 정책(CLAUDE.md)이므로, 그런 사용자가 owner로 오인되지
// 않도록 이메일이 .env의 OWNER_EMAIL과 정확히 일치하는 경우에만 owner로 인정한다.
import { getSupabaseServiceClient } from "@/lib/supabase/serviceClient";

export async function getOwnerFromRequest(request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return null;

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user || data.user.is_anonymous) return null;
  if (!process.env.OWNER_EMAIL || data.user.email !== process.env.OWNER_EMAIL) return null;

  return data.user;
}
