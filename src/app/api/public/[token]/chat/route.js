// RAG 챗봇 응답 로직 (DESIGN.md 2.2, PLAN.md 개발 단위 9·10번).
// 질문을 임베딩해 portfolio_chunks와 유사도 검색을 하고, 그 결과와 함께 "카드별 요약
// 조각"(chunk_type='summary', 항상 전부 포함)도 근거로 준다. "React 프로젝트 있어?",
// "이런 역량 있어?"처럼 카드 하나가 아니라 포트폴리오 전체를 훑어야 답할 수 있는 질문에도
// 답하고, 팀 인원·기간처럼 속성에만 있는 사실도 답할 수 있도록 하기 위해서다.
// AI(gpt-4o-mini)에게 "이 자료로 답할 수 없으면 정해진 문구로만 답하라"를 강하게 지시하고,
// 실제로 어떤 프로젝트를 근거로 썼는지도 함께 JSON으로 받아 출처 버튼에 정확히 반영한다.
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

// 코사인 유사도가 이 값을 넘는 본문 조각만 "이 질문과 특히 관련 있는 세부 내용"으로 추가한다.
// (요약 조각은 이 기준과 무관하게 항상 전부 포함되므로, 이 값은 세부 근거 보강용일 뿐이다.)
// "React 프로젝트 있어?"처럼 여러 프로젝트에 걸쳐 언급을 찾아야 하는 질문도 놓치지 않도록
// 넉넉히 가져온다(카드 수가 적어 비용 부담이 크지 않고, 실제로 쓸지는 모델이 usedProjectIds로 정한다).
const MATCH_THRESHOLD = 0.25;
const MATCH_COUNT = 12;

const SYSTEM_PROMPT = `당신은 지원자의 포트폴리오를 근거로 인사 담당자의 질문에 답하는 채용 지원 챗봇입니다.

[반드시 지킬 규칙]
1. 아래 "프로젝트 자료"에 있는 내용만 근거로 답하세요. 거기 없는 사실은 절대로 추측하거나 지어내지 마세요.
2. "이런 기술 써봤어?", "~프로젝트 있어?", "이런 역량 있어?", "이런 문제 해결할 수 있어?"처럼 특정 프로젝트 하나가 아니라 포트폴리오 전체를 봐야 답할 수 있는 질문에는, 아래 제공된 프로젝트 자료 전체를 빠짐없이 살펴 관련된 프로젝트를 모두 찾아 답하세요. 인사 담당자가 포트폴리오 내용을 전혀 모르는 상태로 물어봐도 답할 수 있어야 합니다.
3. "프로젝트 자료"의 [전체 프로젝트 요약]에는 모든 프로젝트의 제목과 속성(기간·역할·인원 등)이 빠짐없이 들어 있습니다. 질문에 대한 답이 거기 있는데도 "확인하기 어렵다"고 답하지 마세요 — 자료를 다시 한번 꼼꼼히 확인한 뒤에만 규칙 4를 적용하세요.
4. "몇 개", "모두", "전부", "각각" 등 개수를 세거나 전체 목록을 요구하는 질문에는, [전체 프로젝트 요약]에 적힌 "총 N개 프로젝트" 중 1번부터 N번까지 번호를 하나도 빠뜨리지 말고 순서대로 조건에 맞는지 확인한 뒤에만 답하세요. 일부만 확인하고 대략적인 개수나 목록을 말하지 마세요. 답변에 언급한 프로젝트 개수와 usedProjectIds 배열의 길이는 반드시 일치해야 합니다.
5. 질문에 대한 근거를 프로젝트 자료 전체에서 정말로 전혀 찾을 수 없거나, 포트폴리오와 무관한 질문(일반 상식 등)일 때만 다른 말 없이 정확히 이 문장으로 답하세요: "${NO_EVIDENCE_ANSWER}"
6. 근거가 있을 때는 지원자의 역량과 가능성을 자신감 있고 긍정적인 어조로 설명하세요. 관련 경험이 있다면 그 경험이 질문받은 역량과 어떻게 이어지는지 적극적으로 짚어 강점으로 소개하되, 프로젝트 자료에 없는 능력을 있다고 추측해서 덧붙이지는 마세요.
7. 모든 답변은 한국어 존댓말로 작성하세요.
8. 다른 텍스트 없이 아래 JSON 형식으로만 답하세요:
{"answer": "실제 답변 문장", "usedProjectIds": ["실제로 답변에 사용한 프로젝트 자료의 id들"]}
usedProjectIds는 answer가 규칙 5의 정해진 문구인 경우 반드시 빈 배열([])이어야 합니다.`;

