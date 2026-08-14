"use client";

// 이미지 로딩 실패(노션의 임시 서명 URL이 만료된 경우 등)가 페이지 전체에 영향을
// 주지 않도록, 실패 상태를 이 컴포넌트 안에서만 처리한다.
import { useState } from "react";

export default function ImageBlock({ block }) {
  const { data } = block;
  const src = data.type === "external" ? data.external?.url : data.file?.url;
  const caption = (data.caption || []).map((t) => t.plain_text).join("");
  const [failed, setFailed] = useState(false);

  if (!src) return null;
  if (failed) {
    return <p className="notion-unsupported">(이미지를 불러오지 못했습니다)</p>;
  }

  return (
    <figure>
      {/* eslint-disable-next-line @next/next/no-img-element -- 노션이 주는 임시 서명 URL이라 next/image 최적화 대상이 아님 */}
      <img src={src} alt={caption || "첨부 이미지"} onError={() => setFailed(true)} />
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}
