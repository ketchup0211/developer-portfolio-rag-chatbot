// Notion API 서버 전용 클라이언트. NOTION_API_KEY는 진짜 비밀 키이므로,
// 이 파일은 반드시 서버 쪽 코드(API Route)에서만 import한다. 브라우저 코드에서 import하면 안 된다.
import { Client } from "@notionhq/client";

let notionClient;
let databaseInfoPromise;

export function getNotionClient() {
  if (!notionClient) {
    if (!process.env.NOTION_API_KEY) {
      throw new Error("NOTION_API_KEY가 설정되지 않았습니다.");
    }
    notionClient = new Client({ auth: process.env.NOTION_API_KEY });
  }
  return notionClient;
}

// Notion API 2025-09 버전부터는 Database를 바로 쿼리하지 못하고,
// Database 안의 "Data source" ID로 쿼리해야 한다. Database 하나에 보통 data source가 1개뿐이라
// 첫 번째 것을 그대로 쓴다. 같이 내려오는 database url(카드 추가 버튼용)도 함께 캐시해둔다.
export async function getDatabaseInfo() {
  if (!databaseInfoPromise) {
    databaseInfoPromise = (async () => {
      if (!process.env.NOTION_DATABASE_ID) {
        throw new Error("NOTION_DATABASE_ID가 설정되지 않았습니다.");
      }
      const notion = getNotionClient();
      const db = await notion.databases.retrieve({
        database_id: process.env.NOTION_DATABASE_ID,
      });
      const dataSourceId = db.data_sources?.[0]?.id;
      if (!dataSourceId) {
        throw new Error("Notion Database에서 data source를 찾지 못했습니다.");
      }
      return { dataSourceId, url: db.url };
    })();
  }
  return databaseInfoPromise;
}

export async function getDataSourceId() {
  const { dataSourceId } = await getDatabaseInfo();
  return dataSourceId;
}
