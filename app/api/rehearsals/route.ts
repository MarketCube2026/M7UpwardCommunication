import { NextResponse } from "next/server";
import { db } from "@/lib/db";
export async function GET(request: Request) { const url = new URL(request.url); const supervisorId = url.searchParams.get("supervisorId") ?? undefined; return NextResponse.json(await db.rehearsal.findMany({ where: supervisorId ? { supervisorId } : undefined, include: { supervisor: true, debrief: true }, orderBy: { createdAt: "desc" }, take: 50 })); }
