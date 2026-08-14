// 인사 담당자용 화면(포트폴리오 보기, RAG 챗봇, 출처 카드 — /p/[token] 아래 모든 경로)은
// 검색엔진에 노출되면 안 된다(CLAUDE.md 보안 규칙, DESIGN.md 0번 공통 원칙).
// 이 아래 페이지들은 전부 "use client" 컴포넌트라 각자 metadata를 내보낼 수 없어서,
// 이 레이아웃 하나로 하위 경로 전체에 noindex를 한 번에 적용한다.
// robots.txt 쪽 차단은 src/app/robots.js에서 같은 경로(/p/)를 함께 막는다.
export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function PublicInviteLayout({ children }) {
  return children;
}
