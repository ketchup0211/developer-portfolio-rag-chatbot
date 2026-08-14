// 대화 세션의 읽음/안읽음 판정 공통 로직 (DESIGN.md 1.5, 2.4 / PLAN 13·14번).
// chat_sessions.last_read_at과 그 세션에 속한 chat_messages 중 가장 최근 시각을 비교해
// 안읽음 여부를 계산한다. 대화 기록 관리 화면(/questions)과 상단 바 알림 아이콘이
// 이 로직을 함께 쓴다.
export function toSessionSummary(row) {
  const timestamps = (row.chat_messages || []).map((m) => m.created_at).sort();
  const lastMessageAt = timestamps.length ? timestamps[timestamps.length - 1] : null;
  const unread = !!lastMessageAt && (!row.last_read_at || lastMessageAt > row.last_read_at);
  return { id: row.id, anonLabel: row.anon_label, lastMessageAt, unread };
}

export function sortSessions(list) {
  return [...list].sort((a, b) => {
    if (a.unread !== b.unread) return a.unread ? -1 : 1;
    return (b.lastMessageAt || "").localeCompare(a.lastMessageAt || "");
  });
}

// 로그인한 owner 자격으로 Supabase에 직접 접속해 세션 요약 목록을 가져온다
// (RLS 덕분에 자신의 세션만 자동으로 걸러진다).
export async function fetchSessionSummaries(supabase) {
  const { data, error } = await supabase
    .from("chat_sessions")
    .select("id, anon_label, last_read_at, chat_messages(created_at)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return sortSessions((data || []).map(toSessionSummary));
}
