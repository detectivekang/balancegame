import React, { useState } from "react";
import { useSession } from "../hooks/useSession";
import { ADMIN_EMAIL } from "../lib/supabaseClient";

export default function AdminLogin() {
  const { signInAdmin } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (email.trim() !== ADMIN_EMAIL) {
      setError("관리자 계정만 로그인할 수 있습니다.");
      return;
    }

    try {
      await signInAdmin(email.trim(), password);
    } catch (err) {
      console.error(err);
      setError("로그인에 실패했습니다. 이메일/비밀번호를 확인해주세요.");
    }
  };

  return (
    <div className="page page--admin-login">
      <h2>관리자 로그인</h2>
      <form onSubmit={handleSubmit} className="admin-login-form">
        <label>
          이메일
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          비밀번호
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <button type="submit">로그인</button>
        {error && <p className="admin-login-form__error">{error}</p>}
      </form>
    </div>
  );
}
