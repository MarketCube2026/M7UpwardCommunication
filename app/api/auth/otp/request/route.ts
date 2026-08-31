import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashSecret, normalizePhone } from "@/lib/auth";
import { requestIp } from "@/lib/http";
import { isPublicBeta } from "@/lib/beta";

function canExposeDevCode() {
  return process.env.NODE_ENV !== "production" || process.env.LOCAL_AUTH_MODE === "true";
}

export async function POST(request: Request) {
  const phone = normalizePhone(String((await request.json()).phone ?? ""));
  if (isPublicBeta()) return NextResponse.json({ error: "本轮内测仅限邀请用户，请使用邀请链接激活账号" }, { status: 403 });
  if (!phone) return NextResponse.json({ error: "请输入正确的中国大陆手机号" }, { status: 400 });
  const latest = await db.otpChallenge.findFirst({ where: { phone }, orderBy: { createdAt: "desc" } });
  if (latest && Date.now() - latest.createdAt.getTime() < 60000) return NextResponse.json({ error: "验证码发送过于频繁，请稍后再试" }, { status: 429 });
  const since = new Date(Date.now() - 15 * 60000);
  if (await db.otpChallenge.count({ where: { phone, createdAt: { gte: since } } }) >= 5) return NextResponse.json({ error: "请求次数过多，请15分钟后再试" }, { status: 429 });
  const code = String(randomInt(100000, 1000000));
  const pepper = process.env.OTP_PEPPER || "local-development-only";
  const challenge = await db.otpChallenge.create({ data: { phone, codeHash: hashSecret(`${phone}:${code}:${pepper}`), expiresAt: new Date(Date.now() + 5 * 60000), requestedIp: requestIp(request) } });
  return NextResponse.json({ challengeId: challenge.id, expiresIn: 300, devCode: canExposeDevCode() ? code : undefined });
}
