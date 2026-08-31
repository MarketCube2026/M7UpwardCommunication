import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "知彼 · 向上沟通教练", description: "在关键沟通前，把话说到对方心里。", manifest: "/manifest.webmanifest" };
export const viewport: Viewport = { themeColor: "#12211f", width: "device-width", initialScale: 1, viewportFit: "cover" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="zh-CN"><body>{children}</body></html>; }
