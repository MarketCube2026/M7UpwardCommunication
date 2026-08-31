"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { BarChart3, Boxes, CircleDollarSign, Gauge, LogOut, Menu, RefreshCw, Search, Settings, ShieldCheck, Users, X } from "lucide-react";

type View = "dashboard" | "users" | "orders" | "content" | "settings" | "analytics";
type Dashboard = { totalUsers:number; dau:number; netRevenueFen:number; paidConversion:number; todayEvaluations:number; aiFailureRate:number };
type UserItem = { id:string; phone:string; nickname?:string; status:string; createdAt:string; paidRemaining:number; hasPaid:boolean };
type OrderItem = { id:string; packageName:string; credits:number; amountFen:number; status:string; createdAt:string; user:{phone:string;nickname?:string}; creditLot?:{remaining:number;creditsInitial:number}; refund?:unknown };
type ContentItem = { id:string; name?:string; label?:string; content?:string; description?:string; referenceTemplate?:string; sortOrder:number; active:boolean };
type PackageItem = { id:string; code:string; name:string; credits:number; priceFen:number; description?:string; position?:string; active:boolean };
type Analytics = { retention:{d1:number;d7:number;d30:number}; scenarioDistribution:Array<{name:string;count:number}>; ai:{attempts:number;success:number;failed:number;totalTokens:number} };

const navItems = [
  { id:"dashboard" as View,label:"仪表盘",icon:Gauge }, { id:"users" as View,label:"用户管理",icon:Users },
  { id:"orders" as View,label:"订单管理",icon:CircleDollarSign }, { id:"content" as View,label:"内容管理",icon:Boxes },
  { id:"settings" as View,label:"系统设置",icon:Settings }, { id:"analytics" as View,label:"数据统计",icon:BarChart3 },
];

