import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/auth";
export async function GET(){const admin=await currentAdmin();return admin?NextResponse.json({admin:{id:admin.id,username:admin.username}}):NextResponse.json({error:"未登录"},{status:401});}
