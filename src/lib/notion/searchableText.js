// 프로젝트 카드 하나의 "검색 가능한 전체 텍스트"를 모으는 곳.
// 제목 + 본문 블록 텍스트 + 첨부 PDF(본문 안 pdf/file 블록, 속성의 파일) 글자를 합친다.
import { blocksToPlainText } from "./blocks";
import { extractPdfText } from "./pdf";
import { propertyValueToPlainText } from "./properties";

// 카드의 제목+속성(기간, 역할, 기술 스택 등)만 정리한 짧은 요약 글.
// "이 프로젝트 팀 인원은?"처럼 답이 본문 문장이 아니라 속성값에만 있는 질문이나,
// "React 프로젝트 있어?"처럼 여러 카드를 한 번에 훑어야 하는 질문에 챗봇이 답할 수
// 있도록, 카드마다 이 요약을 별도 조각(chunk_type='summary')으로 저장해둔다
// (PLAN.md 개발 단위 9번 개선 — 카드 상세 화면에 보이는 속성과 같은 내용/순서를 쓰도록
// CardGrid 등 화면에서 쓰는 propertyValueToPlainText를 그대로 재사용한다).
export function buildCardSummaryText(card) {
  const lines = [`제목: ${card.title}`];
  for (const prop of card.properties) {
    const text = propertyValueToPlainText(prop.type, prop.value);
    if (text) lines.push(`${prop.name}: ${text}`);
  }
  return lines.join("\n");
}

function collectPdfBlockUrls(blocks, urls = []) {
  for (const block of blocks) {
    const src = block.data?.type === "external" ? block.data.external?.url : block.data?.file?.url;
    if (src) {
      if (block.type === "pdf") urls.push(src);
      else if (block.type === "file" && /\.pdf($|\?)/i.test(src)) urls.push(src);
    }
    if (block.children?.length) collectPdfBlockUrls(block.children, urls);
  }
  return urls;
}

// "발표 자료"처럼 속성(files)으로 올려둔 첨부 중 PDF만 골라낸다.
function collectPropertyPdfUrls(properties) {
  const urls = [];
  for (const prop of properties) {
    if (prop.type !== "files" || !Array.isArray(prop.value)) continue;
    for (const file of prop.value) {
      if (file.url && /\.pdf($|\?)/i.test(file.name || file.url)) urls.push(file.url);
    }
  }
  return urls;
}

export async function buildSearchableText(card, blocks) {
  const parts = [card.title, blocksToPlainText(blocks)];

  const pdfUrls = [
    ...new Set([...collectPdfBlockUrls(blocks), ...collectPropertyPdfUrls(card.properties)]),
  ];

  for (const url of pdfUrls) {
    try {
      const text = await extractPdfText(url);
      if (text?.trim()) parts.push(text);
    } catch (err) {
      // 만료된 서명 URL, 손상된 파일 등으로 하나가 실패해도 나머지 동기화는 계속 진행한다.
      console.error("PDF 텍스트 추출 실패:", url, err.message);
    }
  }

  return parts.filter(Boolean).join("\n");
}
