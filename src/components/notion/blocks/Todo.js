import RichText from "../RichText";

export default function Todo({ block }) {
  return (
    <label className="notion-todo">
      <input type="checkbox" checked={Boolean(block.data.checked)} readOnly />
      <RichText richText={block.data.rich_text} />
    </label>
  );
}
