import { NextResponse } from "next/server";
import { betaGrantCredits, isPublicBeta } from "@/lib/beta";

export async function GET() {
  return NextResponse.json({ active: isPublicBeta(), inviteOnly: isPublicBeta(), grantCredits: betaGrantCredits() });
}
