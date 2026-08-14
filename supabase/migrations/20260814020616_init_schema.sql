-- DESIGN.md 4번(데이터베이스 표 설계), 3.4번(RLS 정책 설계)을 그대로 구현한 초기 스키마입니다.
-- owner(지원자) 계정의 이름/연락처는 별도 표 없이 Supabase Auth의 user_metadata에 저장하므로
-- (이미 /profile 화면에서 그렇게 구현됨), 여기서는 별도 users 표를 만들지 않습니다.

-- 필요한 확장 기능 켜기
create extension if not exists pgcrypto;   -- gen_random_uuid() 사용
create extension if not exists vector;     -- 임베딩(포트폴리오 검색용) 저장

-- =========================================================
-- 1. project_cards — 포트폴리오 안의 프로젝트 카드
-- =========================================================
create table public.project_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  period text,
  service_url text,
  github_url text,
  role text,
  tech_stack text,
  project_type text check (project_type in ('individual', 'team')),
  team_size int,
  attachment_url text,
  description_markdown text,
  troubleshooting text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index project_cards_user_id_idx on public.project_cards (user_id);

alter table public.project_cards enable row level security;

-- owner 본인만 자신의 프로젝트 카드를 조회/등록/수정/삭제할 수 있다.
-- 방문자(인사 담당자)가 필요한 조회는 Next.js 서버가 초대 링크 토큰을 검증한 뒤
-- 대신 조회해서 내려주므로, 방문자용 정책은 별도로 두지 않는다.
create policy "owner manages own project cards"
  on public.project_cards
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =========================================================
-- 2. portfolio_chunks — 카드 내용을 잘라 임베딩으로 저장 (검색용)
-- =========================================================
create table public.portfolio_chunks (
  id uuid primary key default gen_random_uuid(),
  project_card_id uuid not null references public.project_cards (id) on delete cascade,
  content text not null,
  embedding vector(1536), -- OpenAI text-embedding-3-small 차원 수
  created_at timestamptz not null default now()
);

create index portfolio_chunks_project_card_id_idx on public.portfolio_chunks (project_card_id);
create index portfolio_chunks_embedding_idx on public.portfolio_chunks using hnsw (embedding vector_cosine_ops);

alter table public.portfolio_chunks enable row level security;

-- 검색/임베딩 생성은 서버(비밀 키, service role)가 대신 처리하므로 클라이언트 정책은
-- owner가 자기 카드의 조각을 조회하는 경우만 열어둔다 (관리·디버깅 용도).
create policy "owner reads own portfolio chunks"
  on public.portfolio_chunks
  for select
  using (
    auth.uid() = (
      select user_id from public.project_cards where id = project_card_id
    )
  );

-- =========================================================
-- 3. invite_links — 인사 담당자용 초대 링크
-- =========================================================
create table public.invite_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  label text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index invite_links_user_id_idx on public.invite_links (user_id);

alter table public.invite_links enable row level security;

-- owner 본인만 자신의 초대 링크를 조회/발급/비활성화할 수 있다.
-- 방문자는 토큰을 아는 것만으로 접근하며, 그 조회는 서버가 대신 처리한다(RLS 대상 아님).
create policy "owner manages own invite links"
  on public.invite_links
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =========================================================
-- 4. chat_sessions — 초대 링크 + 방문자별 대화 세션
-- =========================================================
create table public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  invite_link_id uuid not null references public.invite_links (id) on delete cascade,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  visitor_user_id uuid not null references auth.users (id) on delete cascade,
  anon_label text not null default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4)),
  last_read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (invite_link_id, visitor_user_id)
);

create index chat_sessions_invite_link_id_idx on public.chat_sessions (invite_link_id);
create index chat_sessions_owner_user_id_idx on public.chat_sessions (owner_user_id);
create index chat_sessions_visitor_user_id_idx on public.chat_sessions (visitor_user_id);

alter table public.chat_sessions enable row level security;

-- owner는 자기 포트폴리오에 달린 모든 세션을, 방문자는 자신이 만든 세션 1개만 볼 수 있다.
create policy "owner and visitor read own sessions"
  on public.chat_sessions
  for select
  using (auth.uid() = owner_user_id or auth.uid() = visitor_user_id);

-- 방문자는 자기 명의로만 새 세션을 만들 수 있다.
create policy "visitor creates own session"
  on public.chat_sessions
  for insert
  with check (auth.uid() = visitor_user_id);

-- 세션 읽음 처리(last_read_at 갱신)는 owner만 할 수 있다.
-- (app 코드는 last_read_at만 갱신하도록 작성한다. 컬럼 단위 제한까지는 이번 범위에서 다루지 않는다.)
create policy "owner marks session read"
  on public.chat_sessions
  for update
  using (auth.uid() = owner_user_id)
  with check (auth.uid() = owner_user_id);

-- =========================================================
-- 5. chat_messages — 세션 안의 질문·답변 로그
-- =========================================================
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_session_id uuid not null references public.chat_sessions (id) on delete cascade,
  role text not null check (role in ('visitor', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index chat_messages_chat_session_id_idx on public.chat_messages (chat_session_id);

alter table public.chat_messages enable row level security;

-- 그 세션을 볼 수 있는 사람(owner 또는 세션의 방문자)만 메시지를 볼 수 있다.
create policy "session participants read messages"
  on public.chat_messages
  for select
  using (
    exists (
      select 1 from public.chat_sessions s
      where s.id = chat_session_id
        and (auth.uid() = s.owner_user_id or auth.uid() = s.visitor_user_id)
    )
  );

-- 방문자는 자기 세션에 "질문(visitor)"만 직접 남길 수 있다.
-- "답변(assistant)"은 서버(비밀 키, service role)만 기록할 수 있어 별도 정책을 두지 않는다.
create policy "visitor writes own question"
  on public.chat_messages
  for insert
  with check (
    role = 'visitor'
    and auth.uid() = (
      select visitor_user_id from public.chat_sessions where id = chat_session_id
    )
  );

-- =========================================================
-- 6. chat_message_sources — 답변별 근거 카드 (여러 개 가능)
-- =========================================================
create table public.chat_message_sources (
  id uuid primary key default gen_random_uuid(),
  chat_message_id uuid not null references public.chat_messages (id) on delete cascade,
  project_card_id uuid not null references public.project_cards (id) on delete cascade
);

create index chat_message_sources_chat_message_id_idx on public.chat_message_sources (chat_message_id);

alter table public.chat_message_sources enable row level security;

-- 근거 카드 조회 권한은 그 답변을 볼 수 있는 사람과 동일하다.
-- 등록은 서버(service role)만 하므로 별도 insert 정책을 두지 않는다.
create policy "session participants read message sources"
  on public.chat_message_sources
  for select
  using (
    exists (
      select 1
      from public.chat_messages m
      join public.chat_sessions s on s.id = m.chat_session_id
      where m.id = chat_message_id
        and (auth.uid() = s.owner_user_id or auth.uid() = s.visitor_user_id)
    )
  );
