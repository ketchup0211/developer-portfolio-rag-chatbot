// 프로젝트 뼈대(초기 세팅) 확인용 임시 화면입니다.
// 실제 화면(로그인, 포트폴리오, 챗봇 등)은 PLAN.md의 다음 작업들에서 순서대로 만듭니다.
export default function Home() {
  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        gap: "0.5rem",
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#111",
        background: "#fff",
      }}
    >
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>
        개발자 포트폴리오 RAG 챗봇
      </h1>
      <p style={{ color: "#555" }}>Next.js 프로젝트 초기 세팅이 완료됐습니다.</p>
    </main>
  );
}
