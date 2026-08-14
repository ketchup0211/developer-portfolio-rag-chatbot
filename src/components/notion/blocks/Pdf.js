// pdf 블록은 file/video/audio와 달리 브라우저 내장 PDF 뷰어로 페이지 안에서
// 바로 미리보기가 가능해, 별도 컴포넌트로 분리해 iframe 미리보기를 보여준다.
export default function Pdf({ block }) {
  const { data } = block;
  const src = data.type === "external" ? data.external?.url : data.file?.url;
  const caption = (data.caption || []).map((t) => t.plain_text).join("");
  if (!src) return null;

  return (
    <figure className="notion-pdf">
      <iframe src={src} title={caption || "PDF 미리보기"} />
      <figcaption>
        <a href={src} target="_blank" rel="noreferrer">
          📎 {caption || "PDF 새 창에서 열기"}
        </a>
      </figcaption>
    </figure>
  );
}
