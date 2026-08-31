import { Prisma } from "@prisma/client";
import { db } from "./db";

const DEFAULT_FREE_LIMIT = 3;

export function shanghaiDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

async function freeLimit(client: Prisma.TransactionClient | typeof db = db) {
  const setting = await client.systemSetting.findUnique({ where: { key: "dailyFreeLimit" } });
  return Math.max(0, Number(setting?.value ?? DEFAULT_FREE_LIMIT) || DEFAULT_FREE_LIMIT);
}

async function paidBalance(userId: string, client: Prisma.TransactionClient | typeof db = db) {
  const aggregate = await client.creditLot.aggregate({ where: { userId }, _sum: { remaining: true } });
  return aggregate._sum.remaining ?? 0;
}

export async function usageSummary(userId: string) {
  const dateKey = shanghaiDateKey();
  const [limit, quota, paidRemaining] = await Promise.all([
    freeLimit(),
    db.dailyQuota.findUnique({ where: { userId_dateKey: { userId, dateKey } } }),
    paidBalance(userId),
  ]);
  const freeRemainingToday = Math.max(0, limit - (quota?.used ?? 0) - (quota?.reserved ?? 0));
  return { dateKey, dailyFreeLimit: limit, freeRemainingToday, paidRemaining, totalRemaining: freeRemainingToday + paidRemaining };
}

export type Reservation = { attemptId: string; chargeSource: "FREE" | "PAID"; existingRehearsalId?: string };

