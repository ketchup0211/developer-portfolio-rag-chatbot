"use client";

// 지원자(owner) 화면들이 함께 쓰는 공통 상단 바입니다 (DESIGN.md 1.1, 1.5, PLAN 14번).
// 포트폴리오 화면은 로그인 없이도 볼 수 있어, 로그인 여부에 따라 메뉴를 다르게 보여준다.
// isOwner로 판단한다 — 챗봇 화면에서 익명 로그인된 방문자가 이 화면(포트폴리오)에
// 들어와도 owner 메뉴가 보이면 안 되기 때문이다.
// 알림 아이콘(종 모양)은 안읽은 세션이 하나라도 있으면 빨간 점을 보여주고, 클릭하면
// 질문 열람 화면(/questions)으로 이동한다. 이 컴포넌트가 화면마다 새로 마운트될 때
// (페이지 이동 시)마다 다시 조회하므로, /questions에서 다 읽고 다른 화면으로 돌아오면
// 빨간 점도 사라진다.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { fetchSessionSummaries } from "@/lib/chat/sessionSummary";

export default function AuthedNav() {
  const router = useRouter();
  const { isOwner } = useAuth();
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    if (!isOwner) return;
    let active = true;
    async function checkUnread() {
      const supabase = createClient();
      try {
        const summaries = await fetchSessionSummaries(supabase);
        if (active) setHasUnread(summaries.some((s) => s.unread));
      } catch {
        // 알림 표시는 부가 기능이라, 조회에 실패해도 화면 자체는 그대로 둔다.
      }
    }
    checkUnread();
    return () => {
      active = false;
    };
  }, [isOwner]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "1rem 1.5rem",
        borderBottom: "1px solid #eee",
      }}
    >
      <Link href="/portfolio" style={{ fontWeight: 700 }}>
        개발자 포트폴리오
      </Link>
      <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
        <Link href="/portfolio">내 포트폴리오</Link>
        {isOwner ? (
          <>
            <Link href="/invites">초대 링크</Link>
            <Link
              href="/questions"
              title={hasUnread ? "질문 열람 (안읽은 질문 있음)" : "질문 열람"}
              style={{ position: "relative", display: "inline-flex" }}
            >
              <span aria-hidden="true">🔔</span>
              {hasUnread && (
                <span
                  className="session-unread-dot"
                  aria-label="안읽은 질문 있음"
                  style={{ position: "absolute", top: "-2px", right: "-4px" }}
                />
              )}
            </Link>
            <Link href="/profile">내 정보</Link>
            <button
              onClick={handleLogout}
              style={{
                border: "none",
                background: "none",
                textDecoration: "underline",
                cursor: "pointer",
                fontSize: "0.95rem",
                color: "#111",
              }}
            >
              로그아웃
            </button>
          </>
        ) : (
          <Link href="/login">로그인</Link>
        )}
      </div>
    </nav>
  );
}
