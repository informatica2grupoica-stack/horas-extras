import { randomUUID } from "crypto";
import { put, wipe } from "./db";
import { hoursBetween } from "./calc";
import { effectiveRate, overtimeCost } from "./payroll";
import { DEFAULT_SETTINGS, type OtType, type Overtime, type Project, type Worker } from "./types";

export async function seed() {
  await wipe();
  await put("settings", "main", DEFAULT_SETTINGS);
  const now = new Date().toISOString();
  const wdata: [string, string, number][] = [
    ["Carlos Ramírez", "Maestro de obra", 1100000], ["Lucía Fernández", "Ingeniera residente", 2200000],
    ["Andrés Mejía", "Electricista", 950000], ["Paula Ortiz", "Diseñadora", 1500000],
    ["Jorge Salazar", "Soldador", 1050000], ["Marta Gil", "Coordinadora SST", 1400000],
    ["Sebastián Cruz", "Operador", 800000], ["Valentina Ríos", "Arquitecta", 2000000],
  ];
  const workers: Worker[] = wdata.map(([name, role, baseSalary], i) => ({
    id: randomUUID(), name, role, baseSalary, hourlyRate: 0, document: `${12000000 + i * 1370003}-${i}`, active: true, createdAt: now,
  }));
  const pdata: [string, string, string, number, string][] = [
    ["OB-101", "Torre Aurora", "Constructora Delta", 420, "#e8590c"],
    ["OB-102", "Bodega Norte", "LogiPlus", 260, "#3b5bdb"],
    ["IN-201", "Planta Solar Casanare", "EnerVerde", 340, "#2f9e44"],
    ["DS-301", "Rediseño Oficinas", "Grupo Andino", 140, "#ae3ec9"],
    ["MT-401", "Mantenimiento Q4", "Interno", 180, "#0c8599"],
  ];
  const projects: Project[] = pdata.map(([code, name, client, budgetHours, color]) => ({
    id: randomUUID(), code, name, client, budgetHours, color, status: "activo", createdAt: now,
  }));
  for (const w of workers) await put("workers", w.id, w);
  for (const p of projects) await put("projects", p.id, p);

  let s = 42;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const types: OtType[] = ["diurna", "diurna", "diurna", "nocturna", "festiva_diurna", "festiva_nocturna"];
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 7);
  const end = new Date();
  const weights = [0.35, 0.2, 0.25, 0.08, 0.12];
  const descs = ["Cierre de entrega", "Avance de cronograma", "Imprevisto en sitio", "Pruebas y ajustes"];
  while (d <= end) {
    const dow = d.getDay();
    if (rnd() < (dow === 0 ? 0.25 : dow === 6 ? 0.45 : 0.55)) {
      const n = 1 + Math.floor(rnd() * 3);
      for (let k = 0; k < n; k++) {
        const w = workers[Math.floor(rnd() * workers.length)];
        let r = rnd();
        let pi = 0;
        while (pi < weights.length - 1 && r > weights[pi]) { r -= weights[pi]; pi++; }
        const type: OtType = dow === 0 ? "festiva_diurna" : types[Math.floor(rnd() * types.length)];
        const night = type.includes("nocturna");
        const sh = night ? 19 + Math.floor(rnd() * 3) : 17 + Math.floor(rnd() * 2);
        const dur = 1 + Math.floor(rnd() * 4);
        const start = `${String(sh).padStart(2, "0")}:00`;
        const endT = `${String((sh + dur) % 24).padStart(2, "0")}:00`;
        const hours = hoursBetween(start, endT);
        const mult = DEFAULT_SETTINGS.multipliers[type];
        const old = end.getTime() - d.getTime() > 20 * 86400000;
        const o: Overtime = {
          id: randomUUID(), workerId: w.id, projectId: projects[pi].id, date: d.toISOString().slice(0, 10),
          start, end: endT, hours, type, multiplier: mult, cost: overtimeCost(hours, effectiveRate(w, DEFAULT_SETTINGS), mult),
          description: descs[Math.floor(rnd() * 4)],
          status: old ? (rnd() < 0.92 ? "aprobada" : "rechazada") : rnd() < 0.5 ? "pendiente" : "aprobada",
          createdAt: now,
        };
        await put("overtime", o.id, o);
      }
    }
    d.setDate(d.getDate() + 1);
  }
}