// 카드별 요약(chunk_type='summary')은 유사도 점수와 무관하게 항상 전부 가져온다.
async function fetchAllSummaries(supabase) {
  const { data, error } = await supabase
    .from("portfolio_chunks")
    .select("notion_page_id, content")
    .eq("chunk_type", "summary");
  if (error) throw error;
  return data || [];
}

// 질문과 포트폴리오 조각을 검색해 답변을 만든다. 실패하면 정해진 오류 문구를 답으로 돌려준다
// (호출하는 쪽에서 이 답도 그대로 세션에 저장하므로, 여기서는 예외를 던지지 않는다).
async function generateAnswer(supabase, message) {
  try {
    const openai = getOpenAIClient();

    // 1. 카드 요약은 전부, 질문과 특히 비슷한 본문 조각은 유사도 검색으로 보강해서 가져온다.
    const embeddingRes = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: message,
    });
    const queryEmbedding = embeddingRes.data[0].embedding;

    const [summaries, matchResult] = await Promise.all([
      fetchAllSummaries(supabase),
      supabase.rpc("match_portfolio_chunks", {
        query_embedding: queryEmbedding,
        match_threshold: MATCH_THRESHOLD,
        match_count: MATCH_COUNT,
      }),
    ]);
    if (matchResult.error) throw matchResult.error;
    // match_portfolio_chunks는 chunk_type='body'만 검색하므로(요약과 중복 방지),
    // 여기 나오는 결과는 전부 카드 요약과는 별개인 본문 발췌다.
    const detailMatches = matchResult.data || [];

    // 포트폴리오에 카드가 하나도 없으면(동기화 전 등) AI를 부를 필요 없이 바로 확정한다.
    if (summaries.length === 0 && detailMatches.length === 0) {
      return { answer: NO_EVIDENCE_ANSWER, sourceCardIds: [] };
    }

    const knownProjectIds = new Set([
      ...summaries.map((s) => s.notion_page_id),
      ...detailMatches.map((m) => m.notion_page_id),
    ]);

    // 2. 자료를 "프로젝트 id" 태그와 함께 정리해서 AI에게 통째로 전달한다. "몇 개/모두"류
    // 질문에서 모델이 목록 중 일부를 건너뛰지 않도록, 총 개수와 번호를 명시적으로 붙인다
    // (시스템 프롬프트 규칙 4가 이 번호를 근거로 빠짐없이 확인하라고 지시한다).
    const summarySection = summaries
      .map(
        (s, i) =>
          `--- 프로젝트 ${i + 1}/${summaries.length} (id: ${s.notion_page_id}) ---\n${s.content}`
      )
      .join("\n\n");
    const detailSection = detailMatches
      .map((m) => `--- 프로젝트 id: ${m.notion_page_id} (본문 발췌) ---\n${m.content}`)
      .join("\n\n");

    const context =
      `[전체 프로젝트 요약] 총 ${summaries.length}개 프로젝트\n${summarySection || "(등록된 프로젝트 없음)"}` +
      (detailSection ? `\n\n[질문과 관련성이 높은 본문 발췌]\n${detailSection}` : "");

    const chatRes = await openai.chat.completions.create({
      model: CHAT_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: `${SYSTEM_PROMPT}\n\n[프로젝트 자료]\n${context}` },
        { role: "user", content: message },
      ],
    });

    const raw = chatRes.choices?.[0]?.message?.content || "";
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("모델 응답을 해석하지 못했습니다: " + raw.slice(0, 200));
    }

    const answer = typeof parsed.answer === "string" && parsed.answer.trim()
      ? parsed.answer.trim()
      : NO_EVIDENCE_ANSWER;

    // 근거 없음 문구를 그대로 답한 경우에는 출처 버튼을 보이지 않는다. 모델이 존재하지 않는
    // 프로젝트 id를 지어내 돌려줄 가능성에 대비해, 실제로 자료에 있던 id만 신뢰한다.
    const hasEvidence = answer !== NO_EVIDENCE_ANSWER;
    const usedIds = Array.isArray(parsed.usedProjectIds) ? parsed.usedProjectIds : [];
    const sourceCardIds = hasEvidence
      ? [...new Set(usedIds.filter((id) => knownProjectIds.has(id)))]
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

  // CLAUDE.md 규칙: RAG 챗봇은 인사 담당자 전용이며 지원자(owner) 본인은 쓰지 않는다.
  // owner가 로그인된 브라우저로 자기 링크를 열어도(화면에서 이미 막지만, API를 직접
  // 호출하는 경우에 대비해 서버에서도) owner 계정이 "방문자"로 기록되지 않도록 막는다.
  if (process.env.OWNER_EMAIL && visitor.email === process.env.OWNER_EMAIL) {
    return NextResponse.json(
      { error: "owner 계정으로는 챗봇을 사용할 수 없습니다. 로그아웃 후 다시 시도해주세요." },
      { status: 403 }
    );
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
