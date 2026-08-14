import RichText from "../RichText";
import { renderBlockList } from "../NotionBlock";

// bulleted_list_item / numbered_list_item 항목 1개. 연속된 형제 항목을 <ul>/<ol>로
// 묶는 일은 NotionBlock.renderBlockList가 하고, 이 컴포넌트는 <li> 내용만 담당한다.
export default function ListItem({ block }) {
  return (
    <li>
      <RichText richText={block.data.rich_text} />
      {block.children?.length > 0 && (
        <div className="notion-nested">{renderBlockList(block.children)}</div>
      )}
    </li>
  );
}
