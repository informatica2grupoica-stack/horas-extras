"use client";
import { useMemo, useState } from "react";
import { Badge, Empty, Field, Icon, Modal, PageHead, Toast, api, useApi, useToast } from "@/components/ui";
import { fmtMoney } from "@/lib/format";
import type { Overtime, Project, Settings } from "@/lib/types";

const COLORS = ["#d9480f", "#3b5bdb", "#2f9e44", "#ae3ec9", "#0c8599", "#c2255c", "#e67700", "#495057"];
const KIND = { activo: "ok", pausado: "warn", cerrado: undefined } as const;

export default function Page() {
  const { data: projects, reload } = useApi<Project[]>("/api/projects");
  const { data: ot } = useApi<Overtime[]>("/api/overtime");
  const { data: settings } = useApi<Settings>("/api/settings");
  const [edit, setEdit] = useState<Partial<Project> | null>(null);
  const [q, setQ] = useState("");
  const toast = useToast();

  const stats = useMemo(() => {
    const m = new Map<string, { h: number; c: number }>();
    ot?.filter((o) => o.status !== "rechazada").forEach((o) => {
      const s = m.get(o.projectId) ?? { h: 0, c: 0 };
      s.h += o.hours; s.c += o.cost; m.set(o.projectId, s);
    });
    return m;
  }, [ot]);

  const sorted = useMemo(() => {
    const n = (c: string) => Number(c.replace(/[^0-9]/g, "")) || 0;
    const term = q.trim().toLowerCase();
    return (projects ?? [])
      .filter((p) => !term || (p.code + " " + p.name + " " + p.client).toLowerCase().includes(term))
      .sort((a, b) => n(b.code) - n(a.code) || a.name.localeCompare(b.name));
  }, [projects, q]);

  async function remove(p: Project) {
    if (!confirm(`¿Eliminar el proyecto ${p.name}?`)) return;
    try { await api("DELETE", `/api/projects/${p.id}`); toast.show("Proyecto eliminado"); reload(); }
    catch (e) { toast.show((e as Error).message); }
  }

  return (
    <>
      <PageHead title="Proyectos" sub="Define el presupuesto de horas extras y controla cuánto consume cada uno.">
        <button className="btn accent" onClick={() => setEdit({ color: COLORS[0], status: "activo" })}><Icon name="plus" /> Nuevo proyecto</button>
      </PageHead>
      <div className="filters" style={{ marginBottom: 16 }}>
        <input className="input" style={{ minWidth: 280 }} placeholder="Buscar por código o nombre…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar proyecto" />
        <span className="cell-sub" style={{ maxWidth: "none" }}>{sorted.length} de {projects?.length ?? 0} proyectos</span>
      </div>
      <div className="card table-wrap">
        {!projects ? <div className="skeleton" style={{ height: 240, margin: 16 }} /> : !projects.length ? (
          <Empty title="Aún no hay proyectos" hint="Crea un proyecto para asignarle horas extras." />
        ) : (
          <table>
            <thead><tr><th>Proyecto</th><th>Cliente</th><th>Consumo de presupuesto</th><th className="r">Costo acumulado</th><th>Estado</th><th /></tr></thead>
            <tbody>
              {sorted.map((p) => {
                const s = stats.get(p.id) ?? { h: 0, c: 0 };
                const pct = p.budgetHours ? s.h / p.budgetHours : 0;
                const col = pct > 1 ? "var(--bad)" : pct >= 0.8 ? "var(--warn)" : "var(--ok)";
                return (
                  <tr key={p.id}>
                    <td className="wrap"><span className="row" style={{ alignItems: "flex-start" }}><i className="dot" style={{ background: p.color, marginTop: 7 }} /><span><div className="cell-main">{p.name}</div><div className="cell-sub mono">{p.code}</div></span></span></td>
                    <td>{p.client || "—"}</td>
                    <td style={{ minWidth: 170 }}>
                      <div className="row" style={{ justifyContent: "space-between", marginBottom: 5 }}>
                        <span className="num">{Math.round(s.h * 10) / 10} / {p.budgetHours || "∞"} h</span>
                        {p.budgetHours > 0 && <b className="num" style={{ color: col }}>{Math.round(pct * 100)}%</b>}
                      </div>
                      {p.budgetHours > 0 && <div className="bar"><i style={{ width: `${Math.min(pct, 1) * 100}%`, background: col }} /></div>}
                    </td>
                    <td className="r num">{fmtMoney(s.c, settings?.currency)}</td>
                    <td><Badge kind={KIND[p.status]}>{p.status[0].toUpperCase() + p.status.slice(1)}</Badge></td>
                    <td><div className="actions">
                      <button className="btn sm ghost icon-btn" aria-label="Editar" onClick={() => setEdit(p)}><Icon name="edit" size={15} /></button>
                      <button className="btn sm ghost icon-btn danger" aria-label="Eliminar" onClick={() => remove(p)}><Icon name="trash" size={15} /></button>
                    </div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {edit && <ProjectForm initial={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); toast.show("Proyecto guardado"); reload(); }} />}
      <Toast msg={toast.msg} />
    </>
  );
}

function ProjectForm({ initial, onClose, onSaved }: { initial: Partial<Project>; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState({ code: initial.code ?? "", name: initial.name ?? "", client: initial.client ?? "", budgetHours: String(initial.budgetHours ?? ""), status: initial.status ?? "activo", color: initial.color ?? COLORS[0] });
  const [err, setErr] = useState("");
  async function save() {
    try {
      const body = { ...v, budgetHours: Number(v.budgetHours) || 0 };
      if (initial.id) await api("PATCH", `/api/projects/${initial.id}`, body); else await api("POST", "/api/projects", body);
      onSaved();
    } catch (e) { setErr((e as Error).message); }
  }
  return (
    <Modal title={initial.id ? "Editar proyecto" : "Nuevo proyecto"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn accent" onClick={save}>Guardar</button></>}>
      <div className="form-grid">
        <Field label="Nombre" full><input className="input" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} autoFocus /></Field>
        <Field label="Código"><input className="input" value={v.code} onChange={(e) => setV({ ...v, code: e.target.value })} placeholder="OB-101" /></Field>
        <Field label="Cliente"><input className="input" value={v.client} onChange={(e) => setV({ ...v, client: e.target.value })} /></Field>
        <Field label="Presupuesto de horas extras"><input className="input" type="number" min="0" value={v.budgetHours} onChange={(e) => setV({ ...v, budgetHours: e.target.value })} placeholder="0 = sin límite" /></Field>
        <Field label="Estado">
          <select className="input" value={v.status} onChange={(e) => setV({ ...v, status: e.target.value as Project["status"] })}><option value="activo">Activo</option><option value="pausado">Pausado</option><option value="cerrado">Cerrado</option></select>
        </Field>
        <Field label="Color" full>
          <div className="row" style={{ gap: 10 }}>
            {COLORS.map((c) => (
              <button key={c} type="button" aria-label={c} onClick={() => setV({ ...v, color: c })}
                style={{ width: 28, height: 28, borderRadius: 99, background: c, border: "2px solid #fff", boxShadow: v.color === c ? `0 0 0 2px ${c}` : "0 0 0 1px var(--line)", cursor: "pointer", transition: "transform 140ms var(--ease-out)" }} />
            ))}
          </div>
        </Field>
      </div>
      {err && <div className="error">{err}</div>}
    </Modal>
  );
}
