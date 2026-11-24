"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Badge, Empty, Field, Icon, Modal, PageHead, Toast, api, downloadCsv, useApi, useToast } from "@/components/ui";
import { hoursBetween } from "@/lib/calc";
import { fmtDate, fmtMoney, today } from "@/lib/format";
import { OT_TYPES, type Overtime, type Project, type Settings, type Worker } from "@/lib/types";

const STATUS = { pendiente: "warn", aprobada: "ok", rechazada: "bad" } as const;

export default function Page() {
  return <Suspense><Registros /></Suspense>;
}

function Registros() {
  const sp = useSearchParams();
  const { data: rows, reload } = useApi<Overtime[]>("/api/overtime");
  const { data: workers } = useApi<Worker[]>("/api/workers");
  const { data: projects } = useApi<Project[]>("/api/projects");
  const { data: settings } = useApi<Settings>("/api/settings");
  const [edit, setEdit] = useState<Partial<Overtime> | null>(null);
  const [f, setF] = useState({ q: "", projectId: "", workerId: "", status: sp.get("estado") ?? "", month: "" });
  const toast = useToast();

  useEffect(() => { if (sp.get("nuevo")) setEdit({}); }, [sp]);

  const wMap = useMemo(() => new Map(workers?.map((w) => [w.id, w])), [workers]);
  const pMap = useMemo(() => new Map(projects?.map((p) => [p.id, p])), [projects]);
  const cur = settings?.currency ?? "CLP";

  const filtered = useMemo(() => (rows ?? [])
    .filter((o) => (!f.projectId || o.projectId === f.projectId) && (!f.workerId || o.workerId === f.workerId)
      && (!f.status || o.status === f.status) && (!f.month || o.date.startsWith(f.month))
      && (!f.q || (o.description + wMap.get(o.workerId)?.name + pMap.get(o.projectId)?.name).toLowerCase().includes(f.q.toLowerCase())))
    .sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start)), [rows, f, wMap, pMap]);

  const totals = filtered.filter((o) => o.status !== "rechazada").reduce((a, o) => ({ h: a.h + o.hours, c: a.c + o.cost }), { h: 0, c: 0 });

  async function setStatus(o: Overtime, status: string) {
    await api("PATCH", `/api/overtime/${o.id}`, { status });
    toast.show(status === "aprobada" ? "Registro aprobado" : "Registro rechazado");
    reload();
  }
  async function remove(o: Overtime) {
    if (!confirm("¿Eliminar este registro de horas extras?")) return;
    await api("DELETE", `/api/overtime/${o.id}`);
    toast.show("Registro eliminado");
    reload();
  }
  function exportCsv() {
    downloadCsv(`horas-extras-${today()}.csv`, [
      ["Fecha", "Trabajador", "Proyecto", "Inicio", "Fin", "Horas", "Tipo", "Recargo", "Costo", "Estado", "Descripción"],
      ...filtered.map((o) => [o.date, wMap.get(o.workerId)?.name ?? "", pMap.get(o.projectId)?.name ?? "", o.start, o.end, o.hours,
        OT_TYPES.find((t) => t.value === o.type)?.label ?? o.type, o.multiplier, o.cost, o.status, o.description]),
    ]);
  }

  const months = [...new Set((rows ?? []).map((o) => o.date.slice(0, 7)))].sort().reverse();

  return (
    <>
      <PageHead title="Registros" sub="Cada hora extra queda ligada a un trabajador y a un proyecto.">
        <a className="btn" href={`/api/export?${new URLSearchParams(Object.entries({ projectId: f.projectId, workerId: f.workerId, status: f.status, month: f.month }).filter(([, v]) => v))}`}>
          <Icon name="download" /> Exportar Excel
        </a>
        <button className="btn" onClick={exportCsv} disabled={!filtered.length}>CSV</button>
        <button className="btn accent" onClick={() => setEdit({})}><Icon name="plus" /> Registrar horas</button>
      </PageHead>

      <div className="filters" style={{ marginBottom: 16 }}>
        <input className="input" placeholder="Buscar…" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} aria-label="Buscar" />
        <select className="input" value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.target.value })} aria-label="Proyecto">
          <option value="">Todos los proyectos</option>{projects?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className="input" value={f.workerId} onChange={(e) => setF({ ...f, workerId: e.target.value })} aria-label="Trabajador">
          <option value="">Todos los trabajadores</option>{workers?.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <select className="input" value={f.month} onChange={(e) => setF({ ...f, month: e.target.value })} aria-label="Mes">
          <option value="">Todos los meses</option>{months.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select className="input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} aria-label="Estado">
          <option value="">Todos los estados</option><option value="pendiente">Pendiente</option><option value="aprobada">Aprobada</option><option value="rechazada">Rechazada</option>
        </select>
        <span style={{ marginLeft: "auto", color: "var(--ink-2)" }} className="num">
          {filtered.length} registros · <b>{Math.round(totals.h * 10) / 10} h</b> · <b>{fmtMoney(totals.c, cur)}</b>
        </span>
      </div>

      <div className="card table-wrap">
        {!rows ? <div className="skeleton" style={{ height: 300, margin: 16 }} /> : !filtered.length ? (
          <Empty title="Sin registros" hint={rows.length ? "Ningún registro coincide con los filtros." : "Registra la primera hora extra del equipo."} />
        ) : (
          <table>
            <thead><tr><th>Fecha</th><th>Trabajador</th><th>Proyecto</th><th>Horario</th><th className="r">Horas</th><th>Tipo</th><th className="r">Costo</th><th>Estado</th><th /></tr></thead>
            <tbody>
              {filtered.map((o) => {
                const p = pMap.get(o.projectId);
                return (
                  <tr key={o.id}>
                    <td className="num" style={{ whiteSpace: "nowrap" }}>{fmtDate(o.date)}</td>
                    <td><div className="cell-main">{wMap.get(o.workerId)?.name ?? "—"}</div><div className="cell-sub">{o.description || wMap.get(o.workerId)?.role}</div></td>
                    <td><span className="row"><i className="dot" style={{ background: p?.color }} />{p?.name ?? "—"}</span></td>
                    <td className="num">{o.start}–{o.end}</td>
                    <td className="r num"><b>{o.hours}</b></td>
                    <td><Badge>{OT_TYPES.find((t) => t.value === o.type)?.label} ×{o.multiplier}</Badge></td>
                    <td className="r num">{fmtMoney(o.cost, cur)}</td>
                    <td><Badge kind={STATUS[o.status]}>{o.status[0].toUpperCase() + o.status.slice(1)}</Badge></td>
                    <td>
                      <div className="actions">
                        {o.status === "pendiente" && <>
                          <button className="btn sm icon-btn" title="Aprobar" aria-label="Aprobar" onClick={() => setStatus(o, "aprobada")}><Icon name="check" size={15} /></button>
                          <button className="btn sm icon-btn danger" title="Rechazar" aria-label="Rechazar" onClick={() => setStatus(o, "rechazada")}><Icon name="x" size={15} /></button>
                        </>}
                        <button className="btn sm ghost icon-btn" aria-label="Editar" onClick={() => setEdit(o)}><Icon name="edit" size={15} /></button>
                        <button className="btn sm ghost icon-btn danger" aria-label="Eliminar" onClick={() => remove(o)}><Icon name="trash" size={15} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {edit && workers && projects && settings && (
        <OvertimeForm initial={edit} workers={workers.filter((w) => w.active || w.id === edit.workerId)} projects={projects.filter((p) => p.status !== "cerrado" || p.id === edit.projectId)}
          settings={settings} onClose={() => setEdit(null)}
          onSaved={() => { setEdit(null); toast.show("Registro guardado"); reload(); }} />
      )}
      <Toast msg={toast.msg} />
    </>
  );
}

function OvertimeForm({ initial, workers, projects, settings, onClose, onSaved }: {
  initial: Partial<Overtime>; workers: Worker[]; projects: Project[]; settings: Settings; onClose: () => void; onSaved: () => void;
}) {
  const [v, setV] = useState({
    workerId: initial.workerId ?? "", projectId: initial.projectId ?? "", date: initial.date ?? today(),
    start: initial.start ?? "18:00", end: initial.end ?? "20:00", type: initial.type ?? "diurna",
    description: initial.description ?? "", status: initial.status ?? "pendiente",
  });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const hours = hoursBetween(v.start, v.end);
  const mult = settings.multipliers[v.type];
  const rate = workers.find((w) => w.id === v.workerId)?.hourlyRate ?? 0;
  const set = (k: string, val: string) => setV((x) => ({ ...x, [k]: val }));

  async function save() {
    setBusy(true); setErr("");
    try {
      if (initial.id) await api("PATCH", `/api/overtime/${initial.id}`, v);
      else await api("POST", "/api/overtime", v);
      onSaved();
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  return (
    <Modal title={initial.id ? "Editar horas extras" : "Registrar horas extras"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn accent" onClick={save} disabled={busy || !v.workerId || !v.projectId}>Guardar</button></>}>
      <div className="form-grid">
        <Field label="Trabajador">
          <select className="input" value={v.workerId} onChange={(e) => set("workerId", e.target.value)} autoFocus>
            <option value="">Seleccionar…</option>{workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </Field>
        <Field label="Proyecto">
          <select className="input" value={v.projectId} onChange={(e) => set("projectId", e.target.value)}>
            <option value="">Seleccionar…</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
          </select>
        </Field>
        <Field label="Fecha"><input className="input" type="date" value={v.date} onChange={(e) => set("date", e.target.value)} /></Field>
        <Field label="Tipo">
          <select className="input" value={v.type} onChange={(e) => set("type", e.target.value)}>
            {OT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label} (×{settings.multipliers[t.value]})</option>)}
          </select>
        </Field>
        <Field label="Hora inicio"><input className="input" type="time" value={v.start} onChange={(e) => set("start", e.target.value)} /></Field>
        <Field label="Hora fin"><input className="input" type="time" value={v.end} onChange={(e) => set("end", e.target.value)} /></Field>
        <Field label="Descripción (opcional)" full><textarea className="input" value={v.description} onChange={(e) => set("description", e.target.value)} placeholder="¿Qué se hizo?" /></Field>
      </div>
      <div className="preview">
        <div><div className="cell-sub">Duración</div><b className="num">{hours} h</b></div>
        <div><div className="cell-sub">Valor hora × recargo</div><b className="num">{fmtMoney(rate, settings.currency)} × {mult}</b></div>
        <div style={{ textAlign: "right" }}><div className="cell-sub">Costo estimado</div><b className="num">{fmtMoney(Math.round(hours * rate * mult), settings.currency)}</b></div>
      </div>
      {err && <div className="error">{err}</div>}
    </Modal>
  );
}
