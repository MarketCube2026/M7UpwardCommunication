import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { scenarioSchema } from "@/lib/schemas";
export async function GET() { return NextResponse.json(await db.scenario.findMany({ orderBy: [{ builtin: "desc" }, { createdAt: "asc" }] })); }
export async function POST(request: Request) {
  const parsed = scenarioSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "场景内容不正确" }, { status: 400 });
  const { name, description, referenceTemplate } = parsed.data;
  return NextResponse.json(await db.scenario.create({ data: { name, description: description || null, referenceTemplate: referenceTemplate || null } }), { status: 201 });
}