const money = (fen:number) => `¥${(fen/100).toFixed(2)}`;
const formatDate = (value:string) => new Date(value).toLocaleString("zh-CN", { month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit" });

export default function AdminPage() {
  const [view,setView] = useState<View>("dashboard");
  const [admin,setAdmin] = useState<{username:string}|null>(null);
  const [dashboard,setDashboard] = useState<Dashboard|null>(null);
  const [users,setUsers] = useState<UserItem[]>([]);
  const [orders,setOrders] = useState<OrderItem[]>([]);
  const [content,setContent] = useState<{scenarios:ContentItem[];tags:ContentItem[];tips:ContentItem[]}>({scenarios:[],tags:[],tips:[]});
  const [settings,setSettings] = useState<Record<string,string>>({});
  const [packages,setPackages] = useState<PackageItem[]>([]);
  const [analytics,setAnalytics] = useState<Analytics|null>(null);
  const [query,setQuery] = useState("");
  const [userStatus,setUserStatus] = useState("");
  const [orderStatus,setOrderStatus] = useState("");
  const [notice,setNotice] = useState("");
  const [loading,setLoading] = useState(true);
  const [mobileNav,setMobileNav] = useState(false);
  const [contentTab,setContentTab] = useState<"scenario"|"tag"|"tip">("scenario");

  const api = useCallback(async (path:string,init?:RequestInit) => {
    const response=await fetch(path,init); const data=await response.json().catch(()=>({}));
    if(response.status===401){window.location.replace("/admin/login");throw new Error("管理员会话已失效");}
    if(!response.ok)throw new Error(data.error||"操作失败"); return data;
  },[]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [me,d,u,o,c,s,a]=await Promise.all([
        api("/api/admin/auth/me"),api("/api/admin/dashboard"),
        api(`/api/admin/users?q=${encodeURIComponent(query)}&status=${encodeURIComponent(userStatus)}`),
        api(`/api/admin/orders?status=${encodeURIComponent(orderStatus)}`),api("/api/admin/content"),api("/api/admin/settings"),api("/api/admin/analytics"),
      ]);
      setAdmin(me.admin);setDashboard(d);setUsers(u);setOrders(o);setContent(c);setSettings(s.settings);setPackages(s.packages);setAnalytics(a);
    } catch(reason) { setNotice(reason instanceof Error?reason.message:"加载失败"); }
    finally { setLoading(false); }
  },[api,query,userStatus,orderStatus]);

  useEffect(()=>{void load();},[load]);

  const mutate = async (path:string,body:unknown,method="PATCH") => {
    try { await api(path,{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});setNotice("操作已完成");await load(); }
    catch(reason){setNotice(reason instanceof Error?reason.message:"操作失败");}
  };
  const adjust = (user:UserItem) => { const raw=window.prompt(`为 ${user.phone} 增减付费次数（减少请输入负数）`,`10`);if(raw===null)return;const delta=Number(raw);if(!Number.isInteger(delta)||delta===0)return setNotice("请输入非零整数");const reason=window.prompt("请填写调整原因");if(!reason?.trim())return setNotice("必须填写原因");void mutate(`/api/admin/users/${user.id}`,{action:"adjust",delta,reason}); };
  const toggleBan = (user:UserItem) => { const action=user.status==="ACTIVE"?"ban":"unban";const reason=window.prompt(action==="ban"?"请填写封禁原因":"请填写解封原因");if(reason?.trim())void mutate(`/api/admin/users/${user.id}`,{action,reason}); };
  const refund = (order:OrderItem) => { const reason=window.prompt("仅未使用的完整次数包可自动退款。请填写原因");if(reason?.trim())void mutate(`/api/admin/orders/${order.id}/refund`,{reason},"POST"); };
  const logout = async()=>{await fetch("/api/admin/auth/logout",{method:"POST"});window.location.replace("/admin/login");};

  const addContent = async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();const form=new FormData(event.currentTarget);const value=String(form.get("value")||"").trim();if(!value)return;const body=contentTab==="scenario"?{kind:"scenario",name:value,description:String(form.get("description")||"")} : contentTab==="tag"?{kind:"tag",label:value}:{kind:"tip",content:value};await mutate("/api/admin/content",body,"POST");event.currentTarget.reset();};
  const editContent = (kind:"scenario"|"tag"|"tip",item:ContentItem) => { const old=item.name||item.label||item.content||"";const value=window.prompt("编辑内容",old);if(value===null||!value.trim())return;void mutate("/api/admin/content",{kind,id:item.id,value:value.trim(),active:item.active,sortOrder:item.sortOrder}); };
  const toggleContent = (kind:"scenario"|"tag"|"tip",item:ContentItem) => void mutate("/api/admin/content",{kind,id:item.id,active:!item.active,sortOrder:item.sortOrder});
  const savePackage = (item:PackageItem) => void mutate("/api/admin/settings",{package:item});
  const saveSettings = (event:FormEvent<HTMLFormElement>) => {event.preventDefault();const form=new FormData(event.currentTarget);void mutate("/api/admin/settings",Object.fromEntries(form.entries()));};

  const renderDashboard=()=>dashboard&&<><PageHead title="经营概览" subtitle="关键经营指标均按本地真实数据计算"/><div className="admin-kpis">
    <Kpi label="总用户数" value={dashboard.totalUsers}/><Kpi label="今日活跃" value={dashboard.dau}/><Kpi label="累计净收入" value={money(dashboard.netRevenueFen)}/><Kpi label="付费转化率" value={`${dashboard.paidConversion}%`}/><Kpi label="今日评估" value={dashboard.todayEvaluations}/><Kpi label="AI 失败率" value={`${dashboard.aiFailureRate}%`}/>
  </div><div className="admin-panel"><h2>当前运行状态</h2><div className="admin-status-grid"><span><i className="ok"/>本地 SQLite</span><span><i className="ok"/>账号数据隔离</span><span><i className="ok"/>模拟支付</span><span><i className="warn"/>短信与微信待配置</span></div></div></>;

  const renderUsers=()=> <><PageHead title="用户管理" subtitle="搜索账号、查看余额、调整次数和登录状态"/><div className="admin-toolbar"><div className="admin-search"><Search size={16}/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="搜索手机号或昵称"/></div><select value={userStatus} onChange={(e)=>setUserStatus(e.target.value)}><option value="">全部状态</option><option value="ACTIVE">正常</option><option value="BANNED">已封禁</option></select><button className="icon-button" title="刷新" onClick={()=>void load()}><RefreshCw size={17}/></button></div><DataTable headers={["用户","注册时间","付费状态","付费余额","账号状态","操作"]}>{users.map(user=><tr key={user.id}><td><strong>{user.nickname||"未命名"}</strong><small>{user.phone}</small></td><td>{formatDate(user.createdAt)}</td><td>{user.hasPaid?"已付费":"未付费"}</td><td>{user.paidRemaining} 次</td><td><Status value={user.status}/></td><td><div className="table-actions"><button onClick={()=>adjust(user)}>调次数</button><button className={user.status==="ACTIVE"?"danger":""} onClick={()=>toggleBan(user)}>{user.status==="ACTIVE"?"封禁":"解封"}</button></div></td></tr>)}</DataTable></>;

  const renderOrders=()=> <><PageHead title="订单管理" subtitle="订单金额以分保存，退款仅支持未使用的完整次数包"/><div className="admin-toolbar"><select value={orderStatus} onChange={(e)=>setOrderStatus(e.target.value)}><option value="">全部状态</option><option value="CREATED">待支付</option><option value="PAID">已支付</option><option value="REFUNDED">已退款</option><option value="CLOSED">已关闭</option></select></div><DataTable headers={["订单","用户","金额","次数包余额","状态","操作"]}>{orders.map(order=><tr key={order.id}><td><strong>{order.packageName}</strong><small>{formatDate(order.createdAt)}</small></td><td>{order.user.nickname}<small>{order.user.phone}</small></td><td>{money(order.amountFen)}</td><td>{order.creditLot?`${order.creditLot.remaining}/${order.creditLot.creditsInitial}`:"-"}</td><td><Status value={order.status}/></td><td>{order.status==="PAID"&&!order.refund?<button className="table-link" onClick={()=>refund(order)}>退款</button>:"-"}</td></tr>)}</DataTable></>;

  const currentContent=contentTab==="scenario"?content.scenarios:contentTab==="tag"?content.tags:content.tips;
  const renderContent=()=> <><PageHead title="内容管理" subtitle="维护所有用户可见的场景、性格标签和每日提示"/><div className="segmented"><button className={contentTab==="scenario"?"active":""} onClick={()=>setContentTab("scenario")}>场景模板</button><button className={contentTab==="tag"?"active":""} onClick={()=>setContentTab("tag")}>性格标签</button><button className={contentTab==="tip"?"active":""} onClick={()=>setContentTab("tip")}>每日提示</button></div><form className="admin-inline-form" onSubmit={addContent}><input name="value" placeholder={contentTab==="scenario"?"新场景名称":contentTab==="tag"?"新标签":"新的每日提示"}/>{contentTab==="scenario"&&<input name="description" placeholder="场景说明（选填）"/>}<button className="action">新增</button></form><div className="content-list">{currentContent.map(item=><div className="content-row" key={item.id}><div><strong>{item.name||item.label||item.content}</strong>{item.description&&<small>{item.description}</small>}</div><div><span className={item.active?"content-live":"content-off"}>{item.active?"已上线":"已下线"}</span><button onClick={()=>editContent(contentTab,item)}>编辑</button><button onClick={()=>toggleContent(contentTab,item)}>{item.active?"下线":"上线"}</button></div></div>)}</div></>;

  const renderSettings=()=> <><PageHead title="系统设置" subtitle="商业参数可配置，所有密钥仍只从环境变量读取"/><form className="admin-panel settings-form" onSubmit={saveSettings}><h2>基础参数</h2><div className="form-grid"><div className="field"><label>每日免费次数</label><input name="dailyFreeLimit" type="number" min="0" defaultValue={settings.dailyFreeLimit||"3"}/></div><div className="field"><label>系统时区</label><input name="timezone" defaultValue={settings.timezone||"Asia/Shanghai"}/></div><div className="field"><label>短信签名展示值</label><input name="smsSignature" defaultValue={settings.smsSignature||"知彼"}/></div><div className="field"><label>每百万 Token 成本（分）</label><input name="tokenCostPerMillionFen" type="number" min="0" defaultValue={settings.tokenCostPerMillionFen||"0"}/></div></div><div className="form-actions"><button className="action">保存基础设置</button></div></form><div className="admin-panel"><h2>套餐参数</h2><div className="package-settings">{packages.map((item,index)=><PackageEditor key={item.id} item={item} onChange={(next)=>setPackages(packages.map((entry,i)=>i===index?next:entry))} onSave={savePackage}/>)}</div></div></>;

  const renderAnalytics=()=>analytics&&<><PageHead title="数据统计" subtitle="留存、场景分布和 AI 调用均来自本地事件记录"/><div className="admin-kpis"><Kpi label="D1 留存" value={`${analytics.retention.d1}%`}/><Kpi label="D7 留存" value={`${analytics.retention.d7}%`}/><Kpi label="D30 留存" value={`${analytics.retention.d30}%`}/><Kpi label="AI 成功率" value={`${analytics.ai.attempts?Math.round(analytics.ai.success/analytics.ai.attempts*1000)/10:0}%`}/><Kpi label="Token 用量" value={analytics.ai.totalTokens||"未知"}/></div><div className="admin-panel"><h2>场景使用分布</h2><div className="bar-list">{analytics.scenarioDistribution.map((item)=><div key={item.name}><span>{item.name}</span><div><i style={{width:`${Math.max(4,item.count/(analytics.scenarioDistribution[0]?.count||1)*100)}%`}}/></div><strong>{item.count}</strong></div>)}</div></div></>;

  return <div className="admin-shell"><aside className={`admin-sidebar ${mobileNav?"open":""}`}><div className="admin-brand"><span><ShieldCheck size={20}/></span><div><strong>知彼管理后台</strong><small>COMMERCIAL V2</small></div></div><nav>{navItems.map(({id,label,icon:Icon})=><button key={id} className={view===id?"active":""} onClick={()=>{setView(id);setMobileNav(false)}}><Icon size={17}/>{label}</button>)}</nav><div className="admin-account"><span>{admin?.username}</span><button title="退出登录" onClick={logout}><LogOut size={16}/></button></div></aside>{mobileNav&&<button className="admin-scrim" aria-label="关闭导航" onClick={()=>setMobileNav(false)}/>}<main className="admin-main"><header className="admin-mobile-header"><button className="icon-button" onClick={()=>setMobileNav(true)}><Menu size={19}/></button><strong>知彼管理后台</strong></header>{notice&&<div className="admin-notice">{notice}<button onClick={()=>setNotice("")}><X size={15}/></button></div>}{loading?<div className="admin-loading">正在加载经营数据...</div>:view==="dashboard"?renderDashboard():view==="users"?renderUsers():view==="orders"?renderOrders():view==="content"?renderContent():view==="settings"?renderSettings():renderAnalytics()}</main></div>;
}

