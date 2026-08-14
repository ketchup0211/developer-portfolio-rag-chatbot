import RichText from "../RichText";
import { renderBlockList } from "../NotionBlock";

// 페이지 제목(카드 title)이 이미 <h1> 역할이라, 노션의 heading_1~3(+API가 내려주는
// heading_4~6)을 한 단계씩 내려 h2~h6에 매핑한다.
const TAG_BY_TYPE = {
  heading_1: "h2",
  heading_2: "h3",
  heading_3: "h4",
  heading_4: "h5",
  heading_5: "h6",
  heading_6: "h6",
};

export default function Heading({ block }) {
  const Tag = TAG_BY_TYPE[block.type] || "h4";
  const { rich_text, is_toggleable } = block.data;

  if (is_toggleable) {
    // 노션의 "토글 헤딩" — 제목을 접었다 펼 수 있다.
    return (
      <details>
        <summary>
          <Tag style={{ display: "inline" }}>
            <RichText richText={rich_text} />
          </Tag>
        </summary>
        {block.children?.length > 0 && (
          <div className="notion-nested">{renderBlockList(block.children)}</div>
        )}
      </details>
    );
  }

  return (
    <Tag>
      <RichText richText={rich_text} />
    </Tag>
  );
}
