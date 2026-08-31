import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { scenarioSchema } from "@/lib/schemas";
import { requireUser } from "@/lib/http";
export async function GET() { const auth=await requireUser(); if("response" in auth)return auth.response; return NextResponse.json(await db.scenario.findMany({where:{active:true,OR:[{builtin:true},{ownerUserId:null},{ownerUserId:auth.user.id}]},orderBy:[{builtin:"desc"},{sortOrder:"asc"},{createdAt:"asc"}]})); }
export async function POST(request: Request) { const auth=await requireUser(); if("response" in auth)return auth.response; const parsed=scenarioSchema.safeParse(await request.json()); if(!parsed.success)return NextResponse.json({error:parsed.error.issues[0]?.message??"场景内容不正确"},{status:400}); const {name,description,referenceTemplate}=parsed.data; return NextResponse.json(await db.scenario.create({data:{ownerUserId:auth.user.id,name,description:description||null,referenceTemplate:referenceTemplate||null}}),{status:201}); }
