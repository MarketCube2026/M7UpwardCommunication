"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, MessageCircle, ShieldCheck, Smartphone } from "lucide-react";

type Stage = "phone" | "code";

export default function LoginPage() {
  const [stage, setStage] = useState<Stage>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [wechatMessage, setWechatMessage] = useState("本地阶段待配置");

  useEffect(() => {
    fetch("/api/auth/me").then((response) => {
      if (response.ok) window.location.replace("/");
    });
    fetch("/api/beta/status").then((response) => response.json()).then((data) => {
      if (data.active) window.location.replace("/beta-login");
    }).catch(() => undefined);

    fetch("/api/auth/wechat/status")
      .then((response) => response.json())
      .then((data) => setWechatMessage(data.message || "本地阶段待配置"))
      .catch(() => undefined);
  }, []);

  const requestCode = async (event: FormEvent) => {
    event.preventDefault();
    if (!agreed) return setError("请先阅读并同意服务协议与隐私说明");
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "验证码发送失败");
      setDevCode(data.devCode || "");
      setStage("code");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "验证码发送失败");
    } finally {
      setBusy(false);
    }
  };

  const verify = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "登录失败");
      window.location.replace("/");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "登录失败");
    } finally {
      setBusy(false);
    }
  };

  return <main className="auth-page">
    <section className="auth-intro">
      <div className="brand auth-brand"><span className="brand-mark">知</span>知彼</div>
      <div>
        <div className="eyebrow">UPWARD COMMUNICATION COACH</div>
        <h1>关键沟通前，<br />先把话想明白。</h1>
        <p>了解不同领导的关注点，预演表达，积累复盘，让职场新人也能更从容地向上沟通。</p>
      </div>
      <div className="auth-trust"><ShieldCheck size={18} /> 每个账号的数据独立保存</div>
    </section>
    <section className="auth-panel">
      <div className="auth-card">
        <div className="mobile-brand"><span className="brand-mark">知</span><strong>知彼</strong></div>
        <div className="eyebrow">{stage === "phone" ? "LOGIN / REGISTER" : "VERIFY PHONE"}</div>
        <h2>{stage === "phone" ? "登录或注册" : "输入验证码"}</h2>
        <p className="auth-help">{stage === "phone" ? "新手机号验证后将自动创建账号" : `验证码已发送至 +86 ${phone.replace(/^\+?86/, "")}`}</p>
        {error && <div className="form-error">{error}</div>}
        {stage === "phone" ? <form onSubmit={requestCode}>
          <div className="field"><label>手机号</label><div className="phone-input"><span>+86</span><input autoFocus inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="请输入 11 位手机号" /></div></div>
          <label className="agreement"><input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} /><span>我已阅读并同意《服务协议》和《隐私说明》</span></label>
          <button className="action auth-submit" disabled={busy}>{busy ? "正在获取..." : <><Smartphone size={17} /> 获取验证码</>}</button>
        </form> : <form onSubmit={verify}>
          {devCode && <div className="dev-code"><span>本地测试验证码</span><strong>{devCode}</strong><small>仅开发环境显示，5 分钟内有效</small></div>}
          <div className="field"><label>6 位验证码</label><input autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} placeholder="请输入验证码" /></div>
          <button className="action auth-submit" disabled={busy || code.length !== 6}>{busy ? "正在登录..." : <><CheckCircle2 size={17} /> 验证并登录</>}</button>
          <button type="button" className="text-button" onClick={() => { setStage("phone"); setCode(""); setError(""); }}>更换手机号</button>
        </form>}
        <div className="auth-divider"><span>其他方式</span></div>
        <button className="wechat-button" type="button" onClick={() => setError(wechatMessage)}><MessageCircle size={18} /> 微信授权登录 <small>{wechatMessage}</small></button>
        <a className="admin-entry" href="/admin/login">管理员登录 <ArrowRight size={14} /></a>
      </div>
    </section>
  </main>;
}
