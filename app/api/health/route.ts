import { NextResponse } from "next/server";
import { dbMode } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json({ mode: dbMode, ephemeral: dbMode === "file" && !!process.env.VERCEL });
}
