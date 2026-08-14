// bookmark / embed / link_preview 공용 — 모두 "URL 하나를 링크로 보여준다"는 점에서 동일하다.
export default function Bookmark({ block }) {
  const url = block.data?.url;
  if (!url) return null;

  return (
    <p>
      <a href={url} target="_blank" rel="noreferrer">
        {url}
      </a>
    </p>
  );
}
