"use client";

// 프로젝트 카드 상세(속성 + 본문)를 실제 노션 페이지 화면과 비슷하게 보여주는 공용 컴포넌트.
// 지원자 본인 화면(/portfolio/[id])과 인사 담당자용 화면(/p/[token]/cards/[cardId])이
// 함께 쓴다 (DESIGN.md 1.3, 1.6) — 상단에 "노션에서 편집" 같은 owner 전용 버튼을 넣을지는
// topbar prop으로 호출부가 결정한다(owner 화면만 넘겨줌).
import NotionRenderer from "@/components/notion/NotionRenderer";
import { NOTION_COLORS } from "@/lib/notion/colors";

const PROPERTY_ICON = {
  date: "📅",
  url: "🔗",
  email: "✉️",
  phone_number: "📞",
  select: "◉",
  status: "◉",
  multi_select: "≣",
  people: "👤",
  files: "📎",
  checkbox: "☑",
  number: "#",
  rich_text: "≡",
};

export default function CardDetailView({ card, blocks, topbar }) {
  return (
    <article className="notion-page">
      {card.cover && (
        // eslint-disable-next-line @next/next/no-img-element -- 노션이 주는 임시 서명 URL
        <img src={card.cover} alt="" className="notion-page-cover" />
      )}

      <div className="notion-page-body">
        {topbar}

        {card.icon && (
          <div className="notion-page-icon">
            {card.icon.type === "emoji" ? (
              card.icon.value
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- 노션이 주는 임시 서명 URL
              <img src={card.icon.value} alt="" />
            )}
          </div>
        )}

        <h1 className="notion-page-title">{card.title}</h1>

        {card.properties.length > 0 && (
          <dl className="notion-property-list">
            {card.properties.map((p) => (
              <div key={p.name} className="notion-property-row">
                <dt>
                  <span className="notion-property-icon">
                    {PROPERTY_ICON[p.type] || "≡"}
                  </span>
                  <span className="notion-property-label">{p.name}</span>
                </dt>
                <dd>{renderPropertyValue(p)}</dd>
              </div>
            ))}
          </dl>
        )}

        <hr className="notion-page-divider" />

        <NotionRenderer blocks={blocks} />
      </div>
    </article>
  );
}

function Tag({ name, color }) {
  const c = NOTION_COLORS[color] || NOTION_COLORS.default;
  return (
    <span className="notion-tag" style={{ background: c.bg, color: c.fg }}>
      {name}
    </span>
  );
}

function renderPropertyValue(prop) {
  const { type, value } = prop;

  if (value === null || value === undefined || value === "") {
    return <span className="notion-property-empty">비어 있음</span>;
  }

  if (type === "url" || type === "email" || type === "phone_number") {
    return (
      <a href={type === "url" ? value : undefined} target="_blank" rel="noreferrer">
        {value}
      </a>
    );
  }

  if (type === "checkbox") {
    return value ? "예" : "아니오";
  }

  if (type === "select" || type === "status") {
    return <Tag name={value.name} color={value.color} />;
  }

  if (type === "multi_select" || type === "people") {
    if (!Array.isArray(value) || value.length === 0) {
      return <span className="notion-property-empty">비어 있음</span>;
    }
    if (type === "people") return value.join(", ");
    return (
      <span style={{ display: "inline-flex", gap: "0.3rem", flexWrap: "wrap" }}>
        {value.map((v) => (
          <Tag key={v.name} name={v.name} color={v.color} />
        ))}
      </span>
    );
  }

  if (type === "files") {
    if (!Array.isArray(value) || value.length === 0) {
      return <span className="notion-property-empty">비어 있음</span>;
    }
    return value.map((f, i) => (
      <span key={f.url || i}>
        {i > 0 && ", "}
        <a href={f.url} target="_blank" rel="noreferrer">
          📎 {f.name || "파일"}
        </a>
      </span>
    ));
  }

  return String(value);
}
