import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/http";

type ContentKind = "scenario" | "tag" | "tip";

function kindOf(value: unknown): ContentKind | null {
  return value === "scenario" || value === "tag" || value === "tip" ? value : null;
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const body = await request.json();
  const kind = kindOf(body.kind);
  const id = String(body.id ?? "");
  const direction = body.direction === "up" || body.direction === "down" ? body.direction : null;
  if (!kind || !id || !direction) return NextResponse.json({ error: "排序参数不完整" }, { status: 400 });

  const orderBy = [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }];
  const items = kind === "scenario"
    ? await db.scenario.findMany({ where: { ownerUserId: null }, orderBy })
    : kind === "tag"
      ? await db.personalityTag.findMany({ orderBy })
      : await db.dailyTip.findMany({ orderBy });
  const index = items.findIndex((item) => item.id === id);
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (index < 0) return NextResponse.json({ error: "内容不存在" }, { status: 404 });
  if (targetIndex < 0 || targetIndex >= items.length) return NextResponse.json({ ok: true, unchanged: true });

  const current = items[index];
  const target = items[targetIndex];
  await db.$transaction(async (tx) => {
    if (kind === "scenario") {
      await tx.scenario.update({ where: { id: current.id }, data: { sortOrder: target.sortOrder } });
      await tx.scenario.update({ where: { id: target.id }, data: { sortOrder: current.sortOrder } });
    } else if (kind === "tag") {
      await tx.personalityTag.update({ where: { id: current.id }, data: { sortOrder: target.sortOrder } });
      await tx.personalityTag.update({ where: { id: target.id }, data: { sortOrder: current.sortOrder } });
    } else {
      await tx.dailyTip.update({ where: { id: current.id }, data: { sortOrder: target.sortOrder } });
      await tx.dailyTip.update({ where: { id: target.id }, data: { sortOrder: current.sortOrder } });
    }
    await tx.adminAuditLog.create({ data: { adminId: auth.admin.id, action: "reorder", targetType: kind, targetId: current.id, beforeJson: JSON.stringify({ current: current.sortOrder, target: target.sortOrder }), afterJson: JSON.stringify({ current: target.sortOrder, target: current.sortOrder }), reason: direction } });
  });
  return NextResponse.json({ ok: true });
}
