export type OtType = "diurna" | "nocturna" | "festiva_diurna" | "festiva_nocturna";
export type OtStatus = "pendiente" | "aprobada" | "rechazada";

export interface Worker {
  id: string; name: string; document: string; role: string;
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
};
