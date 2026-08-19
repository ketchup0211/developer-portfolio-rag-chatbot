"use client";

// RAG 챗봇 화면 (인사 담당자 전용, DESIGN.md 1.7, 2.2) — PLAN 8·9·10번.
// 화면을 열면 뒤에서 Supabase 익명 로그인이 자동으로 이루어져 이 브라우저만의 방문자
// uid를 갖게 되고, 대화는 "초대 링크(토큰) + 방문자 uid" 세션 단위로 서버(API Route)가
// chat_sessions/chat_messages에 저장한다. 새로고침해도 같은 uid로 이전 대화를 이어볼 수
// 있도록, 화면 진입 시 Supabase에서 직접(RLS로 보호됨) 그 세션의 지난 대화를 불러온다.
// 이 초대 링크가 (모든 방문자를 합쳐) 이미 30번 질문을 받았다면(PLAN 12번), 화면에
// 들어오자마자 또는 질문을 보내는 순간 입력칸이 비활성화되고 안내 문구만 보인다.
//
// CLAUDE.md 규칙: "RAG 챗봇은 인사 담당자 전용이다. 지원자 본인은 챗봇을 사용하지 않는다."
// owner 계정으로 로그인된 브라우저로 이 화면에 들어오면(자기 링크 테스트 등) 이미 로그인된
// 사람이 있으니 새 익명 로그인을 만들지 않고 owner 계정을 그대로 "방문자"로 써버리는 문제가
// 있었다(질문 열람함에 owner 본인의 대화가 섞이고 30회 한도도 함께 줄어듦). 그래서 owner로
// 로그인된 상태면 애초에 채팅 자체를 막고 안내만 보여준다(서버에도 동일한 차단을 둔다).
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { propertyValueToPlainText } from "@/lib/notion/properties";

