import type { Settings, Worker } from "./types";

/** Valor hora ordinaria = (sueldo mensual ÷ 30) × 7 ÷ jornada semanal (fórmula de la Dirección del Trabajo). */
export function hourValue(salary: number, s: Pick<Settings, "weeklyHours" | "monthDivisor">) {
  if (!salary || !s.weeklyHours) return 0;
  return (salary / s.monthDivisor) * 7 / s.weeklyHours;
}

/** Valor hora ordinaria efectivo del trabajador: desde su sueldo base o, si no tiene, el valor manual. */
export function effectiveRate(w: Pick<Worker, "baseSalary" | "hourlyRate">, s: Settings) {
  return w.baseSalary > 0 ? hourValue(w.baseSalary, s) : w.hourlyRate || 0;
}

/** Valor de una hora extra (redondeado al peso, como en una liquidación). */
export const overtimeUnit = (rate: number, multiplier: number) => Math.round(rate * multiplier);

export const overtimeCost = (hours: number, rate: number, multiplier: number) =>
  Math.round(hours * overtimeUnit(rate, multiplier));

/** Descuentos legales estimados sobre un monto imponible (sin impuesto único). */
export function estimateDeductions(gross: number, s: Settings) {
  const afp = Math.round((gross * s.afpRate) / 100);
  const health = Math.round((gross * s.healthRate) / 100);
  const unemployment = Math.round((gross * s.unemploymentRate) / 100);
  return { afp, health, unemployment, net: gross - afp - health - unemployment };
}
