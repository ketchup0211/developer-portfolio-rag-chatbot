"use client";

// 카드 상세 화면에서 쓰는 최상위 진입점.
// 사용법: <NotionRenderer blocks={blocks} />  (blocks는 /api/notion/cards/:id가 내려준 트리)
import { renderBlockList } from "./NotionBlock";

export default function NotionRenderer({ blocks }) {
  if (!blocks || blocks.length === 0) {
    return <p style={{ color: "#777" }}>본문 내용이 없습니다.</p>;
  }
  return <div className="notion-blocks">{renderBlockList(blocks)}</div>;
}
