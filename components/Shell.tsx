"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "./ui";

const NAV = [
  { href: "/", label: "Panel", icon: "chart" },
  { href: "/registros", label: "Registros", icon: "clock" },
  { href: "/proyectos", label: "Proyectos", icon: "folder" },
  { href: "/trabajadores", label: "Trabajadores", icon: "users" },
  { href: "/configuracion", label: "Configuración", icon: "cog" },
] as const;

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [ephemeral, setEphemeral] = useState(false);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    fetch("/api/health").then((r) => r.json()).then((h) => setEphemeral(h.ephemeral)).catch(() => {});
  }, []);

  return (
    <div className="app">
      <aside className={`side ${open ? "open" : ""}`}>
        <div className="brand">
          <span className="brand-mark"><Icon name="clock" size={15} /></span>
          Horas Extras
        </div>
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={`nav-link ${(n.href === "/" ? path === "/" : path.startsWith(n.href)) ? "on" : ""}`}>
            <Icon name={n.icon} size={17} /> {n.label}
          </Link>
        ))}
        <div className="side-foot">Uso interno · sin inicio de sesión</div>
      </aside>
      <div>
        <div style={{ padding: "12px 16px 0" }}>
          <button className="btn icon-btn menu-btn" aria-label="Menú" onClick={() => setOpen(!open)}>
            <Icon name="menu" size={17} />
          </button>
        </div>
        <main className="main">
          {ephemeral && (
            <div className="banner">
              Falta conectar la base de datos: los datos se borrarán. En Vercel ve a <b>Storage → Neon (Postgres)</b> y conéctala al proyecto, luego vuelve a desplegar.
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
