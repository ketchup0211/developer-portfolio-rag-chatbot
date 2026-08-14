"use client";

// 로그인이 필요한 화면(내 정보, 포트폴리오, 초대 링크 관리, 질문 열람 등)을
// 감싸서, 로그인하지 않은 사람은 로그인 화면으로 돌려보내는 컴포넌트입니다.
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";

export function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading) {
    return <p style={{ padding: "2rem" }}>불러오는 중...</p>;
  }

  if (!user) {
    // 로그인 화면으로 이동하는 동안 잠깐 아무것도 보여주지 않습니다.
    return null;
  }

  return children;
}
