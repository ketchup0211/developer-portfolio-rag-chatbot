"use client";

// 내 포트폴리오 화면 (DESIGN.md 1.3) — 로그인 없이도 볼 수 있다.
// 카드 원문은 이제 Notion Database가 소스 오브 트루스이고, 이 화면은 그 목록을
// 노션 갤러리뷰처럼 그리드로 읽어와 보여준다. 카드 생성/수정은 Notion에서 직접 하며,
// "노션에서 카드 추가" · "노션에서 다시 불러오기"(임베딩 동기화 포함) 버튼은
// owner가 로그인했을 때만 보인다. 서버(POST /api/notion/sync)도 로그인 여부를 다시 확인한다.
// 카드 그리드 자체는 인사 담당자용 화면(/p/[token])과 공용 컴포넌트를 함께 쓴다.
import { useEffect, useState } from "react";
import AuthedNav from "@/components/AuthedNav";
import CardGrid from "@/components/portfolio/CardGrid";
import { useAuth } from "@/lib/auth/AuthProvider";
import { createClient } from "@/lib/supabase/client";

// 컴포넌트 밖에 둔 순수 fetch 함수. 마운트 시 자동 로딩과, 버튼 클릭 시 재조회에서
// 그대로 재사용한다 (setState는 각 호출부에서 직접 처리해 effect 규칙을 지킨다).
async function fetchNotionCards({ force = false } = {}) {
  const res = await fetch(`/api/notion/cards${force ? "?refresh=1" : ""}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "불러오기에 실패했습니다.");
  return data;
}

export default function PortfolioPage() {
  const { user } = useAuth();
  const [cards, setCards] = useState(null);
  const [databaseUrl, setDatabaseUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");

  // 화면 진입 시 1회 자동 로딩. effect 안에서 직접 정의하고 바로 실행해,
  // effect 바깥 함수를 참조하며 setState하는 패턴(react-hooks/set-state-in-effect)을 피한다.
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const data = await fetchNotionCards();
        if (!active) return;
        setCards(data.cards);
        setDatabaseUrl(data.databaseUrl || "");
      } catch (err) {
        if (active) setError(err.message);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  // "노션에서 다시 불러오기" 버튼 클릭 핸들러. 이벤트 핸들러 안에서의 setState는
  // effect 규칙 대상이 아니라 자유롭게 호출할 수 있다.
  // 화면에 보이는 목록을 최신화하는 것과 함께, 챗봇이 검색할 임베딩(portfolio_chunks)도
  // 이 시점에 통째로 다시 만든다 (DESIGN.md 2.1, PLAN.md 개발 단위 5번).
  async function handleRefresh() {
    setLoading(true);
    setError("");
    setSyncMessage("");
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const syncRes = await fetch("/api/notion/sync", {
        method: "POST",
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      const syncData = await syncRes.json();
      if (!syncRes.ok) throw new Error(syncData.error || "동기화에 실패했습니다.");

      const data = await fetchNotionCards({ force: true });
      setCards(data.cards);
      setDatabaseUrl(data.databaseUrl || "");

      const failedCount = syncData.failed?.length || 0;
      setSyncMessage(
        `카드 ${syncData.syncedCards}개, 조각 ${syncData.totalChunks}개를 동기화했습니다.` +
          (syncData.removedCards ? ` (삭제된 카드 ${syncData.removedCards}개 정리)` : "") +
          (failedCount ? ` — ${failedCount}개 카드는 실패했습니다.` : "")
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <AuthedNav />
      <div style={{ padding: "1.5rem 1.5rem 0" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "0.75rem",
          }}
        >
          <h1 style={{ fontSize: "1.3rem" }}>내 포트폴리오</h1>
          {user && (
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={loading}
                style={secondaryButtonStyle}
              >
                {loading ? "동기화 중..." : "노션에서 다시 불러오기"}
              </button>
              {databaseUrl && (
                <a
                  href={databaseUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={primaryButtonStyle}
                >
                  + 노션에서 카드 추가
                </a>
              )}
            </div>
          )}
        </div>
        <p style={{ color: "#777", fontSize: "0.85rem", marginTop: "0.4rem" }}>
          {user
            ? '프로젝트 카드는 Notion Database에서 작성·수정합니다. 이 화면은 그 내용을 읽기 전용으로 보여줍니다. "노션에서 다시 불러오기"를 누르면 화면 내용과 함께 챗봇이 검색할 내용(임베딩)도 최신 상태로 갱신됩니다.'
            : "프로젝트 카드는 Notion Database에서 작성·수정합니다. 이 화면은 그 내용을 읽기 전용으로 보여줍니다."}
        </p>
        {syncMessage && <p className="form-message">{syncMessage}</p>}
        {error && <p className="form-error">{error}</p>}
      </div>

      {cards === null && !error && (
        <p style={{ padding: "1.5rem" }}>불러오는 중...</p>
      )}

      {cards && cards.length === 0 && (
        <p style={{ padding: "1.5rem", color: "#555" }}>
          아직 등록한 프로젝트 카드가 없습니다. 노션 Database에 카드를 추가한 뒤
          &quot;노션에서 다시 불러오기&quot;를 눌러주세요.
        </p>
      )}

      {cards && cards.length > 0 && (
        <CardGrid cards={cards} hrefFor={(card) => `/portfolio/${card.id}`} />
      )}
    </>
  );
}

const primaryButtonStyle = {
  padding: "0.5rem 1rem",
  background: "#111",
  color: "#fff",
  borderRadius: "6px",
  textDecoration: "none",
  fontSize: "0.9rem",
};

const secondaryButtonStyle = {
  padding: "0.5rem 1rem",
  background: "#fff",
  color: "#111",
  border: "1px solid #ccc",
  borderRadius: "6px",
  fontSize: "0.9rem",
  cursor: "pointer",
};
