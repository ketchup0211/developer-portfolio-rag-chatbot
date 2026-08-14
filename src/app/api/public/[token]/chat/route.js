// RAG 챗봇 응답 로직 (DESIGN.md 2.2, PLAN.md 개발 단위 9·10번).
// 질문을 임베딩해 portfolio_chunks와 유사도 검색을 하고, 근거로 삼을 만한 조각이 있을 때만
// OpenAI로 답변을 만든다. 근거가 없거나(포트폴리오와 무관한 질문 포함) 검색 결과가 기준
// 미만이면 AI를 부르지 않고 CLAUDE.md에 정해진 문구로 확정한다.
// 방문자는 Supabase 익명 로그인(anonymous sign-in) 상태여야 하며, 질문·답변은 모두
// "초대 링크(토큰) + 방문자 uid" 단위 세션(chat_sessions/chat_messages)에 저장한다.
import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/serviceClient";
import { getOpenAIClient } from "@/lib/openai/client";
import { getVisitorFromRequest } from "@/lib/auth/verifyVisitorRequest";
import { QUESTION_LIMIT, QUESTION_LIMIT_MESSAGE, countQuestions } from "@/lib/chat/questionLimit";

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

// 질문과 포트폴리오 조각을 검색해 답변을 만든다. 실패하면 정해진 오류 문구를 답으로 돌려준다
// (호출하는 쪽에서 이 답도 그대로 세션에 저장하므로, 여기서는 예외를 던지지 않는다).
async function generateAnswer(supabase, message) {
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
      return { answer: NO_EVIDENCE_ANSWER, sourceCardIds: [] };
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

    return { answer, sourceCardIds };
  } catch (err) {
    // OpenAI 호출 실패 등 어떤 이유로든 답변 생성에 실패하면 정해진 오류 문구로 답한다.
    console.error("챗봇 응답 생성 실패:", err);
    return { answer: SERVICE_ERROR_ANSWER, sourceCardIds: [] };
  }
}

// 이 방문자(초대 링크 + uid)의 대화 세션을 찾고, 없으면 새로 만든다.
async function findOrCreateSession(supabase, inviteLinkId, ownerUserId, visitorUserId) {
  const { data: existing, error: selectError } = await supabase
    .from("chat_sessions")
    .select("id")
    .eq("invite_link_id", inviteLinkId)
    .eq("visitor_user_id", visitorUserId)
    .maybeSingle();
  if (selectError) throw selectError;
  if (existing) return existing.id;

  const { data: created, error: insertError } = await supabase
    .from("chat_sessions")
    .insert({
      invite_link_id: inviteLinkId,
      owner_user_id: ownerUserId,
      visitor_user_id: visitorUserId,
    })
    .select("id")
    .single();

  // 동시에 같은 방문자가 두 번 요청해 유니크 제약(초대 링크+방문자)에 걸린 경우, 그 사이
  // 다른 요청이 먼저 만든 세션을 다시 조회해서 쓴다.
  if (insertError) {
    if (insertError.code === "23505") {
      const { data: retry, error: retryError } = await supabase
        .from("chat_sessions")
        .select("id")
        .eq("invite_link_id", inviteLinkId)
        .eq("visitor_user_id", visitorUserId)
        .single();
      if (retryError) throw retryError;
      return retry.id;
    }
    throw insertError;
  }

  return created.id;
}

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

  // 방문자(초대 링크로 들어와 익명 로그인된 사람)가 보낸 요청인지 확인한다.
  const visitor = await getVisitorFromRequest(request);
  if (!visitor) {
    return NextResponse.json({ error: "로그인 상태를 확인하지 못했습니다." }, { status: 401 });
  }

  // 초대 링크가 유효한지 확인한다 (비활성/존재하지 않는 링크는 챗봇도 응답하지 않음).
  const { data: link, error: linkError } = await supabase
    .from("invite_links")
    .select("id, user_id, is_active")
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
    // 이 초대 링크가 이미 30회를 다 썼으면(같은 링크의 모든 방문자 합산), 세션·질문을
    // 만들거나 저장하지 않고 AI도 부르지 않은 채 바로 안내 문구로 답한다(DESIGN.md 2.2 ①).
    const questionCount = await countQuestions(supabase, link.id);
    if (questionCount >= QUESTION_LIMIT) {
      return NextResponse.json({ limitReached: true, error: QUESTION_LIMIT_MESSAGE });
    }

    const sessionId = await findOrCreateSession(supabase, link.id, link.user_id, visitor.id);

    // 방문자의 질문을 먼저 세션에 저장한다.
    const { error: questionError } = await supabase
      .from("chat_messages")
      .insert({ chat_session_id: sessionId, role: "visitor", content: message });
    if (questionError) throw questionError;

    const { answer, sourceCardIds } = await generateAnswer(supabase, message);

    // 답변(성공이든, 정해진 안내 문구든)도 같은 세션에 저장한다.
    const { data: answerRow, error: answerError } = await supabase
      .from("chat_messages")
      .insert({ chat_session_id: sessionId, role: "assistant", content: answer })
      .select("id")
      .single();
    if (answerError) throw answerError;

    if (sourceCardIds.length > 0) {
      const { error: sourcesError } = await supabase.from("chat_message_sources").insert(
        sourceCardIds.map((notionPageId) => ({
          chat_message_id: answerRow.id,
          notion_page_id: notionPageId,
        }))
      );
      if (sourcesError) throw sourcesError;
    }

    return NextResponse.json({ answer, sourceCardIds });
  } catch (err) {
    console.error("챗봇 대화 저장 실패:", err);
    return NextResponse.json({ answer: SERVICE_ERROR_ANSWER, sourceCardIds: [] });
  }
}
