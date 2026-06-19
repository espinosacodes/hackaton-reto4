"use client";

import Link from "next/link";
import { PageHeader } from "@/components/AppShell";
import { Card, CardHeader, Badge, Progress, Dot, sevTone, sevLabel, sevColor } from "@/components/ui";
import { Reveal, CountUp } from "@/components/motion";
import { resumenCompliance } from "@/lib/compliance";
import { cop, copShort, fmtDate } from "@/lib/utils";
import { liquidar } from "@/lib/liquidacion";
import { useParametros } from "@/lib/store";
import { HOY } from "@/lib/data/contratos";
import { NAV } from "@/components/nav";
import { Warning2, Convertshape2, ArrowRight2, Danger, People } from "iconsax-react";

const LABORALES = ["indefinido", "fijo", "obra_labor", "aprendizaje"];

export default function Dashboard() {
  const r = resumenCompliance();
  const params = useParametros();

  // Pasivo prestacional ACUMULADO: solo contratos laborales activos (excluye civiles:
  // prestación de servicios y plataforma), en modo acumulado y con los parámetros vigentes.
  const pasivo = r.contratos.reduce(
    (s, c) =>
      s +
      (c.estado === "activo" && LABORALES.includes(c.tipo)
        ? liquidar(c, HOY, "sin_justa_causa", params, "acumulado").total
        : 0),
    0
  );

  const topAlertas = r.alertas.slice(0, 5);

  const kpis = [
    { label: "Índice de compliance", value: r.score, suffix: "/100", tone: r.bandaColor, icon: <Danger size={18} /> },
    { label: "Contratos activos", value: r.total, tone: "var(--ink)", icon: <People size={18} /> },
    { label: "Alertas abiertas", value: r.alertas.length, tone: r.criticas ? "var(--red)" : "var(--ink)", icon: <Warning2 size={18} /> },
    { label: "Riesgo reclasificación alto", value: r.reclaAlto, tone: r.reclaAlto ? "var(--warning)" : "var(--ink)", icon: <Convertshape2 size={18} /> },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        overline="Compliance laboral · Hurtado Gandini"
        title="Panel de compliance proactivo"
        subtitle="Lectura contractual asistida por IA, verificación determinista de prestaciones y detección temprana de riesgo laboral. Cada cálculo es auditable; cada decisión la valida el abogado."
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k, i) => (
          <Reveal key={k.label} delay={i * 0.06}>
            <Card className="px-5 py-4">
              <div className="flex items-center justify-between">
                <div className="overline">{k.label}</div>
                <span className="text-ink-3">{k.icon}</span>
              </div>
              <div className="font-num mt-2 flex items-baseline gap-1 text-[30px] leading-none" style={{ color: k.tone }}>
                <CountUp to={k.value} />
                {k.suffix && <span className="text-[15px] text-ink-3">{k.suffix}</span>}
              </div>
            </Card>
          </Reveal>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* Compliance gauge */}
        <Reveal delay={0.1} className="lg:col-span-1">
          <Card className="h-full">
            <CardHeader overline="Estado general" title="Índice de compliance" />
            <div className="px-5 py-5">
              <div className="flex items-end justify-between">
                <div className="font-num text-[48px] leading-none text-ink">
                  <CountUp to={r.score} />
                </div>
                <Badge tone={r.score >= 80 ? "success" : r.score >= 55 ? "warning" : "red"}>{r.banda}</Badge>
              </div>
              <Progress className="mt-4" value={r.score} tone={r.bandaColor} />
              <div className="mt-5 space-y-2.5">
                {[
                  { l: "Críticas", v: r.criticas, c: "var(--red)" },
                  { l: "Altas", v: r.altas, c: "var(--warning)" },
                  { l: "Medias", v: r.medias, c: "var(--info)" },
                ].map((row) => (
                  <div key={row.l} className="flex items-center gap-2 text-[13px]">
                    <Dot color={row.c} />
                    <span className="text-ink-2">{row.l}</span>
                    <span className="font-num ml-auto text-ink">{row.v}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 border-t border-border pt-4">
                <div className="overline mb-1">Pasivo prestacional estimado</div>
                <div className="font-num text-[22px] text-ink">{cop(pasivo)}</div>
                <div className="mt-1 text-[11px] text-ink-2">Pasivo acumulado de los vínculos laborales activos (excluye contratos civiles), asumiendo terminación sin justa causa.</div>
              </div>
            </div>
          </Card>
        </Reveal>

        {/* Top alerts */}
        <Reveal delay={0.16} className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader
              overline="Prioridad"
              title="Alertas que requieren acción"
              right={
                <Link href="/alertas" className="flex items-center gap-1 text-[12px] text-red-dark hover:underline">
                  Ver todas <ArrowRight2 size={14} />
                </Link>
              }
            />
            <div className="divide-y divide-border">
              {topAlertas.map((a) => (
                <Link
                  key={a.id}
                  href="/alertas"
                  className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-surface-2"
                >
                  <Dot color={sevColor[a.severidad]} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[13.5px] font-medium text-ink">{a.titulo}</span>
                      <Badge tone={sevTone[a.severidad]}>{sevLabel[a.severidad]}</Badge>
                    </div>
                    <div className="mt-0.5 truncate text-[12px] text-ink-2">
                      {a.empleado} · {a.norma}
                    </div>
                  </div>
                  {a.diasRestantes !== undefined && (
                    <div className="font-num shrink-0 text-right text-[12px]" style={{ color: a.diasRestantes < 0 ? "var(--red)" : "var(--ink-3)" }}>
                      {a.diasRestantes < 0 ? `${Math.abs(a.diasRestantes)}d vencido` : `${a.diasRestantes}d`}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </Card>
        </Reveal>
      </div>

      {/* Servicios activos — derivados del menú para que siempre coincidan con lo que existe */}
      <div className="mb-2 mt-5 flex items-baseline gap-2">
        <h2 className="font-head text-[16px] text-ink">Servicios activos</h2>
        <span className="text-[12px] text-ink-3">· {NAV.filter((m) => m.href !== "/").length} módulos</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {NAV.filter((m) => m.href !== "/").map((m, i) => (
          <Reveal key={m.href} delay={0.2 + i * 0.05}>
            <Link href={m.href}>
              <Card className="group h-full px-5 py-4 transition-colors hover:border-border-2 hover:bg-surface-2">
                <m.icon size={22} color="var(--red)" variant="Bulk" />
                <div className="mt-3 flex items-center gap-1 font-head text-[14px] text-ink">
                  {m.label}
                  <ArrowRight2 size={14} className="opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <div className="mt-1 text-[12px] leading-snug text-ink-2">{m.desc}</div>
              </Card>
            </Link>
          </Reveal>
        ))}
      </div>

      <p className="mt-6 text-center text-[11px] text-ink-3">
        Datos de demostración · referencia {fmtDate(HOY)} · pasivo total {copShort(pasivo)}
      </p>
    </div>
  );
}
