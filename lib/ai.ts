import { evaluationSchema, type rehearsalSchema } from "./schemas";
import type { z } from "zod";

type RehearsalInput = z.infer<typeof rehearsalSchema> & { supervisor: Record<string, unknown>; scenario: Record<string, unknown> };
type TokenUsage = { promptTokens?: number; completionTokens?: number; totalTokens?: number };
export type EvaluationWithUsage = z.infer<typeof evaluationSchema> & { usage?: TokenUsage };

export const baselineRequirements = [
  "先讲结论：我怎么看、建议做什么、希望领导决定什么",
  "关键事实可验证：有口径、单位、时间范围和比较基准",
  "说清判断依据：区分已核实事实、假设、影响和紧迫程度",
  "给出推荐方案：说明收益、风险、取舍、边界和退出条件",
  "形成闭环：一个最终负责人、完成时间、验证方式和再次汇报点",
  "按复杂度选渠道：一般事项周报，较急事项即时沟通，复杂事项专题汇报",
  "守住质量、合规、交付和客户影响边界，不把原话当作自己的判断",
];

function demoEvaluation(input: RehearsalInput): EvaluationWithUsage {
  const hasPlan = Boolean(input.actionPlan?.trim());
  const hasStructure = /结果|数据|风险|下一步|计划|完成/.test(input.inputText);
  const baselineChecks = baselineRequirements.map((label, index) => ({ label, passed: index === 0 ? /结论|建议|希望|决定/.test(input.inputText) : index === 1 ? /数据|%|金额|天|周|月|同比|环比|基准/.test(input.inputText) : index === 2 ? /因为|依据|影响|风险|原因/.test(input.inputText) : index === 3 ? /方案|建议|选择|收益|成本|取舍/.test(input.inputText) : index === 4 ? hasPlan && /今天|明天|周五|负责人|同步|确认|完成/.test(`${input.inputText}${input.actionPlan ?? ""}`) : index === 5 ? true : /质量|合规|客户|交付|安全|边界/.test(input.inputText), note: "" }));
  return evaluationSchema.parse({
    styleMatchScore: 78,
    completenessScore: hasStructure ? 84 : 62,
    riskAlertScore: input.supervisor.taboos ? 72 : 88,
    behaviorScore: hasPlan ? 86 : 58,
    keyStrengths: ["已经表达了明确的沟通目的", hasPlan ? "行动计划体现了闭环意识" : "可以继续补充可执行的下一步"],
    riskAlerts: input.supervisor.taboos ? [`请避开画像中记录的敏感话题：${input.supervisor.taboos}`] : ["建议在开头先给结论，降低对方理解成本"],
    suggestions: ["先说结论，再补充关键事实和影响", "把下一步拆成负责人、时间点和验收标准"],
    rewrittenVersion: `结论：${input.inputText.slice(0, 160)}\n\n补充：当前影响是……，主要风险是……。\n下一步：我会在……前完成……，并在……节点同步结果。`,
    behaviorFeedback: hasPlan ? ["计划包含明确动作，继续保持主动同步。"] : ["建议补充主动动作、时间节点和风险预案。"],
    baselineChecks,
    mode: "demo",
  });
}

function tokenUsage(value: unknown): TokenUsage | undefined {
  if (!value || typeof value !== "object") return undefined;
  const source = value as Record<string, unknown>;
  const toNumber = (entry: unknown) => Number.isInteger(Number(entry)) && Number(entry) >= 0 ? Number(entry) : undefined;
  const promptTokens = toNumber(source.prompt_tokens);
  const completionTokens = toNumber(source.completion_tokens);
  const totalTokens = toNumber(source.total_tokens);
  return promptTokens === undefined && completionTokens === undefined && totalTokens === undefined ? undefined : { promptTokens, completionTokens, totalTokens };
}

function useDemoMode() {
  return process.env.NODE_ENV !== "production";
}

export async function evaluateRehearsal(input: RehearsalInput): Promise<EvaluationWithUsage> {
  const baseUrl = process.env.AI_BASE_URL?.trim();
  const apiKey = process.env.AI_API_KEY?.trim();
  const model = process.env.AI_MODEL?.trim();
  if (process.env.DEMO_MODE === "true") {
    if (useDemoMode()) return demoEvaluation(input);
    throw new Error("生产环境不允许使用演示评估");
  }
  if (!baseUrl || !apiKey || !model) {
    if (useDemoMode()) return demoEvaluation(input);
    throw new Error("AI 服务尚未配置");
  }

  const prompt = `你是向上沟通教练。请基于上级画像和场景评估用户话术。附件中的管理原则必须作为基本要求：${baselineRequirements.map((x, i) => `${i + 1}.${x}`).join("；")}。若场景包含参考模板，只借鉴其结构和表达方式，不照搬其中的具体事实、数据或承诺。只返回 JSON，字段严格为：styleMatchScore, completenessScore, riskAlertScore, behaviorScore, keyStrengths, riskAlerts, suggestions, rewrittenVersion, behaviorFeedback, baselineChecks。baselineChecks 必须是包含 label、passed、note 的 7 项数组，逐项对应上述要求。评分 0-100。上级画像：${JSON.stringify(input.supervisor)}。场景：${JSON.stringify(input.scenario)}。话术：${input.inputText}。行动计划：${input.actionPlan ?? "未填写"}`;
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model, temperature: 0.3, messages: [{ role: "user", content: prompt }] }), signal: AbortSignal.timeout(25000) });
    if (!response.ok) throw new Error(`AI request failed: ${response.status}`);
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    const text = String(content).replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    const parsed = JSON.parse(start >= 0 && end > start ? text.slice(start, end + 1) : text) as Record<string, unknown>;
    const number = (value: unknown, fallback: number) => { const parsedNumber = Number(value); return Number.isFinite(parsedNumber) ? Math.max(0, Math.min(100, parsedNumber)) : fallback; };
    const strings = (value: unknown) => Array.isArray(value) ? value.map(String) : value == null ? [] : [String(value)];
    const rewritten = Array.isArray(parsed.rewrittenVersion) ? parsed.rewrittenVersion.map(String).join("\n") : String(parsed.rewrittenVersion ?? "");
    const checks = Array.isArray(parsed.baselineChecks) ? parsed.baselineChecks.map((item, index) => { const value = (item as Record<string, unknown>)?.passed; return { label: baselineRequirements[index] ?? String((item as Record<string, unknown>)?.label ?? "基本要求"), passed: value === true || String(value).toLowerCase() === "true", note: String((item as Record<string, unknown>)?.note ?? "") }; }) : baselineRequirements.map((label) => ({ label, passed: false, note: "模型未返回逐项判断" }));
    const evaluation = evaluationSchema.parse({ ...parsed, styleMatchScore: number(parsed.styleMatchScore, 70), completenessScore: number(parsed.completenessScore, 70), riskAlertScore: number(parsed.riskAlertScore, 70), behaviorScore: parsed.behaviorScore == null ? undefined : number(parsed.behaviorScore, 70), keyStrengths: strings(parsed.keyStrengths), riskAlerts: strings(parsed.riskAlerts), suggestions: strings(parsed.suggestions), rewrittenVersion: rewritten, behaviorFeedback: strings(parsed.behaviorFeedback), baselineChecks: checks, mode: "ai" });
    return { ...evaluation, usage: tokenUsage(data.usage) };
  } catch (error) {
    if (!useDemoMode()) throw error;
    console.error("AI evaluation fallback:", error instanceof Error ? error.message : "unknown error");
    return demoEvaluation(input);
  }
}
