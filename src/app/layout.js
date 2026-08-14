import "./globals.css";
import { AuthProvider } from "@/lib/auth/AuthProvider";

// 인터넷 연결 없이도(오프라인 개발 환경 포함) 안정적으로 뜨도록,
// Google Fonts 대신 운영체제 기본 글꼴을 사용합니다.
export const metadata = {
  title: "개발자 포트폴리오 RAG 챗봇",
  description: "지원자의 포트폴리오 데이터를 근거로 답변하는 RAG 챗봇이 포함된 개발자 포트폴리오 웹사이트",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>
        {/* 로그인 상태를 앱 전체에서 알 수 있도록 감싸줍니다. */}
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
