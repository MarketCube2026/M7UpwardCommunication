import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { supervisorSchema } from "@/lib/schemas";
import { requireUser } from "@/lib/http";

export async function GET() { const auth = await requireUser(); if ("response" in auth) return auth.response; return NextResponse.json(await db.supervisor.findMany({ where: { userId: auth.user.id }, orderBy: { updatedAt: "desc" } })); }
export async function POST(request: Request) {
  const auth = await requireUser(); if ("response" in auth) return auth.response;
  const parsed = supervisorSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "输入无效" }, { status: 400 });
  const data = parsed.data;
  const record = await db.supervisor.create({ data: { userId: auth.user.id, ...data, tags: JSON.stringify(data.tags), communicationPrefs: JSON.stringify(data.communicationPrefs), workStyle: JSON.stringify(data.workStyle) } });
  return NextResponse.json(record, { status: 201 });
}
