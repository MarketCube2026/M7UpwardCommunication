"use client";

import { FormEvent, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, ShieldCheck } from "lucide-react";

export default function InviteActivationPage() {
  const params=useParams<{token:string}>();
  const [form,setForm]=useState({phone:"",nickname:"",password:"",confirm:"",agreed:false});
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  const submit=async(event:FormEvent)=>{
    event.preventDefault(); setError("");
    if(form.password!==form.confirm)return setError("两次输入的密码不一致");
    if(!form.agreed)return setError("请先阅读并同意相关条款");
    setBusy(true);
    try{
      const response=await fetch("/api/beta/activate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:params.token,phone:form.phone,nickname:form.nickname,password:form.password,agreed:form.agreed})});
      const data=await response.json(); if(!response.ok)throw new Error(data.error||"激活失败");
      window.location.replace("/");
    }catch(reason){setError(reason instanceof Error?reason.message:"激活失败");}finally{setBusy(false);}
  };

  return <main className="auth-page">
    <section className="auth-intro">
      <div className="brand auth-brand"><span className="brand-mark">知</span>知彼</div>
      <div><div className="eyebrow">WELCOME TO PRIVATE BETA</div><h1>欢迎成为<br/>知彼首批内测用户。</h1><p>激活后将获得 30 次内测权益。请使用真实但不敏感的工作场景，避免输入客户隐私、商业机密或他人的敏感个人信息。</p></div>
      <div className="auth-trust"><ShieldCheck size={18}/> 邀请链接一次有效 · 数据按账号隔离</div>
    </section>
    <section className="auth-panel"><div className="auth-card">
      <div className="mobile-brand"><span className="brand-mark">知</span><strong>知彼</strong></div>
      <div className="eyebrow">ACTIVATE INVITATION</div><h2>激活内测账号</h2><p className="auth-help">完成后自动登录，并发放 30 次内测权益。</p>
      {error&&<div className="form-error">{error}</div>}
      <form onSubmit={submit}>
        <div className="field"><label>手机号</label><div className="phone-input"><span>+86</span><input required inputMode="tel" value={form.phone} onChange={(e)=>setForm({...form,phone:e.target.value})} placeholder="请输入 11 位手机号"/></div></div>
        <div className="field"><label>昵称（选填）</label><input maxLength={30} value={form.nickname} onChange={(e)=>setForm({...form,nickname:e.target.value})} placeholder="例如：小林"/></div>
        <div className="field"><label>设置密码</label><input required type="password" minLength={8} maxLength={72} value={form.password} onChange={(e)=>setForm({...form,password:e.target.value})} placeholder="8-72 个字符"/></div>
        <div className="field"><label>确认密码</label><input required type="password" minLength={8} maxLength={72} value={form.confirm} onChange={(e)=>setForm({...form,confirm:e.target.value})} placeholder="请再次输入"/></div>
        <label className="agreement"><input type="checkbox" checked={form.agreed} onChange={(e)=>setForm({...form,agreed:e.target.checked})}/><span>我已阅读并同意<a href="/terms" target="_blank">《服务条款》</a>、<a href="/privacy" target="_blank">《隐私说明》</a>和<a href="/ai-notice" target="_blank">《AI 使用告知》</a></span></label>
        <button className="action auth-submit" disabled={busy}>{busy?"正在激活...":<><CheckCircle2 size={17}/> 激活并开始使用</>}</button>
      </form>
    </div></section>
  </main>;
}
