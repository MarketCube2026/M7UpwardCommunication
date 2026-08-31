import { NextResponse } from "next/server";
import { issueUserSession, recordEvent } from "@/lib/auth";
import { isPublicBeta, verifyBetaPassword } from "@/lib/beta";

export async function POST(request: Request) {
  if (!isPublicBeta()) return NextResponse.json({ error: "当前未启用密码登录" }, { status: 404 });
  const body = await request.json();
  const user = await verifyBetaPassword(String(body.phone ?? ""), String(body.password ?? ""));
  if (!user) return NextResponse.json({ error: "手机号或密码不正确" }, { status: 401 });
  await issueUserSession(user.id);
  await recordEvent("LOGIN", user.id, { method: "beta_password" });
  return NextResponse.json({ user: { id: user.id, phone: user.phone, nickname: user.nickname } });
}
