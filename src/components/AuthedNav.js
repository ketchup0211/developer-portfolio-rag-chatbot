"use client";

// 지원자(owner) 화면들이 함께 쓰는 공통 상단 바입니다 (DESIGN.md 1.1).
// 포트폴리오 화면은 로그인 없이도 볼 수 있어, 로그인 여부에 따라 메뉴를 다르게 보여준다.
// isOwner로 판단한다 — 챗봇 화면에서 익명 로그인된 방문자가 이 화면(포트폴리오)에
// 들어와도 owner 메뉴가 보이면 안 되기 때문이다.
// 알림 아이콘은 아직 해당 기능이 없어 이후 작업에서 추가합니다.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/AuthProvider";

export default function AuthedNav() {
  const router = useRouter();
  const { isOwner } = useAuth();

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
            <Link href="/questions">질문 열람</Link>
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
