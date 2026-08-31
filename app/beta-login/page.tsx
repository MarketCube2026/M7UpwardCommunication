"use client";

import { FormEvent, useEffect, useState } from "react";
import { LockKeyhole, ShieldCheck } from "lucide-react";

export default function BetaLoginPage() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/auth/me").then((response) => { if (response.ok) window.location.replace("/"); });
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/password/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, password }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "登录失败");
      window.location.replace("/");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "登录失败");
    } finally { setBusy(false); }
  };

  return <main className="auth-page">
    <section className="auth-intro">
      <div className="brand auth-brand"><span className="brand-mark">知</span>知彼</div>
      <div><div className="eyebrow">7-DAY PRIVATE BETA</div><h1>把第一次向上沟通，<br />准备得更从容。</h1><p>本轮仅面向受邀职场新人。你的使用反馈会帮助我们校准评估质量、价格与复盘体验。</p></div>
      <div className="auth-trust"><ShieldCheck size={18}/> 每个账号的数据独立保存</div>
    </section>
    <section className="auth-panel"><div className="auth-card">
      <div className="mobile-brand"><span className="brand-mark">知</span><strong>知彼</strong></div>
      <div className="eyebrow">INVITED TESTER LOGIN</div><h2>内测用户登录</h2><p className="auth-help">请使用邀请链接激活时填写的手机号和密码。</p>
      {error&&<div className="form-error">{error}</div>}
      <form onSubmit={submit}>
        <div className="field"><label>手机号</label><div className="phone-input"><span>+86</span><input required inputMode="tel" autoComplete="tel" value={phone} onChange={(event)=>setPhone(event.target.value)} placeholder="请输入 11 位手机号"/></div></div>
        <div className="field"><label>密码</label><input required type="password" minLength={8} maxLength={72} autoComplete="current-password" value={password} onChange={(event)=>setPassword(event.target.value)} placeholder="请输入密码"/></div>
        <button className="action auth-submit" disabled={busy}>{busy?"正在登录...":<><LockKeyhole size={17}/> 登录</>}</button>
      </form>
      <p className="beta-login-note">尚未激活？请从邀请消息中的专属链接进入。邀请链接仅可使用一次。</p>
      <a className="admin-entry" href="/admin/login">管理员登录</a>
    </div></section>
  </main>;
}
