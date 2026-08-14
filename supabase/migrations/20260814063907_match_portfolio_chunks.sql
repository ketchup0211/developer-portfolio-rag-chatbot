-- RAG 챗봇 응답 로직(DESIGN.md 2.2, PLAN.md 개발 단위 9번)이 쓰는 벡터 유사도 검색 함수.
-- Supabase JS 클라이언트는 pgvector의 <=> 연산자를 바로 쓸 수 없어 RPC 함수로 감싼다.
-- match_threshold(코사인 유사도) 이상인 조각만, 유사도 높은 순으로 최대 match_count개 돌려준다.
-- 이 함수는 서버(service role)만 호출하므로 portfolio_chunks의 RLS 정책과는 무관하게 동작한다.
create or replace function public.match_portfolio_chunks(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  notion_page_id text,
  content text,
  similarity float
)
language sql
stable
as $$
  select
    portfolio_chunks.id,
    portfolio_chunks.notion_page_id,
    portfolio_chunks.content,
    1 - (portfolio_chunks.embedding <=> query_embedding) as similarity
  from public.portfolio_chunks
  where 1 - (portfolio_chunks.embedding <=> query_embedding) > match_threshold
  order by portfolio_chunks.embedding <=> query_embedding
  limit match_count;
$$;
