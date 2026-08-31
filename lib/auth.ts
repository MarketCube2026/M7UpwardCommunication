import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db";

export const USER_COOKIE = "zhibi_session";
export const ADMIN_COOKIE = "zhibi_admin_session";
const SESSION_DAYS = 30;

function shouldUseSecureCookie() {
  return process.env.NODE_ENV === "production" && process.env.LOCAL_AUTH_MODE !== "true";
}

export function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  const local = digits.startsWith("86") && digits.length === 13 ? digits.slice(2) : digits;
  return /^1[3-9]\d{9}$/.test(local) ? `+86${local}` : null;
}

export function hashSecret(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function newToken() {
  return randomBytes(32).toString("base64url");
}

export async function issueUserSession(userId: string) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000);
  await db.userSession.create({ data: { userId, tokenHash: hashSecret(token), expiresAt } });
  const store = await cookies();
  store.set(USER_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: shouldUseSecureCookie(), path: "/", expires: expiresAt });
}

export async function issueAdminSession(adminId: string) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
  await db.adminSession.create({ data: { adminId, tokenHash: hashSecret(token), expiresAt } });
  const store = await cookies();
  store.set(ADMIN_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: shouldUseSecureCookie(), path: "/admin", expires: expiresAt });
}

export async function currentUser() {
  const token = (await cookies()).get(USER_COOKIE)?.value;
  if (!token) return null;
  const session = await db.userSession.findUnique({ where: { tokenHash: hashSecret(token) }, include: { user: true } });
  if (!session || session.expiresAt <= new Date() || session.user.status !== "ACTIVE") return null;
  return session.user;
}

export async function currentAdmin() {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  const session = await db.adminSession.findUnique({ where: { tokenHash: hashSecret(token) }, include: { admin: true } });
  if (!session || session.expiresAt <= new Date() || session.admin.status !== "ACTIVE") return null;
  return session.admin;
}

export async function clearUserSession() {
  const store = await cookies();
  const token = store.get(USER_COOKIE)?.value;
  if (token) await db.userSession.deleteMany({ where: { tokenHash: hashSecret(token) } });
  store.delete(USER_COOKIE);
}

export async function clearAdminSession() {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  if (token) await db.adminSession.deleteMany({ where: { tokenHash: hashSecret(token) } });
  store.delete(ADMIN_COOKIE);
}

export async function recordEvent(eventType: string, userId?: string, metadata: Record<string, unknown> = {}) {
  await db.analyticsEvent.create({ data: { eventType, userId, metadata: JSON.stringify(metadata) } });
}
