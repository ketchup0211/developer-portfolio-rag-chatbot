-- 프로젝트 카드에 첨부하는 파일(PDF 등)을 저장할 비공개 버킷과 권한 정책.
-- DESIGN.md 2.1: 브라우저가 Next.js 서버를 거치지 않고 Supabase Storage에 직접 올린다.
-- owner는 로그인 상태(authenticated)이므로, "임시 서명 URL" 없이도 RLS로 보호된
-- 직접 업로드가 가능하다 (더 단순한 방식으로 같은 목표를 달성).

insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

-- 파일 경로는 반드시 "본인 uid로 시작하는 폴더" 아래에만 두도록 강제한다.
-- 예: {uid}/{project_card_id}/파일명.pdf
create policy "owner manages own attachment files"
  on storage.objects
  for all
  using (
    bucket_id = 'attachments'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'attachments'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
