import "dotenv/config";
import { randomUUID } from "node:crypto";
import { db } from "../lib/db";
import { payMockOrder, reserveUsage, finalizeUsage, releaseUsage, usageSummary } from "../lib/billing";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  const suffix = Date.now().toString().slice(-9);
  const phone = `+86157${suffix.slice(-8)}`;
  const user = await db.user.create({ data: { phone, nickname: "商业化验收临时用户" } });
  let supervisorId = "";
  let scenarioId = "";
  try {
    const supervisor = await db.supervisor.create({ data: { userId: user.id, name: "验收领导" } });
    const scenario = await db.scenario.create({ data: { ownerUserId: user.id, name: "验收场景" } });
    supervisorId = supervisor.id;
    scenarioId = scenario.id;

    for (let index = 0; index < 3; index += 1) {
      const reservation = await reserveUsage(user.id, randomUUID());
      assert(reservation.chargeSource === "FREE", `第 ${index + 1} 次应使用免费额度`);
      const rehearsal = await db.rehearsal.create({ data: { userId: user.id, supervisorId, scenarioId, scenarioName: scenario.name, supervisorSnapshot: "{}", inputText: "验收话术", evaluation: "{}", mode: "ai" } });
      await finalizeUsage(reservation.attemptId, rehearsal.id, { totalTokens: 10 });
    }
    const afterFree = await usageSummary(user.id);
    assert(afterFree.freeRemainingToday === 0, "三次免费额度应全部用完");
    await reserveUsage(user.id, randomUUID()).then(() => { throw new Error("免费额度耗尽后应返回余额不足"); }).catch((error) => assert(error.code === "INSUFFICIENT_CREDITS", "余额不足错误码不正确"));

    const packageItem = await db.package.findUniqueOrThrow({ where: { code: "trial-20" } });
    const order = await db.order.create({ data: { userId: user.id, packageId: packageItem.id, packageCode: packageItem.code, packageName: packageItem.name, credits: packageItem.credits, amountFen: packageItem.priceFen } });
    const paid = await payMockOrder(user.id, order.id);
    await payMockOrder(user.id, order.id);
    const lots = await db.creditLot.findMany({ where: { orderId: order.id } });
    assert(paid.status === "PAID" && lots.length === 1, "重复支付不得重复创建次数包");

    const paidRequestId = randomUUID();
    const paidReservation = await reserveUsage(user.id, paidRequestId);
    assert(paidReservation.chargeSource === "PAID", "第四次应使用付费次数");
    await releaseUsage(paidReservation.attemptId, "TEST_RELEASE");
    const afterRelease = await usageSummary(user.id);
    assert(afterRelease.paidRemaining === packageItem.credits, "失败返还后付费余额应恢复");

    const finalReservation = await reserveUsage(user.id, randomUUID());
    const finalRehearsal = await db.rehearsal.create({ data: { userId: user.id, supervisorId, scenarioId, scenarioName: scenario.name, supervisorSnapshot: "{}", inputText: "付费验收话术", evaluation: "{}", mode: "ai" } });
    await finalizeUsage(finalReservation.attemptId, finalRehearsal.id);
    const afterPaid = await usageSummary(user.id);
    assert(afterPaid.paidRemaining === packageItem.credits - 1, "成功评估应扣除一次付费余额");

    const duplicate = await reserveUsage(user.id, "idempotent-test");
    const duplicateRehearsal = await db.rehearsal.create({ data: { userId: user.id, supervisorId, scenarioId, scenarioName: scenario.name, supervisorSnapshot: "{}", inputText: "幂等话术", evaluation: "{}", mode: "ai" } });
    await finalizeUsage(duplicate.attemptId, duplicateRehearsal.id);
    const replay = await reserveUsage(user.id, "idempotent-test");
    assert(replay.existingRehearsalId === duplicateRehearsal.id, "相同 clientRequestId 应返回同一演练");

    const other = await db.user.create({ data: { phone: `+86158${suffix.slice(-8)}`, nickname: "隔离验收用户" } });
    const ownCount = await db.supervisor.count({ where: { userId: user.id } });
    const otherCount = await db.supervisor.count({ where: { userId: other.id } });
    assert(ownCount > 0 && otherCount === 0, "用户画像应按用户隔离");
    await db.user.delete({ where: { id: other.id } });

    console.log("Commercial smoke tests passed.");
  } finally {
    await db.rehearsal.deleteMany({ where: { userId: user.id } });
    await db.scenario.deleteMany({ where: { id: scenarioId } });
    await db.supervisor.deleteMany({ where: { id: supervisorId } });
    await db.usageAttempt.deleteMany({ where: { userId: user.id } });
    await db.creditLedger.deleteMany({ where: { userId: user.id } });
    await db.creditLot.deleteMany({ where: { userId: user.id } });
    await db.order.deleteMany({ where: { userId: user.id } });
    await db.dailyQuota.deleteMany({ where: { userId: user.id } });
    await db.user.deleteMany({ where: { id: user.id } });
    await db.$disconnect();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
