import RichText from "../RichText";

export default function Paragraph({ block }) {
  return (
    <p>
      <RichText richText={block.data.rich_text} />
    </p>
  );
}
