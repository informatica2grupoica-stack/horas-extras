import { neon } from "@neondatabase/serverless";
import fs from "fs";
import path from "path";

/**
 * Almacén de documentos: tabla `records(kind,id,data jsonb)`.
 * - Con DATABASE_URL / POSTGRES_URL -> Postgres (Neon / Vercel Postgres). Producción.
 * - Sin ella -> archivo JSON local (solo desarrollo; en Vercel sería temporal en /tmp).
 */
const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
export const dbMode: "postgres" | "file" = url ? "postgres" : "file";

let ready: Promise<unknown> | null = null;
const sql = () => neon(url!);
function init() {
  if (!ready) {
    ready = sql()`CREATE TABLE IF NOT EXISTS records (
      kind text NOT NULL, id text NOT NULL, data jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (kind, id))`;
  }
  return ready;
}

const FILE = process.env.VERCEL ? "/tmp/horas-extras.json" : path.join(process.cwd(), ".data", "db.json");
type FileDb = Record<string, Record<string, unknown>>;
function readFile(): FileDb {
  try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return {}; }
}
function writeFile(d: FileDb) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(d));
}

export async function list<T>(kind: string): Promise<T[]> {
  if (dbMode === "postgres") {
    await init();
    const rows = await sql()`SELECT data FROM records WHERE kind = ${kind} ORDER BY created_at ASC`;
    return rows.map((r) => r.data as T);
  }
  return Object.values(readFile()[kind] ?? {}) as T[];
}
export async function get<T>(kind: string, id: string): Promise<T | null> {
  if (dbMode === "postgres") {
    await init();
    const rows = await sql()`SELECT data FROM records WHERE kind = ${kind} AND id = ${id}`;
    return (rows[0]?.data as T) ?? null;
  }
  return ((readFile()[kind] ?? {})[id] as T) ?? null;
}
export async function put(kind: string, id: string, data: unknown) {
  if (dbMode === "postgres") {
    await init();
    await sql()`INSERT INTO records (kind, id, data) VALUES (${kind}, ${id}, ${JSON.stringify(data)}::jsonb)
      ON CONFLICT (kind, id) DO UPDATE SET data = EXCLUDED.data`;
    return;
  }
  const d = readFile();
  (d[kind] ??= {})[id] = data;
  writeFile(d);
}
export async function del(kind: string, id: string) {
  if (dbMode === "postgres") {
    await init();
    await sql()`DELETE FROM records WHERE kind = ${kind} AND id = ${id}`;
    return;
  }
  const d = readFile();
  if (d[kind]) delete d[kind][id];
  writeFile(d);
}
export async function wipe() {
  if (dbMode === "postgres") { await init(); await sql()`DELETE FROM records`; return; }
  writeFile({});
}

import { DEFAULT_SETTINGS, type Settings } from "./types";
export async function getSettings(): Promise<Settings> {
  const s = await get<Settings>("settings", "main");
  return { ...DEFAULT_SETTINGS, ...s, multipliers: { ...DEFAULT_SETTINGS.multipliers, ...(s?.multipliers ?? {}) } };
}
