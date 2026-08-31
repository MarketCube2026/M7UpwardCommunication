import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashSecret, issueUserSession, normalizePhone, recordEvent } from "@/lib/auth";
import { isPublicBeta } from "@/lib/beta";

export async function POST(request: Request) {
  const body = await request.json();
  if (isPublicBeta()) return NextResponse.json({ error: "本轮内测仅限邀请用户" }, { status: 403 });
  const phone = normalizePhone(String(body.phone ?? ""));
  const code = String(body.code ?? "").trim();
  if (!phone || !/^\d{6}$/.test(code)) return NextResponse.json({ error: "手机号或验证码格式不正确" }, { status: 400 });
  const challenge = await db.otpChallenge.findFirst({ where: { phone, consumedAt: null }, orderBy: { createdAt: "desc" } });
  if (!challenge || challenge.expiresAt <= new Date() || challenge.attempts >= 5) return NextResponse.json({ error: "验证码已失效，请重新获取" }, { status: 400 });
  const expected = hashSecret(`${phone}:${code}:${process.env.OTP_PEPPER || "local-development-only"}`);
  if (expected !== challenge.codeHash) {
    await db.otpChallenge.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } });
    return NextResponse.json({ error: "验证码不正确" }, { status: 400 });
  }
  const user = await db.user.upsert({ where: { phone }, update: { lastLoginAt: new Date() }, create: { phone, nickname: `用户${phone.slice(-4)}`, lastLoginAt: new Date() } });
  if (user.status !== "ACTIVE") return NextResponse.json({ error: "账号已被封禁" }, { status: 403 });
  await db.otpChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } });
  await issueUserSession(user.id);
  await recordEvent("LOGIN", user.id, { method: "otp" });
  return NextResponse.json({ user: { id: user.id, phone: user.phone, nickname: user.nickname } });
}
