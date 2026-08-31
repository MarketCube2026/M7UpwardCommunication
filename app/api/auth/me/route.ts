import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { usageSummary } from "@/lib/billing";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  return NextResponse.json({ user: { id: user.id, phone: user.phone, nickname: user.nickname, status: user.status }, usage: await usageSummary(user.id) });
}
