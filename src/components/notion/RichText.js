// 노션 Rich Text 배열 → React 요소. 모든 블록 컴포넌트가 공통으로 사용한다.
// bold/italic/strikethrough/underline/code/color(배경 포함)/link 주석을 지원한다.
import { NOTION_COLORS } from "@/lib/notion/colors";

export default function RichText({ richText }) {
  if (!richText || richText.length === 0) return null;

  return richText.map((t, i) => {
    let node = t.plain_text;
    const a = t.annotations || {};

    if (a.code) node = <code key="code">{node}</code>;
    if (a.bold) node = <strong key="b">{node}</strong>;
    if (a.italic) node = <em key="i">{node}</em>;
    if (a.strikethrough) node = <s key="s">{node}</s>;
    if (a.underline) node = <u key="u">{node}</u>;

    if (a.color && a.color !== "default") {
      const isBackground = a.color.endsWith("_background");
      const colorName = isBackground ? a.color.replace("_background", "") : a.color;
      const c = NOTION_COLORS[colorName] || NOTION_COLORS.default;
      const style = isBackground
        ? { background: c.bg, color: c.fg, borderRadius: "3px", padding: "0 0.2em" }
        : { color: c.fg };
      node = (
        <span key="color" style={style}>
          {node}
        </span>
      );
    }

    // 텍스트 링크(href)와 멘션/수식 등도 plain_text + href 조합으로 안전하게 처리된다.
    const href = t.href;
    if (href) {
      node = (
        <a key="a" href={href} target="_blank" rel="noreferrer">
          {node}
        </a>
      );
    }

    return <span key={i}>{node}</span>;
  });
}
