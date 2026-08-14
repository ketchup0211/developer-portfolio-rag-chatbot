-- Supabase 최신 기본값은 새로 만든 표를 API 역할(anon/authenticated)에
-- 자동으로 노출하지 않습니다(config.toml의 auto_expose_new_tables 주석 참고).
-- RLS 정책은 "허용된 접근 중 어떤 행을 볼 수 있는지"만 정하고, 애초에 표에
-- 접근할 권한 자체는 별도로 내려줘야 하므로 아래 GRANT를 추가합니다.
--
-- owner(이메일 로그인)와 방문자(익명 로그인) 모두 Supabase에서는 동일하게
-- "authenticated" 역할로 취급되므로, authenticated에만 권한을 주면 됩니다.
-- 실제로 어떤 행을 보고 쓸 수 있는지는 이전 마이그레이션의 RLS 정책이 걸러줍니다.

grant select, insert, update, delete on public.project_cards to authenticated;
grant select on public.portfolio_chunks to authenticated;
grant select, insert, update, delete on public.invite_links to authenticated;
grant select, insert, update on public.chat_sessions to authenticated;
grant select, insert on public.chat_messages to authenticated;
grant select on public.chat_message_sources to authenticated;
