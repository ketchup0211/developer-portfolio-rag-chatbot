// 노션 카드 본문(+첨부 PDF)을 임베딩해 Supabase(pgvector)에 저장하는 동기화 파이프라인
// (DESIGN.md 2.1, PLAN.md 개발 단위 5번). "노션에서 다시 불러오기" 버튼을 누르면 실행된다.
// 비밀 키(OPENAI_API_KEY, SUPABASE_SERVICE_ROLE_KEY, NOTION_API_KEY)를 여러 개 쓰므로
// 반드시 서버(API Route)에서만 동작한다.
import { NextResponse } from "next/server";
import { getNotionClient, getDatabaseInfo } from "@/lib/notion/client";
import { extractCardSummary } from "@/lib/notion/properties";
import { fetchBlocksRecursive } from "@/lib/notion/blocks";
import { buildSearchableText } from "@/lib/notion/searchableText";
import { chunkText } from "@/lib/notion/chunk";
import { getOpenAIClient } from "@/lib/openai/client";
import { getSupabaseServiceClient } from "@/lib/supabase/serviceClient";
import { getOwnerFromRequest } from "@/lib/auth/verifyOwnerRequest";

const EMBEDDING_MODEL = "text-embedding-3-small";

export async function POST(request) {
  // 포트폴리오 열람 자체는 로그인 없이 가능하지만, 임베딩 재생성은 비용이 드는
  // owner 전용 작업이라 서버에서도 로그인 여부를 직접 확인한다(화면의 버튼 숨김만으로는
  // API 주소를 직접 호출하는 것을 막을 수 없다).
  const owner = await getOwnerFromRequest(request);
  if (!owner) {
    return NextResponse.json({ error: "로그인이 필요한 기능입니다." }, { status: 401 });
  }

  try {
    const notion = getNotionClient();
    const supabase = getSupabaseServiceClient();
    const openai = getOpenAIClient();
    const { dataSourceId } = await getDatabaseInfo();

    const listRes = await notion.dataSources.query({
      data_source_id: dataSourceId,
      page_size: 100,
    });
    const cards = listRes.results
      .filter((page) => "properties" in page)
      .map((page) => extractCardSummary(page));

    const results = [];

    for (const card of cards) {
      try {
        const blocks = await fetchBlocksRecursive(card.id);
        const text = await buildSearchableText(card, blocks);
        const chunks = chunkText(text);

        // 이 카드의 기존 조각을 지우고 새로 만든다(다시 불러올 때마다 완전히 갱신).
        const { error: deleteError } = await supabase
          .from("portfolio_chunks")
          .delete()
          .eq("notion_page_id", card.id);
        if (deleteError) throw deleteError;

        if (chunks.length > 0) {
          const embeddingRes = await openai.embeddings.create({
            model: EMBEDDING_MODEL,
            input: chunks,
          });
          const sorted = [...embeddingRes.data].sort((a, b) => a.index - b.index);

          const rows = chunks.map((content, i) => ({
            notion_page_id: card.id,
            content,
            embedding: sorted[i].embedding,
          }));

          const { error: insertError } = await supabase.from("portfolio_chunks").insert(rows);
          if (insertError) throw insertError;
        }

        results.push({ id: card.id, title: card.title, chunks: chunks.length, ok: true });
      } catch (err) {
        console.error("카드 동기화 실패:", card.id, err);
        results.push({ id: card.id, title: card.title, ok: false, error: err.message });
      }
    }

    // 노션에서 지워진 카드의 임베딩도 함께 정리한다.
    const currentIds = new Set(cards.map((c) => c.id));
    const { data: existingRows, error: existingError } = await supabase
      .from("portfolio_chunks")
      .select("notion_page_id");
    if (existingError) throw existingError;

    const staleIds = [...new Set((existingRows || []).map((r) => r.notion_page_id))].filter(
      (id) => !currentIds.has(id)
    );

    if (staleIds.length > 0) {
      const { error: cleanupError } = await supabase
        .from("portfolio_chunks")
        .delete()
        .in("notion_page_id", staleIds);
      if (cleanupError) throw cleanupError;
    }

    return NextResponse.json({
      syncedCards: results.length,
      totalChunks: results.reduce((sum, r) => sum + (r.chunks || 0), 0),
      failed: results.filter((r) => !r.ok),
      removedCards: staleIds.length,
    });
  } catch (err) {
    console.error("노션 동기화 실패:", err);
    return NextResponse.json(
      { error: "노션 동기화에 실패했습니다: " + err.message },
      { status: 500 }
    );
  }
}
