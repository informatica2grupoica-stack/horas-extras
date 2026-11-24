import { randomUUID } from "crypto";
import { get, getSettings, list, put, del } from "./db";
import { hoursBetween } from "./calc";
import type { Overtime, OtType, Project, Worker } from "./types";

export const RESOURCES = ["workers", "projects", "overtime"] as const;
export type Resource = (typeof RESOURCES)[number];
export const isResource = (r: string): r is Resource => (RESOURCES as readonly string[]).includes(r);

const str = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : 0; };
export class ValidationError extends Error {}
const need = (cond: unknown, msg: string) => { if (!cond) throw new ValidationError(msg); };

/* eslint-disable @typescript-eslint/no-explicit-any */
async function buildOvertime(input: any, prev?: Overtime): Promise<Overtime> {
  const b = { ...prev, ...input };
  const worker = await get<Worker>("workers", str(b.workerId));
  const project = await get<Project>("projects", str(b.projectId));
  need(worker, "Selecciona un trabajador válido");
  need(project, "Selecciona un proyecto válido");
  need(/^\d{4}-\d{2}-\d{2}$/.test(str(b.date)), "Fecha inválida");
  need(/^\d{2}:\d{2}$/.test(str(b.start)) && /^\d{2}:\d{2}$/.test(str(b.end)), "Horas inválidas");
  const settings = await getSettings();
  const type = (str(b.type) || "diurna") as OtType;
  need(type in settings.multipliers, "Tipo de hora extra inválido");
  const hours = hoursBetween(b.start, b.end);
  need(hours <= 16, "Una jornada de horas extras no puede superar 16 h");
  const multiplier = settings.multipliers[type];
  return {
    id: prev?.id ?? randomUUID(),
    workerId: worker!.id, projectId: project!.id, date: b.date, start: b.start, end: b.end,
    hours, type, multiplier, cost: Math.round(hours * worker!.hourlyRate * multiplier),
    description: str(b.description, 500),
    status: ["pendiente", "aprobada", "rechazada"].includes(b.status) ? b.status : "pendiente",
    createdAt: prev?.createdAt ?? new Date().toISOString(),
  };
}

export async function build(resource: Resource, input: any, prev?: any) {
  if (resource === "overtime") return buildOvertime(input, prev);
  const b = { ...prev, ...input };
  need(str(b.name), "El nombre es obligatorio");
  if (resource === "workers") {
    const w: Worker = {
      id: prev?.id ?? randomUUID(), name: str(b.name), document: str(b.document, 40), role: str(b.role),
      hourlyRate: num(b.hourlyRate), active: b.active !== false, createdAt: prev?.createdAt ?? new Date().toISOString(),
    };
    return w;
  }
  const p: Project = {
    id: prev?.id ?? randomUUID(), code: str(b.code, 20).toUpperCase(), name: str(b.name), client: str(b.client),
    budgetHours: num(b.budgetHours), status: ["activo", "pausado", "cerrado"].includes(b.status) ? b.status : "activo",
    color: /^#[0-9a-fA-F]{6}$/.test(str(b.color)) ? b.color : "#3b5bdb", createdAt: prev?.createdAt ?? new Date().toISOString(),
  };
  return p;
}
export { list, get, put, del };
