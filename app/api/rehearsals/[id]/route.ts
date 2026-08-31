import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/http";
export async function GET(_:Request,context:{params:Promise<{id:string}>}){const auth=await requireUser();if("response" in auth)return auth.response;const {id}=await context.params;const item=await db.rehearsal.findFirst({where:{id,userId:auth.user.id},include:{supervisor:true,scenario:true,debrief:true}});return item?NextResponse.json({...item,evaluation:JSON.parse(item.evaluation)}):NextResponse.json({error:"未找到演练记录"},{status:404});}
