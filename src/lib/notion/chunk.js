// 긴 텍스트를 임베딩하기 좋은 크기의 조각(청크)으로 나눈다.
// 문단(줄바꿈) 경계를 최대한 지키면서 한 조각이 너무 커지지 않게 모으고,
// 문단 하나 자체가 지나치게 길면(예: PDF에서 뽑은 긴 글) 강제로도 잘라준다.
const CHUNK_SIZE = 800; // 조각 하나의 목표 길이(자 수)
const HARD_MAX = 4000; // 임베딩 모델 입력 한도에 안전하게 걸리지 않도록 강제 분할하는 최대 길이

function splitLong(text) {
  const parts = [];
  for (let i = 0; i < text.length; i += HARD_MAX) {
    parts.push(text.slice(i, i + HARD_MAX));
  }
  return parts;
}

export function chunkText(text) {
  if (!text || !text.trim()) return [];

  const paragraphs = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const chunks = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const pieces = paragraph.length > HARD_MAX ? splitLong(paragraph) : [paragraph];

    for (const piece of pieces) {
      const candidate = current ? `${current}\n${piece}` : piece;
      if (candidate.length > CHUNK_SIZE && current) {
        chunks.push(current);
        current = piece;
      } else {
        current = candidate;
      }
    }
  }
  if (current) chunks.push(current);

  return chunks;
}
