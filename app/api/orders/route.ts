import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createOrder } from "@/lib/billing";
import { requireUser } from "@/lib/http";

export async function GET() { const auth = await requireUser(); if ("response" in auth) return auth.response; return NextResponse.json(await db.order.findMany({ where: { userId: auth.user.id }, orderBy: { createdAt: "desc" }, take: 30 })); }
export async function POST(request: Request) {
  const auth = await requireUser(); if ("response" in auth) return auth.response;
  try { return NextResponse.json(await createOrder(auth.user.id, String((await request.json()).packageCode ?? "")), { status: 201 }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "创建订单失败" }, { status: 400 }); }
}
