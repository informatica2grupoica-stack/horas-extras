import { NextResponse } from "next/server";
import { build, del, get, isResource, list, put, ValidationError } from "@/lib/resources";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ resource: string; id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { resource, id } = await params;
  if (!isResource(resource)) return NextResponse.json({ error: "No existe" }, { status: 404 });
  const prev = await get(resource, id);
  if (!prev) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  try {
    const item = await build(resource, await req.json(), prev);
    await put(resource, id, item);
    return NextResponse.json(item);
  } catch (e) {
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}

export async function DELETE(_: Request, { params }: Ctx) {
  const { resource, id } = await params;
  if (!isResource(resource)) return NextResponse.json({ error: "No existe" }, { status: 404 });
  if (resource !== "overtime") {
    const key = resource === "workers" ? "workerId" : "projectId";
    const used = (await list<Record<string, string>>("overtime")).filter((o) => o[key] === id).length;
    if (used)
      return NextResponse.json(
        { error: `Tiene ${used} registro(s) de horas extras. Desactívalo en vez de eliminarlo.` },
        { status: 409 },
      );
  }
  await del(resource, id);
  return NextResponse.json({ ok: true });
}
