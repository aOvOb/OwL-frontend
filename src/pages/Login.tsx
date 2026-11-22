import { useState } from "react";
import { api } from "../api";

export default function Login({ onLogin }: { onLogin: (username: string) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const me = await api.login(username.trim(), password);
      onLogin(me.username);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <div className="login-glow" />
      <form className="login-card" onSubmit={submit}>
        <img className="login-logo" src="/icons/icon-192.png" alt="" />
        <h1>OwL</h1>
        {error && <div className="login-error">{error}</div>}
        <label>
          아이디
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} required />
        </label>
        <label>
          비밀번호
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        <button className="login-btn" disabled={busy}>
          {busy ? "확인 중…" : "로그인"}
        </button>
      </form>
    </div>
  );
}
