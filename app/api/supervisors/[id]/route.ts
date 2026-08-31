import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { supervisorSchema } from "@/lib/schemas";

type Context = { params: Promise<{ id: string }> };
export async function GET(_: Request, context: Context) { const { id } = await context.params; const item = await db.supervisor.findUnique({ where: { id }, include: { rehearsals: { orderBy: { createdAt: "desc" }, take: 10 } } }); return item ? NextResponse.json(item) : NextResponse.json({ error: "未找到档案" }, { status: 404 }); }
export async function PATCH(request: Request, context: Context) { const { id } = await context.params; const parsed = supervisorSchema.partial().safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ error: "输入无效" }, { status: 400 }); const data = parsed.data; const update: Record<string, unknown> = {}; for (const key of ["name", "position", "relation", "taboos", "notes"] as const) if (data[key] !== undefined) update[key] = data[key]; if (data.tags !== undefined) update.tags = JSON.stringify(data.tags); if (data.communicationPrefs !== undefined) update.communicationPrefs = JSON.stringify(data.communicationPrefs); if (data.workStyle !== undefined) update.workStyle = JSON.stringify(data.workStyle); const record = await db.supervisor.update({ where: { id }, data: update }); return NextResponse.json(record); }
export async function DELETE(_: Request, context: Context) { const { id } = await context.params; await db.supervisor.delete({ where: { id } }); return NextResponse.json({ ok: true }); }
