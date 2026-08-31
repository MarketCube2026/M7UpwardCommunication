import { NextResponse } from "next/server";
import { db } from "@/lib/db";
export async function GET(_: Request, context: { params: Promise<{ id: string }> }) { const { id } = await context.params; const item = await db.rehearsal.findUnique({ where: { id }, include: { supervisor: true, scenario: true, debrief: true } }); return item ? NextResponse.json({ ...item, evaluation: JSON.parse(item.evaluation) }) : NextResponse.json({ error: "未找到演练记录" }, { status: 404 }); }
