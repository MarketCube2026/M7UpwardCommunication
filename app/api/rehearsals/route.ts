import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/http";
export async function GET(request: Request) { const auth=await requireUser(); if("response" in auth)return auth.response; const supervisorId=new URL(request.url).searchParams.get("supervisorId")??undefined; return NextResponse.json(await db.rehearsal.findMany({where:{userId:auth.user.id,...(supervisorId?{supervisorId}:{})},include:{supervisor:true,debrief:true},orderBy:{createdAt:"desc"},take:50})); }
