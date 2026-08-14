"use client";

// 홈 화면: 로그인 여부에 따라 안내 문구와 이동할 곳을 다르게 보여줍니다.
// 포트폴리오, 초대 링크, 챗봇 등 다른 화면은 이후 작업에서 이어서 만듭니다.
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthProvider";
import { createClient } from "@/lib/supabase/client";

export default function Home() {
  const { user, loading } = useAuth();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
  }

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        gap: "0.75rem",
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#111",
        background: "#fff",
      }}
    >
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>
        개발자 포트폴리오 RAG 챗봇
      </h1>

      {loading && <p style={{ color: "#555" }}>불러오는 중...</p>}

      {!loading && !user && (
        <>
          <p style={{ color: "#555" }}>로그인하고 포트폴리오를 관리해보세요.</p>
          <Link href="/login">로그인</Link>
        </>
      )}

      {!loading && user && (
        <>
          <p style={{ color: "#555" }}>
            {(user.user_metadata?.name || user.email) + "님, 환영합니다."}
          </p>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <Link href="/profile">내 정보</Link>
            <button
              onClick={handleLogout}
              style={{
                border: "none",
                background: "none",
                textDecoration: "underline",
                cursor: "pointer",
                fontSize: "1rem",
                color: "#111",
              }}
            >
              로그아웃
            </button>
          </div>
        </>
      )}
    </main>
  );
}
