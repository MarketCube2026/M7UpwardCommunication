import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/http";
import { isPublicBeta } from "@/lib/beta";
import { recordEvent } from "@/lib/auth";

export async function POST(request: Request) {
  const auth = await requireUser(); if ("response" in auth) return auth.response;
  if (!isPublicBeta()) return NextResponse.json({ error: "内测意向功能未启用" }, { status: 404 });
  const body = await request.json();
  const item = await db.package.findFirst({ where: { code: String(body.packageCode ?? ""), active: true, priceFen: { gt: 0 } } });
  if (!item) return NextResponse.json({ error: "套餐不存在或已下架" }, { status: 404 });
  const intent = await db.betaPurchaseIntent.create({ data: { userId: auth.user.id, packageCode: item.code, packageName: item.name, amountFen: item.priceFen, source: String(body.source ?? "pricing").slice(0, 40) } });
  await recordEvent("BETA_PRICE_CLICK", auth.user.id, { intentId: intent.id, packageCode: item.code, amountFen: item.priceFen });
  return NextResponse.json(intent, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireUser(); if ("response" in auth) return auth.response;
  if (!isPublicBeta()) return NextResponse.json({ error: "内测意向功能未启用" }, { status: 404 });
  const body = await request.json();
  const intent = await db.betaPurchaseIntent.findFirst({ where: { id: String(body.id ?? ""), userId: auth.user.id } });
  if (!intent) return NextResponse.json({ error: "意向记录不存在" }, { status: 404 });
  const confirmed = body.confirmed === true;
  const updated = await db.betaPurchaseIntent.update({ where: { id: intent.id }, data: { confirmedAt: confirmed ? new Date() : null, reason: body.reason ? String(body.reason).slice(0, 300) : null } });
  await recordEvent(confirmed ? "BETA_PRICE_CONFIRMED" : "BETA_PRICE_DECLINED", auth.user.id, { intentId: intent.id, packageCode: intent.packageCode, reason: updated.reason });
  return NextResponse.json(updated);
}
