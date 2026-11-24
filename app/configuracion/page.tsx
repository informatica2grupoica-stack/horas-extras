"use client";
import { useEffect, useState } from "react";
import { Field, PageHead, Toast, api, useApi, useToast } from "@/components/ui";
import { fmtMoney } from "@/lib/format";
import { estimateDeductions, hourValue, overtimeUnit } from "@/lib/payroll";
import { OT_TYPES, type Settings } from "@/lib/types";

export default function Page() {
  const { data, reload } = useApi<Settings>("/api/settings");
  const [s, setS] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [calcSalary, setCalcSalary] = useState("800000");
  const [calcHours, setCalcHours] = useState("10");
  const toast = useToast();
  useEffect(() => { if (data) setS(data); }, [data]);

  async function save() {
    await api("PUT", "/api/settings", s);
    toast.show("Configuración guardada");
    reload();
  }
  async function seed() {
    if (!confirm("Esto reemplaza TODOS los datos actuales por datos de ejemplo. ¿Continuar?")) return;
    setBusy(true);
    await api("POST", "/api/seed");
    setBusy(false);
    toast.show("Datos de ejemplo cargados");
    reload();
  }
  async function wipe() {
    if (!confirm("Se borrarán TODOS los trabajadores, proyectos y registros. Esta acción no se puede deshacer. ¿Continuar?")) return;
    setBusy(true);
    await api("DELETE", "/api/seed");
    setBusy(false);
    toast.show("Todos los datos fueron eliminados");
    reload();
  }

  if (!s) return <div className="skeleton" style={{ height: 300 }} />;
  const num = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) => setS({ ...s, [k]: Number(e.target.value) });

  // Calculadora
  const sal = Number(calcSalary) || 0;
  const hv = hourValue(sal, s);
  const hrs = Number(calcHours) || 0;
  const unit = overtimeUnit(hv, s.multipliers.diurna);
  const gross = Math.round(unit * hrs);
  const ded = estimateDeductions(gross, s);
  const cur = s.currency;

  return (
    <>
      <PageHead title="Configuración" sub="Valor de la hora extra, recargos y datos para la liquidación de sueldo.">
        <button className="btn primary" onClick={save}>Guardar cambios</button>
      </PageHead>

      <div className="grid g-2" style={{ alignItems: "start" }}>
        <div style={{ display: "grid", gap: 16 }}>
          <div className="card card-pad" style={{ display: "grid", gap: 16 }}>
            <div><h2>Jornada y valor hora</h2><div className="sub">Base para calcular cuánto vale una hora ordinaria y, a partir de ella, la extra.</div></div>
            <div className="form-grid">
              <Field label="Jornada semanal (horas)"><input className="input num" type="number" min="1" max="60" value={s.weeklyHours} onChange={num("weeklyHours")} /></Field>
              <Field label="Divisor mensual (días)"><input className="input num" type="number" min="28" max="31" value={s.monthDivisor} onChange={num("monthDivisor")} /></Field>
            </div>
            <div className="cell-sub" style={{ maxWidth: "none", whiteSpace: "normal" }}>
              Chile: 44 h desde abril 2024, <b>42 h desde abril 2026</b> y 40 h desde abril 2028 (Ley 21.561). Verifica la jornada pactada en cada contrato.
            </div>
            <div className="preview" style={{ flexDirection: "column", gap: 4 }}>
              <b>Valor hora ordinaria = (sueldo base ÷ {s.monthDivisor}) × 7 ÷ {s.weeklyHours}</b>
              <span className="cell-sub" style={{ maxWidth: "none", whiteSpace: "normal" }}>Se usa solo el sueldo base: no incluye gratificación, colación, movilización ni otras asignaciones.</span>
            </div>
          </div>

          <div className="card card-pad" style={{ display: "grid", gap: 16 }}>
            <div><h2>Recargos por tipo de hora extra</h2><div className="sub">Multiplicador sobre el valor hora ordinaria. En Chile el recargo mínimo legal es 1,5 (50%).</div></div>
            <div className="form-grid">
              {OT_TYPES.map((t) => (
                <Field key={t.value} label={t.label}>
                  <input className="input num" type="number" step="0.05" min="1" max="5" value={s.multipliers[t.value]}
                    onChange={(e) => setS({ ...s, multipliers: { ...s.multipliers, [t.value]: Number(e.target.value) } })} />
                </Field>
              ))}
            </div>
          </div>

          <div className="card card-pad" style={{ display: "grid", gap: 16 }}>
            <div><h2>Límites</h2><div className="sub">Las horas extras son transitorias y se pactan por escrito (art. 32).</div></div>
            <div className="form-grid">
              <Field label="Máximo de horas extras por día"><input className="input num" type="number" min="0" max="12" value={s.maxDailyHours} onChange={num("maxDailyHours")} /></Field>
              <Field label="Límite mensual por trabajador (h)"><input className="input num" type="number" min="0" value={s.monthlyLimitPerWorker} onChange={num("monthlyLimitPerWorker")} /></Field>
              <Field label="Si se supera el máximo diario" full>
                <select className="input" value={String(s.enforceDaily)} onChange={(e) => setS({ ...s, enforceDaily: e.target.value === "true" })}>
                  <option value="false">Solo avisar al registrar</option>
                  <option value="true">Bloquear el registro</option>
                </select>
              </Field>
            </div>
            <div className="cell-sub" style={{ maxWidth: "none", whiteSpace: "normal" }}>El tope legal es de 2 horas extras por día. El límite mensual dispara las alertas del panel al llegar al 80%.</div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          <div className="card card-pad" style={{ display: "grid", gap: 14 }}>
            <div><h2>Calculadora de hora extra</h2><div className="sub">Prueba un sueldo base y mira cómo queda en la liquidación.</div></div>
            <div className="form-grid">
              <Field label="Sueldo base mensual"><input className="input num" type="number" min="0" value={calcSalary} onChange={(e) => setCalcSalary(e.target.value)} /></Field>
              <Field label="Horas extras del mes"><input className="input num" type="number" min="0" value={calcHours} onChange={(e) => setCalcHours(e.target.value)} /></Field>
            </div>
            <table style={{ fontSize: 13.5 }}>
              <tbody>
                <tr><td>Valor hora ordinaria</td><td className="r num"><b>{fmtMoney(Math.round(hv), cur)}</b></td></tr>
                <tr><td>Valor hora extra (× {s.multipliers.diurna})</td><td className="r num"><b>{fmtMoney(unit, cur)}</b></td></tr>
                <tr><td>Haber por {hrs} h extras <span className="cell-sub">imponible y tributable</span></td><td className="r num"><b>{fmtMoney(gross, cur)}</b></td></tr>
                <tr><td>− AFP ({s.afpRate}%)</td><td className="r num">{fmtMoney(ded.afp, cur)}</td></tr>
                <tr><td>− Salud ({s.healthRate}%)</td><td className="r num">{fmtMoney(ded.health, cur)}</td></tr>
                <tr><td>− Seguro de cesantía ({s.unemploymentRate}%)</td><td className="r num">{fmtMoney(ded.unemployment, cur)}</td></tr>
                <tr><td><b>Líquido aproximado</b> <span className="cell-sub">antes de impuesto único</span></td><td className="r num"><b>{fmtMoney(ded.net, cur)}</b></td></tr>
              </tbody>
            </table>
          </div>

          <div className="card card-pad" style={{ display: "grid", gap: 16 }}>
            <div><h2>Descuentos legales (estimados)</h2><div className="sub">Para calcular el líquido aproximado de las horas extras en el módulo Liquidación.</div></div>
            <div className="form-grid">
              <Field label="AFP incl. comisión (%)"><input className="input num" type="number" step="0.01" min="0" value={s.afpRate} onChange={num("afpRate")} /></Field>
              <Field label="Salud (%)"><input className="input num" type="number" step="0.01" min="0" value={s.healthRate} onChange={num("healthRate")} /></Field>
              <Field label="Seguro de cesantía trabajador (%)"><input className="input num" type="number" step="0.01" min="0" value={s.unemploymentRate} onChange={num("unemploymentRate")} /></Field>
              <Field label="Moneda (código ISO)"><input className="input" maxLength={3} value={s.currency} onChange={(e) => setS({ ...s, currency: e.target.value.toUpperCase() })} /></Field>
            </div>
            <div className="cell-sub" style={{ maxWidth: "none", whiteSpace: "normal" }}>
              La AFP varía por administradora (10% + comisión): ajústala al promedio de tu equipo. No se calcula impuesto único ni topes imponibles; es una referencia, no la liquidación oficial.
            </div>
          </div>

          <div className="card card-pad" style={{ display: "grid", gap: 14 }}>
            <div><h2>Cómo se contabilizan en la liquidación</h2></div>
            <ul style={{ paddingLeft: 18, display: "grid", gap: 6, color: "var(--ink-2)" }}>
              <li>Van como <b>haber imponible y tributable</b>, línea &quot;Horas extras&quot;.</li>
              <li>Están afectas a AFP, salud, seguro de cesantía e impuesto único.</li>
              <li>No forman parte de la base de la gratificación legal.</li>
              <li>Se pagan junto con la remuneración del mes en que se trabajaron.</li>
              <li>Solo se liquidan las horas <b>aprobadas</b>.</li>
            </ul>
          </div>

          <div className="card card-pad" style={{ display: "grid", gap: 14 }}>
            <div><h2>Datos</h2><div className="sub">Útil para probar el sistema o empezar de cero.</div></div>
            <div className="row"><button className="btn" onClick={seed} disabled={busy}>Cargar datos de ejemplo</button><button className="btn danger" onClick={wipe} disabled={busy}>Borrar todos los datos</button></div>
          </div>
        </div>
      </div>
      <Toast msg={toast.msg} />
    </>
  );
}
