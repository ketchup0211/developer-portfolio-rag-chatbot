import RichText from "../RichText";
import { renderBlockList } from "../NotionBlock";

export default function Quote({ block }) {
  return (
    <blockquote>
      <RichText richText={block.data.rich_text} />
      {block.children?.length > 0 && renderBlockList(block.children)}
    </blockquote>
  );
}
