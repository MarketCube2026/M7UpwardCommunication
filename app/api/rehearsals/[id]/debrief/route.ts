import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/http";
import { recordEvent } from "@/lib/auth";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { id } = await context.params;
  const rehearsal = await db.rehearsal.findFirst({
    where: { id, userId: auth.user.id },
  });
  if (!rehearsal)
    return NextResponse.json({ error: "记录不存在" }, { status: 404 });
  const body = await request.json();
  const outcome = String(body.outcome ?? "").trim();
  if (!outcome)
    return NextResponse.json({ error: "请填写实际结果" }, { status: 400 });
  const aiAccuracy = body.aiAccuracy ? Number(body.aiAccuracy) : null;
  if (
    aiAccuracy !== null &&
    (!Number.isInteger(aiAccuracy) || aiAccuracy < 1 || aiAccuracy > 5)
  )
    return NextResponse.json(
      { error: "预测准确度应为 1-5 分" },
      { status: 400 },
    );
  const data = {
    outcome,
    rating: body.rating ? Number(body.rating) : null,
    variance: body.variance ? String(body.variance).slice(0, 1000) : null,
    nextAction: body.nextAction ? String(body.nextAction).slice(0, 1000) : null,
    adviceUsed: typeof body.adviceUsed === "boolean" ? body.adviceUsed : null,
    aiAccuracy,
    continueUse:
      typeof body.continueUse === "boolean" ? body.continueUse : null,
  };
  const item = await db.debrief.upsert({
    where: { rehearsalId: id },
    update: data,
    create: { userId: auth.user.id, rehearsalId: id, ...data },
  });
  await recordEvent("DEBRIEF_SAVED", auth.user.id, {
    rehearsalId: id,
    adviceUsed: data.adviceUsed,
    aiAccuracy,
    continueUse: data.continueUse,
  });
  return NextResponse.json(item);
}
