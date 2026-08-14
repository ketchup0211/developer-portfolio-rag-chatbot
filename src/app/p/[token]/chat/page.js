"use client";

// RAG 챗봇 화면 (인사 담당자 전용, DESIGN.md 1.7, 2.2) — PLAN 8·9·10번.
// 화면을 열면 뒤에서 Supabase 익명 로그인이 자동으로 이루어져 이 브라우저만의 방문자
// uid를 갖게 되고, 대화는 "초대 링크(토큰) + 방문자 uid" 세션 단위로 서버(API Route)가
// chat_sessions/chat_messages에 저장한다. 새로고침해도 같은 uid로 이전 대화를 이어볼 수
// 있도록, 화면 진입 시 Supabase에서 직접(RLS로 보호됨) 그 세션의 지난 대화를 불러온다.
// 이 초대 링크가 (모든 방문자를 합쳐) 이미 30번 질문을 받았다면(PLAN 12번), 화면에
// 들어오자마자 또는 질문을 보내는 순간 입력칸이 비활성화되고 안내 문구만 보인다.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/AuthProvider";

async function fetchLinkInfo(token) {
  const res = await fetch(`/api/public/${token}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "링크를 확인하지 못했습니다.");
  return data;
}

function toBubble(row) {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    sourceCardIds: (row.chat_message_sources || []).map((s) => s.notion_page_id),
  };
}

export default function PublicChatPage() {
  const { token } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [linkInfo, setLinkInfo] = useState(null);
  const [linkError, setLinkError] = useState("");
  const [messages, setMessages] = useState([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const listEndRef = useRef(null);

  // 1. 초대 링크 유효성 확인 (이미 30회를 다 썼다면 limitReached도 함께 내려온다)
  useEffect(() => {
    let active = true;
    fetchLinkInfo(token)
      .then((info) => {
        if (!active) return;
        setLinkInfo(info);
        setLimitReached(!!info.limitReached);
      })
      .catch((err) => {
        if (active) setLinkError(err.message);
      });
    return () => {
      active = false;
    };
  }, [token]);

  // 2. 아직 로그인(익명 포함) 상태가 아니면 방문자로 익명 로그인한다.
  useEffect(() => {
    if (authLoading || user) return;
    let active = true;
    async function signInAnonymously() {
      const supabase = createClient();
      const { error } = await supabase.auth.signInAnonymously();
      if (error && active) {
        setLinkError("방문자 로그인에 실패했습니다. 새로고침 후 다시 시도해주세요.");
      }
    }
    signInAnonymously();
    return () => {
      active = false;
    };
  }, [authLoading, user]);

  // 3. 링크와 방문자 로그인이 모두 준비되면, 이 방문자의 지난 대화를 불러온다.
  useEffect(() => {
    if (!linkInfo?.valid || !user) return;
    let active = true;
    async function loadHistory() {
      const supabase = createClient();
      const { data: session } = await supabase
        .from("chat_sessions")
        .select("id")
        .eq("invite_link_id", linkInfo.inviteLinkId)
        .eq("visitor_user_id", user.id)
        .maybeSingle();

      if (!session) {
        if (active) setHistoryLoaded(true);
        return;
      }

      const { data: rows } = await supabase
        .from("chat_messages")
        .select("id, role, content, chat_message_sources(notion_page_id)")
        .eq("chat_session_id", session.id)
        .order("created_at", { ascending: true });

      if (active) {
        setMessages((rows || []).map(toBubble));
        setHistoryLoaded(true);
      }
    }
    loadHistory();
    return () => {
      active = false;
    };
  }, [linkInfo, user]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function handleSend(event) {
    event.preventDefault();
    const question = input.trim();
    if (!question || sending || !user || limitReached) return;

    const localId = `local-${Date.now()}`;
    setMessages((prev) => [...prev, { id: localId, role: "visitor", content: question }]);
    setInput("");
    setSending(true);

    try {
      const supabase = createClient();
      const {
        data: { session: authSession },
      } = await supabase.auth.getSession();

      const res = await fetch(`/api/public/${token}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authSession?.access_token || ""}`,
        },
        body: JSON.stringify({ message: question }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "답변을 받지 못했습니다.");

      if (data.limitReached) {
        // 이 질문은 처리되지 않았으므로, 방금 화면에 낙관적으로 띄웠던 말풍선을 되돌린다.
        setMessages((prev) => prev.filter((m) => m.id !== localId));
        setLimitReached(true);
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}-a`,
          role: "assistant",
          content: data.answer,
          sourceCardIds: data.sourceCardIds || [],
        },
      ]);
    } catch {
      // 응답 API 호출 자체가 실패한 경우(네트워크 오류 등)에도 CLAUDE.md에 정해진
      // 문구로만 안내한다. OpenAI 호출 실패는 서버가 이미 같은 문구를 답으로 보낸다.
      setMessages((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}-e`,
          role: "assistant",
          content:
            "죄송합니다. 오류로 인해 현재 챗봇 서비스 사용이 불가합니다. 다시 시도해주세요.",
          sourceCardIds: [],
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  function openSourcePopup(cardId) {
    // CLAUDE.md 규칙: 출처는 반드시 새 팝업창으로 연다.
    window.open(
      `/p/${token}/cards/${cardId}`,
      "portfolio-source",
      "width=760,height=900,noopener,noreferrer"
    );
  }

  const ready = linkInfo?.valid && user && historyLoaded;

  return (
    <>
      <header className="public-portfolio-topbar">
        <span>RAG 챗봇</span>
        <Link href={`/p/${token}`}>← 목록으로</Link>
      </header>

      {linkError && (
        <p className="form-error" style={{ padding: "1.5rem" }}>
          {linkError}
        </p>
      )}

      {!linkInfo && !linkError && <p style={{ padding: "1.5rem" }}>불러오는 중...</p>}

      {linkInfo && !linkInfo.valid && (
        <p style={{ padding: "1.5rem", color: "#555" }}>
          더 이상 사용할 수 없는 링크입니다.
        </p>
      )}

      {linkInfo?.valid && !ready && !linkError && (
        <p style={{ padding: "1.5rem" }}>불러오는 중...</p>
      )}

      {ready && (
        <div className="chat-page">
          <div className="chat-message-list">
            {messages.length === 0 && (
              <p className="chat-empty-guide">
                포트폴리오에 등록된 내용을 바탕으로 궁금한 점을 질문해보세요.
              </p>
            )}

            {messages.map((message) => (
              <div key={message.id} className={`chat-bubble chat-bubble-${message.role}`}>
                <p>{message.content}</p>
                {message.role === "assistant" && message.sourceCardIds?.length > 0 && (
                  <div className="chat-source-buttons">
                    {message.sourceCardIds.map((cardId) => (
                      <button
                        key={cardId}
                        type="button"
                        className="chat-source-button"
                        onClick={() => openSourcePopup(cardId)}
                      >
                        출처
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {sending && (
              <div className="chat-bubble chat-bubble-assistant chat-bubble-loading">
                <p>입력 중...</p>
              </div>
            )}

            <div ref={listEndRef} />
          </div>

          {limitReached && (
            <p className="chat-limit-notice">질문 가능 횟수를 모두 사용했습니다</p>
          )}

          <form className="chat-input-row" onSubmit={handleSend}>
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="해당 챗봇이 제대로 확인하지 못하는 부분이 존재할 수도 있습니다."
              disabled={sending || limitReached}
            />
            <button type="submit" disabled={sending || limitReached || !input.trim()}>
              보내기
            </button>
          </form>
        </div>
      )}
    </>
  );
}
