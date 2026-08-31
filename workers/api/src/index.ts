interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<unknown>;
}

interface D1Database {
  prepare(query: string): D1Statement;
}

interface R2Bucket {
  put(key: string, value: string, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
}

interface Env {
  DB: D1Database;
  FILES?: R2Bucket;
  AI_BASE_URL?: string;
  AI_API_KEY?: string;
  AI_MODEL?: string;
  DEMO_MODE?: string;
  FRONTEND_ORIGIN?: string;
}

interface ExportedHandler<T> {
  fetch(request: Request, env: T): Response | Promise<Response>;
}

type Row = Record<string, unknown>;

const baselineRequirements = [
  "先讲结论：我怎么看、建议做什么、希望领导决定什么",
  "关键事实可验证：有口径、单位、时间范围和比较基准",
  "说清判断依据：区分已核实事实、假设、影响和紧迫程度",
  "给出推荐方案：说明收益、风险、取舍、边界和退出条件",
  "形成闭环：一个最终负责人、完成时间、验证方式和再次汇报点",
  "按复杂度选渠道：一般事项周报，较急事项即时沟通，复杂事项专题汇报",
  "守住质量、合规、交付和客户影响边界，不把原话当作自己的判断",
];

function headers(env: Env, request?: Request) {
  const configuredOrigins = (env.FRONTEND_ORIGIN ?? "").split(",").map((origin) => origin.trim()).filter(Boolean);
  const requestOrigin = request?.headers.get("Origin") ?? "";
  const allowedOrigin = configuredOrigins.length === 0 ? "*" : configuredOrigins.includes(requestOrigin) ? requestOrigin : configuredOrigins[0];
  return { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": allowedOrigin, "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS" };
}

function response(env: Env, request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: headers(env, request) });
}

