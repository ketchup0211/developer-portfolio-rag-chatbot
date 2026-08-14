"use client";

// 프로젝트 카드 상세 화면 (DESIGN.md 1.3) — 로그인 없이도 볼 수 있다.
// 편집은 노션에서 하고, 이 화면은 실제 노션 페이지 화면과 최대한 비슷하게 읽기 전용으로
// 보여준다. "노션에서 편집"·"노션에서 새로고침" 버튼은 owner가 로그인했을 때만 보인다.
// 렌더링 자체는 인사 담당자용 화면(/p/[token]/cards/[cardId])과 공용 컴포넌트를 함께 쓴다.
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import AuthedNav from "@/components/AuthedNav";
import CardDetailView from "@/components/portfolio/CardDetailView";
import { useAuth } from "@/lib/auth/AuthProvider";

async function fetchCardDetail(id, { force = false } = {}) {
  const res = await fetch(`/api/notion/cards/${id}${force ? "?refresh=1" : ""}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "불러오기에 실패했습니다.");
  return data;
}

export default function CardDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [card, setCard] = useState(null);
  const [blocks, setBlocks] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const data = await fetchCardDetail(id);
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
  }, [id]);

  async function handleRefresh() {
    setRefreshing(true);
    setError("");
    try {
      const data = await fetchCardDetail(id, { force: true });
      setCard(data.card);
      setBlocks(data.blocks);
    } catch (err) {
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <>
      <AuthedNav />

      {error && (
        <p className="form-error" style={{ padding: "1.5rem" }}>
          {error}
        </p>
      )}

      {!card && !error && <p style={{ padding: "1.5rem" }}>불러오는 중...</p>}

      {card && (
        <CardDetailView
          card={card}
          blocks={blocks}
          topbar={
            user && (
              <div className="notion-page-topbar">
                <button type="button" onClick={handleRefresh} disabled={refreshing}>
                  {refreshing ? "새로고침 중..." : "노션에서 새로고침"}
                </button>
                <a href={card.url} target="_blank" rel="noreferrer">
                  노션에서 편집 ↗
                </a>
              </div>
            )
          }
        />
      )}
    </>
  );
}