export async function reserveUsage(userId: string, clientRequestId: string): Promise<Reservation> {
  return db.$transaction(async (tx) => {
    const existing = await tx.usageAttempt.findUnique({ where: { userId_clientRequestId: { userId, clientRequestId } } });
    if (existing) {
      if (existing.rehearsalId) return { attemptId: existing.id, chargeSource: existing.chargeSource as "FREE" | "PAID", existingRehearsalId: existing.rehearsalId };
      throw Object.assign(new Error("请求正在处理中，请稍候"), { code: "REQUEST_IN_PROGRESS" });
    }
    const dateKey = shanghaiDateKey();
    const limit = await freeLimit(tx);
    const quota = await tx.dailyQuota.upsert({ where: { userId_dateKey: { userId, dateKey } }, update: {}, create: { userId, dateKey } });
    if (quota.used + quota.reserved < limit) {
      const updated = await tx.dailyQuota.update({ where: { id: quota.id }, data: { reserved: { increment: 1 } } });
      const attempt = await tx.usageAttempt.create({ data: { userId, clientRequestId, chargeSource: "FREE", dailyQuotaId: updated.id } });
      return { attemptId: attempt.id, chargeSource: "FREE" };
    }
    const lot = await tx.creditLot.findFirst({ where: { userId, remaining: { gt: 0 } }, orderBy: { createdAt: "asc" } });
    if (!lot) throw Object.assign(new Error("次数不足，请先购买套餐"), { code: "INSUFFICIENT_CREDITS" });
    await tx.creditLot.update({ where: { id: lot.id }, data: { remaining: { decrement: 1 } } });
    const attempt = await tx.usageAttempt.create({ data: { userId, clientRequestId, chargeSource: "PAID", creditLotId: lot.id } });
    const balanceAfter = await paidBalance(userId, tx);
    await tx.creditLedger.create({ data: { userId, type: "EVALUATION_RESERVE", delta: -1, balanceAfter, creditLotId: lot.id, usageAttemptId: attempt.id, reason: "评估次数预占" } });
    return { attemptId: attempt.id, chargeSource: "PAID" };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function finalizeUsage(attemptId: string, rehearsalId: string, usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number }) {
  await db.$transaction(async (tx) => {
    const attempt = await tx.usageAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    if (attempt.status !== "PENDING") return;
    if (attempt.chargeSource === "FREE" && attempt.dailyQuotaId) {
      await tx.dailyQuota.update({ where: { id: attempt.dailyQuotaId }, data: { reserved: { decrement: 1 }, used: { increment: 1 } } });
    }
    await tx.usageAttempt.update({ where: { id: attemptId }, data: { status: "SUCCEEDED", rehearsalId, promptTokens: usage?.promptTokens, completionTokens: usage?.completionTokens, totalTokens: usage?.totalTokens } });
  });
}

export async function releaseUsage(attemptId: string, errorCode: string, rehearsalId?: string) {
  await db.$transaction(async (tx) => {
    const attempt = await tx.usageAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt || attempt.status !== "PENDING") return;
    if (attempt.chargeSource === "FREE" && attempt.dailyQuotaId) {
      await tx.dailyQuota.update({ where: { id: attempt.dailyQuotaId }, data: { reserved: { decrement: 1 } } });
    }
    if (attempt.chargeSource === "PAID" && attempt.creditLotId) {
      await tx.creditLot.update({ where: { id: attempt.creditLotId }, data: { remaining: { increment: 1 } } });
      const balanceAfter = await paidBalance(attempt.userId, tx);
      await tx.creditLedger.create({ data: { userId: attempt.userId, type: "EVALUATION_RELEASE", delta: 1, balanceAfter, creditLotId: attempt.creditLotId, usageAttemptId: attempt.id, reason: errorCode } });
    }
    await tx.usageAttempt.update({ where: { id: attemptId }, data: { status: rehearsalId ? "RELEASED" : "FAILED", errorCode, rehearsalId } });
  });
}

export async function createOrder(userId: string, packageCode: string) {
  const item = await db.package.findFirst({ where: { code: packageCode, active: true, priceFen: { gt: 0 } } });
  if (!item) throw new Error("套餐不存在或已下架");
  return db.order.create({ data: { userId, packageId: item.id, packageCode: item.code, packageName: item.name, credits: item.credits, amountFen: item.priceFen } });
}

export async function payMockOrder(userId: string, orderId: string) {
  return db.$transaction(async (tx) => {
    const order = await tx.order.findFirst({ where: { id: orderId, userId } });
    if (!order) throw new Error("订单不存在");
    if (order.status === "PAID") return order;
    if (order.status !== "CREATED") throw new Error("订单状态不可支付");
    const paid = await tx.order.update({ where: { id: order.id }, data: { status: "PAID", provider: "MOCK", providerOrderId: `mock-${order.id}`, paidAt: new Date() } });
    const lot = await tx.creditLot.create({ data: { userId, orderId: order.id, creditsInitial: order.credits, remaining: order.credits, source: "PURCHASE" } });
    const balanceAfter = await paidBalance(userId, tx);
    await tx.creditLedger.create({ data: { userId, type: "PURCHASE", delta: order.credits, balanceAfter, orderId: order.id, creditLotId: lot.id, reason: `购买${order.packageName}` } });
    return paid;
  });
}

export async function adjustCredits(userId: string, delta: number, reason: string) {
  if (!Number.isInteger(delta) || delta === 0) throw new Error("调整次数必须为非零整数");
  return db.$transaction(async (tx) => {
    if (delta > 0) await tx.creditLot.create({ data: { userId, creditsInitial: delta, remaining: delta, source: "ADMIN" } });
    else {
      let needed = -delta;
      const lots = await tx.creditLot.findMany({ where: { userId, remaining: { gt: 0 } }, orderBy: { createdAt: "asc" } });
      if (lots.reduce((sum, lot) => sum + lot.remaining, 0) < needed) throw new Error("用户余额不足，不能扣成负数");
      for (const lot of lots) {
        if (!needed) break;
        const take = Math.min(needed, lot.remaining);
        await tx.creditLot.update({ where: { id: lot.id }, data: { remaining: { decrement: take } } });
        needed -= take;
      }
    }
    const balanceAfter = await paidBalance(userId, tx);
    await tx.creditLedger.create({ data: { userId, type: "ADMIN_ADJUSTMENT", delta, balanceAfter, reason } });
    return balanceAfter;
  });
}
