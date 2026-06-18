"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";
import { NAV } from "./nav";
import { cn } from "@/lib/utils";
import { SearchNormal1, Notification, ShieldTick } from "iconsax-react";
import { CONTRATOS, HOY } from "@/lib/data/contratos";
import { generarAlertas } from "@/lib/alertas";
import { fmtDate } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const alertas = generarAlertas(CONTRATOS, HOY);
  const criticas = alertas.filter((a) => a.severidad === "critica").length;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-surface lg:flex">
        <div className="flex h-16 shrink-0 items-center border-b border-border px-5">
          <Logo />
        </div>
        <nav className="flex-1 px-3 py-4">
          <div className="overline px-2 pb-2">Operación legal</div>
          {NAV.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
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
                {item.href === "/alertas" && criticas > 0 && (
                  <span className="font-num inline-flex h-4 min-w-4 items-center justify-center bg-red px-1 text-[10px] font-bold text-white">
                    {criticas}
                  </span>
                )}
              </Link>
            );
          })}
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

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="z-20 flex h-16 shrink-0 items-center gap-4 border-b border-border bg-bg/85 px-6 backdrop-blur">
          <div className="hairline hidden items-center gap-2 bg-surface px-3 py-1.5 text-[13px] text-ink-3 md:flex md:w-72">
            <SearchNormal1 size={15} />
            <span>Buscar empleado, contrato…</span>
          </div>
          <div className="ml-auto flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <div className="text-[12px] font-medium text-ink">Empresa Demo S.A.S.</div>
              <div className="text-[11px] text-ink-3">Nómina · {CONTRATOS.length} vínculos · {fmtDate(HOY)}</div>
            </div>
            <div className="relative">
              <Notification size={20} color="var(--ink-2)" />
              {criticas > 0 && (
                <span className="absolute -right-1 -top-1 h-2 w-2 bg-red pulse-red" style={{ borderRadius: "var(--radius)" }} />
              )}
            </div>
            <div className="flex h-8 w-8 items-center justify-center bg-black text-[12px] font-medium text-white" style={{ borderRadius: "var(--radius)" }}>
              RH
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto px-6 py-7">{children}</main>
      </div>
    </div>
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
