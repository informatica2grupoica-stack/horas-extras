import { NextResponse } from "next/server";
import { getSettings, put as putDb } from "@/lib/db";
import { build, isResource, list, put, ValidationError } from "@/lib/resources";

export const dynamic = "force-dynamic";
const clamp = (v: unknown, min: number, max: number, fb: number) => { const n = Number(v); return Number.isFinite(n) && n >= min && n <= max ? n : fb; };
type Ctx = { params: Promise<{ resource: string }> };

export async function GET(_: Request, { params }: Ctx) {
  const { resource } = await params;
  if (resource === "settings") return NextResponse.json(await getSettings());
  if (!isResource(resource)) return NextResponse.json({ error: "No existe" }, { status: 404 });
  return NextResponse.json(await list(resource));
}

export async function POST(req: Request, { params }: Ctx) {
  const { resource } = await params;
  if (!isResource(resource)) return NextResponse.json({ error: "No existe" }, { status: 404 });
  try {
    const item = await build(resource, await req.json());
    await put(resource, item.id, item);
    return NextResponse.json(item, { status: 201 });
  } catch (e) {
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}

export async function PUT(req: Request, { params }: Ctx) {
  const { resource } = await params;
  if (resource !== "settings") return NextResponse.json({ error: "No existe" }, { status: 404 });
  const b = await req.json();
  const cur = await getSettings();
  const mult = { ...cur.multipliers };
  for (const k of Object.keys(mult) as (keyof typeof mult)[]) {
    const v = Number(b.multipliers?.[k]);
    if (Number.isFinite(v) && v >= 1 && v <= 5) mult[k] = v;
  }
  const next = {
    multipliers: mult,
    monthlyLimitPerWorker: Math.max(0, Number(b.monthlyLimitPerWorker) || 0),
    currency: String(b.currency || cur.currency).slice(0, 5).toUpperCase(),
    weeklyHours: clamp(b.weeklyHours, 1, 60, cur.weeklyHours),
    monthDivisor: clamp(b.monthDivisor, 28, 31, cur.monthDivisor),
    maxDailyHours: clamp(b.maxDailyHours, 0, 12, cur.maxDailyHours),
    enforceDaily: Boolean(b.enforceDaily),
    afpRate: clamp(b.afpRate, 0, 30, cur.afpRate),
    healthRate: clamp(b.healthRate, 0, 30, cur.healthRate),
    unemploymentRate: clamp(b.unemploymentRate, 0, 5, cur.unemploymentRate),
  };
  await putDb("settings", "main", next);
  return NextResponse.json(next);
}
