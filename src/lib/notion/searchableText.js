// 프로젝트 카드 하나의 "검색 가능한 전체 텍스트"를 모으는 곳.
// 제목 + 본문 블록 텍스트 + 첨부 PDF(본문 안 pdf/file 블록, 속성의 파일) 글자를 합친다.
import { blocksToPlainText } from "./blocks";
import { extractPdfText } from "./pdf";

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
