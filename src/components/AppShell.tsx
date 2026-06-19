"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "./Logo";
import { NAV } from "./nav";
import { cn } from "@/lib/utils";
import { SearchNormal1, Notification, ShieldTick } from "iconsax-react";
import { generarAlertas } from "@/lib/alertas";
import { fmtDate } from "@/lib/utils";
import { useBusqueda, setBusqueda, useEmpresaActiva } from "@/lib/store";
import { AuthGate, UserMenu } from "./Auth";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <AppShellInner>{children}</AppShellInner>
    </AuthGate>
  );
}

function AppShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const busqueda = useBusqueda();
  const empresa = useEmpresaActiva();
  const alertas = empresa ? generarAlertas(empresa.contratos, empresa.hoy) : [];
  const criticas = alertas.filter((a) => a.severidad === "critica").length;
  const altas = alertas.filter((a) => a.severidad === "alta").length;
  const medias = alertas.filter((a) => a.severidad === "media").length;

  // Menú lateral para pantallas angostas (< lg): se abre con la hamburguesa y se
  // cierra al tocar un enlace (onNavigate) o el fondo oscuro.
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar (desktop) */}
      <aside className="hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-surface lg:flex">
        <div className="flex h-16 shrink-0 items-center border-b border-border px-5">
          <Logo />
        </div>
        <nav className="flex-1 px-3 py-4">
          <NavLinks pathname={pathname} criticas={criticas} altas={altas} medias={medias} />
        </nav>
        <div className="border-t border-border p-4">
          <div className="hairline flex items-start gap-2 bg-surface-2 px-3 py-2.5">
            <ShieldTick size={16} color="var(--success)" variant="Bold" className="mt-0.5 shrink-0" />
            <div className="text-[11px] leading-snug text-ink-2">
              <span className="font-medium text-ink">Decisión asistida.</span> Toda salida
              requiere validación del abogado responsable.
            </div>
          </div>
        </div>
      </aside>

      {/* Menú lateral (móvil / pantalla angosta) */}
      {navOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setNavOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-64 flex-col border-r border-border bg-surface shadow-xl">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-5">
              <Logo />
              <button
                onClick={() => setNavOpen(false)}
                className="text-ink-3 hover:text-ink"
                aria-label="Cerrar menú"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-4">
              <NavLinks
                pathname={pathname}
                criticas={criticas}
                altas={altas}
                medias={medias}
                onNavigate={() => setNavOpen(false)}
              />
            </nav>
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="z-20 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-bg/85 px-4 backdrop-blur md:px-6">
          {/* Hamburguesa (solo pantallas angostas) */}
          <button
            onClick={() => setNavOpen(true)}
            className="shrink-0 text-ink-2 hover:text-ink lg:hidden"
            aria-label="Abrir menú"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              router.push("/contratos");
            }}
            className="hairline hidden items-center gap-2 bg-surface px-3 py-1.5 text-[13px] md:flex md:w-72"
          >
            <SearchNormal1 size={15} className="shrink-0 text-ink-3" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar empleado, contrato…"
              className="w-full bg-transparent text-ink placeholder:text-ink-3 focus:outline-none"
            />
          </form>
          <div className="ml-auto flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <div className="text-[12px] font-medium text-ink">{empresa?.nombre ?? "—"}</div>
              <div className="text-[11px] text-ink-3">
                Nómina · {empresa?.contratos.length ?? 0} vínculos · {empresa ? fmtDate(empresa.hoy) : ""}
              </div>
            </div>
            <Link href="/alertas" className="relative" aria-label="Ver alertas">
              <Notification size={20} color="var(--ink-2)" />
              {criticas > 0 && (
                <span className="absolute -right-1 -top-1 h-2 w-2 bg-red pulse-red" style={{ borderRadius: "var(--radius)" }} />
              )}
            </Link>
            <UserMenu />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto px-4 py-6 md:px-6 md:py-7">{children}</main>
      </div>
    </div>
  );
}

// Píldora de conteo por severidad (rojo crítica / naranja alta / azul media).
function ConteoSeveridad({ n, color, title }: { n: number; color: string; title: string }) {
  if (n <= 0) return null;
  return (
    <span
      title={title}
      className="font-num inline-flex h-4 min-w-4 items-center justify-center px-1 text-[10px] font-bold text-white"
      style={{ background: color, borderRadius: "var(--radius)" }}
    >
      {n}
    </span>
  );
}

// Enlaces de navegación, reutilizados por el sidebar (desktop) y el menú móvil.
function NavLinks({
  pathname,
  criticas,
  altas,
  medias,
  onNavigate,
}: {
  pathname: string;
  criticas: number;
  altas: number;
  medias: number;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className="overline px-2 pb-2">Operación legal</div>
      {NAV.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "group relative mb-0.5 flex items-center gap-3 px-2 py-2 text-[13px] transition-colors",
              active
                ? "bg-surface-2 text-ink font-medium"
                : "text-ink-2 hover:bg-surface-2 hover:text-ink"
            )}
          >
            {active && (
              <span className="absolute left-0 top-1/2 h-5 -translate-y-1/2 bg-red" style={{ width: 2.5 }} />
            )}
            <Icon size={18} variant={active ? "Bold" : "Linear"} color={active ? "var(--red)" : "currentColor"} />
            <span className="flex-1">{item.label}</span>
            {item.href === "/alertas" && (
              <span className="flex items-center gap-1">
                <ConteoSeveridad n={criticas} color="var(--red)" title={`${criticas} crítica(s)`} />
                <ConteoSeveridad n={altas} color="var(--warning)" title={`${altas} alta(s)`} />
                <ConteoSeveridad n={medias} color="var(--info)" title={`${medias} media(s)`} />
              </span>
            )}
          </Link>
        );
      })}
    </>
  );
}

export function PageHeader({
  overline,
  title,
  subtitle,
  actions,
}: {
  overline: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <div className="overline mb-1.5">{overline}</div>
        <h1 className="font-display text-[30px] leading-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}
