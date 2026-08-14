// RAG 챗봇 응답 로직 (DESIGN.md 2.2, PLAN.md 개발 단위 9·10번).
// 질문을 임베딩해 portfolio_chunks와 유사도 검색을 하고, 그 결과와 함께 "카드별 요약
// 조각"(chunk_type='summary', 항상 전부 포함)도 근거로 준다. "React 프로젝트 있어?",
// "이런 역량 있어?"처럼 카드 하나가 아니라 포트폴리오 전체를 훑어야 답할 수 있는 질문에도
// 답하고, 팀 인원·기간처럼 속성에만 있는 사실도 답할 수 있도록 하기 위해서다.
//
// "팀 프로젝트 몇 개야?" 같은 질문에서 모델이 스스로 개수를 세다가 일부를 빠뜨리는 문제가
// 있어서(한 번의 호출로 판단+개수+문장을 다 시키면 신뢰도가 떨어짐), 판단과 문장 작성을
// 2단계로 분리했다.
// 1단계(분류): 프로젝트마다 이 질문과 관련 있는지를 "독립적으로" true/false 판단시킨다.
//   최종 근거 목록과 개수는 이 판단 결과 배열의 길이를 코드에서 세어 정하지, 모델이 답변
//   문장 안에서 스스로 센 숫자를 신뢰하지 않는다(데이터 기반 정확성 확보).
// 2단계(작성): 코드가 이미 확정한 프로젝트 목록만 모델에게 다시 주고, 그 목록 그대로
//   자연스러운 문장으로 풀어 쓰게 한다. id는 이 단계에 아예 넘기지 않아 답변에 id가 섞일
//   여지 자체를 없앤다.
// 근거가 전혀 없으면(1단계 결과가 0개) 2단계를 부르지 않고 바로 정해진 문구로 확정한다.
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

// 모델이 프롬프트 지시(규칙 9)를 어기고 답변 문장에 노션 페이지 id를 그대로 옮겨 적는
// 경우에 대비한 안전장치. "(id: xxx)" 형태와 UUID 패턴을 답변에서 지운다(사람이 읽는
// 문장에 내부 식별자가 노출되면 안 되므로, 프롬프트만 믿지 않고 서버에서도 한 번 더 막는다).
const ID_PARENTHETICAL_PATTERN = /[(（]\s*id\s*[:：]\s*[0-9a-fA-F-]{6,}\s*[)）]/gi;
const UUID_PATTERN = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g;

function stripProjectIds(text) {
  return text
    .replace(ID_PARENTHETICAL_PATTERN, "")
    .replace(UUID_PATTERN, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([.,!?])/g, "$1")
    .trim();
}

// 1단계: 프로젝트마다 독립적으로 관련 여부를 판단시킨다. "전체 개수"나 "목록"을 한 번에
// 만들게 하지 않고 항목 하나하나에 대해서만 참/거짓을 답하게 하면, 모델이 스스로 세다가
// 빠뜨리는 실수를 코드가 배열 길이로 대신 세어 막을 수 있다.
const CLASSIFY_SYSTEM_PROMPT = `당신은 지원자의 포트폴리오 프로젝트들을 인사 담당자의 질문과 하나씩 대조해 관련 여부를 판단하는 도우미입니다.

[반드시 지킬 규칙]
1. 아래 [프로젝트 자료]에 나열된 프로젝트를 처음부터 끝까지 하나도 빠짐없이 살펴보고, 각 프로젝트가 그 프로젝트 자료 내용만으로 볼 때 질문과 관련 있는지(relevant)를 다른 프로젝트와 무관하게 각각 독립적으로 판단하세요.
2. 질문이 "이런 기술 써봤어?", "~프로젝트 있어?", "이런 역량/문제를 다뤄봤어?"처럼 넓은 질문이면, 프로젝트 자료에 조금이라도 관련 근거가 있는 프로젝트는 모두 relevant: true로 표시하세요.
3. 질문이 "개인/팀 몇 명", "언제 진행" 같은 특정 속성 조건이면, 그 속성 값을 프로젝트 자료에서 정확히 확인해서 조건에 정말 맞을 때만 relevant: true로 표시하세요. 짐작하거나 다른 프로젝트와 헷갈리지 마세요.
4. 프로젝트 자료에 없는 내용을 근거로 relevant: true를 주지 마세요. 포트폴리오와 무관한 질문(일반 상식 등)이면 모든 프로젝트를 relevant: false로 표시하세요.
5. relevant가 true인 프로젝트에는 그 프로젝트가 무엇인지(무엇을 만들었는지, 어떤 문제를 다뤘는지 등) 프로젝트 자료 내용을 바탕으로 한두 문장 description을 쓰세요. relevant가 false면 description은 빈 문자열로 두세요.
6. 다른 텍스트 없이 아래 JSON 형식으로만, [프로젝트 자료]에 있는 프로젝트 전부에 대해 하나씩 빠짐없이 답하세요:
{"judgments": [{"id": "프로젝트 id", "relevant": true, "description": "설명 또는 빈 문자열"}]}`;

