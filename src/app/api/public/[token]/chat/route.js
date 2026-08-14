// RAG 챗봇 응답 로직 (DESIGN.md 2.2, PLAN.md 개발 단위 9번).
// 질문을 임베딩해 portfolio_chunks와 유사도 검색을 하고, 근거로 삼을 만한 조각이 있을 때만
// OpenAI로 답변을 만든다. 근거가 없거나(포트폴리오와 무관한 질문 포함) 검색 결과가 기준
// 미만이면 AI를 부르지 않고 CLAUDE.md에 정해진 문구로 확정한다.
// 방문자 익명 로그인 연동과 대화 기록 저장(chat_sessions/chat_messages)은 PLAN 10번에서
// 이어서 만든다 — 이번 작업은 질문 한 번을 받아 답 하나를 만들어 돌려주는 로직까지만 다룬다.
import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/serviceClient";
import { getOpenAIClient } from "@/lib/openai/client";

const EMBEDDING_MODEL = "text-embedding-3-small";
const CHAT_MODEL = "gpt-4o-mini";

// CLAUDE.md에 정해진 문구는 절대 바꾸지 않는다.
const NO_EVIDENCE_ANSWER =
  "포트폴리오에 포함된 정보에서는 해당 내용을 확인하기 어렵습니다.";
const SERVICE_ERROR_ANSWER =
  "죄송합니다. 오류로 인해 현재 챗봇 서비스 사용이 불가합니다. 다시 시도해주세요.";

// 코사인 유사도가 이 값을 넘는 조각만 "근거 있음"으로 인정한다.
const MATCH_THRESHOLD = 0.35;
const MATCH_COUNT = 5;

export async function POST(request, { params }) {
  const { token } = await params;

  let message = "";
  try {
    const body = await request.json();
    message = typeof body?.message === "string" ? body.message.trim() : "";
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  if (!message) {
    return NextResponse.json({ error: "질문을 입력해주세요." }, { status: 400 });
  }

  const supabase = getSupabaseServiceClient();

  // 초대 링크가 유효한지 먼저 확인한다 (비활성/존재하지 않는 링크는 챗봇도 응답하지 않음).
  const { data: link, error: linkError } = await supabase
    .from("invite_links")
    .select("id, is_active")
    .eq("token", token)
    .maybeSingle();

  if (linkError) {
    console.error("초대 링크 조회 실패:", linkError);
    return NextResponse.json({ error: "링크를 확인하지 못했습니다." }, { status: 500 });
  }
  if (!link || !link.is_active) {
    return NextResponse.json({ error: "더 이상 사용할 수 없는 링크입니다." }, { status: 403 });
  }

  try {
    const openai = getOpenAIClient();

    // 1. 질문을 임베딩해서 포트폴리오 조각들과 유사도 검색
    const embeddingRes = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: message,
    });
    const queryEmbedding = embeddingRes.data[0].embedding;

    const { data: matches, error: matchError } = await supabase.rpc(
      "match_portfolio_chunks",
      {
        query_embedding: queryEmbedding,
        match_threshold: MATCH_THRESHOLD,
        match_count: MATCH_COUNT,
      }
    );
    if (matchError) throw matchError;

    // 2. 근거가 될 만한 조각이 하나도 없으면 AI를 부르지 않고 바로 확정 문구로 답한다.
    if (!matches || matches.length === 0) {
      return NextResponse.json({ answer: NO_EVIDENCE_ANSWER, sourceCardIds: [] });
    }

    // 3. 근거 조각만 참고해서 답변을 생성한다 (근거 밖 지식 사용 금지를 시스템 프롬프트로 강제).
    const context = matches
      .map((m, i) => `[근거 ${i + 1}]\n${m.content}`)
      .join("\n\n");

    const chatRes = await openai.chat.completions.create({
      model: CHAT_MODEL,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "당신은 지원자의 포트폴리오 내용을 근거로 인사 담당자의 질문에 답하는 챗봇입니다.\n" +
            "아래 [근거]에 나온 내용만을 바탕으로 답변하고, [근거]에 없는 사실은 절대 추측하거나 " +
            "지어내지 마세요. 질문에 대한 답을 [근거]에서 찾을 수 없거나, 질문이 포트폴리오와 " +
            `무관한 내용(일반 상식 등)이라면, 다른 말 없이 정확히 이 문장으로만 답하세요: ` +
            `"${NO_EVIDENCE_ANSWER}"\n` +
            "그 외의 모든 답변은 반드시 한국어 존댓말로 작성하세요.\n\n" +
            `[근거]\n${context}`,
        },
        { role: "user", content: message },
      ],
    });

    const answer = chatRes.choices?.[0]?.message?.content?.trim() || NO_EVIDENCE_ANSWER;

    // 근거 없음 문구를 그대로 답한 경우에는 출처 버튼을 보이지 않는다.
    const hasEvidence = answer !== NO_EVIDENCE_ANSWER;
    const sourceCardIds = hasEvidence
      ? [...new Set(matches.map((m) => m.notion_page_id))]
      : [];

    return NextResponse.json({ answer, sourceCardIds });
  } catch (err) {
    // OpenAI 호출 실패 등 어떤 이유로든 답변 생성에 실패하면 정해진 오류 문구로 답한다.
    console.error("챗봇 응답 생성 실패:", err);
    return NextResponse.json({ answer: SERVICE_ERROR_ANSWER, sourceCardIds: [] });
  }
}
