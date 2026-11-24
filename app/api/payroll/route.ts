import { NextResponse } from "next/server";
import { buildPayroll } from "@/lib/payrollReport";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const month = new URL(req.url).searchParams.get("month") || new Date().toISOString().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: "Mes inválido" }, { status: 400 });
  return NextResponse.json(await buildPayroll(month));
}
