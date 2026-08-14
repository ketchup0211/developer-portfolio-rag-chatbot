// file / video / audio 블록 공용. 미리보기 없이 새 창에서 여는 작은 칩 형태로 보여준다.
const ICON_BY_TYPE = { video: "🎬", audio: "🎵", file: "📎" };

export default function FileBlock({ block }) {
  const { type, data } = block;
  const src = data.type === "external" ? data.external?.url : data.file?.url;
  const caption = (data.caption || []).map((t) => t.plain_text).join("") || "첨부 파일";
  if (!src) return null;

  return (
    <p className="notion-file-chip">
      <a href={src} target="_blank" rel="noreferrer">
        {ICON_BY_TYPE[type] || "📎"} {caption}
      </a>
    </p>
  );
}
