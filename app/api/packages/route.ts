import { NextResponse } from "next/server";
import { db } from "@/lib/db";
export async function GET() {
  const paid = await db.package.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
  return NextResponse.json([{ code: "free", name: "免费", credits: 3, priceFen: 0, description: "每日3次", position: "引流体验", active: true }, ...paid]);
}
