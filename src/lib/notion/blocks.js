// Notion 페이지 본문(블록)을 재귀적으로 가져와 화면에 그리기 좋은 형태로 정리하는 유틸.
import { getNotionClient } from "./client";

const MAX_DEPTH = 4; // 토글/리스트가 무한히 중첩된 경우를 대비한 안전장치

export async function fetchBlocksRecursive(blockId, depth = 0) {
  if (depth > MAX_DEPTH) return [];

  const notion = getNotionClient();
  const nodes = [];
  let cursor;

  do {
    const res = await notion.blocks.children.list({
      block_id: blockId,
      start_cursor: cursor,
      page_size: 100,
    });

    for (const block of res.results) {
      const node = {
        id: block.id,
        type: block.type,
        data: block[block.type] ?? null,
        children: [],
      };
      if (block.has_children) {
        node.children = await fetchBlocksRecursive(block.id, depth + 1);
      }
      nodes.push(node);
    }

    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);

  return nodes;
}

// 개발 단위 5(RAG 임베딩 파이프라인)에서 그대로 재사용할 수 있도록,
// 블록 트리에서 순수 텍스트만 뽑아내는 함수도 미리 만들어둔다.
export function blocksToPlainText(nodes) {
  const lines = [];

  function walk(list) {
    for (const node of list) {
      const text = richTextOf(node.data);
      if (text) lines.push(text);
      if (node.children?.length) walk(node.children);
    }
  }

  walk(nodes);
  return lines.join("\n");
}

function richTextOf(data) {
  if (!data || !Array.isArray(data.rich_text)) return "";
  return data.rich_text.map((t) => t.plain_text).join("");
}
