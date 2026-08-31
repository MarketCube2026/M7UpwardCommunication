"use client";

import { FormEvent, useEffect, useState } from "react";
import { LockKeyhole, ShieldCheck } from "lucide-react";

export default function AdminLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { fetch("/api/admin/auth/me").then((response) => { if (response.ok) window.location.replace("/admin"); }); }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/auth/login", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ username, password }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "登录失败");
      window.location.replace("/admin");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "登录失败"); }
    finally { setBusy(false); }
  };

  return <main className="admin-login-page"><form className="admin-login-card" onSubmit={submit}>
    <div className="admin-lock"><ShieldCheck size={24} /></div>
    <div className="eyebrow">ZHIBI ADMIN</div><h1>管理后台</h1><p>使用本地环境中初始化的管理员账号登录。</p>
    {error && <div className="form-error">{error}</div>}
    <div className="field"><label>管理员账号</label><input autoFocus autoComplete="username" value={username} onChange={(event)=>setUsername(event.target.value)} /></div>
    <div className="field"><label>密码</label><input type="password" autoComplete="current-password" value={password} onChange={(event)=>setPassword(event.target.value)} /></div>
    <button className="action auth-submit" disabled={busy}><LockKeyhole size={17}/>{busy ? "正在验证..." : "登录后台"}</button>
    <a className="text-button" href="/login">返回用户登录</a>
  </form></main>;
}
