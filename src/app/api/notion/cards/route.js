// 프로젝트 카드 목록 조회 (DESIGN.md 1.3, 2.1).
// NOTION_API_KEY가 필요해 반드시 서버(Next.js API Route)에서만 Notion API를 호출한다.
import { NextResponse } from "next/server";
import { getNotionClient, getDatabaseInfo } from "@/lib/notion/client";
import { extractCardSummary } from "@/lib/notion/properties";
import { cached } from "@/lib/notion/cache";

const LIST_CACHE_TTL_MS = 60_000; // 카드 목록은 1분 정도 재사용해도 충분하다.

export async function GET(request) {
  try {
    const force = request.nextUrl.searchParams.get("refresh") === "1";

    const data = await cached(
      "cards-list",
      LIST_CACHE_TTL_MS,
      async () => {
        const notion = getNotionClient();
        const { dataSourceId, url: databaseUrl } = await getDatabaseInfo();

        const res = await notion.dataSources.query({
          data_source_id: dataSourceId,
          page_size: 100,
          sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
        });

        const cards = res.results
          .filter((page) => "properties" in page)
          .map((page) => extractCardSummary(page));

        return { cards, databaseUrl };
      },
      { force }
    );

    return NextResponse.json(data);
  } catch (err) {
    console.error("Notion 카드 목록 조회 실패:", err);
    return NextResponse.json(
      { error: "노션에서 카드 목록을 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}
