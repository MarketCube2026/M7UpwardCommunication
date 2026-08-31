import { NextResponse } from "next/server";
import { currentAdmin, currentUser } from "./auth";

export async function requireUser() {
  const user = await currentUser();
  return user ? { user } : { response: NextResponse.json({ error: "请先登录", code: "UNAUTHORIZED" }, { status: 401 }) };
}

export async function requireAdmin() {
  const admin = await currentAdmin();
  return admin ? { admin } : { response: NextResponse.json({ error: "管理员未登录", code: "ADMIN_UNAUTHORIZED" }, { status: 401 }) };
}

export function requestIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
}
