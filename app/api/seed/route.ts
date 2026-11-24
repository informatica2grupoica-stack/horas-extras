import { NextResponse } from "next/server";
import { dbMode, wipe } from "@/lib/db";
import { seed } from "@/lib/seed";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Los datos de ejemplo solo se pueden cargar en desarrollo (archivo local): en producción borrarían los datos reales.
export async function POST() {
  if (dbMode === "postgres")
    return NextResponse.json({ error: "Los datos de ejemplo están desactivados cuando hay una base de datos real conectada." }, { status: 403 });
  await seed();
  return NextResponse.json({ ok: true });
}

// Borrar todo exige escribir la frase de confirmación.
export async function DELETE(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (body?.confirm !== "BORRAR TODO")
    return NextResponse.json({ error: 'Escribe "BORRAR TODO" para confirmar.' }, { status: 400 });
  await wipe();
  return NextResponse.json({ ok: true });
}
