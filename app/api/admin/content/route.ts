import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/http";

type ContentKind = "scenario" | "tag" | "tip";

function kindOf(value: unknown): ContentKind | null {
  return value === "scenario" || value === "tag" || value === "tip" ? value : null;
}

async function findItem(kind: ContentKind, id: string) {
  if (kind === "scenario") return db.scenario.findFirst({ where: { id, ownerUserId: null } });
  if (kind === "tag") return db.personalityTag.findUnique({ where: { id } });
  return db.dailyTip.findUnique({ where: { id } });
}

export async function GET() {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const [scenarios, tags, tips] = await Promise.all([
    db.scenario.findMany({ where: { ownerUserId: null }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    db.personalityTag.findMany({ orderBy: { sortOrder: "asc" } }),
    db.dailyTip.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  return NextResponse.json({ scenarios, tags, tips });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const body = await request.json();
  const kind = kindOf(body.kind);
  if (!kind) return NextResponse.json({ error: "内容类型无效" }, { status: 400 });
  const sortOrder = Number.isInteger(Number(body.sortOrder)) ? Number(body.sortOrder) : 0;
  let item: unknown;
  if (kind === "scenario") {
    const name = String(body.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "请输入场景名称" }, { status: 400 });
    item = await db.scenario.create({ data: { name, description: String(body.description ?? ""), referenceTemplate: String(body.referenceTemplate ?? ""), builtin: true, active: true, sortOrder } });
  } else if (kind === "tag") {
    const label = String(body.label ?? "").trim();
    if (!label) return NextResponse.json({ error: "请输入标签" }, { status: 400 });
    item = await db.personalityTag.create({ data: { label, active: true, sortOrder } });
  } else {
    const content = String(body.content ?? "").trim();
    if (!content) return NextResponse.json({ error: "请输入提示内容" }, { status: 400 });
    item = await db.dailyTip.create({ data: { content, active: true, sortOrder } });
  }
  await db.adminAuditLog.create({ data: { adminId: auth.admin.id, action: "create", targetType: kind, afterJson: JSON.stringify(item) } });
  return NextResponse.json(item, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const body = await request.json();
  const kind = kindOf(body.kind);
  const id = String(body.id ?? "");
  if (!kind || !id) return NextResponse.json({ error: "内容参数不完整" }, { status: 400 });
  const before = await findItem(kind, id);
  if (!before) return NextResponse.json({ error: "内容不存在" }, { status: 404 });
  const shared = {
    ...(body.active !== undefined ? { active: Boolean(body.active) } : {}),
    ...(body.sortOrder !== undefined ? { sortOrder: Number(body.sortOrder) || 0 } : {}),
  };
  let item: unknown;
  if (kind === "scenario") {
    item = await db.scenario.update({ where: { id }, data: { ...shared, ...(body.value !== undefined ? { name: String(body.value).trim() } : {}), ...(body.description !== undefined ? { description: String(body.description) } : {}), ...(body.referenceTemplate !== undefined ? { referenceTemplate: String(body.referenceTemplate) } : {}) } });
  } else if (kind === "tag") {
    item = await db.personalityTag.update({ where: { id }, data: { ...shared, ...(body.value !== undefined ? { label: String(body.value).trim() } : {}) } });
  } else {
    item = await db.dailyTip.update({ where: { id }, data: { ...shared, ...(body.value !== undefined ? { content: String(body.value).trim() } : {}) } });
  }
  await db.adminAuditLog.create({ data: { adminId: auth.admin.id, action: "update", targetType: kind, targetId: id, beforeJson: JSON.stringify(before), afterJson: JSON.stringify(item) } });
  return NextResponse.json(item);
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const body = await request.json();
  const kind = kindOf(body.kind);
  const id = String(body.id ?? "");
  const reason = String(body.reason ?? "").trim();
  if (!kind || !id || !reason) return NextResponse.json({ error: "删除内容时必须填写原因" }, { status: 400 });
  const before = await findItem(kind, id);
  if (!before) return NextResponse.json({ error: "内容不存在" }, { status: 404 });
  try {
    if (kind === "scenario") await db.scenario.delete({ where: { id } });
    else if (kind === "tag") await db.personalityTag.delete({ where: { id } });
    else await db.dailyTip.delete({ where: { id } });
    await db.adminAuditLog.create({ data: { adminId: auth.admin.id, action: "delete", targetType: kind, targetId: id, beforeJson: JSON.stringify(before), reason } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "该内容已有使用记录，请改为下线" }, { status: 409 });
  }
}
