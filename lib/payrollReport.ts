import { getSettings, list } from "./db";
import { effectiveRate, estimateDeductions, hourValue, overtimeUnit } from "./payroll";
import { OT_TYPES, type Overtime, type Settings, type Worker } from "./types";

export interface PayrollRow {
  workerId: string; name: string; document: string; role: string;
  baseSalary: number; rate: number; hours: number; amount: number;
  byType: { type: string; label: string; hours: number; multiplier: number; unit: number; amount: number }[];
  afp: number; health: number; unemployment: number; net: number;
  pendingHours: number; days: number;
}
export interface PayrollReport {
  month: string; settings: Settings; rows: PayrollRow[];
  totals: { hours: number; amount: number; afp: number; health: number; unemployment: number; net: number; pendingHours: number };
}

/** Horas extras APROBADAS del mes por trabajador, listas para llevar a la liquidación de sueldo. */
export async function buildPayroll(month: string): Promise<PayrollReport> {
  const [all, workers, settings] = await Promise.all([list<Overtime>("overtime"), list<Worker>("workers"), getSettings()]);
  const inMonth = all.filter((o) => o.date.startsWith(month));
  const rows: PayrollRow[] = [];
  for (const w of workers) {
    const mine = inMonth.filter((o) => o.workerId === w.id);
    const ok = mine.filter((o) => o.status === "aprobada");
    const pendingHours = mine.filter((o) => o.status === "pendiente").reduce((a, o) => a + o.hours, 0);
    if (!ok.length && !pendingHours) continue;
    const rate = effectiveRate(w, settings);
    const byType = OT_TYPES.map((t) => {
      const xs = ok.filter((o) => o.type === t.value);
      const hours = xs.reduce((a, o) => a + o.hours, 0);
      const multiplier = settings.multipliers[t.value];
      return { type: t.value, label: t.label, hours, multiplier, unit: overtimeUnit(rate, multiplier), amount: xs.reduce((a, o) => a + o.cost, 0) };
    }).filter((t) => t.hours > 0);
    const amount = byType.reduce((a, t) => a + t.amount, 0);
    const d = estimateDeductions(amount, settings);
    rows.push({
      workerId: w.id, name: w.name, document: w.document, role: w.role, baseSalary: w.baseSalary, rate,
      hours: byType.reduce((a, t) => a + t.hours, 0), amount, byType,
      afp: d.afp, health: d.health, unemployment: d.unemployment, net: d.net, pendingHours,
      days: new Set(ok.map((o) => o.date)).size,
    });
  }
  rows.sort((a, b) => b.amount - a.amount);
  const sum = (k: keyof PayrollRow) => rows.reduce((a, r) => a + (r[k] as number), 0);
  return {
    month, settings, rows,
    totals: { hours: sum("hours"), amount: sum("amount"), afp: sum("afp"), health: sum("health"), unemployment: sum("unemployment"), net: sum("net"), pendingHours: sum("pendingHours") },
  };
}
export { hourValue };
