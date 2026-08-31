import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rehearsalSchema } from "@/lib/schemas";
import { evaluateRehearsal } from "@/lib/ai";
export async function POST(request: Request) {
  const parsed = rehearsalSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "请输入完整内容" }, { status: 400 });
  const input = parsed.data;
  const [supervisor, scenario] = await Promise.all([db.supervisor.findUnique({ where: { id: input.supervisorId } }), db.scenario.findUnique({ where: { id: input.scenarioId } })]);
  if (!supervisor || !scenario) return NextResponse.json({ error: "上级或场景不存在" }, { status: 404 });
  const supervisorView = { ...supervisor, tags: JSON.parse(supervisor.tags), communicationPrefs: JSON.parse(supervisor.communicationPrefs), workStyle: JSON.parse(supervisor.workStyle) };
  const evaluation = await evaluateRehearsal({ ...input, supervisor: supervisorView, scenario });
  const record = await db.rehearsal.create({ data: { supervisorId: supervisor.id, scenarioId: scenario.id, scenarioName: scenario.name, supervisorSnapshot: JSON.stringify(supervisorView), inputText: input.inputText, actionPlan: input.actionPlan ?? null, evaluation: JSON.stringify(evaluation), mode: evaluation.mode }, include: { supervisor: true, scenario: true } });
  return NextResponse.json({ ...record, evaluation });
}
