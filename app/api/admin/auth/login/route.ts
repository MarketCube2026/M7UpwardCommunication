import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { issueAdminSession } from "@/lib/auth";
export async function POST(request: Request) {
  const body=await request.json(); const username=String(body.username??"").trim(); const password=String(body.password??"");
  const admin=await db.adminAccount.findUnique({where:{username}});
  if(!admin||admin.status!=="ACTIVE"||!(await compare(password,admin.passwordHash)))return NextResponse.json({error:"账号或密码不正确"},{status:401});
  await db.adminAccount.update({where:{id:admin.id},data:{lastLoginAt:new Date()}}); await issueAdminSession(admin.id);
  return NextResponse.json({admin:{id:admin.id,username:admin.username}});
}