// 2단계: 1단계에서 이미 확정된(코드가 필터링한) 프로젝트 목록만 넘겨 문장으로 풀어 쓰게
// 한다. 이 단계에는 프로젝트 id를 아예 주지 않으므로 답변 문장에 id가 섞일 수 없다.
const SYNTHESIZE_SYSTEM_PROMPT = `당신은 지원자의 포트폴리오를 근거로 인사 담당자의 질문에 답하는 채용 지원 챗봇입니다. 어떤 프로젝트가 근거가 되는지는 이미 정확히 정해져 있으니, 그 목록만 사용해 자연스러운 답변을 작성하세요.

[반드시 지킬 규칙]
1. 사용자 메시지에 주어진 목록의 프로젝트만 언급하세요. 목록에 없는 프로젝트를 언급하거나 지어내지 마세요.
2. 목록에 있는 프로젝트는 하나도 빠짐없이 전부 답변에 포함하세요. 개수를 스스로 세거나 임의로 줄이지 마세요 — 목록에 있는 그대로가 정답입니다.
3. 프로젝트 제목과 설명은 목록에 주어진 내용을 바탕으로 자연스럽게 풀어 쓰세요. 목록에 없는 사실을 추측해서 덧붙이지 마세요.
4. 지원자의 역량과 가능성을 자신감 있고 긍정적인 어조로 설명하세요. 관련 경험이 질문받은 역량과 어떻게 이어지는지 적극적으로 짚어 강점으로 소개하세요.
5. 프로젝트 id나 내부 식별자 같은 것은 답변에 절대 포함하지 마세요(목록에는 애초에 id가 없습니다). 프로젝트 제목과 설명만 사용하세요.
6. 모든 답변은 한국어 존댓말로 작성하세요. 프로젝트 이름은 정확히 그대로 언급하세요.
7. 다른 텍스트 없이 답변 문장만 그대로 출력하세요(JSON, 따옴표, 접두어 없이).`;

// 카드별 요약(chunk_type='summary')은 유사도 점수와 무관하게 항상 전부 가져온다.
async function fetchAllSummaries(supabase) {
  const { data, error } = await supabase
    .from("portfolio_chunks")
    .select("notion_page_id, content")
    .eq("chunk_type", "summary");
  if (error) throw error;
  return data || [];
}

// 프로젝트 요약 본문(`제목: xxx`로 시작)에서 제목만 뽑아낸다. 2단계 프롬프트에는 id 없이
// 제목만 넘기므로, 사람이 읽을 제목 표기를 항상 여기서 다시 뽑아 쓴다(모델이 새로 지어내지
// 않도록 — 코드가 실제 데이터에서 가져온 제목만 신뢰한다).
function extractTitle(summaryContent) {
  const firstLine = (summaryContent || "").split("\n")[0] || "";
  const match = firstLine.match(/^제목:\s*(.+)$/);
  return match ? match[1].trim() : firstLine.trim() || "제목 미상";
}

function shuffled(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// 1단계 분류를 한 번 실행한다. gpt-4o-mini가 나열 순서에 따라 특정 프로젝트(주로 맨 앞
// 항목)를 놓치는 위치 편향이 실제로 재현되어서(같은 질문·같은 프로젝트인데 순서만 바꾸면
// 판단이 달라짐), 하나의 순서만 믿지 않고 여러 순서로 여러 번 물어본 뒤 합집합을 취한다
// (아래 classifyRelevantProjects 참고). 이 함수는 그중 한 번의 호출만 담당한다.
// summaryMap에는 일부러 카드 요약(제목+속성)만 담는다 — 본문 발췌까지 섞으면 특정
// 프로젝트에 발췌가 몰릴 때 판단 자체가 불안정해지는 것을 반복 검증으로 확인했다.
async function classifyOnce(openai, orderedIds, summaryMap, message) {
  const manifest = orderedIds
    .map((id, i) => `--- 프로젝트 ${i + 1}/${orderedIds.length} (id: ${id}) ---\n${summaryMap.get(id)}`)
    .join("\n\n");

  const res = await openai.chat.completions.create({
    model: CHAT_MODEL,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `${CLASSIFY_SYSTEM_PROMPT}\n\n[프로젝트 자료] 총 ${orderedIds.length}개\n${manifest}`,
      },
      { role: "user", content: message },
    ],
  });

  const raw = res.choices?.[0]?.message?.content || "";
  const parsed = JSON.parse(raw); // 실패하면 호출부의 catch에서 SERVICE_ERROR_ANSWER로 처리
  return Array.isArray(parsed.judgments) ? parsed.judgments : [];
}

