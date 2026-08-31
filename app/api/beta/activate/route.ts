import { NextResponse } from "next/server";
import { activateBetaInvite, isPublicBeta } from "@/lib/beta";
import { issueUserSession, recordEvent } from "@/lib/auth";

export async function POST(request: Request) {
  if (!isPublicBeta()) return NextResponse.json({ error: "当前未开放邀请激活" }, { status: 404 });
  const body = await request.json();
  if (body.agreed !== true) return NextResponse.json({ error: "请先同意服务协议、隐私说明与 AI 使用告知" }, { status: 400 });
  try {
    const user = await activateBetaInvite({
      token: String(body.token ?? ""),
      phone: String(body.phone ?? ""),
      nickname: String(body.nickname ?? ""),
      password: String(body.password ?? ""),
    });
    await issueUserSession(user.id);
    await recordEvent("BETA_ACTIVATED", user.id, { method: "invite" });
    return NextResponse.json({ user: { id: user.id, phone: user.phone, nickname: user.nickname } }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "邀请激活失败" }, { status: 400 });
  }
}