function text(value: unknown, max = 10_000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function json(value: unknown) {
  return JSON.stringify(value ?? {});
}

async function body(request: Request): Promise<Row> {
  try {
    const data = await request.json();
    return data && typeof data === "object" ? data as Row : {};
  } catch {
    return {};
  }
}

async function all(db: D1Database, query: string, ...values: unknown[]) {
  return (await db.prepare(query).bind(...values).all<Row>()).results;
}

async function first(db: D1Database, query: string, ...values: unknown[]) {
  return db.prepare(query).bind(...values).first<Row>();
}

function demoEvaluation(input: Row) {
  const inputText = text(input.inputText);
  const actionPlan = text(input.actionPlan);
  const hasPlan = Boolean(actionPlan);
  const hasStructure = /结果|数据|风险|下一步|计划|完成/.test(inputText);
  return {
    styleMatchScore: 78,
    completenessScore: hasStructure ? 84 : 62,
    riskAlertScore: 82,
    behaviorScore: hasPlan ? 86 : 58,
    keyStrengths: ["已经表达了明确的沟通目的", hasPlan ? "行动计划体现了闭环意识" : "可以继续补充可执行的下一步"],
    riskAlerts: ["建议在开头先给结论，降低对方理解成本"],
    suggestions: ["先说结论，再补充关键事实和影响", "把下一步拆成负责人、时间点和验收标准"],
    rewrittenVersion: `结论：${inputText.slice(0, 160)}\n\n补充：当前影响是……，主要风险是……。\n下一步：我会在……前完成……，并在……节点同步结果。`,
    behaviorFeedback: hasPlan ? ["计划包含明确动作，继续保持主动同步。"] : ["建议补充主动动作、时间节点和风险预案。"],
    baselineChecks: baselineRequirements.map((label, index) => ({ label, passed: index === 0 ? /结论|建议|希望|决定/.test(inputText) : index === 4 ? hasPlan : true, note: "" })),
    mode: "demo",
  };
}

async function evaluate(env: Env, input: Row, supervisor: Row, scenario: Row) {
  if (env.DEMO_MODE === "true" || !env.AI_BASE_URL || !env.AI_API_KEY || !env.AI_MODEL) return demoEvaluation(input);
  const prompt = `你是向上沟通教练。请基于上级画像和场景评估用户话术。管理原则：${baselineRequirements.map((item, index) => `${index + 1}.${item}`).join("；")}。若场景包含参考模板，只借鉴其结构和表达方式，不照搬具体事实、数据或承诺。只返回 JSON，字段：styleMatchScore, completenessScore, riskAlertScore, behaviorScore, keyStrengths, riskAlerts, suggestions, rewrittenVersion, behaviorFeedback, baselineChecks。baselineChecks 必须包含 7 项 label、passed、note。评分范围 0-100。上级画像：${JSON.stringify(supervisor)}。场景：${JSON.stringify(scenario)}。话术：${text(input.inputText)}。行动计划：${text(input.actionPlan) || "未填写"}`;
  try {
    const result = await fetch(`${env.AI_BASE_URL.replace(/\/$/, "")}/chat/completions`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.AI_API_KEY}` }, body: JSON.stringify({ model: env.AI_MODEL, temperature: 0.3, messages: [{ role: "user", content: prompt }] }) });
    if (!result.ok) throw new Error(String(result.status));
    const content = String((await result.json() as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message?.content ?? "").replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    const parsed = JSON.parse(start >= 0 && end > start ? content.slice(start, end + 1) : content) as Row;
    const score = (value: unknown) => Math.max(0, Math.min(100, Number(value) || 70));
    const strings = (value: unknown) => Array.isArray(value) ? value.map(String) : value ? [String(value)] : [];
    return { styleMatchScore: score(parsed.styleMatchScore), completenessScore: score(parsed.completenessScore), riskAlertScore: score(parsed.riskAlertScore), behaviorScore: parsed.behaviorScore == null ? undefined : score(parsed.behaviorScore), keyStrengths: strings(parsed.keyStrengths), riskAlerts: strings(parsed.riskAlerts), suggestions: strings(parsed.suggestions), rewrittenVersion: String(parsed.rewrittenVersion ?? ""), behaviorFeedback: strings(parsed.behaviorFeedback), baselineChecks: Array.isArray(parsed.baselineChecks) ? parsed.baselineChecks : baselineRequirements.map((label) => ({ label, passed: false, note: "模型未返回逐项判断" })), mode: "ai" };
  } catch {
    return demoEvaluation(input);
  }
}

function rehearsal(row: Row) {
  return { ...row, evaluation: typeof row.evaluation === "string" ? row.evaluation : json(row.evaluation), supervisor: row.supervisorName ? { id: row.supervisorId, name: row.supervisorName } : undefined, debrief: row.debriefId ? { id: row.debriefId } : null };
}

async function listRehearsals(env: Env) {
  const rows = await all(env.DB, `SELECT r.*, s.name AS supervisorName, d.id AS debriefId FROM Rehearsal r JOIN Supervisor s ON s.id = r.supervisorId LEFT JOIN Debrief d ON d.rehearsalId = r.id ORDER BY r.createdAt DESC`);
  return rows.map(rehearsal);
}

const worker: ExportedHandler<Env> = {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: headers(env, request) });
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, "");
    const method = request.method;

    const send = (body: unknown, status = 200) => response(env, request, body, status);

    if (path === "/api/health") return send( { status: "ok", storage: "d1", time: new Date().toISOString() });
    if (path === "/api/settings") return send( { configured: Boolean(env.AI_BASE_URL && env.AI_API_KEY && env.AI_MODEL), provider: env.AI_BASE_URL ? "OpenAI-compatible" : "未配置", model: env.AI_MODEL ?? null, demoMode: env.DEMO_MODE === "true" || !env.AI_API_KEY });

    if (path === "/api/supervisors" && method === "GET") return send( await all(env.DB, "SELECT * FROM Supervisor ORDER BY updatedAt DESC"));
    if (path === "/api/supervisors" && method === "POST") {
      const data = await body(request); const name = text(data.name, 80); if (!name) return send( { error: "姓名不能为空" }, 400);
      const item = { id: crypto.randomUUID(), name, position: text(data.position, 120) || null, relation: text(data.relation, 80) || null, tags: json(Array.isArray(data.tags) ? data.tags.slice(0, 12) : []), communicationPrefs: json(data.communicationPrefs), workStyle: json(data.workStyle), taboos: text(data.taboos, 1000) || null, notes: text(data.notes, 3000) || null };
      await env.DB.prepare("INSERT INTO Supervisor (id,name,position,relation,tags,communicationPrefs,workStyle,taboos,notes) VALUES (?,?,?,?,?,?,?,?,?)").bind(item.id,item.name,item.position,item.relation,item.tags,item.communicationPrefs,item.workStyle,item.taboos,item.notes).run();
      return send( await first(env.DB, "SELECT * FROM Supervisor WHERE id=?", item.id), 201);
    }
    const supervisorMatch = path.match(/^\/api\/supervisors\/([^/]+)$/);
    if (supervisorMatch) {
      const id = decodeURIComponent(supervisorMatch[1]);
      if (method === "GET") { const item = await first(env.DB, "SELECT * FROM Supervisor WHERE id=?", id); return item ? send( item) : send( { error: "档案不存在" }, 404); }
      if (method === "DELETE") { await env.DB.prepare("DELETE FROM Supervisor WHERE id=?").bind(id).run(); return send( { ok: true }); }
      if (method === "PATCH") { const data = await body(request); const name = text(data.name, 80); if (!name) return send( { error: "姓名不能为空" }, 400); await env.DB.prepare("UPDATE Supervisor SET name=?,position=?,relation=?,tags=?,communicationPrefs=?,workStyle=?,taboos=?,notes=?,updatedAt=CURRENT_TIMESTAMP WHERE id=?").bind(name,text(data.position,120)||null,text(data.relation,80)||null,json(Array.isArray(data.tags)?data.tags.slice(0,12):[]),json(data.communicationPrefs),json(data.workStyle),text(data.taboos,1000)||null,text(data.notes,3000)||null,id).run(); return send( await first(env.DB,"SELECT * FROM Supervisor WHERE id=?",id)); }
    }

    if (path === "/api/scenarios" && method === "GET") return send( await all(env.DB, "SELECT * FROM Scenario ORDER BY builtin DESC, createdAt ASC"));
    if (path === "/api/scenarios" && method === "POST") { const data = await body(request); const name = text(data.name,80); if (!name) return send({error:"场景名称不能为空"},400); const item={id:crypto.randomUUID(),name,description:text(data.description,2000)||null,referenceTemplate:text(data.referenceTemplate,5000)||null}; await env.DB.prepare("INSERT INTO Scenario (id,name,description,referenceTemplate) VALUES (?,?,?,?)").bind(item.id,item.name,item.description,item.referenceTemplate).run(); return send( {...item,builtin:false},201); }

    if (path === "/api/rehearsals" && method === "GET") return send( await listRehearsals(env));
    if (path === "/api/rehearsals/evaluate" && method === "POST") {
      const data = await body(request); const supervisorId=text(data.supervisorId,100), scenarioId=text(data.scenarioId,100), inputText=text(data.inputText,10_000), actionPlan=text(data.actionPlan,5000)||null;
      if (!supervisorId || !scenarioId || !inputText) return send({error:"请输入完整内容"},400);
      const supervisor=await first(env.DB,"SELECT * FROM Supervisor WHERE id=?",supervisorId), scenario=await first(env.DB,"SELECT * FROM Scenario WHERE id=?",scenarioId);
      if (!supervisor || !scenario) return send({error:"上级或场景不存在"},404);
      const snapshot={...supervisor,tags:JSON.parse(String(supervisor.tags||"[]")),communicationPrefs:JSON.parse(String(supervisor.communicationPrefs||"{}")),workStyle:JSON.parse(String(supervisor.workStyle||"{}"))};
      const evaluation=await evaluate(env,{inputText,actionPlan},snapshot,scenario); const id=crypto.randomUUID();
      await env.DB.prepare("INSERT INTO Rehearsal (id,supervisorId,scenarioId,scenarioName,supervisorSnapshot,inputText,actionPlan,evaluation,mode) VALUES (?,?,?,?,?,?,?,?,?)").bind(id,supervisorId,scenarioId,String(scenario.name),json(snapshot),inputText,actionPlan,json(evaluation),String(evaluation.mode)).run();
      return send({id,supervisorId,scenarioId,scenarioName:scenario.name,inputText,actionPlan,evaluation,mode:evaluation.mode,createdAt:new Date().toISOString(),supervisor:{id:supervisorId,name:supervisor.name}});
    }
    const debriefMatch=path.match(/^\/api\/rehearsals\/([^/]+)\/debrief$/);
    if (debriefMatch && method === "POST") { const data=await body(request), outcome=text(data.outcome,5000); if(!outcome)return send({error:"请填写实际沟通结果"},400); const rehearsalId=decodeURIComponent(debriefMatch[1]); const id=crypto.randomUUID(); await env.DB.prepare("INSERT INTO Debrief (id,rehearsalId,outcome,rating,variance,nextAction) VALUES (?,?,?,?,?,?) ON CONFLICT(rehearsalId) DO UPDATE SET outcome=excluded.outcome,rating=excluded.rating,variance=excluded.variance,nextAction=excluded.nextAction").bind(id,rehearsalId,outcome,Number(data.rating)||null,text(data.variance,2000)||null,text(data.nextAction,2000)||null).run(); return send({ok:true}); }
    const rehearsalMatch=path.match(/^\/api\/rehearsals\/([^/]+)$/);
    if (rehearsalMatch && method === "GET") { const item=await first(env.DB,"SELECT r.*,s.name AS supervisorName,d.id AS debriefId FROM Rehearsal r JOIN Supervisor s ON s.id=r.supervisorId LEFT JOIN Debrief d ON d.rehearsalId=r.id WHERE r.id=?",decodeURIComponent(rehearsalMatch[1])); return item?send(rehearsal(item)):send({error:"记录不存在"},404); }

    const reportMatch=path.match(/^\/api\/reports\/supervisors\/([^/]+)$/);
    if(reportMatch && method==="GET") { const rows=await all(env.DB,"SELECT evaluation,createdAt FROM Rehearsal WHERE supervisorId=? ORDER BY createdAt ASC",decodeURIComponent(reportMatch[1])); const scores=rows.map((row)=>{try{const item=JSON.parse(String(row.evaluation));return Math.round((Number(item.styleMatchScore)+Number(item.completenessScore)+Number(item.riskAlertScore))/3)}catch{return 0}}); return send({count:rows.length,averageScore:scores.length?Math.round(scores.reduce((sum,score)=>sum+score,0)/scores.length):0,trend:rows.map((row,index)=>({createdAt:row.createdAt,score:scores[index]}))}); }
    if(path==="/api/backups" && method==="POST") { if(!env.FILES)return send({error:"R2 未绑定"},503); const snapshot={createdAt:new Date().toISOString(),supervisors:await all(env.DB,"SELECT * FROM Supervisor"),scenarios:await all(env.DB,"SELECT * FROM Scenario"),rehearsals:await all(env.DB,"SELECT * FROM Rehearsal"),debriefs:await all(env.DB,"SELECT * FROM Debrief")}; const key=`backups/zhibi-${snapshot.createdAt.replace(/[:.]/g,"-")}.json`; await env.FILES.put(key,JSON.stringify(snapshot),{httpMetadata:{contentType:"application/json"}}); return send({ok:true,key}); }
    return send({error:"接口不存在"},404);
  },
};

export default worker;
