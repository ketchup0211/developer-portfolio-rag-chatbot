import RichText from "../RichText";
import { renderBlockList } from "../NotionBlock";

export default function Toggle({ block }) {
  return (
    <details>
      <summary>
        <RichText richText={block.data.rich_text} />
      </summary>
      {block.children?.length > 0 && (
        <div className="notion-nested">{renderBlockList(block.children)}</div>
      )}
    </details>
  );
}
