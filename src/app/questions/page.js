"use client";

// 대화 기록 관리 화면 (DESIGN.md 1.5, 2.4, PLAN 13번) — owner 전용.
// 세션(방문자 1명 + 초대 링크 1개 조합) 목록을 안읽음 우선 → 최신순으로 보여준다.
// 회사/초대 링크 정보는 저장 자체를 하지 않으므로(chat_sessions에 없음) 화면에도 당연히
// 나오지 않고, 임의의 익명 라벨(anon_label)로만 구분한다(인사 담당자 익명성 보장).
// 세션을 열면 그 세션의 질문·답변을 대화 형태로 순서대로 보여주고, 그 순간 읽음
// 처리한다(chat_sessions.last_read_at 갱신). 브라우저가 로그인한 owner 자격으로
// Supabase에 직접 접속하며, RLS 덕분에 자신의 세션만 자동으로 걸러져서 온다(서버 경유 불필요).
import { useEffect, useState } from "react";
import AuthedNav from "@/components/AuthedNav";
import { RequireAuth } from "@/lib/auth/RequireAuth";
import { createClient } from "@/lib/supabase/client";
import { fetchSessionSummaries, sortSessions } from "@/lib/chat/sessionSummary";

function QuestionsPageContent() {
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState(null);
  const [threadError, setThreadError] = useState("");

  // 화면 진입 시 1회 자동 로딩. effect 안에서 직접 정의하고 바로 실행해,
  // effect 바깥 함수를 참조하며 setState하는 패턴(react-hooks/set-state-in-effect)을 피한다.
  useEffect(() => {
    let active = true;
    async function loadSessions() {
      const supabase = createClient();
      try {
        const summaries = await fetchSessionSummaries(supabase);
        if (active) setSessions(summaries);
      } catch {
        if (active) setError("대화 목록을 불러오지 못했습니다.");
      }
    }
    loadSessions();
    return () => {
      active = false;
    };
  }, []);

  async function openSession(session) {
    setSelectedId(session.id);
    setMessages(null);
    setThreadError("");

    const supabase = createClient();
    const { data, error: threadLoadError } = await supabase
      .from("chat_messages")
      .select("id, role, content, created_at")
      .eq("chat_session_id", session.id)
      .order("created_at", { ascending: true });

    if (threadLoadError) {
      setThreadError("대화를 불러오지 못했습니다.");
      return;
    }
    setMessages(data || []);

    if (session.unread) {
      const { error: updateError } = await supabase
        .from("chat_sessions")
        .update({ last_read_at: new Date().toISOString() })
        .eq("id", session.id);
      if (!updateError) {
        setSessions((prev) =>
          sortSessions(prev.map((s) => (s.id === session.id ? { ...s, unread: false } : s)))
        );
      }
    }
  }

  function closeSession() {
    setSelectedId(null);
    setMessages(null);
    setThreadError("");
  }

  const selectedSession = sessions?.find((s) => s.id === selectedId);

  return (
    <>
      <AuthedNav />
      <div style={{ padding: "1.5rem", maxWidth: "640px", margin: "0 auto" }}>
        {!selectedId && (
          <>
            <h1 style={{ fontSize: "1.3rem", marginBottom: "0.4rem" }}>질문 열람</h1>
            <p style={{ color: "#777", fontSize: "0.85rem", marginBottom: "1.25rem" }}>
              인사 담당자가 챗봇에 보낸 질문·답변을 방문자 단위로 볼 수 있습니다. 어떤
              회사(초대 링크)의 대화인지는 표시되지 않습니다.
            </p>

            {error && <p className="form-error">{error}</p>}
            {!sessions && !error && <p>불러오는 중...</p>}
            {sessions && sessions.length === 0 && (
              <p style={{ color: "#555" }}>아직 받은 질문이 없습니다.</p>
            )}

            {sessions && sessions.length > 0 && (
              <ul className="session-list">
                {sessions.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      className={`session-row ${s.unread ? "session-row-unread" : ""}`}
                      onClick={() => openSession(s)}
                    >
                      <span className="session-row-label">
                        {s.unread && <span className="session-unread-dot" aria-hidden="true" />}
                        방문자 #{s.anonLabel}
                      </span>
                      <span className="session-row-time">
                        {s.lastMessageAt ? new Date(s.lastMessageAt).toLocaleString("ko-KR") : "-"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {selectedId && (
          <>
            <button type="button" className="session-back-button" onClick={closeSession}>
              ← 목록으로
            </button>
            <h2 style={{ fontSize: "1.1rem", margin: "0.75rem 0 1rem" }}>
              방문자 #{selectedSession?.anonLabel}
            </h2>

            {threadError && <p className="form-error">{threadError}</p>}
            {!messages && !threadError && <p>불러오는 중...</p>}

            {messages && messages.length === 0 && (
              <p style={{ color: "#555" }}>아직 대화 내용이 없습니다.</p>
            )}

            {messages && messages.length > 0 && (
              <div className="chat-message-list" style={{ minHeight: "auto" }}>
                {messages.map((m) => (
                  <div key={m.id} className={`chat-bubble chat-bubble-${m.role}`}>
                    <p>{m.content}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

export default function QuestionsPage() {
  return (
    <RequireAuth>
      <QuestionsPageContent />
    </RequireAuth>
  );
}
