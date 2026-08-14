// Notion 페이지의 속성(Properties)을 화면에 보여주기 좋은 값으로 변환하는 유틸.
// 지원자가 Notion Database에 어떤 속성을 넣어뒀는지 우리가 미리 정해두지 않고,
// 실제로 들어있는 속성을 그대로 순회해서 보여주는 방식이라 속성을 추가/삭제해도 코드 수정이 필요 없다.

function plainTextFromRichText(richText) {
  return (richText || []).map((t) => t.plain_text).join("");
}

// 속성 하나의 값을 사람이 읽기 좋은 형태로 뽑아낸다. (타입별로 저장 형태가 다름)
export function extractPropertyValue(prop) {
  switch (prop.type) {
    case "title":
      return plainTextFromRichText(prop.title);
    case "rich_text":
      return plainTextFromRichText(prop.rich_text);
    case "select":
      return prop.select ? { name: prop.select.name, color: prop.select.color } : null;
    case "multi_select":
      return (prop.multi_select || []).map((o) => ({ name: o.name, color: o.color }));
    case "status":
      return prop.status ? { name: prop.status.name, color: prop.status.color } : null;
    case "date": {
      const { start, end } = prop.date || {};
      if (!start) return null;
      return end ? `${start} ~ ${end}` : start;
    }
    case "checkbox":
      return prop.checkbox;
    case "number":
      return prop.number;
    case "url":
      return prop.url;
    case "email":
      return prop.email;
    case "phone_number":
      return prop.phone_number;
    case "files":
      return (prop.files || []).map((f) => ({
        name: f.name,
        url: f.type === "external" ? f.external?.url : f.file?.url,
      }));
    case "people":
      return (prop.people || []).map((p) => p.name).filter(Boolean);
    default:
      return null;
  }
}

// 목록 화면 등 짧은 요약이 필요한 곳에서, 속성 값을 한 줄 텍스트로 바꾼다.
// (select/multi_select는 상세 화면에서만 색상 있는 배지로 보여주고, 목록에서는 이름만 뽑는다)
export function propertyValueToPlainText(type, value) {
  if (value === null || value === undefined || value === "") return null;
  if (type === "select" || type === "status") return value.name;
  if (type === "multi_select" || type === "people") {
    if (!Array.isArray(value) || value.length === 0) return null;
    return value.map((v) => (typeof v === "string" ? v : v.name)).join(", ");
  }
  if (type === "files") return null;
  if (type === "checkbox") return value ? "예" : "아니오";
  return String(value);
}

function extractPageIcon(icon) {
  if (!icon) return null;
  if (icon.type === "emoji") return { type: "emoji", value: icon.emoji };
  if (icon.type === "external") return { type: "image", value: icon.external?.url };
  if (icon.type === "file") return { type: "image", value: icon.file?.url };
  return null;
}

function extractPageCover(cover) {
  if (!cover) return null;
  if (cover.type === "external") return cover.external?.url ?? null;
  if (cover.type === "file") return cover.file?.url ?? null;
  return null;
}

// 노션 페이지 하나를 "카드"로 요약: 제목은 따로 꺼내고, 나머지 속성은 목록으로 정리한다.
export function extractCardSummary(page) {
  let title = "";
  const properties = [];

  for (const [name, prop] of Object.entries(page.properties || {})) {
    const value = extractPropertyValue(prop);
    if (prop.type === "title") {
      title = value || "(제목 없음)";
      continue;
    }
    properties.push({ name, type: prop.type, value });
  }

  return {
    id: page.id,
    url: page.url,
    lastEditedTime: page.last_edited_time,
    title,
    icon: extractPageIcon(page.icon),
    cover: extractPageCover(page.cover),
    properties,
  };
}
