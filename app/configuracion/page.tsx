"use client";
import { useEffect, useState } from "react";
import { Field, PageHead, Toast, api, useApi, useToast } from "@/components/ui";
import { OT_TYPES, type Settings } from "@/lib/types";

export default function Page() {
  const { data, reload } = useApi<Settings>("/api/settings");
  const [s, setS] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
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
  return (
    <>
      <PageHead title="Configuración" sub="Recargos, límites y datos del sistema." />
      <div className="grid g-2" style={{ alignItems: "start" }}>
        <div className="card card-pad" style={{ display: "grid", gap: 16 }}>
          <div><h2>Recargos por tipo de hora extra</h2><div className="sub">Multiplicador sobre el valor de la hora ordinaria. En Chile el recargo mínimo legal es 1,5 (50%).</div></div>
          <div className="form-grid">
            {OT_TYPES.map((t) => (
              <Field key={t.value} label={t.label}>
                <input className="input num" type="number" step="0.05" min="1" max="5" value={s.multipliers[t.value]}
                  onChange={(e) => setS({ ...s, multipliers: { ...s.multipliers, [t.value]: Number(e.target.value) } })} />
              </Field>
            ))}
          </div>
          <div className="form-grid">
            <Field label="Límite mensual de horas por trabajador"><input className="input num" type="number" min="0" value={s.monthlyLimitPerWorker} onChange={(e) => setS({ ...s, monthlyLimitPerWorker: Number(e.target.value) })} /></Field>
            <Field label="Moneda (código ISO)"><input className="input" maxLength={3} value={s.currency} onChange={(e) => setS({ ...s, currency: e.target.value.toUpperCase() })} /></Field>
          </div>
          <div className="cell-sub">Los cambios aplican a registros nuevos o editados. Los costos ya guardados conservan el recargo con el que se calcularon.</div>
          <div><button className="btn primary" onClick={save}>Guardar cambios</button></div>
        </div>
        <div className="card card-pad" style={{ display: "grid", gap: 14 }}>
          <div><h2>Datos</h2><div className="sub">Útil para probar el sistema o empezar de cero.</div></div>
          <div className="row"><button className="btn" onClick={seed} disabled={busy}>Cargar datos de ejemplo</button><button className="btn danger" onClick={wipe} disabled={busy}>Borrar todos los datos</button></div>
        </div>
      </div>
      <Toast msg={toast.msg} />
    </>
  );
}
