"use client";

// 내 정보 화면 (DESIGN.md 1.2.1) — 로그인 필요.
// 이름·연락처를 나중에 고칠 수 있는 화면입니다. 이메일/비밀번호 변경은
// 이번 범위에 포함하지 않습니다.
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { RequireAuth } from "@/lib/auth/RequireAuth";

function ProfileForm() {
  const { user } = useAuth();
  // RequireAuth가 로그인 확인이 끝난 뒤에만 이 화면을 그리므로,
  // 처음 렌더링될 때 이미 user 정보를 알고 있어 별도 effect 없이 초기값을 채웁니다.
  const [name, setName] = useState(user?.user_metadata?.name ?? "");
  const [contact, setContact] = useState(user?.user_metadata?.contact ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSaved(false);

    if (!name.trim()) {
      setError("이름은 필수 입력 항목입니다.");
      return;
    }

    setSubmitting(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      data: { name: name.trim(), contact: contact.trim() },
    });
    setSubmitting(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSaved(true);
  }

  return (
    <main className="form-page">
      <h1>내 정보</h1>
      <form onSubmit={handleSubmit}>
        <label>
          이메일
          <input type="email" value={user?.email ?? ""} disabled />
        </label>
        <label>
          이름
          <input
            type="text"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label>
          연락처
          <input
            type="text"
            value={contact}
            onChange={(event) => setContact(event.target.value)}
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        {saved && <p className="form-message">저장했습니다.</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? "저장 중..." : "저장"}
        </button>
      </form>
      <p className="form-links">
        <Link href="/">홈으로</Link>
      </p>
    </main>
  );
}

export default function ProfilePage() {
  return (
    <RequireAuth>
      <ProfileForm />
    </RequireAuth>
  );
}
