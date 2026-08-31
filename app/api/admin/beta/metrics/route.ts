import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/http";

export async function GET() {
  const auth = await requireAdmin(); if ("response" in auth) return auth.response;
  const betaUsers = await db.user.findMany({ where: { betaJoinedAt: { not: null } }, select: { id: true, betaJoinedAt: true } });
  const userIds = betaUsers.map((user) => user.id);
  const [invited, activated, evaluators, evaluationCount, feedbacks, intents, debriefs, events] = await Promise.all([
    db.betaInvite.count(),
    db.betaInvite.count({ where: { status: "ACTIVATED" } }),
    db.rehearsal.findMany({ where: { userId: { in: userIds } }, distinct: ["userId"], select: { userId: true } }),
    db.rehearsal.count({ where: { userId: { in: userIds } } }),
    db.evaluationFeedback.findMany({ where: { userId: { in: userIds } }, select: { helpfulRating: true, wouldUseAdvice: true, issueType: true } }),
    db.betaPurchaseIntent.findMany({ where: { userId: { in: userIds } }, select: { packageCode: true, packageName: true, confirmedAt: true, reason: true } }),
    db.debrief.count({ where: { userId: { in: userIds } } }),
    db.analyticsEvent.findMany({ where: { userId: { in: userIds }, createdAt: { gte: new Date(Date.now() - 7 * 86400000) } }, select: { userId: true, createdAt: true } }),
  ]);
  const quality4Plus = feedbacks.filter((item) => item.helpfulRating >= 4).length;
  const packageMap = new Map<string, { name: string; clicks: number; confirmed: number }>();
  for (const item of intents) {
    const current = packageMap.get(item.packageCode) ?? { name: item.packageName, clicks: 0, confirmed: 0 };
    current.clicks += 1; if (item.confirmedAt) current.confirmed += 1; packageMap.set(item.packageCode, current);
  }
  const daily = new Map<string, Set<string>>();
  for (const event of events) {
    if (!event.userId) continue;
    const day = event.createdAt.toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
    if (!daily.has(day)) daily.set(day, new Set()); daily.get(day)!.add(event.userId);
  }
  return NextResponse.json({
    invited, activated, activationRate: invited ? Math.round(activated / invited * 1000) / 10 : 0,
    evaluators: evaluators.length, evaluationCount,
    feedbackCount: feedbacks.length, quality4PlusRate: feedbacks.length ? Math.round(quality4Plus / feedbacks.length * 1000) / 10 : 0,
    adoptionRate: feedbacks.length ? Math.round(feedbacks.filter((item) => item.wouldUseAdvice).length / feedbacks.length * 1000) / 10 : 0,
    debriefs, debriefRate: evaluationCount ? Math.round(debriefs / evaluationCount * 1000) / 10 : 0,
    intentClicks: intents.length, intentConfirmed: intents.filter((item) => item.confirmedAt).length,
    packages: [...packageMap.entries()].map(([code, value]) => ({ code, ...value })),
    dailyActive: [...daily.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, users]) => ({ date, users: users.size })),
  });
}
