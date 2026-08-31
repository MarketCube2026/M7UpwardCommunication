import { NextResponse } from "next/server";
import { payMockOrder, usageSummary } from "@/lib/billing";
import { requireUser } from "@/lib/http";
import { recordEvent } from "@/lib/auth";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(); if ("response" in auth) return auth.response;
  try { const { id } = await context.params; const order = await payMockOrder(auth.user.id, id); await recordEvent("PURCHASE", auth.user.id, { orderId: id, amountFen: order.amountFen }); return NextResponse.json({ order, usage: await usageSummary(auth.user.id) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "支付失败" }, { status: 400 }); }
}
