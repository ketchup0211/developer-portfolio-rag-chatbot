// 초대 링크 토큰 유효성 확인 + 지원자(owner) 이름/연락처 조회 (DESIGN.md 1.6, 2.5).
// invite_links는 owner 본인만 조회할 수 있도록 RLS가 걸려 있어(3.4절), 초대 링크로
// 들어온 방문자를 위해 서버가 service role로 대신 조회해 필요한 정보만 내려준다.
// 실제 프로젝트 카드 데이터는 이미 공개된 /api/notion/cards(/:id)에서 그대로 가져온다.
import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/serviceClient";

export async function GET(request, { params }) {
  const { token } = await params;

  try {
    const supabase = getSupabaseServiceClient();

    const { data: link, error: linkError } = await supabase
      .from("invite_links")
      .select("user_id, is_active")
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

    return NextResponse.json({
      valid: true,
      ownerName: metadata.name || "",
      ownerContact: metadata.contact || "",
    });
  } catch (err) {
    console.error("초대 링크 확인 실패:", err);
    return NextResponse.json({ error: "링크를 확인하지 못했습니다." }, { status: 500 });
  }
}
