// 초대 링크(토큰) 하나당 질문은 최대 30회까지만 받는다(CLAUDE.md, DESIGN.md 1.7·PLAN 12번).
// 이 30회는 같은 링크를 쓰는 모든 방문자(익명 로그인 세션)가 합쳐서 공유하는 횟수이고,
// 대화방이 방문자별로 나뉘는 것과는 별개의 기준이다.
export const QUESTION_LIMIT = 30;
export const QUESTION_LIMIT_MESSAGE = "질문 가능 횟수를 모두 사용했습니다";

// 이 초대 링크에 속한 모든 세션(chat_sessions)에서, 방문자가 보낸 질문(role='visitor')
// 수를 합산한다. service role 클라이언트로 호출한다(RLS와 무관하게 전체를 세야 함).
export async function countQuestions(supabase, inviteLinkId) {
  const { data: sessions, error: sessionsError } = await supabase
    .from("chat_sessions")
    .select("id")
    .eq("invite_link_id", inviteLinkId);
  if (sessionsError) throw sessionsError;

  const sessionIds = (sessions || []).map((s) => s.id);
  if (sessionIds.length === 0) return 0;

  const { count, error: countError } = await supabase
    .from("chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("role", "visitor")
    .in("chat_session_id", sessionIds);
  if (countError) throw countError;

  return count || 0;
}
