import { NextResponse } from "next/server";
import { requireUser } from "@/lib/http";
import { usageSummary } from "@/lib/billing";
export async function GET() { const auth = await requireUser(); if ("response" in auth) return auth.response; return NextResponse.json(await usageSummary(auth.user.id)); }
