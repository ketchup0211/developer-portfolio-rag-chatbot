-- match_portfolio_chunks가 검색하는 대상을 chunk_type='body'로 제한한다.
-- 카드 요약(chunk_type='summary')은 항상 전부 별도로 가져오므로(20260814074931 참고),
-- 유사도 검색까지 요약 조각을 함께 뒤지면 같은 내용이 두 번 겹쳐 나올 수 있다.
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
  where portfolio_chunks.chunk_type = 'body'
    and 1 - (portfolio_chunks.embedding <=> query_embedding) > match_threshold
  order by portfolio_chunks.embedding <=> query_embedding
  limit match_count;
$$;
