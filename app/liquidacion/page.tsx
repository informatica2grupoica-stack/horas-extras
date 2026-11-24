"use client";
import { Fragment, useMemo, useState } from "react";
import { Badge, Empty, Icon, PageHead, useApi } from "@/components/ui";
import { fmtMoney } from "@/lib/format";
import type { PayrollReport } from "@/lib/payrollReport";

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export default function Page() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [open, setOpen] = useState<string | null>(null);
  const { data, loading } = useApi<PayrollReport>(`/api/payroll?month=${month}`);

  const options = useMemo(() => {
    const out: string[] = [];
    const d = new Date();
    d.setDate(1);
    for (let i = 0; i < 18; i++) {
      out.push(d.toISOString().slice(0, 7));
      d.setMonth(d.getMonth() - 1);
    }
    return out;
  }, []);
  const label = (m: string) => `${MONTHS[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`;
  const cur = data?.settings.currency ?? "CLP";
  const t = data?.totals;

  return (
    <>
      <PageHead title="Liquidación de horas extras" sub="Horas extras aprobadas del mes, listas para ingresar como haber en la liquidación de sueldo.">
        <select className="input" style={{ width: 190, height: 36 }} value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Mes">
          {options.map((m) => <option key={m} value={m}>{label(m)}</option>)}
        </select>
        <a className="btn accent" href={`/api/export?month=${month}`}><Icon name="download" /> Exportar Excel</a>
      </PageHead>

      {t && t.pendingHours > 0 && (
        <div className="banner">
          Hay <b>{Math.round(t.pendingHours * 10) / 10} h pendientes de aprobar</b> en {label(month)}. No están incluidas en esta liquidación: apruébalas en Registros antes de cerrar el mes.
        </div>
      )}

      <div className="grid g-kpi" style={{ marginBottom: 16 }}>
        <div className="card kpi hero"><span className="label">Haber horas extras del mes</span><span className="value num">{fmtMoney(t?.amount ?? 0, cur)}</span><span className="foot">imponible y tributable</span></div>
        <div className="card kpi"><span className="label">Horas aprobadas</span><span className="value num">{Math.round((t?.hours ?? 0) * 10) / 10}<small>h</small></span><span className="foot">{data?.rows.filter((r) => r.hours > 0).length ?? 0} trabajadores</span></div>
        <div className="card kpi"><span className="label">Descuentos legales (est.)</span><span className="value num">{fmtMoney((t?.afp ?? 0) + (t?.health ?? 0) + (t?.unemployment ?? 0), cur)}</span><span className="foot">AFP, salud y cesantía</span></div>
        <div className="card kpi"><span className="label">Líquido aprox. horas extras</span><span className="value num">{fmtMoney(t?.net ?? 0, cur)}</span><span className="foot">antes de impuesto único</span></div>
      </div>

      <div className="card table-wrap">
        {loading && !data ? <div className="skeleton" style={{ height: 240, margin: 16 }} /> : !data || !data.rows.length ? (
          <Empty title="Sin horas extras en este mes" hint="Cuando haya registros aprobados aparecerán aquí por trabajador." />
        ) : (
          <table>
            <thead>
              <tr><th>Trabajador</th><th className="r">Sueldo base</th><th className="r">Valor hora</th><th className="r">Horas extras</th><th className="r">Haber (imponible)</th><th className="r">AFP</th><th className="r">Salud</th><th className="r">Cesantía</th><th className="r">Líquido aprox.</th><th /></tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <Fragment key={r.workerId}>
                  <tr>
                    <td><div className="cell-main">{r.name}</div><div className="cell-sub">{r.document || r.role}{r.pendingHours ? <> · <Badge kind="warn">{Math.round(r.pendingHours * 10) / 10} h pendientes</Badge></> : null}</div></td>
                    <td className="r num">{r.baseSalary ? fmtMoney(r.baseSalary, cur) : "—"}</td>
                    <td className="r num">{fmtMoney(Math.round(r.rate), cur)}</td>
                    <td className="r num"><b>{Math.round(r.hours * 10) / 10} h</b></td>
                    <td className="r num"><b>{fmtMoney(r.amount, cur)}</b></td>
                    <td className="r num">{fmtMoney(r.afp, cur)}</td>
                    <td className="r num">{fmtMoney(r.health, cur)}</td>
                    <td className="r num">{fmtMoney(r.unemployment, cur)}</td>
                    <td className="r num"><b>{fmtMoney(r.net, cur)}</b></td>
                    <td><button className="btn sm ghost" onClick={() => setOpen(open === r.workerId ? null : r.workerId)}>{open === r.workerId ? "Ocultar" : "Detalle"}</button></td>
                  </tr>
                  {open === r.workerId && (
                    <tr>
                      <td colSpan={10} style={{ background: "var(--surface-2)" }}>
                        <div style={{ display: "grid", gap: 6, padding: "4px 0" }}>
                          {r.byType.length ? r.byType.map((b) => (
                            <div key={b.type} className="row" style={{ justifyContent: "space-between" }}>
                              <span>{b.label} · {Math.round(b.hours * 100) / 100} h × {fmtMoney(b.unit, cur)} <span className="cell-sub">(valor hora × {b.multiplier})</span></span>
                              <b className="num">{fmtMoney(b.amount, cur)}</b>
                            </div>
                          )) : <span className="cell-sub">Sin horas aprobadas.</span>}
                          <div className="cell-sub" style={{ maxWidth: "none" }}>Trabajó horas extras en {r.days} {r.days === 1 ? "día" : "días"}.</div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              <tr style={{ background: "var(--surface-2)" }}>
                <td><b>Total</b></td><td /><td />
                <td className="r num"><b>{Math.round(t!.hours * 10) / 10} h</b></td>
                <td className="r num"><b>{fmtMoney(t!.amount, cur)}</b></td>
                <td className="r num">{fmtMoney(t!.afp, cur)}</td><td className="r num">{fmtMoney(t!.health, cur)}</td><td className="r num">{fmtMoney(t!.unemployment, cur)}</td>
                <td className="r num"><b>{fmtMoney(t!.net, cur)}</b></td><td />
              </tr>
            </tbody>
          </table>
        )}
      </div>

      <div className="card card-pad" style={{ marginTop: 16 }}>
        <h2>Cómo ingresarlo en la liquidación</h2>
        <ul style={{ paddingLeft: 18, display: "grid", gap: 6, color: "var(--ink-2)", marginTop: 10 }}>
          <li>Línea de <b>haber imponible y tributable</b> &quot;Horas extras&quot; por el monto de la columna <i>Haber</i>.</li>
          <li>Las horas extras no entran en la base de la gratificación legal.</li>
          <li>Los descuentos de AFP, salud y cesantía son estimados con los porcentajes de Configuración. El impuesto único y los topes imponibles los calcula tu sistema de remuneraciones.</li>
        </ul>
      </div>
    </>
  );
}
