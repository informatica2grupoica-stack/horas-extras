"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge, Empty, Icon, PageHead, useApi } from "@/components/ui";
import { Donut, Heatmap, HBars, MonthChart, TrendArea, WeekdayBars } from "@/components/charts";
import { fmtHours, fmtMoney, monthLabel } from "@/lib/format";
import type { Project } from "@/lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
const PERIODS = [
  { k: "3", label: "3 meses" }, { k: "6", label: "6 meses" }, { k: "12", label: "12 meses" }, { k: "all", label: "Todo" },
];

function fromFor(k: string) {
  if (k === "all") return "";
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - (Number(k) - 1));
  return d.toISOString().slice(0, 10);
}

export default function Dashboard() {
  const [period, setPeriod] = useState("6");
  const [projectId, setProjectId] = useState("");
  const [onlyApproved, setOnlyApproved] = useState(false);
  const [metric, setMetric] = useState<"hours" | "cost">("hours");

  const url = useMemo(() => {
    const p = new URLSearchParams();
    const f = fromFor(period);
    if (f) p.set("from", f);
    if (projectId) p.set("projectId", projectId);
    if (onlyApproved) p.set("pending", "0");
    return `/api/stats?${p}`;
  }, [period, projectId, onlyApproved]);

  const { data: s, loading } = useApi<any>(url);
  const { data: projects } = useApi<Project[]>("/api/projects");
  const cur = s?.currency ?? "CLP";
  const empty = s && s.totals.records === 0 && period === "all" && !projectId;

  return (
    <>
      <PageHead title="Panel de horas extras" sub="Qué mes y qué proyecto consumen más horas del equipo.">
        <Link href="/registros?nuevo=1" className="btn accent"><Icon name="plus" /> Registrar horas</Link>
      </PageHead>

      <div className="filters" style={{ marginBottom: 20 }}>
        <div className="seg" role="tablist">
          {PERIODS.map((p) => (
            <button key={p.k} className={period === p.k ? "on" : ""} onClick={() => setPeriod(p.k)}>{p.label}</button>
          ))}
        </div>
        <select className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)} aria-label="Proyecto">
          <option value="">Todos los proyectos</option>
          {projects?.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
        </select>
        <label className="row" style={{ cursor: "pointer", color: "var(--ink-2)" }}>
          <input type="checkbox" checked={onlyApproved} onChange={(e) => setOnlyApproved(e.target.checked)} /> Solo aprobadas
        </label>
      </div>

      {loading && !s ? <Loading /> : !s ? null : empty ? (
        <div className="card"><Empty title="Aún no hay horas registradas" hint="Registra tus primeras horas extras o carga datos de ejemplo para explorar el panel."
          action={<div className="row" style={{ justifyContent: "center" }}>
            <Link href="/registros?nuevo=1" className="btn primary">Registrar horas</Link>
            <Link href="/configuracion" className="btn">Cargar datos de ejemplo</Link></div>} /></div>
      ) : (
        <div style={{ display: "grid", gap: 16, opacity: loading ? 0.6 : 1, transition: "opacity 150ms" }}>
          {/* KPIs */}
          <div className="grid g-kpi">
            <div className="card kpi hero enter">
              <span className="label">Horas extras en el periodo</span>
              <span className="value num">{Math.round(s.totals.hours * 10) / 10}<small>h</small></span>
              <span className="foot">{s.totals.records} registros · {fmtHours(s.totals.avgPerMonth)}/mes</span>
            </div>
            <div className="card kpi enter">
              <span className="label">Costo total</span>
              <span className="value num">{fmtMoney(s.totals.cost, cur)}</span>
              <span className="foot">{fmtMoney(s.totals.avgCostPerHour, cur)} por hora promedio</span>
            </div>
            <div className="card kpi enter">
              <span className="label">Este mes</span>
              <span className="value num">{Math.round(s.month.current * 10) / 10}<small>h</small></span>
              <span className="foot">
                {s.month.delta === null ? "Sin mes anterior para comparar" : (
                  <><span className={`delta ${s.month.delta > 0 ? "up" : "down"}`}>{s.month.delta > 0 ? "▲" : "▼"} {Math.abs(Math.round(s.month.delta * 100))}%</span> vs mes anterior</>
                )}
              </span>
            </div>
            <div className="card kpi enter">
              <span className="label">Pendientes de aprobar</span>
              <span className="value num">{s.totals.pending}</span>
              <span className="foot"><Link href="/registros?estado=pendiente" style={{ color: "var(--accent)", fontWeight: 550 }}>Revisar ahora →</Link></span>
            </div>
          </div>

          {/* Quién consume más */}
          <div className="grid g-kpi">
            <Insight label="Mes con más horas" main={s.topMonth ? monthLabel(s.topMonth.month) : "—"} sub={s.topMonth ? fmtHours(s.topMonth.hours) : ""} />
            <Insight label="Proyecto que más consume" main={s.topProject?.name ?? "—"} sub={s.topProject ? fmtHours(s.topProject.hours) : ""} color={s.topProject?.color} />
            <Insight label="Trabajador con más horas" main={s.topWorker?.name ?? "—"} sub={s.topWorker ? fmtHours(s.topWorker.hours) : ""} />
            <Insight label="Nocturnas y festivas" main={`${Math.round((s.totals.nightShare + s.totals.holidayShare) * 100)}%`} sub={`${Math.round(s.totals.nightShare * 100)}% noct. · ${Math.round(s.totals.holidayShare * 100)}% fest.`} />
          </div>

          <div className="grid g-3-2">
            <div className="card card-pad">
              <div className="card-head">
                <div><h2>Horas extras por mes</h2><div className="sub">El mes más alto se resalta en naranja</div></div>
                <div className="seg">
                  <button className={metric === "hours" ? "on" : ""} onClick={() => setMetric("hours")}>Horas</button>
                  <button className={metric === "cost" ? "on" : ""} onClick={() => setMetric("cost")}>Costo</button>
                </div>
              </div>
              <MonthChart data={s.byMonth} metric={metric} cur={cur} />
            </div>
            <div className="card card-pad">
              <div className="card-head"><div><h2>Consumo por proyecto</h2><div className="sub">Horas en el periodo</div></div></div>
              {s.byProject.length ? (
                <HBars rows={s.byProject.slice(0, 7).map((p: any) => ({ name: p.name, value: p.hours, color: p.color, sub: fmtMoney(p.cost, cur) }))} />
              ) : <Empty title="Sin datos" />}
            </div>
          </div>

          <div className="card card-pad">
            <div className="card-head"><div><h2>Mapa de calor: proyecto × mes</h2><div className="sub">Más intenso = más horas extras. Encuentra de un vistazo dónde se concentra el esfuerzo.</div></div></div>
            {s.matrix.length ? <Heatmap months={s.months} rows={s.matrix} /> : <Empty title="Sin datos" />}
          </div>

          <div className="grid g-2-3">
            <div className="card card-pad">
              <div className="card-head"><div><h2>Tipo de hora extra</h2><div className="sub">Distribución del periodo</div></div></div>
              {s.byType.length ? <Donut data={s.byType} /> : <Empty title="Sin datos" />}
              <div style={{ height: 8 }} />
              <div className="card-head" style={{ marginTop: 20 }}><div><h2>Día de la semana</h2></div></div>
              <WeekdayBars data={s.byWeekday} />
            </div>
            <div className="card card-pad">
              <div className="card-head"><div><h2>Ranking de trabajadores</h2><div className="sub">Quién acumula más horas</div></div></div>
              {s.byWorker.length ? (
                <HBars rows={s.byWorker.slice(0, 8).map((w: any, i: number) => ({ name: w.name, value: w.hours, color: i === 0 ? "#d9480f" : "#17160f", sub: fmtMoney(w.cost, cur) }))} />
              ) : <Empty title="Sin datos" />}
            </div>
          </div>

          <div className="grid g-2">
            <div className="card card-pad">
              <div className="card-head"><div><h2>Presupuesto de horas por proyecto</h2><div className="sub">Horas acumuladas vs presupuesto asignado</div></div></div>
              <div style={{ display: "grid", gap: 14 }}>
                {s.byProject.filter((p: any) => p.budgetHours).map((p: any) => {
                  const pct = Math.min(p.pct, 1.2);
                  const kind = p.pct > 1 ? "var(--bad)" : p.pct >= 0.8 ? "var(--warn)" : "var(--ok)";
                  return (
                    <div key={p.id}>
                      <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontWeight: 550 }}>{p.name}</span>
                        <span className="num" style={{ color: "var(--ink-2)" }}>{Math.round(p.usedTotal)} / {p.budgetHours} h · <b style={{ color: kind }}>{Math.round(p.pct * 100)}%</b></span>
                      </div>
                      <div className="bar"><i style={{ width: `${Math.min(pct / 1.2, 1) * 100}%`, background: kind }} /></div>
                    </div>
                  );
                })}
                {!s.byProject.some((p: any) => p.budgetHours) && <Empty title="Sin presupuestos" hint="Define horas presupuestadas en cada proyecto." />}
              </div>
            </div>
            <div className="card card-pad">
              <div className="card-head"><div><h2>Alertas</h2><div className="sub">Mes en curso y presupuestos</div></div></div>
              <div className="alert-list">
                {s.alerts.overLimit.map((w: any) => (
                  <div key={w.id} className="alert">
                    <span className="row"><Icon name="alert" size={16} /> <b>{w.name}</b></span>
                    <Badge kind={w.over ? "bad" : "warn"}>{Math.round(w.hours)} / {w.limit} h este mes</Badge>
                  </div>
                ))}
                {s.alerts.overBudget.map((p: any) => (
                  <div key={p.id} className="alert">
                    <span className="row"><Icon name="alert" size={16} /> <b>{p.name}</b></span>
                    <Badge kind={p.over ? "bad" : "warn"}>{Math.round(p.pct * 100)}% del presupuesto</Badge>
                  </div>
                ))}
                {!s.alerts.overLimit.length && !s.alerts.overBudget.length && (
                  <Empty title="Todo en orden" hint="Nadie cerca del límite mensual ni proyectos sobre presupuesto." />
                )}
              </div>
            </div>
          </div>

          <div className="card card-pad">
            <div className="card-head"><div><h2>Tendencia mensual</h2><div className="sub">Evolución de horas en el periodo</div></div></div>
            <TrendArea data={s.byMonth} />
          </div>
        </div>
      )}
    </>
  );
}

function Insight({ label, main, sub, color }: { label: string; main: string; sub: string; color?: string }) {
  return (
    <div className="card kpi enter">
      <span className="label">{label}</span>
      <span className="row" style={{ fontSize: 18, fontWeight: 620, letterSpacing: "-0.02em" }}>
        {color && <i className="dot" style={{ background: color }} />}{main}
      </span>
      <span className="foot num">{sub}</span>
    </div>
  );
}

function Loading() {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="grid g-kpi">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 108 }} />)}</div>
      <div className="skeleton" style={{ height: 340 }} />
    </div>
  );
}
