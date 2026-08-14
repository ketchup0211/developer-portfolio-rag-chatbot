// 초대 링크 토큰 유효성 확인 + 지원자(owner) 이름/연락처 조회 (DESIGN.md 1.6, 2.5).
// invite_links는 owner 본인만 조회할 수 있도록 RLS가 걸려 있어(3.4절), 초대 링크로
// 들어온 방문자를 위해 서버가 service role로 대신 조회해 필요한 정보만 내려준다.
// 실제 프로젝트 카드 데이터는 이미 공개된 /api/notion/cards(/:id)에서 그대로 가져온다.
import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/serviceClient";
import { QUESTION_LIMIT, countQuestions } from "@/lib/chat/questionLimit";

export async function GET(request, { params }) {
  const { token } = await params;

  try {
    const supabase = getSupabaseServiceClient();

    const { data: link, error: linkError } = await supabase
      .from("invite_links")
      .select("id, user_id, is_active")
      .eq("token", token)
      .maybeSingle();

    if (linkError) throw linkError;

    if (!link || !link.is_active) {
      return NextResponse.json({ valid: false });
    }

    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(
      link.user_id
    );
    if (userError) throw userError;

    const metadata = userData?.user?.user_metadata || {};

    // 이 초대 링크(토큰)가 지금까지 받은 질문 수(같은 링크의 모든 방문자 합산, PLAN 12번).
    // 챗봇 화면이 처음 열릴 때부터 이미 30회를 넘겼다면 입력칸을 바로 비활성화해야 하므로
    // 여기서 함께 계산해 내려준다.
    const questionCount = await countQuestions(supabase, link.id);

    return NextResponse.json({
      valid: true,
      // 대화 세션(chat_sessions)은 초대 링크 id + 방문자 uid로 구분되는데, invite_links는
      // owner 본인만 RLS로 조회할 수 있어 방문자 브라우저가 직접 알아낼 수 없다. 그래서
      // 이미 서비스 role로 링크를 확인한 이 응답에 실어서 함께 내려준다(비밀 값 아님).
      inviteLinkId: link.id,
      ownerName: metadata.name || "",
      ownerContact: metadata.contact || "",
      limitReached: questionCount >= QUESTION_LIMIT,
    });
  } catch (err) {
    console.error("초대 링크 확인 실패:", err);
    return NextResponse.json({ error: "링크를 확인하지 못했습니다." }, { status: 500 });
  }
}
