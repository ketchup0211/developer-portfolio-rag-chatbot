export default function CodeBlock({ block }) {
  const { rich_text, language, caption } = block.data;
  const code = (rich_text || []).map((t) => t.plain_text).join("");
  const captionText = (caption || []).map((t) => t.plain_text).join("");

  return (
    <figure className="notion-code">
      {language && <div className="notion-code-lang">{language}</div>}
      <pre>
        <code>{code}</code>
      </pre>
      {captionText && <figcaption>{captionText}</figcaption>}
    </figure>
  );
}
