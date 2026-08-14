// 노션 블록 하나를 타입에 맞는 하위 컴포넌트로 위임하는 디스패처.
// "블록 타입 → 컴포넌트" 매핑은 이 파일에만 있고, 실제 렌더링 로직은 각 blocks/* 컴포넌트가 담당한다.
import Paragraph from "./blocks/Paragraph";
import Heading from "./blocks/Heading";
import ListItem from "./blocks/ListItem";
import Todo from "./blocks/Todo";
import Quote from "./blocks/Quote";
import Callout from "./blocks/Callout";
import CodeBlock from "./blocks/CodeBlock";
import ImageBlock from "./blocks/ImageBlock";
import Table from "./blocks/Table";
import Toggle from "./blocks/Toggle";
import Divider from "./blocks/Divider";
import Pdf from "./blocks/Pdf";
import FileBlock from "./blocks/FileBlock";
import Bookmark from "./blocks/Bookmark";
import Columns from "./blocks/Columns";
import ChildDatabase from "./blocks/ChildDatabase";
import Unsupported from "./blocks/Unsupported";

const HEADING_TYPES = new Set([
  "heading_1",
  "heading_2",
  "heading_3",
  "heading_4",
  "heading_5",
  "heading_6",
]);

const LIST_ITEM_TYPES = new Set(["bulleted_list_item", "numbered_list_item"]);

// 형제 블록 배열을 받아, 연속된 리스트 항목은 <ul>/<ol>로 묶고 나머지는
// NotionBlock 하나씩으로 렌더링한다. Toggle/Columns/Heading(토글) 등 자식을 가진
// 컴포넌트에서도 이 함수를 그대로 재사용해 재귀적으로 트리를 그린다.
export function renderBlockList(blocks) {
  if (!blocks || blocks.length === 0) return null;

  const output = [];
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];

    if (LIST_ITEM_TYPES.has(block.type)) {
      const listType = block.type;
      const items = [];
      while (i < blocks.length && blocks[i].type === listType) {
        items.push(<NotionBlock key={blocks[i].id} block={blocks[i]} />);
        i += 1;
      }
      const ListTag = listType === "bulleted_list_item" ? "ul" : "ol";
      output.push(<ListTag key={`list-${block.id}`}>{items}</ListTag>);
      continue;
    }

    output.push(<NotionBlock key={block.id} block={block} />);
    i += 1;
  }

  return output;
}

export default function NotionBlock({ block }) {
  try {
    return renderByType(block);
  } catch (err) {
    // 블록 하나가 깨져도(잘못된 rich text, 예상 밖 구조 등) 페이지 전체는 계속 보여준다.
    console.error("노션 블록 렌더링 실패:", block?.type, err);
    return null;
  }
}

function renderByType(block) {
  const { type } = block;

  if (HEADING_TYPES.has(type)) return <Heading block={block} />;
  if (LIST_ITEM_TYPES.has(type)) return <ListItem block={block} />;

  switch (type) {
    case "paragraph":
      return <Paragraph block={block} />;
    case "to_do":
      return <Todo block={block} />;
    case "quote":
      return <Quote block={block} />;
    case "callout":
      return <Callout block={block} />;
    case "code":
      return <CodeBlock block={block} />;
    case "image":
      return <ImageBlock block={block} />;
    case "table":
      return <Table block={block} />;
    case "table_row":
      // table 블록이 자신의 children(=table_row들)을 직접 순회해서 그리므로,
      // 형제 목록에서 단독으로 마주칠 일은 없지만 방어적으로 아무것도 그리지 않는다.
      return null;
    case "toggle":
      return <Toggle block={block} />;
    case "divider":
      return <Divider />;
    case "pdf":
      return <Pdf block={block} />;
    case "file":
    case "video":
    case "audio":
      return <FileBlock block={block} />;
    case "bookmark":
    case "embed":
    case "link_preview":
      return <Bookmark block={block} />;
    case "column_list":
      return <Columns block={block} />;
    case "column":
      // column_list 밖에서 단독으로 나타나는 경우를 대비한 안전장치.
      return <>{renderBlockList(block.children)}</>;
    case "table_of_contents":
      // 목차가 가리킬 헤딩에 앵커(id)를 아직 붙이지 않아, 클릭 이동이 불가능하므로 생략한다.
      return null;
    case "child_database":
      return <ChildDatabase block={block} />;
    default:
      return <Unsupported type={type} />;
  }
}
