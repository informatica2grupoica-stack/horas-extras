export const fmtHours = (n: number) =>
  (Math.round(n * 10) / 10).toLocaleString("es-CL", { maximumFractionDigits: 1 }) + " h";
export const fmtNum = (n: number) => Math.round(n * 10) / 10;
export const fmtMoney = (n: number, cur = "CLP") =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(n);
export const fmtCompact = (n: number) =>
  new Intl.NumberFormat("es-CL", { notation: "compact", maximumFractionDigits: 1 }).format(n);
const MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
export const monthLabel = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS[m - 1]} ${String(y).slice(2)}`;
};
export const fmtDate = (d: string) => {
  const [y, m, day] = d.split("-").map(Number);
  return `${String(day).padStart(2, "0")} ${MONTHS[m - 1]} ${y}`;
};
export const today = () => new Date().toISOString().slice(0, 10);
