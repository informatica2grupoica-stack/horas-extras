import { NextResponse } from "next/server";
import { wipe } from "@/lib/db";
import { seed } from "@/lib/seed";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST() {
  await seed();
  return NextResponse.json({ ok: true });
}
export async function DELETE() {
  await wipe();
  return NextResponse.json({ ok: true });
}
