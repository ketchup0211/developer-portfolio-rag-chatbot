"use client";

// 초대 링크 관리 화면 (DESIGN.md 1.4) — 로그인 필요.
// 지원자가 인사 담당자에게 전달할 초대 링크를 발급·비활성화한다.
// invite_links 표는 이미 RLS로 owner 본인 것만 보이도록 보호돼 있어(개발 단위 3번),
// 브라우저가 Supabase에 직접 조회/등록/수정한다 (Next.js API 불필요, DESIGN.md 2.5).
import { useEffect, useState } from "react";
import { RequireAuth } from "@/lib/auth/RequireAuth";
import AuthedNav from "@/components/AuthedNav";
import { useAuth } from "@/lib/auth/AuthProvider";
import { createClient } from "@/lib/supabase/client";

function InviteLinksManager() {
  const { user } = useAuth();
  const [links, setLinks] = useState(null);
  // window는 브라우저에서만 존재한다. lazy initializer는 클라이언트에서 마운트될 때
  // 다시 실행되므로(하이드레이션), 서버 렌더링 시에는 빈 문자열로 안전하게 시작한다.
  const [origin] = useState(() =>
    typeof window !== "undefined" ? window.location.origin : ""
  );
  const [newLabel, setNewLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = createClient();
      const { data, error: loadError } = await supabase
        .from("invite_links")
        .select("id, token, label, is_active, created_at")
        .order("created_at", { ascending: false });
      if (!active) return;
      if (loadError) {
        setError("초대 링크 목록을 불러오지 못했습니다.");
        return;
      }
      setLinks(data);
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  async function handleCreate(event) {
    event.preventDefault();
    if (!newLabel.trim()) {
      setError("구분용 이름을 입력해주세요.");
      return;
    }

    setCreating(true);
    setError("");
    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from("invite_links")
      .insert({ user_id: user.id, label: newLabel.trim() })
      .select("id, token, label, is_active, created_at")
      .single();
    setCreating(false);

    if (insertError) {
      setError("링크 발급에 실패했습니다: " + insertError.message);
      return;
    }

    setLinks((prev) => [data, ...(prev || [])]);
    setNewLabel("");
  }

  async function handleDeactivate(id) {
    setError("");
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("invite_links")
      .update({ is_active: false })
      .eq("id", id);

    if (updateError) {
      setError("비활성화하지 못했습니다: " + updateError.message);
      return;
    }

    setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, is_active: false } : l)));
  }

  async function handleCopy(token, id) {
    const url = `${origin}/p/${token}`;

    function markCopied() {
      setCopiedId(id);
      setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 1500);
    }

    if (navigator.clipboard?.writeText) {
      try {
        // 클립보드 권한 프롬프트가 응답 없이 멈추는 환경(일부 임베디드/자동화 브라우저)을
        // 대비해, 일정 시간 안에 끝나지 않으면 타임아웃시켜 아래 폴백으로 넘어간다.
        await Promise.race([
          navigator.clipboard.writeText(url),
          new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 800)),
        ]);
        markCopied();
        return;
      } catch {
        // 클립보드 권한이 없거나 시간 초과된 환경이면 아래 폴백을 시도한다.
      }
    }

    // document.execCommand 폴백: 화면 밖 임시 textarea에 값을 넣고 선택한 뒤 복사한다.
    const textarea = document.createElement("textarea");
    textarea.value = url;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand("copy");
      markCopied();
    } catch {
      setError("링크 복사에 실패했습니다. 직접 선택해 복사해주세요.");
    } finally {
      document.body.removeChild(textarea);
    }
  }

  return (
    <>
      <AuthedNav />
      <main style={{ maxWidth: "720px", margin: "2rem auto", padding: "0 1.5rem" }}>
        <h1 style={{ fontSize: "1.3rem", marginBottom: "0.3rem" }}>초대 링크 관리</h1>
        <p style={{ color: "#777", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
          인사 담당자에게 전달할 링크입니다. 링크에는 유효기간이 없으며, 더 쓰지 않을
          링크는 비활성화할 수 있습니다 (완전 삭제는 지원하지 않습니다).
        </p>

        <form
          onSubmit={handleCreate}
          style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}
        >
          <input
            type="text"
            placeholder="구분용 이름 (예: 회사명)"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            style={{ flex: 1 }}
          />
          <button type="submit" disabled={creating}>
            {creating ? "만드는 중..." : "+ 새 링크 만들기"}
          </button>
        </form>

        {error && <p className="form-error">{error}</p>}

        {links === null && !error && <p>불러오는 중...</p>}

        {links && links.length === 0 && (
          <p style={{ color: "#555" }}>아직 발급한 초대 링크가 없습니다.</p>
        )}

        {links && links.length > 0 && (
          <ul className="invite-link-list">
            {links.map((link) => (
              <li
                key={link.id}
                className={`invite-link-row${link.is_active ? "" : " invite-link-row-inactive"}`}
              >
                <div className="invite-link-info">
                  <strong>{link.label || "(이름 없음)"}</strong>
                  <span className="invite-link-url">
                    {origin ? `${origin}/p/${link.token}` : `/p/${link.token}`}
                  </span>
                </div>
                <div className="invite-link-actions">
                  <span
                    className={`invite-link-status${link.is_active ? " invite-link-status-active" : ""}`}
                  >
                    {link.is_active ? "활성" : "비활성"}
                  </span>
                  <button type="button" onClick={() => handleCopy(link.token, link.id)}>
                    {copiedId === link.id ? "복사됨" : "복사"}
                  </button>
                  {link.is_active && (
                    <button type="button" onClick={() => handleDeactivate(link.id)}>
                      비활성화
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}

export default function InvitesPage() {
  return (
    <RequireAuth>
      <InviteLinksManager />
    </RequireAuth>
  );
}