async function fetchLinkInfo(token) {
  const res = await fetch(`/api/public/${token}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "링크를 확인하지 못했습니다.");
  return data;
}

async function fetchNotionCards() {
  // 출처 칩에 마우스를 올렸을 때 보여줄 제목/아이콘/속성 미리보기용. 카드 목록 조회는
  // 로그인 없이도 쓸 수 있는 공개 API라 지원자 이름 등과 무관하게 항상 호출해도 된다.
  const res = await fetch("/api/notion/cards");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "카드 목록을 불러오지 못했습니다.");
  return data.cards || [];
}

function toBubble(row) {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    sourceCardIds: (row.chat_message_sources || []).map((s) => s.notion_page_id),
  };
}

// AI 답변에 포함된 "**강조**" 표시만 굵게 렌더링한다(그 외 마크다운은 프롬프트에서부터
// 안 쓰도록 지시했으므로 여기서도 굵게 표시만 지원한다). dangerouslySetInnerHTML을 쓰지
// 않고 텍스트를 조각내 React 엘리먼트로만 렌더링하므로 그대로 안전하다.
function renderInlineBold(line, keyPrefix) {
  const parts = line.split(/(\*\*[^*]+\*\*)/g).filter((part) => part !== "");
  return parts.map((part, i) => {
    const match = part.match(/^\*\*([^*]+)\*\*$/);
    return match ? (
      <strong key={`${keyPrefix}-${i}`}>{match[1]}</strong>
    ) : (
      <span key={`${keyPrefix}-${i}`}>{part}</span>
    );
  });
}

// 답변을 빈 줄 기준으로 문단(<p>)으로 나누고, 문단 안의 줄바꿈은 <br/>로 살린다.
function renderFormattedAnswer(content) {
  const paragraphs = (content || "").split(/\n{2,}/).filter((p) => p.trim() !== "");
  const list = paragraphs.length > 0 ? paragraphs : [content || ""];
  return list.map((paragraph, pIdx) => {
    const lines = paragraph.split("\n");
    return (
      <p key={pIdx}>
        {lines.map((line, lIdx) => (
          <span key={lIdx}>
            {renderInlineBold(line, `${pIdx}-${lIdx}`)}
            {lIdx < lines.length - 1 && <br />}
          </span>
        ))}
      </p>
    );
  });
}

export default function PublicChatPage() {
  const { token } = useParams();
  const { user, isOwner, loading: authLoading } = useAuth();
  const [linkInfo, setLinkInfo] = useState(null);
  const [linkError, setLinkError] = useState("");
  const [messages, setMessages] = useState([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [cardsById, setCardsById] = useState({});
  // 출처 칩 목록이 말풍선 폭을 넘어가면 슬라이딩(가로 스크롤)으로 보게 했는데(아래
  // .chat-source-buttons), 그 스크롤 컨테이너가 넘치는 내용을 자르기 때문에 미리보기
  // 카드를 칩 안에 CSS로만 띄우면 잘려 보인다. 그래서 미리보기 하나를 화면 전체 기준
  // 고정 위치(position: fixed)로 따로 렌더링하고, 어느 칩 위에 마우스가 있는지만
  // 이 상태로 추적한다.
  const [hoverPreview, setHoverPreview] = useState(null); // { cardId, top, left } | null
  const listEndRef = useRef(null);

  // 0. 출처 칩 미리보기에 쓸 카드 제목/아이콘/속성을 미리 한 번 받아둔다.
  useEffect(() => {
    let active = true;
    fetchNotionCards()
      .then((cards) => {
        if (!active) return;
        setCardsById(Object.fromEntries(cards.map((card) => [card.id, card])));
      })
      .catch(() => {
        // 미리보기는 부가 기능이므로 실패해도 챗봇 사용 자체를 막지 않는다.
      });
    return () => {
      active = false;
    };
  }, []);

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
  // (owner로 이미 로그인돼 있으면 이 조건에서 자연히 건너뛰어진다 — user가 이미 있으므로.
  // 그 경우 채팅 자체를 막는 처리는 아래 렌더링 부분에서 isOwner로 따로 한다.)
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
  // (owner 로그인 상태면 애초에 채팅을 막을 것이므로 여기서도 불러올 필요가 없다.)
  useEffect(() => {
    if (!linkInfo?.valid || !user || isOwner) return;
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
  }, [linkInfo, user, isOwner]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function handleSend(event) {
    event.preventDefault();
    const question = input.trim();
    if (!question || sending || !user || isOwner || limitReached) return;

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
    // CLAUDE.md 규칙: 출처는 반드시 새 팝업창으로 연다. 근거 카드가 여러 개면(DESIGN.md 2.3)
    // 카드마다 별도의 칩을 보여주고, 칩을 클릭하면 그 카드 하나만 담아 새 팝업창을 연다.
    window.open(
      `/p/${token}/cards/${cardId}`,
      "portfolio-source",
      "width=760,height=900,noopener,noreferrer"
    );
  }

  function showChipPreview(cardId, anchorEl) {
    const rect = anchorEl.getBoundingClientRect();
    setHoverPreview({ cardId, top: rect.top, left: rect.left });
  }

  function hideChipPreview() {
    setHoverPreview(null);
  }

  const ready = linkInfo?.valid && user && !isOwner && historyLoaded;

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

      {linkInfo?.valid && isOwner && (
        <p style={{ padding: "1.5rem", color: "#555" }}>
          현재 owner 계정으로 로그인되어 있어 이 챗봇을 사용할 수 없습니다. RAG 챗봇은
          인사 담당자 전용 기능입니다. 로그아웃하거나 시크릿(비공개) 창에서 열어주세요.
        </p>
      )}

      {linkInfo?.valid && !isOwner && !ready && !linkError && (
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
                {message.role === "assistant" ? (
                  renderFormattedAnswer(message.content)
                ) : (
                  <p>{message.content}</p>
                )}
                {message.role === "assistant" && message.sourceCardIds?.length > 0 && (
                  // 출처 칩이 말풍선 폭을 넘어가면(근거가 여러 개인 답변) 줄바꿈하지 않고
                  // 가로로 슬라이딩해서 볼 수 있게 한다 — 말풍선 UI를 벗어나지 않도록.
                  <div className="chat-source-buttons">
                    {message.sourceCardIds.map((cardId) => {
                      const card = cardsById[cardId];
                      return (
                        <span key={cardId} className="chat-source-chip-wrap">
                          <button
                            type="button"
                            className="chat-source-chip"
                            onClick={() => openSourcePopup(cardId)}
                            onMouseEnter={(e) => showChipPreview(cardId, e.currentTarget)}
                            onMouseLeave={hideChipPreview}
                            onFocus={(e) => showChipPreview(cardId, e.currentTarget)}
                            onBlur={hideChipPreview}
                          >
                            {card?.icon?.type === "emoji" && (
                              <span className="chat-source-chip-icon">{card.icon.value}</span>
                            )}
                            <span className="chat-source-chip-title">
                              {card?.title || "출처"}
                            </span>
                          </button>
                        </span>
                      );
                    })}
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

          {/* 출처 칩 미리보기(호버) — 칩을 담은 가로 스크롤 컨테이너 밖에 고정 위치로 따로
              렌더링해서, 스크롤 컨테이너의 overflow에 잘리지 않게 한다. */}
          {hoverPreview &&
            (() => {
              const card = cardsById[hoverPreview.cardId];
              const metaLines = card
                ? card.properties
                    .map((p) => propertyValueToPlainText(p.type, p.value))
                    .filter(Boolean)
                    .slice(0, 2)
                : [];
              return (
                <div
                  className="chat-source-preview chat-source-preview-fixed"
                  style={{ top: hoverPreview.top, left: hoverPreview.left }}
                >
                  <p className="chat-source-preview-title">
                    {card?.icon?.type === "emoji" && <span>{card.icon.value}</span>}
                    <span>{card?.title || "출처 확인 중..."}</span>
                  </p>
                  {metaLines.map((line, index) => (
                    <p className="chat-source-preview-meta" key={index}>
                      {line}
                    </p>
                  ))}
                </div>
              );
            })()}
        </div>
      )}
    </>
  );
}
