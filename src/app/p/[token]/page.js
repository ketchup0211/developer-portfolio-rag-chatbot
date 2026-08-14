"use client";

// 포트폴리오 보기 화면 (DESIGN.md 1.6) — 인사 담당자가 초대 링크로 들어왔을 때 첫 화면.
// 로그인 절차 없음. 카드 목록 자체는 /portfolio와 같은 CardGrid 컴포넌트를 재사용하고,
// 여기서는 지원자 이름·연락처와 "RAG 챗봇" 바로가기 버튼만 추가로 보여준다.
// 이 화면에는 owner 영역(로그인, 초대 링크 관리 등)으로 가는 링크가 전혀 없다
// (인사 담당자는 이 화면과 챗봇 화면 외에는 접근할 수 없다).
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import CardGrid from "@/components/portfolio/CardGrid";

async function fetchLinkInfo(token) {
  const res = await fetch(`/api/public/${token}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "링크를 확인하지 못했습니다.");
  return data;
}

async function fetchNotionCards() {
  const res = await fetch("/api/notion/cards");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "불러오기에 실패했습니다.");
  return data;
}

export default function PublicPortfolioPage() {
  const { token } = useParams();
  const [linkInfo, setLinkInfo] = useState(null);
  const [cards, setCards] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const info = await fetchLinkInfo(token);
        if (!active) return;
        setLinkInfo(info);
        if (!info.valid) return;

        const data = await fetchNotionCards();
        if (!active) return;
        setCards(data.cards);
      } catch (err) {
        if (active) setError(err.message);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [token]);

  return (
    <>
      <header className="public-portfolio-topbar">개발자 포트폴리오</header>

      <main style={{ maxWidth: "960px", margin: "0 auto", padding: "0 1.5rem 2rem" }}>
        {error && (
          <p className="form-error" style={{ marginTop: "1.5rem" }}>
            {error}
          </p>
        )}

        {!linkInfo && !error && <p style={{ padding: "1.5rem" }}>불러오는 중...</p>}

        {linkInfo && !linkInfo.valid && (
          <p style={{ padding: "1.5rem", color: "#555" }}>
            더 이상 사용할 수 없는 링크입니다.
          </p>
        )}

        {linkInfo && linkInfo.valid && (
          <>
            <div className="public-portfolio-header">
              <div>
                <h1 style={{ fontSize: "1.3rem" }}>
                  {linkInfo.ownerName ? `${linkInfo.ownerName}님의 포트폴리오` : "포트폴리오"}
                </h1>
                {linkInfo.ownerContact && (
                  <p style={{ color: "#777", fontSize: "0.9rem", marginTop: "0.2rem" }}>
                    연락처: {linkInfo.ownerContact}
                  </p>
                )}
              </div>
              <Link href={`/p/${token}/chat`} className="public-chat-button">
                RAG 챗봇으로 질문하기
              </Link>
            </div>

            {cards === null && <p style={{ padding: "1.5rem 0" }}>불러오는 중...</p>}

            {cards && cards.length === 0 && (
              <p style={{ padding: "1.5rem 0", color: "#555" }}>
                아직 등록된 프로젝트 카드가 없습니다.
              </p>
            )}

            {cards && cards.length > 0 && (
              <CardGrid cards={cards} hrefFor={(card) => `/p/${token}/cards/${card.id}`} />
            )}
          </>
        )}
      </main>
    </>
  );
}
