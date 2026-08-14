"use client";

// RAG 챗봇 화면 (인사 담당자 전용, DESIGN.md 1.7) — PLAN 8번: 화면 UI까지만 만든다.
// 실제 유사도 검색·답변 생성 API(POST /api/public/[token]/chat)는 아직 없어서, 지금 질문을
// 보내면 항상 실패 응답으로 처리되어 정해진 오류 문구가 뜬다. 이 흐름은 PLAN 9번에서 그
// API가 만들어지면 그대로 이어받아 정상 동작한다. 30회 질문 제한(PLAN 12번)과 방문자
// 익명 로그인(PLAN 10번)도 아직 연결되지 않았다.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

async function fetchLinkInfo(token) {
  const res = await fetch(`/api/public/${token}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "링크를 확인하지 못했습니다.");
  return data;
}

let nextMessageId = 1;

export default function PublicChatPage() {
  const { token } = useParams();
  const [linkInfo, setLinkInfo] = useState(null);
  const [linkError, setLinkError] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const listEndRef = useRef(null);

  useEffect(() => {
    let active = true;
    fetchLinkInfo(token)
      .then((info) => {
        if (active) setLinkInfo(info);
      })
      .catch((err) => {
        if (active) setLinkError(err.message);
      });
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function handleSend(event) {
    event.preventDefault();
    const question = input.trim();
    if (!question || sending) return;

    setMessages((prev) => [
      ...prev,
      { id: nextMessageId++, role: "visitor", content: question },
    ]);
    setInput("");
    setSending(true);

    try {
      const res = await fetch(`/api/public/${token}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "답변을 받지 못했습니다.");

      setMessages((prev) => [
        ...prev,
        {
          id: nextMessageId++,
          role: "assistant",
          content: data.answer,
          sourceCardIds: data.sourceCardIds || [],
        },
      ]);
    } catch {
      // 응답 API가 아직 없거나(PLAN 9번 이전) OpenAI 호출이 실패한 경우 모두
      // CLAUDE.md에 정해진 문구로만 안내한다.
      setMessages((prev) => [
        ...prev,
        {
          id: nextMessageId++,
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

      {linkInfo?.valid && (
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

          <form className="chat-input-row" onSubmit={handleSend}>
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="해당 챗봇이 제대로 확인하지 못하는 부분이 존재할 수도 있습니다."
              disabled={sending}
            />
            <button type="submit" disabled={sending || !input.trim()}>
              보내기
            </button>
          </form>
        </div>
      )}
    </>
  );
}
