import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/http";
import { recordEvent } from "@/lib/auth";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(); if ("response" in auth) return auth.response;
  const { id } = await context.params;
  const rehearsal = await db.rehearsal.findFirst({ where: { id, userId: auth.user.id } });
  if (!rehearsal) return NextResponse.json({ error: "记录不存在" }, { status: 404 });
  const body = await request.json();
  const helpfulRating = Number(body.helpfulRating);
  if (!Number.isInteger(helpfulRating) || helpfulRating < 1 || helpfulRating > 5) return NextResponse.json({ error: "请选择 1-5 分" }, { status: 400 });
  const data = {
    userId: auth.user.id,
    helpfulRating,
    wouldUseAdvice: typeof body.wouldUseAdvice === "boolean" ? body.wouldUseAdvice : null,
    issueType: body.issueType ? String(body.issueType).slice(0, 50) : null,
    note: body.note ? String(body.note).slice(0, 1000) : null,
  };
  const feedback = await db.evaluationFeedback.upsert({ where: { rehearsalId: id }, update: data, create: { ...data, rehearsalId: id } });
  await recordEvent("EVALUATION_FEEDBACK", auth.user.id, { rehearsalId: id, helpfulRating, wouldUseAdvice: data.wouldUseAdvice, issueType: data.issueType });
  return NextResponse.json(feedback);
}