function PageHead({title,subtitle}:{title:string;subtitle:string}){return <div className="admin-page-head"><div><div className="eyebrow">ADMIN CONSOLE</div><h1>{title}</h1><p>{subtitle}</p></div></div>}
function Kpi({label,value}:{label:string;value:string|number}){return <div className="admin-kpi"><span>{label}</span><strong>{value}</strong></div>}
function Status({value}:{value:string}){const map:Record<string,string>={ACTIVE:"正常",BANNED:"已封禁",CREATED:"待支付",PAID:"已支付",REFUNDED:"已退款",CLOSED:"已关闭"};return <span className={`admin-status status-${value.toLowerCase()}`}>{map[value]||value}</span>}
function DataTable({headers,children}:{headers:string[];children:React.ReactNode}){return <div className="table-wrap"><table className="admin-table"><thead><tr>{headers.map(item=><th key={item}>{item}</th>)}</tr></thead><tbody>{children}</tbody></table></div>}
function PackageEditor({item,onChange,onSave}:{item:PackageItem;onChange:(item:PackageItem)=>void;onSave:(item:PackageItem)=>void}){return <div className="package-editor"><div><strong>{item.code}</strong><label><input type="checkbox" checked={item.active} onChange={(e)=>onChange({...item,active:e.target.checked})}/> 启用</label></div><input value={item.name} onChange={(e)=>onChange({...item,name:e.target.value})}/><div className="package-numbers"><label>次数<input type="number" min="0" value={item.credits} onChange={(e)=>onChange({...item,credits:Number(e.target.value)})}/></label><label>价格（分）<input type="number" min="0" value={item.priceFen} onChange={(e)=>onChange({...item,priceFen:Number(e.target.value)})}/></label></div><input value={item.position||""} placeholder="套餐定位" onChange={(e)=>onChange({...item,position:e.target.value})}/><textarea value={item.description||""} placeholder="说明" onChange={(e)=>onChange({...item,description:e.target.value})}/><button className="action secondary" onClick={()=>onSave(item)}>保存套餐</button></div>}
