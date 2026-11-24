export type OtType = "diurna" | "nocturna" | "festiva_diurna" | "festiva_nocturna";
export type OtStatus = "pendiente" | "aprobada" | "rechazada";

export interface Worker {
  id: string; name: string; document: string; role: string;
  /** Sueldo base mensual (bruto, sin gratificación ni asignaciones). Si es > 0, el valor hora se calcula con él. */
  baseSalary: number;
  /** Valor hora ordinaria manual; solo se usa si no hay sueldo base. */
  hourlyRate: number; active: boolean; createdAt: string;
}
export interface Project {
  id: string; code: string; name: string; client: string;
  budgetHours: number; status: "activo" | "pausado" | "cerrado"; color: string; createdAt: string;
}
export interface Overtime {
  id: string; workerId: string; projectId: string; date: string;
  start: string; end: string; hours: number; type: OtType; multiplier: number;
  cost: number; description: string; status: OtStatus; createdAt: string;
}
export interface Settings {
  multipliers: Record<OtType, number>;
  monthlyLimitPerWorker: number;
  currency: string;
  /** Jornada ordinaria semanal pactada (Chile: 44 h desde abr-2024, 42 h desde abr-2026, 40 h desde abr-2028). */
  weeklyHours: number;
  /** Divisor mensual para el valor hora. Chile: 30 días. */
  monthDivisor: number;
  /** Máximo legal de horas extras por día (art. 31). */
  maxDailyHours: number;
  /** Si está activo, no permite guardar más horas extras al día que el máximo. */
  enforceDaily: boolean;
  /** Descuentos legales del trabajador, en %, para estimar el líquido de las horas extras. */
  afpRate: number;
  healthRate: number;
  unemploymentRate: number;
}

export const OT_TYPES: { value: OtType; label: string }[] = [
  { value: "diurna", label: "Diurna" },
  { value: "nocturna", label: "Nocturna" },
  { value: "festiva_diurna", label: "Festiva diurna" },
  { value: "festiva_nocturna", label: "Festiva nocturna" },
];

export const DEFAULT_SETTINGS: Settings = {
  // Chile: la hora extra se paga con un recargo mínimo de 50% (Código del Trabajo, art. 32).
  multipliers: { diurna: 1.5, nocturna: 1.5, festiva_diurna: 1.5, festiva_nocturna: 1.5 },
  monthlyLimitPerWorker: 40,
  currency: "CLP",
  weeklyHours: 42,
  monthDivisor: 30,
  maxDailyHours: 2,
  enforceDaily: false,
  afpRate: 11.44,
  healthRate: 7,
  unemploymentRate: 0.6,
};
