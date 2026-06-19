import { PageHeader } from "@/components/AppShell";
import { Card, Badge, Dot, sevTone, sevLabel, sevColor } from "@/components/ui";
import { Reveal } from "@/components/motion";
import { generarAlertas } from "@/lib/alertas";
import { CONTRATOS, HOY } from "@/lib/data/contratos";
import { ArrowRight2 } from "iconsax-react";
import Link from "next/link";

export default function AlertasPage() {
  const alertas = generarAlertas(CONTRATOS, HOY);
  const counts = {
    critica: alertas.filter((a) => a.severidad === "critica").length,
    alta: alertas.filter((a) => a.severidad === "alta").length,
    media: alertas.filter((a) => a.severidad === "media").length,
    info: alertas.filter((a) => a.severidad === "info").length,
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        overline="Alertas tempranas"
        title="Vencimientos y obligaciones periódicas"
        subtitle="Motor determinista basado en fechas y parámetros de cada contrato. Detecta vencimientos de término fijo, vacaciones acumuladas, mora en seguridad social y exceso de jornada (Ley 2101/2021)."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Badge tone="red">{counts.critica} críticas</Badge>
        <Badge tone="warning">{counts.alta} altas</Badge>
        <Badge tone="info">{counts.media} medias</Badge>
        {counts.info > 0 && <Badge tone="neutral">{counts.info} informativas</Badge>}
      </div>

      <div className="space-y-2.5">
        {alertas.map((a, i) => (
          <Reveal key={a.id} delay={Math.min(i * 0.04, 0.4)}>
            <Card className="overflow-hidden">
              <div className="flex">
                <div className="w-1 shrink-0" style={{ background: sevColor[a.severidad] }} />
                <div className="flex-1 px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Dot color={sevColor[a.severidad]} />
                    <h3 className="font-head text-[15px] text-ink">{a.titulo}</h3>
                    <Badge tone={sevTone[a.severidad]}>{sevLabel[a.severidad]}</Badge>
                    {a.diasRestantes !== undefined && (
                      <span
                        className="font-num ml-auto text-[12px]"
                        style={{ color: a.diasRestantes < 0 ? "var(--red)" : "var(--ink-3)" }}
                      >
                        {a.diasRestantes < 0
                          ? `${Math.abs(a.diasRestantes)} días vencido`
                          : `${a.diasRestantes} días restantes`}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-[13px] leading-relaxed text-ink-2">{a.detalle}</p>
                  <div className="mt-3 hairline flex items-start gap-2 bg-surface-2 px-3 py-2">
                    <ArrowRight2 size={15} color="var(--red)" className="mt-0.5 shrink-0" />
                    <span className="text-[12.5px] text-ink">
                      <span className="font-medium">Acción RRHH:</span> {a.accion}
                    </span>
                  </div>
                  <div className="mt-2.5 flex items-center gap-3 text-[11px] text-ink-3">
                    <Link href="/contratos" className="hover:text-red-dark hover:underline">
                      {a.empleado} · {a.contratoId}
                    </Link>
                    <span>·</span>
                    <span className="font-num">{a.norma}</span>
                  </div>
                </div>
              </div>
            </Card>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
