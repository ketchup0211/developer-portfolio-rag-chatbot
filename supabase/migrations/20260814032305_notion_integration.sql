-- 프로젝트 카드 데이터 원본을 Supabase(project_cards)에서 Notion Database로 옮기면서 생기는 변경.
-- 이제 카드 원문은 Notion이 갖고 있고, 우리 DB는 "검색용 임베딩 조각"만 Notion 페이지 ID로 연결해 보관한다.
-- (project_cards를 지우면 그 표를 참조하던 FK 제약도 cascade로 함께 정리된다. 표 자체는 남는다.)

-- =========================================================
-- 1. project_cards 표 삭제 (카드 원문은 이제 Notion이 소스 오브 트루스)
-- =========================================================
drop table if exists public.project_cards cascade;

-- =========================================================
-- 2. portfolio_chunks — project_card_id(uuid, FK) 대신 notion_page_id(text)로 연결
-- =========================================================
alter table public.portfolio_chunks
  drop column if exists project_card_id;

alter table public.portfolio_chunks
  add column notion_page_id text not null;

create index portfolio_chunks_notion_page_id_idx on public.portfolio_chunks (notion_page_id);

-- 조각 조회/생성/삭제는 서버(비밀 키, service role)만 처리한다(RLS를 우회함).
-- 브라우저(authenticated)가 직접 조회할 이유가 없어져서, 클라이언트용 select 정책은 두지 않는다.
-- (RLS는 계속 켜져 있고 정책이 없으므로 authenticated 요청은 기본적으로 거부된다.)
drop policy if exists "owner reads own portfolio chunks" on public.portfolio_chunks;

-- =========================================================
-- 3. chat_message_sources — project_card_id(uuid, FK) 대신 notion_page_id(text)로 연결
-- =========================================================
alter table public.chat_message_sources
  drop column if exists project_card_id;

alter table public.chat_message_sources
  add column notion_page_id text not null;

-- =========================================================
-- 4. attachments Storage 정책 삭제 (첨부 파일은 이제 Notion 페이지 안에 직접 넣는다)
-- 버킷/오브젝트 자체는 SQL로 직접 지울 수 없어(Storage API 전용), 별도로 Storage API를 통해 정리한다.
-- =========================================================
drop policy if exists "owner manages own attachment files" on storage.objects;