// 원래 순서·역순·무작위 순서 세 번을 병렬로 물어보고 관련 있다고 판단된 프로젝트의
// 합집합을 취한다. 위치 편향으로 어느 한 순서에서 특정 프로젝트를 놓치더라도, 다른
// 순서에서는 대부분 정상적으로 잡히기 때문에 결과가 훨씬 안정적이다("몇 개인지"는
// 모델이 답변 문장 안에서 세는 숫자가 아니라, 이렇게 코드가 확정한 배열의 길이다).
async function classifyRelevantProjects(openai, summaryMap, message) {
  const original = [...summaryMap.keys()];
  const orderings = [original, [...original].reverse(), shuffled(original)];

  const results = await Promise.all(
    orderings.map((ids) => classifyOnce(openai, ids, summaryMap, message))
  );

  const relevantIds = [];
  const descriptionById = new Map();
  for (const judgments of results) {
    for (const j of judgments) {
      if (!j || j.relevant !== true || !summaryMap.has(j.id)) continue;
      if (!relevantIds.includes(j.id)) relevantIds.push(j.id);
      // 여러 순서에서 같은 프로젝트가 relevant로 잡히면, 그중 설명이 채워진 것을 쓴다.
      const desc = typeof j.description === "string" ? j.description.trim() : "";
      if (desc && !descriptionById.get(j.id)) descriptionById.set(j.id, desc);
    }
  }

  return { relevantIds, descriptionById };
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

    // 2. 프로젝트 요약 맵(id -> 요약 내용)과, 프로젝트별 본문 발췌 목록을 따로 만든다.
    // 요약은 모든 카드에 대해 항상 존재하므로, 이 맵의 키가 곧 "전체 프로젝트 목록"이다.
    // 1단계(관련 여부 판단)에는 일부러 본문 발췌를 섞지 않는다 — 실험해보니 본문 발췌를
    // 함께 주면 특정 프로젝트에 발췌가 몰릴 때 판단이 흔들리는 경우가 있어서(예: 팀 프로젝트
    // 개수를 물었는데 발췌가 많이 달린 프로젝트 하나 때문에 다른 프로젝트 판단이 무너짐),
    // 요약만으로 판단할 때가 훨씬 안정적이었다(반복 검증 결과). 본문 발췌는 이미 관련 있다고
    // 확정된 프로젝트의 설명을 풍부하게 하는 2단계(문장 작성)에서만 참고 자료로 쓴다.
    const summaryMap = new Map(summaries.map((s) => [s.notion_page_id, s.content]));
    const detailByProject = new Map();
    for (const m of detailMatches) {
      if (!detailByProject.has(m.notion_page_id)) detailByProject.set(m.notion_page_id, []);
      detailByProject.get(m.notion_page_id).push(m.content);
    }

    // 3. 1단계: 프로젝트마다 독립적으로 관련 여부를 판단시킨다(순서를 바꿔 3번 물어보고
    // 합집합을 취해 위치 편향을 상쇄한다 — classifyRelevantProjects 참고). 최종 근거
    // 목록/개수는 이 결과 배열을 코드가 세어 정한다 — 모델이 스스로 센 숫자를 신뢰하지 않는다.
    const { relevantIds, descriptionById } = await classifyRelevantProjects(
      openai,
      summaryMap,
      message
    );

    // 근거가 하나도 없으면(1단계 결과가 0개) AI를 다시 부르지 않고 바로 정해진 문구로
    // 확정한다 — "근거 없음" 판단도 모델 문장이 아니라 이 배열 길이로 결정한다.
    if (relevantIds.length === 0) {
      return { answer: NO_EVIDENCE_ANSWER, sourceCardIds: [] };
    }

    // 4. 2단계: 이미 확정된 프로젝트 목록만 모델에게 다시 주고 문장으로 풀어 쓰게 한다.
    // id는 여기서 아예 넘기지 않으므로 답변에 id가 섞일 여지 자체가 없다. 이 프로젝트에
    // 관련성 높은 본문 발췌가 있으면 설명을 더 구체적으로 쓸 수 있도록 함께 참고시킨다.
    const relevantList = relevantIds
      .map((id, i) => {
        const title = extractTitle(summaryMap.get(id));
        const description = descriptionById.get(id) || "(설명 없음)";
        const details = detailByProject.get(id);
        const detailNote = details ? `\n   참고 본문 발췌: ${details.join(" / ")}` : "";
        return `${i + 1}. ${title}: ${description}${detailNote}`;
      })
      .join("\n");

    const synthesizeRes = await openai.chat.completions.create({
      model: CHAT_MODEL,
      temperature: 0.3,
      messages: [
        { role: "system", content: SYNTHESIZE_SYSTEM_PROMPT },
        {
          role: "user",
          content: `인사 담당자 질문: "${message}"\n\n정확히 아래 ${relevantIds.length}개 프로젝트만 근거로 답변하세요(전부 언급하고, 목록 외 프로젝트는 언급하지 마세요):\n${relevantList}`,
        },
      ],
    });

    const synthesizedAnswer = synthesizeRes.choices?.[0]?.message?.content?.trim();
    if (!synthesizedAnswer) {
      throw new Error("모델이 빈 답변을 반환했습니다.");
    }

    return { answer: stripProjectIds(synthesizedAnswer), sourceCardIds: relevantIds };
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
