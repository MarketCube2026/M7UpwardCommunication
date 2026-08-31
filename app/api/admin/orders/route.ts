import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/http";
export async function GET(request:Request){const auth=await requireAdmin();if("response" in auth)return auth.response;const status=new URL(request.url).searchParams.get("status")||undefined;return NextResponse.json(await db.order.findMany({where:status?{status}:{},include:{user:{select:{phone:true,nickname:true}},creditLot:true,refund:true},orderBy:{createdAt:"desc"},take:100}));}
