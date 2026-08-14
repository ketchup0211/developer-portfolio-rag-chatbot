// Notion 첨부 PDF의 임시 서명 URL에서 파일을 내려받아 글자를 추출한다.
// (pdf-parse v2 기준: PDFParse 인스턴스를 만들고 getText() 후 반드시 destroy()로 정리한다)
// 실패해도(만료된 URL, 손상된 파일 등) 전체 동기화가 멈추지 않도록 호출부에서 감싸 쓴다.
import { PDFParse } from "pdf-parse";
import { getPath } from "pdf-parse/worker";

// Next.js 서버(Node.js) 환경에서는 pdfjs-dist가 브라우저용 워커 경로를 자동으로
// 찾지 못해 "fake worker" 설정에 실패하는 문제가 있어, 패키지가 제공하는 워커 경로를
// 앱 시작 시 한 번 명시적으로 지정해준다.
PDFParse.setWorker(getPath());

export async function extractPdfText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`PDF 다운로드 실패 (${res.status})`);
  const buffer = Buffer.from(await res.arrayBuffer());

  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}
