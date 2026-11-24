import { NextResponse } from "next/server";
import { getSettings, list } from "@/lib/db";
import type { Overtime, Project, Worker } from "@/lib/types";

export const dynamic = "force-dynamic";

const ym = (d: string) => d.slice(0, 7);
const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function monthsBetween(from: string, to: string) {
  const out: string[] = [];
  let [y, m] = from.split("-").map(Number);
  const [ey, em] = to.split("-").map(Number);
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    if (++m > 12) { m = 1; y++; }
  }
  return out;
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const [all, workers, projects, settings] = await Promise.all([
    list<Overtime>("overtime"), list<Worker>("workers"), list<Project>("projects"), getSettings(),
  ]);
  const from = q.get("from") || "";
  const to = q.get("to") || "";
  const projectId = q.get("projectId") || "";
  const workerId = q.get("workerId") || "";
  const includePending = q.get("pending") !== "0";

  const rows = all.filter(
    (o) =>
      o.status !== "rechazada" &&
      (includePending || o.status === "aprobada") &&
      (!from || o.date >= from) && (!to || o.date <= to) &&
      (!projectId || o.projectId === projectId) && (!workerId || o.workerId === workerId),
  );

  const sum = (xs: Overtime[], k: "hours" | "cost") => xs.reduce((a, o) => a + o[k], 0);
  const wMap = new Map(workers.map((w) => [w.id, w]));
  const pMap = new Map(projects.map((p) => [p.id, p]));

  // Meses del rango
  const dates = rows.map((o) => o.date).sort();
  const nowYm = new Date().toISOString().slice(0, 7);
  const first = from ? ym(from) : dates[0] ? ym(dates[0]) : nowYm;
  const last = to ? ym(to) : dates.length ? ym(dates[dates.length - 1]) : nowYm;
  const months = monthsBetween(first, last <= nowYm || to ? last : nowYm);

  const byMonth = months.map((m) => {
    const xs = rows.filter((o) => ym(o.date) === m);
    return { month: m, hours: sum(xs, "hours"), cost: sum(xs, "cost"), records: xs.length };
  });

  const byProject = projects
    .map((p) => {
      const xs = rows.filter((o) => o.projectId === p.id);
      const allXs = all.filter((o) => o.projectId === p.id && o.status !== "rechazada");
      const used = sum(allXs, "hours");
      return {
        id: p.id, code: p.code, name: p.name, color: p.color, hours: sum(xs, "hours"), cost: sum(xs, "cost"),
        budgetHours: p.budgetHours, usedTotal: used, pct: p.budgetHours ? used / p.budgetHours : 0,
      };
    })
    .filter((p) => p.hours > 0 || p.usedTotal > 0)
    .sort((a, b) => b.hours - a.hours);

  const byWorker = workers
    .map((w) => {
      const xs = rows.filter((o) => o.workerId === w.id);
      return { id: w.id, name: w.name, role: w.role, hours: sum(xs, "hours"), cost: sum(xs, "cost"), records: xs.length };
    })
    .filter((w) => w.hours > 0)
    .sort((a, b) => b.hours - a.hours);

  const typeLabels: Record<string, string> = {
    diurna: "Diurna", nocturna: "Nocturna", festiva_diurna: "Festiva diurna", festiva_nocturna: "Festiva nocturna",
  };
  const byType = Object.keys(typeLabels).map((t) => {
    const xs = rows.filter((o) => o.type === t);
    return { type: t, label: typeLabels[t], hours: sum(xs, "hours"), cost: sum(xs, "cost") };
  }).filter((t) => t.hours > 0);

  const byWeekday = WEEKDAYS.map((label, i) => ({
    label, hours: sum(rows.filter((o) => new Date(o.date + "T12:00:00").getDay() === i), "hours"),
  }));

  // Matriz proyecto x mes (mapa de calor)
  const matrix = byProject.map((p) => ({
    id: p.id, code: p.code, name: p.name, color: p.color,
    values: months.map((m) => sum(rows.filter((o) => o.projectId === p.id && ym(o.date) === m), "hours")),
  }));

  const totalHours = sum(rows, "hours");
  const totalCost = sum(rows, "cost");
  const cur = byMonth.find((m) => m.month === nowYm);
  const prevYm = (() => { let [y, m] = nowYm.split("-").map(Number); if (--m < 1) { m = 12; y--; } return `${y}-${String(m).padStart(2, "0")}`; })();
  const prev = byMonth.find((m) => m.month === prevYm);
  const topMonth = [...byMonth].sort((a, b) => b.hours - a.hours)[0];

  // Alertas (siempre sobre el mes en curso y todos los proyectos, ignorando filtros de fecha)
  const monthRows = all.filter((o) => o.status !== "rechazada" && ym(o.date) === nowYm);
  const overLimit = settings.monthlyLimitPerWorker
    ? workers
        .map((w) => ({ id: w.id, name: w.name, hours: sum(monthRows.filter((o) => o.workerId === w.id), "hours") }))
        .filter((w) => w.hours >= settings.monthlyLimitPerWorker * 0.8)
        .map((w) => ({ ...w, limit: settings.monthlyLimitPerWorker, over: w.hours > settings.monthlyLimitPerWorker }))
        .sort((a, b) => b.hours - a.hours)
    : [];
  const overBudget = byProject.filter((p) => p.budgetHours && p.pct >= 0.8).map((p) => ({ ...p, over: p.pct > 1 }));

  return NextResponse.json({
    totals: {
      hours: totalHours, cost: totalCost, records: rows.length,
      pending: all.filter((o) => o.status === "pendiente").length,
      avgPerRecord: rows.length ? totalHours / rows.length : 0,
      avgCostPerHour: totalHours ? totalCost / totalHours : 0,
      workersWithOt: byWorker.length,
      avgPerWorker: byWorker.length ? totalHours / byWorker.length : 0,
      avgPerMonth: months.length ? totalHours / months.length : 0,
      nightShare: totalHours ? sum(rows.filter((o) => o.type.includes("nocturna")), "hours") / totalHours : 0,
      holidayShare: totalHours ? sum(rows.filter((o) => o.type.includes("festiva")), "hours") / totalHours : 0,
    },
    month: {
      current: cur?.hours ?? 0, previous: prev?.hours ?? 0, currentCost: cur?.cost ?? 0,
      delta: prev?.hours ? ((cur?.hours ?? 0) - prev.hours) / prev.hours : null,
    },
    topMonth: topMonth && topMonth.hours > 0 ? topMonth : null,
    topProject: byProject[0] && byProject[0].hours > 0 ? byProject[0] : null,
    topWorker: byWorker[0] ?? null,
    byMonth, byProject, byWorker, byType, byWeekday, months, matrix,
    alerts: { overLimit, overBudget },
    currency: settings.currency,
    _lookup: { workers: wMap.size, projects: pMap.size },
  });
}
