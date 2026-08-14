// API Route에서 "로그인한 owner가 보낸 요청인지"를 서버에서 직접 확인하는 헬퍼.
// 브라우저는 Authorization: Bearer <supabase access token> 헤더로 로그인 토큰을 보내고,
// 여기서 그 토큰이 실제로 유효한지 Supabase에 검증받는다.
// (아직 방문자 익명 로그인 기능은 없고 owner 계정도 1개뿐이라, 익명이 아닌 유효한
// 로그인이면 곧 owner로 간주한다. 방문자 익명 로그인이 생기는 시점에 조건을 보강한다.)
import { getSupabaseServiceClient } from "@/lib/supabase/serviceClient";

export async function getOwnerFromRequest(request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return null;

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user || data.user.is_anonymous) return null;

  return data.user;
}
