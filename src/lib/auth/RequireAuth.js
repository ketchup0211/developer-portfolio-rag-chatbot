"use client";

// owner 전용 화면(내 정보, 초대 링크 관리, 질문 열람 등)을 감싸서, owner로
// 로그인하지 않은 사람은 로그인 화면으로 돌려보내는 컴포넌트입니다.
// `user`가 아니라 `isOwner`로 판단한다 — PLAN 10번부터 챗봇 화면의 방문자도
// Supabase에 익명으로 로그인된 `user`를 가질 수 있는데, 그런 방문자가 이
// 화면들에 들어오면 안 되기 때문이다(익명 로그인은 owner로 인정하지 않음).
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";

export function RequireAuth({ children }) {
  const { isOwner, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isOwner) {
      router.replace("/login");
    }
  }, [loading, isOwner, router]);

  if (loading) {
    return <p style={{ padding: "2rem" }}>불러오는 중...</p>;
  }

  if (!isOwner) {
    // 로그인 화면으로 이동하는 동안 잠깐 아무것도 보여주지 않습니다.
    return null;
  }

  return children;
}
