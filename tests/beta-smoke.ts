import "dotenv/config";
import assert from "node:assert/strict";
import { db } from "../lib/db";
import { activateBetaInvite, createBetaInvite, verifyBetaPassword } from "../lib/beta";
import { finalizeUsage, releaseUsage, reserveUsage, usageSummary } from "../lib/billing";

async function main() {
  const phone = `+86188${String(Date.now()).slice(-8)}`;
  const password = "BetaTest!2026";
  const { invite, token } = await createBetaInvite({ phone, note: "automated-smoke", grantCredits: 30 });
  let userId: string | undefined;
  try {
    const user = await activateBetaInvite({ token, phone, nickname: "内测验收用户", password });
    userId = user.id;
    assert.equal((await verifyBetaPassword(phone, password))?.id, user.id);
    assert.equal(await verifyBetaPassword(phone, "wrong-password"), null);

    const supervisor = await db.supervisor.create({ data: { userId: user.id, name: "测试领导" } });
    const scenario = await db.scenario.create({ data: { ownerUserId: user.id, name: "内测测试场景" } });
    for (let index = 0; index < 4; index += 1) {
      const reservation = await reserveUsage(user.id, `beta-smoke-${Date.now()}-${index}`);
      const rehearsal = await db.rehearsal.create({
        data: {
          userId: user.id,
          supervisorId: supervisor.id,
          scenarioId: scenario.id,
          scenarioName: scenario.name,
          supervisorSnapshot: "{}",
          inputText: "测试话术",
          evaluation: "{}",
          mode: "ai",
        },
      });
      await finalizeUsage(reservation.attemptId, rehearsal.id);
      assert.equal(reservation.chargeSource, index < 3 ? "FREE" : "BETA");
    }
    let summary = await usageSummary(user.id);
    assert.equal(summary.freeRemainingToday, 0);
    assert.equal(summary.betaRemaining, 29);
    assert.equal(summary.paidRemaining, 0);

    const reservation = await reserveUsage(user.id, `beta-smoke-release-${Date.now()}`);
    assert.equal(reservation.chargeSource, "BETA");
    await releaseUsage(reservation.attemptId, "SMOKE_RELEASE");
    summary = await usageSummary(user.id);
    assert.equal(summary.betaRemaining, 29);

    const rehearsal = await db.rehearsal.findFirstOrThrow({ where: { userId: user.id } });
    await db.evaluationFeedback.create({ data: { userId: user.id, rehearsalId: rehearsal.id, helpfulRating: 5, wouldUseAdvice: true } });
    await db.debrief.create({ data: { userId: user.id, rehearsalId: rehearsal.id, outcome: "沟通顺利", adviceUsed: true, aiAccuracy: 4, continueUse: true } });
    const pkg = await db.package.findFirstOrThrow({ where: { code: "regular-100" } });
    await db.betaPurchaseIntent.create({ data: { userId: user.id, packageCode: pkg.code, packageName: pkg.name, amountFen: pkg.priceFen, confirmedAt: new Date() } });

    assert.equal(await db.evaluationFeedback.count({ where: { userId: user.id } }), 1);
    assert.equal(await db.betaPurchaseIntent.count({ where: { userId: user.id, confirmedAt: { not: null } } }), 1);
    console.log("Public beta smoke test passed.");
  } finally {
    if (userId) await db.user.delete({ where: { id: userId } }).catch(() => undefined);
    await db.betaInvite.delete({ where: { id: invite.id } }).catch(() => undefined);
  }
}

main().finally(() => db.$disconnect());
