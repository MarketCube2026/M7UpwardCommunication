import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rehearsalSchema } from "@/lib/schemas";
import { evaluateRehearsal } from "@/lib/ai";
import { requireUser } from "@/lib/http";
import { finalizeUsage, releaseUsage, reserveUsage, usageSummary } from "@/lib/billing";
import { recordEvent } from "@/lib/auth";

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const body = await request.json();
  const parsed = rehearsalSchema.safeParse(body);
  const clientRequestId = String(body.clientRequestId ?? "");
  if (!parsed.success || !clientRequestId) return NextResponse.json({ error: parsed.success ? "缺少请求标识" : parsed.error.issues[0]?.message ?? "请输入完整内容" }, { status: 400 });
  const input = parsed.data;
  const [supervisor, scenario] = await Promise.all([
    db.supervisor.findFirst({ where: { id: input.supervisorId, userId: auth.user.id } }),
    db.scenario.findFirst({ where: { id: input.scenarioId, active: true, OR: [{ builtin: true }, { ownerUserId: null }, { ownerUserId: auth.user.id }] } }),
  ]);
  if (!supervisor || !scenario) return NextResponse.json({ error: "上级或场景不存在" }, { status: 404 });

  let reservation;
  try {
    reservation = await reserveUsage(auth.user.id, clientRequestId);
  } catch (error) {
    const code = (error as { code?: string }).code;
    return NextResponse.json({ error: error instanceof Error ? error.message : "次数预占失败", code }, { status: code === "INSUFFICIENT_CREDITS" ? 402 : 409 });
  }
  if (reservation.existingRehearsalId) {
    const existing = await db.rehearsal.findFirst({ where: { id: reservation.existingRehearsalId, userId: auth.user.id }, include: { supervisor: true } });
    if (existing) {
      const evaluation = JSON.parse(existing.evaluation);
      return NextResponse.json({ record: existing, rehearsal: existing, evaluation, usage: await usageSummary(auth.user.id), clientRequestId });
    }
  }

  try {
    const supervisorView = { ...supervisor, tags: JSON.parse(supervisor.tags), communicationPrefs: JSON.parse(supervisor.communicationPrefs), workStyle: JSON.parse(supervisor.workStyle) };
    const rawEvaluation = await evaluateRehearsal({ ...input, supervisor: supervisorView, scenario });
    const { usage: tokenUsage, ...evaluation } = rawEvaluation;
    const record = await db.rehearsal.create({ data: { userId: auth.user.id, supervisorId: supervisor.id, scenarioId: scenario.id, scenarioName: scenario.name, supervisorSnapshot: JSON.stringify(supervisorView), inputText: input.inputText, actionPlan: input.actionPlan ?? null, evaluation: JSON.stringify(evaluation), mode: evaluation.mode }, include: { supervisor: true, scenario: true } });
    if (evaluation.mode === "ai") await finalizeUsage(reservation.attemptId, record.id, tokenUsage);
    else await releaseUsage(reservation.attemptId, "DEMO_MODE", record.id);
    await recordEvent(evaluation.mode === "ai" ? "EVALUATION_SUCCESS" : "EVALUATION_DEMO", auth.user.id, { scenarioId: scenario.id, rehearsalId: record.id });
    return NextResponse.json({ record, rehearsal: record, evaluation, usage: await usageSummary(auth.user.id), clientRequestId });
  } catch (error) {
    await releaseUsage(reservation.attemptId, "EVALUATION_FAILED");
    return NextResponse.json({ error: "本次评估未完成，次数已返还，请重试", code: "EVALUATION_FAILED" }, { status: 502 });
  }
}
