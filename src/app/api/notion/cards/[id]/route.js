// 프로젝트 카드 상세(속성 + 본문 블록) 조회 (DESIGN.md 1.3, 2.1).
import { NextResponse } from "next/server";
import { getNotionClient } from "@/lib/notion/client";
import { extractCardSummary } from "@/lib/notion/properties";
import { fetchBlocksRecursive } from "@/lib/notion/blocks";
import { cached } from "@/lib/notion/cache";

const DETAIL_CACHE_TTL_MS = 60_000; // 카드 상세(본문 포함)도 1분 정도 재사용한다.

export async function GET(request, { params }) {
  const { id } = await params;

  try {
    const force = request.nextUrl.searchParams.get("refresh") === "1";

    const data = await cached(
      `card-${id}`,
      DETAIL_CACHE_TTL_MS,
      async () => {
        const notion = getNotionClient();
        const page = await notion.pages.retrieve({ page_id: id });
        const card = extractCardSummary(page);
        const blocks = await fetchBlocksRecursive(id);
        return { card, blocks };
      },
      { force }
    );

    return NextResponse.json(data);
  } catch (err) {
    console.error("Notion 카드 상세 조회 실패:", err);
    return NextResponse.json(
      { error: "노션에서 카드를 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}
