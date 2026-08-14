"use client";

// 프로젝트 카드 상세 (인사 담당자용, DESIGN.md 1.6, 2.3) — 초대 링크로 들어온 사람이
// 카드 목록에서 클릭했을 때, 그리고 챗봇 출처 버튼으로 팝업을 열 때 이 경로를 함께 쓴다.
// 렌더링은 /portfolio/[id]와 같은 CardDetailView 컴포넌트를 재사용하고, owner 전용
// 버튼("노션에서 편집" 등)은 넘기지 않는다. 비활성 링크면 안내 문구만 보여준다.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import CardDetailView from "@/components/portfolio/CardDetailView";

async function fetchLinkInfo(token) {
  const res = await fetch(`/api/public/${token}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "링크를 확인하지 못했습니다.");
  return data;
}

async function fetchCardDetail(cardId) {
  const res = await fetch(`/api/notion/cards/${cardId}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "불러오기에 실패했습니다.");
  return data;
}

export default function PublicCardDetailPage() {
  const { token, cardId } = useParams();
  const [linkInfo, setLinkInfo] = useState(null);
  const [card, setCard] = useState(null);
  const [blocks, setBlocks] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const info = await fetchLinkInfo(token);
        if (!active) return;
        setLinkInfo(info);
        if (!info.valid) return;

        const data = await fetchCardDetail(cardId);
        if (!active) return;
        setCard(data.card);
        setBlocks(data.blocks);
      } catch (err) {
        if (active) setError(err.message);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [token, cardId]);

  return (
    <>
      <header className="public-portfolio-topbar">
        <span>개발자 포트폴리오</span>
        <Link href={`/p/${token}`}>← 목록으로</Link>
      </header>

      {error && (
        <p className="form-error" style={{ padding: "1.5rem" }}>
          {error}
        </p>
      )}

      {!linkInfo && !error && <p style={{ padding: "1.5rem" }}>불러오는 중...</p>}

      {linkInfo && !linkInfo.valid && (
        <p style={{ padding: "1.5rem", color: "#555" }}>
          더 이상 사용할 수 없는 링크입니다.
        </p>
      )}

      {linkInfo?.valid && !card && !error && (
        <p style={{ padding: "1.5rem" }}>불러오는 중...</p>
      )}

      {linkInfo?.valid && card && <CardDetailView card={card} blocks={blocks} />}
    </>
  );
}
