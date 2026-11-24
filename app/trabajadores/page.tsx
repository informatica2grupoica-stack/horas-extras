"use client";
import { useMemo, useState } from "react";
import { Badge, Empty, Field, Icon, Modal, PageHead, Toast, api, useApi, useToast } from "@/components/ui";
import { fmtMoney } from "@/lib/format";
import { effectiveRate, overtimeUnit } from "@/lib/payroll";
import type { Overtime, Settings, Worker } from "@/lib/types";

export default function Page() {
  const { data: workers, reload } = useApi<Worker[]>("/api/workers");
  const { data: ot } = useApi<Overtime[]>("/api/overtime");
  const { data: settings } = useApi<Settings>("/api/settings");
  const [edit, setEdit] = useState<Partial<Worker> | null>(null);
  const toast = useToast();
  const ym = new Date().toISOString().slice(0, 7);

  const stats = useMemo(() => {
    const m = new Map<string, { month: number; total: number }>();
    ot?.filter((o) => o.status !== "rechazada").forEach((o) => {
      const s = m.get(o.workerId) ?? { month: 0, total: 0 };
      s.total += o.hours;
      if (o.date.startsWith(ym)) s.month += o.hours;
      m.set(o.workerId, s);
    });
    return m;
  }, [ot, ym]);

  async function remove(w: Worker) {
    if (!confirm(`¿Eliminar a ${w.name}?`)) return;
    try { await api("DELETE", `/api/workers/${w.id}`); toast.show("Trabajador eliminado"); reload(); }
    catch (e) { toast.show((e as Error).message); }
  }

  return (
    <>
      <PageHead title="Trabajadores" sub="Las personas que registran horas extras. No requieren cuenta ni contraseña.">
        <button className="btn accent" onClick={() => setEdit({ active: true })}><Icon name="plus" /> Nuevo trabajador</button>
      </PageHead>
      <div className="card table-wrap">
        {!workers ? <div className="skeleton" style={{ height: 240, margin: 16 }} /> : !workers.length ? (
          <Empty title="Aún no hay trabajadores" hint="Crea a las personas del equipo para poder asignarles horas extras." />
        ) : (
          <table>
            <thead><tr><th>Nombre</th><th>RUT</th><th className="r">Sueldo base</th><th className="r">Valor hora</th><th className="r">Hora extra</th><th className="r">Horas este mes</th><th className="r">Horas totales</th><th>Estado</th><th /></tr></thead>
            <tbody>
              {workers.map((w) => {
                const s = stats.get(w.id) ?? { month: 0, total: 0 };
                const limit = settings?.monthlyLimitPerWorker ?? 0;
                const over = limit && s.month > limit;
                return (
                  <tr key={w.id}>
                    <td><div className="cell-main">{w.name}</div><div className="cell-sub">{w.role || "—"}</div></td>
                    <td className="num">{w.document || "—"}</td>
                    <td className="r num">{w.baseSalary ? fmtMoney(w.baseSalary, settings?.currency) : "—"}</td>
                    <td className="r num">{settings ? fmtMoney(Math.round(effectiveRate(w, settings)), settings.currency) : ""}</td>
                    <td className="r num"><b>{settings ? fmtMoney(overtimeUnit(effectiveRate(w, settings), settings.multipliers.diurna), settings.currency) : ""}</b></td>
                    <td className="r num"><b style={{ color: over ? "var(--bad)" : undefined }}>{Math.round(s.month * 10) / 10}</b>{limit ? <span className="cell-sub"> / {limit}</span> : null}</td>
                    <td className="r num">{Math.round(s.total * 10) / 10}</td>
                    <td><Badge kind={w.active ? "ok" : undefined}>{w.active ? "Activo" : "Inactivo"}</Badge></td>
                    <td><div className="actions">
                      <button className="btn sm ghost icon-btn" aria-label="Editar" onClick={() => setEdit(w)}><Icon name="edit" size={15} /></button>
                      <button className="btn sm ghost icon-btn danger" aria-label="Eliminar" onClick={() => remove(w)}><Icon name="trash" size={15} /></button>
                    </div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {edit && <WorkerForm settings={settings} initial={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); toast.show("Trabajador guardado"); reload(); }} />}
      <Toast msg={toast.msg} />
    </>
  );
}

function WorkerForm({ initial, settings, onClose, onSaved }: { initial: Partial<Worker>; settings: Settings | null; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState({ name: initial.name ?? "", document: initial.document ?? "", role: initial.role ?? "", baseSalary: String(initial.baseSalary ?? ""), hourlyRate: String(initial.hourlyRate ?? ""), active: initial.active ?? true });
  const [err, setErr] = useState("");
  async function save() {
    try {
      const body = { ...v, baseSalary: Number(v.baseSalary) || 0, hourlyRate: Number(v.hourlyRate) || 0 };
      if (initial.id) await api("PATCH", `/api/workers/${initial.id}`, body); else await api("POST", "/api/workers", body);
      onSaved();
    } catch (e) { setErr((e as Error).message); }
  }
  return (
    <Modal title={initial.id ? "Editar trabajador" : "Nuevo trabajador"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn accent" onClick={save}>Guardar</button></>}>
      <div className="form-grid">
        <Field label="Nombre completo" full><input className="input" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} autoFocus /></Field>
        <Field label="RUT"><input className="input" value={v.document} onChange={(e) => setV({ ...v, document: e.target.value })} /></Field>
        <Field label="Cargo"><input className="input" value={v.role} onChange={(e) => setV({ ...v, role: e.target.value })} /></Field>
        <Field label="Sueldo base mensual"><input className="input" type="number" min="0" value={v.baseSalary} onChange={(e) => setV({ ...v, baseSalary: e.target.value })} placeholder="Ej: 800000" /></Field>
        <Field label="Valor hora manual (si no hay sueldo base)"><input className="input" type="number" min="0" value={v.hourlyRate} disabled={Number(v.baseSalary) > 0} onChange={(e) => setV({ ...v, hourlyRate: e.target.value })} /></Field>
        {settings && (() => {
          const rate = effectiveRate({ baseSalary: Number(v.baseSalary) || 0, hourlyRate: Number(v.hourlyRate) || 0 }, settings);
          return (
            <div className="preview full">
              <div><div className="cell-sub">Valor hora ordinaria</div><b className="num">{fmtMoney(Math.round(rate), settings.currency)}</b></div>
              <div style={{ textAlign: "right" }}><div className="cell-sub">Hora extra (× {settings.multipliers.diurna})</div><b className="num">{fmtMoney(overtimeUnit(rate, settings.multipliers.diurna), settings.currency)}</b></div>
            </div>
          );
        })()}
        <Field label="Estado">
          <select className="input" value={String(v.active)} onChange={(e) => setV({ ...v, active: e.target.value === "true" })}><option value="true">Activo</option><option value="false">Inactivo</option></select>
        </Field>
      </div>
      {err && <div className="error">{err}</div>}
    </Modal>
  );
}
