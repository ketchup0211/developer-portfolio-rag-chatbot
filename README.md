# 개발자 포트폴리오 RAG 챗봇

지원자가 등록한 포트폴리오 데이터(노션 페이지 + 첨부 파일)만을 근거로, 인사 담당자의 질문
("이런 역량 있어?", "이런 기술 스택 써봤어?", "이런 개발 경험 있어?")에 답변하는 **RAG 챗봇이
포함된 개발자 포트폴리오 웹사이트**입니다.

🔗 배포 주소: [developer-portfolio-rag-chatbot.vercel.app](https://developer-portfolio-rag-chatbot.vercel.app)

- 지원자는 자신의 프로젝트를 Notion Database에 카드 형태로 작성하고, 이 사이트는 Notion API로
  그 내용을 읽어와 갤러리뷰 형식으로 보여줍니다.
- 인사 담당자는 지원자가 발급한 **초대 링크**로 로그인 없이 접속해 포트폴리오를 열람하고,
  RAG 챗봇에게 궁금한 점을 질문할 수 있습니다.
- 챗봇은 포트폴리오에 없는 내용은 추측하지 않고, 근거가 없으면 정해진 문구로만 답하며,
  근거가 있는 답변에는 원문 카드를 새 팝업창으로 보여주는 출처 버튼이 붙습니다.
- 지원자는 로그인 후 자신에게 들어온 질문들을 대화 기록 관리 화면에서 열람할 수 있습니다.

자세한 배경·요구사항은 [PRD.md](./PRD.md), 화면·데이터 설계는 [DESIGN.md](./DESIGN.md),
개발 순서는 [PLAN.md](./PLAN.md)를 참고하세요.

## 기술 스택

| 영역 | 사용 기술 |
| --- | --- |
| 프레임워크 | [Next.js](https://nextjs.org) (App Router) |
| DB · 인증 · 파일 저장 · 벡터 검색 | [Supabase](https://supabase.com) (Postgres, Auth, Storage, pgvector) |
| 포트폴리오 원문 | [Notion API](https://developers.notion.com) |
| LLM / 임베딩 | OpenAI `gpt-4o-mini` / `text-embedding-3-small` |
| 배포 | [Vercel](https://vercel.com) |

## 개발 서버 실행

```bash
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 을 열어 확인합니다.

## 환경 변수

`.env` 파일(Git에 커밋되지 않음)에 아래 값을 채워야 합니다.

| 변수 | 용도 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL (공개용) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (공개용, RLS로 접근 제어) |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 전용, RLS를 우회해야 하는 API에서만 사용 |
| `NOTION_API_KEY` | Notion API 인증 (서버 전용) |
| `NOTION_DATABASE_ID` | 포트폴리오 카드가 담긴 Notion Database ID |
| `OPENAI_API_KEY` | 임베딩·챗봇 답변 생성 (서버 전용) |
| `OWNER_EMAIL` | owner 전용 API가 "실제 owner 계정인지" 서버에서 판별할 때 사용 (서버 전용) |

비밀 키가 필요한 기능(챗봇 응답 생성, Notion/임베딩 동기화)은 모두 Next.js 서버(API Route)를
거치며, 클라이언트에는 절대 노출되지 않습니다.

## 현재 개발 상태

[PLAN.md](./PLAN.md)에 정의된 MVP 작업(포트폴리오 연동, RAG 챗봇, 초대 링크, 대화 기록 관리,
noindex 적용 등 1~17번)을 모두 완료해 Vercel에 배포된 상태입니다. GitHub `main` 브랜치와
Vercel 프로젝트가 연동되어 있어, `main`에 push(또는 PR merge)하면 자동으로 빌드·배포되고
PR에는 프리뷰 배포가 생성됩니다.

이후로는 RAG 응답 품질(다중 프로젝트 질문의 정확도, 답변 서식 등)과 챗봇 UI를 계속 다듬는
중입니다.
