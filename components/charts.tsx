"use client";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { fmtCompact, fmtMoney, monthLabel } from "@/lib/format";

const AXIS = { fontSize: 12, fill: "#8a877b" };
const GRID = "#efede7";

function Tip({ active, payload, label, unit = "h", money, cur }: { active?: boolean; payload?: { value: number; name?: string; payload?: Record<string, unknown> }[]; label?: string; unit?: string; money?: boolean; cur?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#17160f", color: "#fff", padding: "8px 12px", borderRadius: 9, fontSize: 12.5, boxShadow: "0 8px 24px rgba(0,0,0,.25)" }}>
      <div style={{ opacity: 0.6, marginBottom: 2 }}>{label ?? payload[0].name}</div>
      <b className="num">{money ? fmtMoney(payload[0].value, cur) : `${Math.round(payload[0].value * 10) / 10} ${unit}`}</b>
    </div>
  );
}

export function MonthChart({ data, metric, cur }: { data: { month: string; hours: number; cost: number }[]; metric: "hours" | "cost"; cur: string }) {
  const peak = Math.max(...data.map((d) => d[metric]), 0);
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="month" tickFormatter={monthLabel} tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v) => (metric === "cost" ? fmtCompact(v) : v)} />
        <Tooltip cursor={{ fill: "rgba(23,22,15,.04)" }} content={<Tip money={metric === "cost"} cur={cur} />} labelFormatter={(l) => monthLabel(String(l))} />
        <Bar dataKey={metric} radius={[6, 6, 0, 0]} maxBarSize={44} animationDuration={500}>
          {data.map((d) => (
            <Cell key={d.month} fill={d[metric] === peak && peak > 0 ? "#d9480f" : "#17160f"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TrendArea({ data }: { data: { month: string; hours: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="ga" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d9480f" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#d9480f" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="month" tickFormatter={monthLabel} tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} />
        <Tooltip content={<Tip />} labelFormatter={(l) => monthLabel(String(l))} />
        <Area type="monotone" dataKey="hours" stroke="#d9480f" strokeWidth={2} fill="url(#ga)" animationDuration={600} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function HBars({ rows }: { rows: { name: string; value: number; color: string; sub?: string }[] }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div style={{ display: "grid", gap: 14 }}>
      {rows.map((r) => (
        <div key={r.name}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
            <span className="row" style={{ fontWeight: 550, minWidth: 0 }}>
              <i className="dot" style={{ background: r.color }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
            </span>
            <span className="num" style={{ fontWeight: 600 }}>
              {Math.round(r.value * 10) / 10} h {r.sub && <span style={{ color: "var(--ink-3)", fontWeight: 400 }}>· {r.sub}</span>}
            </span>
          </div>
          <div className="bar"><i style={{ width: `${(r.value / max) * 100}%`, background: r.color }} /></div>
        </div>
      ))}
    </div>
  );
}

export function Donut({ data }: { data: { label: string; hours: number }[] }) {
  const colors = ["#17160f", "#d9480f", "#8a877b", "#f0a77c"];
  const total = data.reduce((a, d) => a + d.hours, 0);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 16, alignItems: "center" }}>
      <div style={{ position: "relative", height: 150 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="hours" nameKey="label" innerRadius={48} outerRadius={70} paddingAngle={2} stroke="none" animationDuration={500}>
              {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
            </Pie>
            <Tooltip content={<Tip />} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none", textAlign: "center" }}>
          <div><b className="num" style={{ fontSize: 18 }}>{Math.round(total)}</b><div style={{ fontSize: 11, color: "var(--ink-3)" }}>horas</div></div>
        </div>
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {data.map((d, i) => (
          <div key={d.label} className="row" style={{ justifyContent: "space-between" }}>
            <span className="row"><i className="dot" style={{ background: colors[i % colors.length] }} />{d.label}</span>
            <span className="num" style={{ color: "var(--ink-2)" }}>{total ? Math.round((d.hours / total) * 100) : 0}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function WeekdayBars({ data }: { data: { label: string; hours: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
        <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} />
        <Tooltip cursor={{ fill: "rgba(23,22,15,.04)" }} content={<Tip />} />
        <Bar dataKey="hours" fill="#17160f" radius={[5, 5, 0, 0]} maxBarSize={30} animationDuration={500} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Heatmap({ months, rows }: { months: string[]; rows: { id: string; code: string; name: string; color: string; values: number[] }[] }) {
  const max = Math.max(...rows.flatMap((r) => r.values), 1);
  return (
    <div className="table-wrap">
      <div className="heat" style={{ gridTemplateColumns: `minmax(130px, 1.4fr) repeat(${months.length}, minmax(44px, 1fr))`, minWidth: 130 + months.length * 48 }}>
        <div />
        {months.map((m) => <div key={m} className="hd">{monthLabel(m)}</div>)}
        {rows.map((r) => (
          <FragmentRow key={r.id} r={r} max={max} />
        ))}
      </div>
    </div>
  );
}
function FragmentRow({ r, max }: { r: { code: string; name: string; color: string; values: number[] }; max: number }) {
  return (
    <>
      <div className="row" style={{ fontWeight: 550, minWidth: 0 }}>
        <i className="dot" style={{ background: r.color }} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
      </div>
      {r.values.map((v, i) => {
        const t = v / max;
        return (
          <div key={i} className="cell num" title={`${r.name}: ${Math.round(v * 10) / 10} h`}
            style={{ background: v ? `rgba(217,72,15,${0.08 + t * 0.85})` : "var(--line-2)", color: t > 0.55 ? "#fff" : "var(--ink-2)" }}>
            {v ? Math.round(v) : ""}
          </div>
        );
      })}
    </>
  );
}
