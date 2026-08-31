import "dotenv/config";
import assert from "node:assert/strict";

const baseUrl = process.env.TEST_BASE_URL ?? "http://localhost:3101";
const token = process.env.TEST_INVITE_TOKEN;
assert(token, "TEST_INVITE_TOKEN is required");

async function call(path: string, init: RequestInit = {}, cookie?: string) {
  const headers = new Headers(init.headers);
  if (cookie) headers.set("Cookie", cookie);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return fetch(`${baseUrl}${path}`, { ...init, headers });
}
const body = (value: unknown) => JSON.stringify(value);
const cookieFrom = (response: Response) => response.headers.getSetCookie()[0]?.split(";")[0] ?? "";

async function main() {
  const status = await call("/api/beta/status");
  assert.equal((await status.json()).active, true);
  const otp = await call("/api/auth/otp/request", { method: "POST", body: body({ phone: "18800000000" }) });
  assert.equal(otp.status, 403);

  const phone = `188${String(Date.now()).slice(-8)}`;
  const activation = await call("/api/beta/activate", {
    method: "POST",
    body: body({ token, phone, nickname: "HTTP验收用户", password: "BetaHttp!2026", agreed: true }),
  });
  assert.equal(activation.status, 201, await activation.clone().text());
  const userCookie = cookieFrom(activation);
  assert(userCookie);

  const me = await call("/api/auth/me", {}, userCookie);
  const account = await me.json();
  assert.equal(account.usage.betaRemaining, 30);
  assert.equal(account.usage.paidRemaining, 0);

  const supervisorResponse = await call("/api/supervisors", {
    method: "POST",
    body: body({ name: "林经理", position: "市场经理", relation: "直属上级", tags: ["结果导向"], communicationPrefs: { channel: "微信" }, workStyle: { focus: "数据" }, taboos: "", notes: "" }),
  }, userCookie);
  assert.equal(supervisorResponse.status, 201, await supervisorResponse.clone().text());
  const supervisor = await supervisorResponse.json();

  const scenariosResponse = await call("/api/scenarios", {}, userCookie);
  const scenarios = await scenariosResponse.json();
  const scenario = scenarios[0];
  assert(scenario?.id);

  const evaluationResponse = await call("/api/rehearsals/evaluate", {
    method: "POST",
    body: body({ supervisorId: supervisor.id, scenarioId: scenario.id, inputText: "本周项目有一些进展，但客户反馈还需要继续跟进。", actionPlan: "明天下午补齐数据并同步。", clientRequestId: crypto.randomUUID() }),
  }, userCookie);
  assert.equal(evaluationResponse.status, 200, await evaluationResponse.clone().text());
  const evaluation = await evaluationResponse.json();
  assert.equal(evaluation.evaluation.mode, "demo");
  assert.equal(evaluation.usage.betaRemaining, 30);

  const feedback = await call(`/api/rehearsals/${evaluation.record.id}/feedback`, {
    method: "POST",
    body: body({ helpfulRating: 5, wouldUseAdvice: true, issueType: "", note: "建议具体，可以直接使用。" }),
  }, userCookie);
  assert.equal(feedback.status, 200, await feedback.clone().text());

  const debrief = await call(`/api/rehearsals/${evaluation.record.id}/debrief`, {
    method: "POST",
    body: body({ outcome: "领导确认了下一步安排", rating: 4, variance: "基本一致", nextAction: "按节点同步", adviceUsed: true, aiAccuracy: 4, continueUse: true }),
  }, userCookie);
  assert.equal(debrief.status, 200, await debrief.clone().text());

  const packages = await (await call("/api/packages", {}, userCookie)).json();
  const selected = packages.find((item: { code: string }) => item.code === "regular-100");
  assert.equal(selected.priceFen, 1000);
  const intentResponse = await call("/api/beta/intents", { method: "POST", body: body({ packageCode: selected.code, source: "http-smoke" }) }, userCookie);
  assert.equal(intentResponse.status, 201, await intentResponse.clone().text());
  const intent = await intentResponse.json();
  const confirm = await call("/api/beta/intents", { method: "PATCH", body: body({ id: intent.id, confirmed: true, reason: "价格可接受" }) }, userCookie);
  assert.equal(confirm.status, 200, await confirm.clone().text());

  const blockedOrder = await call("/api/orders", { method: "POST", body: body({ packageCode: selected.code }) }, userCookie);
  assert.equal(blockedOrder.status, 403);

  const adminLogin = await call("/api/admin/auth/login", {
    method: "POST",
    body: body({ username: process.env.ADMIN_USERNAME, password: process.env.ADMIN_INITIAL_PASSWORD }),
  });
  assert.equal(adminLogin.status, 200, await adminLogin.clone().text());
  const adminCookie = cookieFrom(adminLogin);
  const metricsResponse = await call("/api/admin/beta/metrics", {}, adminCookie);
  assert.equal(metricsResponse.status, 200, await metricsResponse.clone().text());
  const metricsText = await metricsResponse.text();
  assert(!metricsText.includes("inputText"));
  const metrics = JSON.parse(metricsText);
  assert(metrics.feedbackCount >= 1);
  assert(metrics.intentConfirmed >= 1);
  assert(metrics.debriefs >= 1);

  console.log("Public beta HTTP smoke test passed.");
}
main();
