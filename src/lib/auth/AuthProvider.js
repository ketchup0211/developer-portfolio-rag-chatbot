"use client";

// 로그인 상태를 앱 전체에서 공유하기 위한 컨텍스트입니다.
// Supabase Auth를 브라우저에서 직접 사용하므로, 서버 세션 없이
// 브라우저에 저장된 로그인 정보를 읽어와 상태로 관리합니다.
import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const AuthContext = createContext({ user: null, loading: true });

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    // 처음 화면을 열었을 때 이미 로그인되어 있는지 확인합니다.
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // 로그인/로그아웃/정보 변경 등 인증 상태가 바뀔 때마다 반영합니다.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

// 로그인한 사용자 정보(user)와 로딩 상태를 어느 화면에서든 꺼내 쓸 수 있는 훅입니다.
export function useAuth() {
  return useContext(AuthContext);
}
