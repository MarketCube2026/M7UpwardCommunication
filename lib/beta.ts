import { randomBytes } from "node:crypto";
import { compare, hash } from "bcryptjs";
import { db } from "./db";
import { hashSecret, normalizePhone } from "./auth";

export function isPublicBeta() {
  return process.env.PUBLIC_BETA_MODE === "true";
}

export function betaGrantCredits() {
  const value = Number(process.env.BETA_GRANT_CREDITS ?? 30);
  return Number.isInteger(value) && value > 0 ? value : 30;
}

export async function createBetaInvite(input: {
  phone?: string;
  note?: string;
  grantCredits?: number;
}) {
  const phone = input.phone?.trim() ? normalizePhone(input.phone) : null;
  if (input.phone?.trim() && !phone) throw new Error("手机号格式不正确");
  const grantCredits = input.grantCredits ?? betaGrantCredits();
  if (
    !Number.isInteger(grantCredits) ||
    grantCredits < 1 ||
    grantCredits > 1000
  )
    throw new Error("赠送次数应为 1-1000");
  if (phone) {
    const existing = await db.betaInvite.findFirst({ where: { phone } });
    if (existing && existing.status === "PENDING")
      throw new Error("该手机号已有待使用邀请");
  }
  const token = randomBytes(32).toString("base64url");
  const invite = await db.betaInvite.create({
    data: {
      tokenHash: hashSecret(token),
      phone,
      note: input.note?.trim() || null,
      grantCredits,
      expiresAt: new Date(Date.now() + 14 * 86400000),
    },
  });
  return { invite, token };
}

export async function activateBetaInvite(input: {
  token: string;
  phone: string;
  nickname?: string;
  password: string;
}) {
  const phone = normalizePhone(input.phone);
  if (!phone) throw new Error("请输入正确的中国大陆手机号");
  if (input.password.length < 8 || input.password.length > 72)
    throw new Error("密码需为 8-72 个字符");
  const passwordHash = await hash(input.password, 12);
  return db.$transaction(async (tx) => {
    const invite = await tx.betaInvite.findUnique({
      where: { tokenHash: hashSecret(input.token) },
    });
    if (
      !invite ||
      invite.status !== "PENDING" ||
      invite.expiresAt <= new Date()
    )
      throw new Error("邀请链接无效或已过期");
    if (invite.phone && invite.phone !== phone)
      throw new Error("手机号与邀请信息不一致");
    if (await tx.user.findUnique({ where: { phone } }))
      throw new Error("该手机号已存在，请直接登录或联系管理员");
    const now = new Date();
    const user = await tx.user.create({
      data: {
        phone,
        nickname:
          input.nickname?.trim().slice(0, 30) || `内测用户${phone.slice(-4)}`,
        passwordHash,
        betaJoinedAt: now,
        lastLoginAt: now,
      },
    });
    const lot = await tx.creditLot.create({
      data: {
        userId: user.id,
        creditsInitial: invite.grantCredits,
        remaining: invite.grantCredits,
        source: "BETA_GRANT",
      },
    });
    await tx.creditLedger.create({
      data: {
        userId: user.id,
        type: "BETA_GRANT",
        delta: invite.grantCredits,
        balanceAfter: invite.grantCredits,
        creditLotId: lot.id,
        reason: "公网内测邀请赠送",
      },
    });
    await tx.betaInvite.update({
      where: { id: invite.id },
      data: { status: "ACTIVATED", activatedAt: now, userId: user.id, phone },
    });
    return user;
  });
}

export async function verifyBetaPassword(phoneValue: string, password: string) {
  const phone = normalizePhone(phoneValue);
  if (!phone) return null;
  const user = await db.user.findUnique({ where: { phone } });
  if (!user?.passwordHash || user.status !== "ACTIVE") return null;
  return (await compare(password, user.passwordHash)) ? user : null;
}

export async function grantBetaCredits(
  userId: string,
  credits: number,
  reason: string,
) {
  if (!Number.isInteger(credits) || credits < 1 || credits > 1000)
    throw new Error("赠送次数应为 1-1000");
  return db.$transaction(async (tx) => {
    const lot = await tx.creditLot.create({
      data: {
        userId,
        creditsInitial: credits,
        remaining: credits,
        source: "BETA_GRANT",
      },
    });
    const balance = await tx.creditLot.aggregate({
      where: { userId },
      _sum: { remaining: true },
    });
    await tx.creditLedger.create({
      data: {
        userId,
        type: "BETA_GRANT",
        delta: credits,
        balanceAfter: balance._sum.remaining ?? credits,
        creditLotId: lot.id,
        reason,
      },
    });
    return lot;
  });
}

export async function revokeBetaInvite(id: string) {
  const invite = await db.betaInvite.findUnique({ where: { id } });
  if (!invite || invite.status !== "PENDING")
    throw new Error("只能停用尚未激活的邀请");
  return db.betaInvite.update({
    where: { id },
    data: { status: "REVOKED", revokedAt: new Date() },
  });
}
