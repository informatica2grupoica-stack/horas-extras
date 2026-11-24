import ExcelJS from "exceljs";
import { getSettings, list } from "@/lib/db";
import { OT_TYPES, type Overtime, type Project, type Worker } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const INK = "FF17160F";
const MONEY = '"$"#,##0';
const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const monthName = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;

function style(ws: ExcelJS.Worksheet, widths: number[]) {
  ws.columns.forEach((c, i) => (c.width = widths[i] ?? 14));
  const head = ws.getRow(1);
  head.height = 24;
  head.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Calibri", size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INK } };
    cell.alignment = { vertical: "middle", horizontal: "left" };
  });
  ws.views = [{ state: "frozen", ySplit: 1 }];
}
const sum = (xs: Overtime[], k: "hours" | "cost") => xs.reduce((a, o) => a + o[k], 0);

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const from = q.get("from") || "";
  const to = q.get("to") || "";
  const projectId = q.get("projectId") || "";
  const workerId = q.get("workerId") || "";
  const status = q.get("status") || "";
  const month = q.get("month") || "";

  const [all, workers, projects, settings] = await Promise.all([
    list<Overtime>("overtime"), list<Worker>("workers"), list<Project>("projects"), getSettings(),
  ]);
  const wMap = new Map(workers.map((w) => [w.id, w]));
  const pMap = new Map(projects.map((p) => [p.id, p]));

  const rows = all
    .filter((o) => (!from || o.date >= from) && (!to || o.date <= to) && (!projectId || o.projectId === projectId)
      && (!workerId || o.workerId === workerId) && (!status || o.status === status) && (!month || o.date.startsWith(month)))
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  const valid = rows.filter((o) => o.status !== "rechazada");

  const wb = new ExcelJS.Workbook();
  wb.creator = "Horas Extras";
  wb.created = new Date();

  // 1. Resumen
  const rs = wb.addWorksheet("Resumen");
  rs.columns = [{ header: "Indicador", key: "k" }, { header: "Valor", key: "v" }];
  const months = [...new Set(valid.map((o) => o.date.slice(0, 7)))].sort();
  const byMonthAll = months.map((m) => ({ m, h: sum(valid.filter((o) => o.date.startsWith(m)), "hours") }));
  const topMonth = [...byMonthAll].sort((a, b) => b.h - a.h)[0];
  const projTot = projects.map((p) => ({ p, h: sum(valid.filter((o) => o.projectId === p.id), "hours") })).sort((a, b) => b.h - a.h);
  const workTot = workers.map((w) => ({ w, h: sum(valid.filter((o) => o.workerId === w.id), "hours") })).sort((a, b) => b.h - a.h);
  const totalH = sum(valid, "hours");
  const totalC = sum(valid, "cost");
  const info: [string, string | number, string?][] = [
    ["Generado", new Date().toLocaleString("es-CL")],
    ["Periodo", `${from || (valid[0]?.date ?? "—")}  a  ${to || (valid[valid.length - 1]?.date ?? "—")}`],
    ["Moneda", settings.currency],
    ["Registros incluidos (sin rechazados)", valid.length],
    ["Registros rechazados (excluidos)", rows.length - valid.length],
    ["Horas extras totales", Math.round(totalH * 100) / 100],
    ["Costo total", totalC, MONEY],
    ["Costo promedio por hora", totalH ? Math.round(totalC / totalH) : 0, MONEY],
    ["Promedio de horas por mes", months.length ? Math.round((totalH / months.length) * 100) / 100 : 0],
    ["Mes con más horas", topMonth ? `${monthName(topMonth.m)} (${topMonth.h} h)` : "—"],
    ["Proyecto que más consume", projTot[0]?.h ? `${projTot[0].p.name} (${projTot[0].h} h)` : "—"],
    ["Trabajador con más horas", workTot[0]?.h ? `${workTot[0].w.name} (${workTot[0].h} h)` : "—"],
    ["Pendientes de aprobar", rows.filter((o) => o.status === "pendiente").length],
  ];
  info.forEach(([k, v, fmt]) => {
    const r = rs.addRow({ k, v });
    r.getCell(1).font = { bold: true };
    r.getCell(2).alignment = { horizontal: "left" };
    if (fmt) r.getCell(2).numFmt = fmt;
  });
  style(rs, [38, 42]);

  // 2. Registros
  const ws = wb.addWorksheet("Registros");
  ws.columns = [
    { header: "Fecha" }, { header: "Mes" }, { header: "Trabajador" }, { header: "RUT" }, { header: "Cargo" },
    { header: "Código proyecto" }, { header: "Proyecto" }, { header: "Cliente" }, { header: "Inicio" }, { header: "Fin" },
    { header: "Horas" }, { header: "Tipo" }, { header: "Recargo" }, { header: "Valor hora" }, { header: "Costo" },
    { header: "Estado" }, { header: "Descripción" },
  ];
  for (const o of rows) {
    const w = wMap.get(o.workerId);
    const p = pMap.get(o.projectId);
    const r = ws.addRow([
      new Date(o.date + "T12:00:00"), monthName(o.date.slice(0, 7)), w?.name ?? "", w?.document ?? "", w?.role ?? "",
      p?.code ?? "", p?.name ?? "", p?.client ?? "", o.start, o.end, o.hours,
      OT_TYPES.find((t) => t.value === o.type)?.label ?? o.type, o.multiplier, w?.hourlyRate ?? 0, o.cost,
      o.status[0].toUpperCase() + o.status.slice(1), o.description,
    ]);
    r.getCell(1).numFmt = "dd-mm-yyyy";
    r.getCell(14).numFmt = MONEY;
    r.getCell(15).numFmt = MONEY;
    if (o.status === "rechazada") r.font = { color: { argb: "FF8A877B" }, strike: true };
  }
  const n = rows.length;
  const tot = ws.addRow(["TOTAL (sin rechazados)", "", "", "", "", "", "", "", "", "",
    { formula: `SUMIFS(K2:K${n + 1},P2:P${n + 1},"<>Rechazada")`, result: Math.round(totalH * 100) / 100 }, "", "", "",
    { formula: `SUMIFS(O2:O${n + 1},P2:P${n + 1},"<>Rechazada")`, result: totalC }]);
  tot.font = { bold: true };
  tot.getCell(15).numFmt = MONEY;
  tot.eachCell((c) => (c.border = { top: { style: "thin" } }));
  ws.autoFilter = { from: "A1", to: "Q1" };
  style(ws, [13, 18, 24, 14, 22, 12, 26, 22, 8, 8, 9, 17, 9, 12, 13, 12, 36]);

  // 3. Por mes
  const sm = wb.addWorksheet("Por mes");
  sm.columns = [{ header: "Mes" }, { header: "Horas" }, { header: "Costo" }, { header: "Registros" }, { header: "% del total de horas" }];
  months.forEach((m) => {
    const xs = valid.filter((o) => o.date.startsWith(m));
    const r = sm.addRow([monthName(m), sum(xs, "hours"), sum(xs, "cost"), xs.length, totalH ? sum(xs, "hours") / totalH : 0]);
    r.getCell(3).numFmt = MONEY;
    r.getCell(5).numFmt = "0.0%";
  });
  style(sm, [20, 12, 16, 12, 22]);

  // 4. Por proyecto
  const sp = wb.addWorksheet("Por proyecto");
  sp.columns = [{ header: "Código" }, { header: "Proyecto" }, { header: "Cliente" }, { header: "Horas" }, { header: "Costo" }, { header: "Registros" },
    { header: "Presupuesto (h)" }, { header: "% presupuesto usado" }];
  projects.forEach((p) => {
    const xs = valid.filter((o) => o.projectId === p.id);
    if (!xs.length) return;
    const used = sum(all.filter((o) => o.projectId === p.id && o.status !== "rechazada"), "hours");
    const r = sp.addRow([p.code, p.name, p.client, sum(xs, "hours"), sum(xs, "cost"), xs.length, p.budgetHours || "", p.budgetHours ? used / p.budgetHours : ""]);
    r.getCell(5).numFmt = MONEY;
    r.getCell(8).numFmt = "0.0%";
  });
  style(sp, [12, 28, 24, 10, 16, 11, 16, 22]);

  // 5. Por trabajador
  const sw = wb.addWorksheet("Por trabajador");
  sw.columns = [{ header: "Trabajador" }, { header: "RUT" }, { header: "Cargo" }, { header: "Horas" }, { header: "Costo" }, { header: "Registros" }, { header: "Valor hora" }];
  workTot.filter((x) => x.h > 0).forEach(({ w }) => {
    const xs = valid.filter((o) => o.workerId === w.id);
    const r = sw.addRow([w.name, w.document, w.role, sum(xs, "hours"), sum(xs, "cost"), xs.length, w.hourlyRate]);
    r.getCell(5).numFmt = MONEY;
    r.getCell(7).numFmt = MONEY;
  });
  style(sw, [26, 14, 24, 10, 16, 11, 13]);

  // 6. Proyecto x mes (horas)
  const sx = wb.addWorksheet("Proyecto x mes");
  sx.columns = [{ header: "Proyecto" }, ...months.map((m) => ({ header: monthName(m) })), { header: "Total" }];
  projects.forEach((p) => {
    const vals = months.map((m) => sum(valid.filter((o) => o.projectId === p.id && o.date.startsWith(m)), "hours"));
    if (!vals.some(Boolean)) return;
    sx.addRow([p.name, ...vals, vals.reduce((a, b) => a + b, 0)]);
  });
  style(sx, [28, ...months.map(() => 15), 10]);
  // Escala de color tipo mapa de calor
  if (sx.rowCount > 1 && months.length) {
    const lastCol = String.fromCharCode(65 + months.length);
    sx.addConditionalFormatting({
      ref: `B2:${lastCol}${sx.rowCount}`,
      rules: [{ type: "colorScale", priority: 1, cfvo: [{ type: "min" }, { type: "max" }], color: [{ argb: "FFFDEEE6" }, { argb: "FFD9480F" }] }],
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="horas-extras-${stamp}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
