import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/http";
import { createBetaInvite } from "@/lib/beta";

export async function GET() {
  const auth = await requireAdmin(); if ("response" in auth) return auth.response;
  return NextResponse.json(await db.betaInvite.findMany({ include: { user: { select: { id: true, phone: true, nickname: true, status: true } } }, orderBy: { createdAt: "desc" }, take: 100 }));
}

export async function POST(request: Request) {
  const auth = await requireAdmin(); if ("response" in auth) return auth.response;
  const body = await request.json();
  try {
    const { invite, token } = await createBetaInvite({ phone: body.phone, note: body.note, grantCredits: body.grantCredits ? Number(body.grantCredits) : undefined });
    await db.adminAuditLog.create({ data: { adminId: auth.admin.id, action: "create_beta_invite", targetType: "BetaInvite", targetId: invite.id, afterJson: JSON.stringify({ phone: invite.phone, grantCredits: invite.grantCredits, expiresAt: invite.expiresAt }), reason: invite.note } });
    return NextResponse.json({ ...invite, activationPath: `/invite/${token}` }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "创建邀请失败" }, { status: 400 });
  }
}
