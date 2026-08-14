-- RAG 챗봇이 "이런 기술 스택 써봤어?", "이런 역량 있어?"처럼 카드 하나가 아니라
-- 포트폴리오 전체를 훑어야 답할 수 있는 질문에도 답할 수 있도록, 카드마다 본문 조각과는
-- 별개로 "요약 조각"(제목+속성 전체를 정리한 글)을 하나씩 추가로 저장한다.
-- 요약 조각은 질문마다 유사도 점수와 무관하게 항상 챗봇 컨텍스트에 포함시킬 것이므로,
-- 본문 조각과 구분할 수 있는 chunk_type 컬럼이 필요하다.
alter table public.portfolio_chunks
  add column chunk_type text not null default 'body' check (chunk_type in ('body', 'summary'));

create index portfolio_chunks_chunk_type_idx on public.portfolio_chunks (chunk_type);
