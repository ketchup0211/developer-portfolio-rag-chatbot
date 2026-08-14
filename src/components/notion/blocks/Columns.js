import { renderBlockList } from "../NotionBlock";

// column_list의 자식은 column 블록들이고, 실제 내용은 그 column의 children 안에 있다.
export default function Columns({ block }) {
  return (
    <div className="notion-columns">
      {(block.children || []).map((col) => (
        <div key={col.id} className="notion-column">
          {renderBlockList(col.children)}
        </div>
      ))}
    </div>
  );
}
