// robots.txt 생성 (CLAUDE.md 보안 규칙, DESIGN.md 0번 공통 원칙, PLAN 개발 단위 15번).
// 인사 담당자용 화면(/p/[token] 및 그 아래 모든 경로 — 포트폴리오 보기, RAG 챗봇,
// 출처 카드)은 검색엔진이 아예 수집해가지 않도록 막는다. 그 외 화면(포트폴리오,
// 로그인 등)은 원래부터 색인돼도 문제없으므로 그대로 허용한다.
export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/p/",
    },
  };
}
