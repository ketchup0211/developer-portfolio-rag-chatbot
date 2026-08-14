import RichText from "../RichText";
import { renderBlockList } from "../NotionBlock";

export default function Callout({ block }) {
  const { icon, rich_text } = block.data;
  return (
    <div className="notion-callout">
      {icon?.emoji && <span>{icon.emoji}</span>}
      <div>
        <RichText richText={rich_text} />
        {block.children?.length > 0 && (
          <div className="notion-nested">{renderBlockList(block.children)}</div>
        )}
      </div>
    </div>
  );
}
