import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/http";
import { grantBetaCredits, revokeBetaInvite } from "@/lib/beta";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(); if ("response" in auth) return auth.response;
  const { id } = await context.params;
  const body = await request.json();
  const reason = String(body.reason ?? "").trim();
  if (!reason) return NextResponse.json({ error: "请填写操作原因" }, { status: 400 });
  const invite = await db.betaInvite.findUnique({ where: { id } });
  if (!invite) return NextResponse.json({ error: "邀请不存在" }, { status: 404 });
  try {
    let result: unknown;
    if (body.action === "revoke") result = await revokeBetaInvite(id);
    else if (body.action === "grant" && invite.userId) result = await grantBetaCredits(invite.userId, Number(body.credits ?? 30), reason);
    else return NextResponse.json({ error: "当前邀请不支持该操作" }, { status: 400 });
    await db.adminAuditLog.create({ data: { adminId: auth.admin.id, action: `beta_invite_${String(body.action)}`, targetType: "BetaInvite", targetId: id, beforeJson: JSON.stringify({ status: invite.status, userId: invite.userId }), afterJson: JSON.stringify(result), reason } });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "操作失败" }, { status: 400 });
  }
}
