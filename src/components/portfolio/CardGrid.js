"use client";

// 프로젝트 카드 목록을 노션 갤러리뷰처럼 그리드로 보여주는 공용 컴포넌트.
// 지원자 본인 화면(/portfolio)과 인사 담당자용 화면(/p/[token])이 함께 쓴다
// (DESIGN.md 1.3, 1.6) — 카드를 눌렀을 때 이동할 경로만 다르므로 hrefFor로 받는다.
import Link from "next/link";
import { propertyValueToPlainText } from "@/lib/notion/properties";

export default function CardGrid({ cards, hrefFor }) {
  return (
    <div className="card-grid">
      {cards.map((card) => (
        <Link key={card.id} href={hrefFor(card)} className="card-grid-item">
          {card.icon?.type === "emoji" && (
            <span className="card-icon">{card.icon.value}</span>
          )}
          <h3>{card.title}</h3>
          {card.properties
            .map((p) => ({ ...p, text: propertyValueToPlainText(p.type, p.value) }))
            .filter((p) => p.text)
            .slice(0, 2)
            .map((p) => (
              <p className="card-meta" key={p.name}>
                {p.text}
              </p>
            ))}
        </Link>
      ))}
    </div>
  );
}
