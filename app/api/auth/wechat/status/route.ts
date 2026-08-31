import { NextResponse } from "next/server";
import { disabledWeChatProvider } from "@/lib/providers";
export async function GET() { return NextResponse.json({ configured: disabledWeChatProvider.configured, message: "本地阶段待配置" }); }
