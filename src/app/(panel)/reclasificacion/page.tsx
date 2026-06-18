import { PageHeader } from "@/components/AppShell";
import { Card, CardHeader, Badge, Progress } from "@/components/ui";
import { Reveal } from "@/components/motion";
import { CONTRATOS } from "@/lib/data/contratos";
import { evaluarReclasificacion } from "@/lib/reclasificacion";
import { TickCircle, CloseCircle, Cpu, Flash } from "iconsax-react";

const nivelTone = { alto: "red", medio: "warning", bajo: "success" } as const;
const nivelColor = { alto: "var(--red)", medio: "var(--warning)", bajo: "var(--success)" } as const;

export default function ReclasificacionPage() {
  const candidatos = CONTRATOS.filter(
    (c) => c.tipo === "prestacion_servicios" || c.tipo === "plataforma"
  );
  const resultados = candidatos.map(evaluarReclasificacion);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        overline="Detección de riesgo laboral"
        title="Test de reclasificación de contratos"
        subtitle="Evalúa contratos civiles y de plataforma frente a la primacía de la realidad (CP art. 53, CST art. 23) y la subordinación algorítmica de la Ley 2466/2025. Cada indicio está ponderado y referenciado a su norma."
      />

      <div className="mb-4 hairline flex items-start gap-3 bg-[var(--red-tint)] px-4 py-3">
        <Flash size={18} color="var(--red)" variant="Bold" className="mt-0.5 shrink-0" />
        <p className="text-[12.5px] leading-snug text-ink-2">
          <span className="font-medium text-ink">Elemento diferenciador — Ley 2466 de 2025.</span>{" "}
          Las plataformas digitales de reparto tienen presunción de vínculo laboral por subordinación algorítmica
          (asignación por algoritmo, geolocalización, calificación y penalización por rechazos).
        </p>
      </div>

      <div className="space-y-3">
        {resultados.map((r, idx) => {
          const c = candidatos[idx];
          return (
            <Reveal key={r.contratoId} delay={idx * 0.06}>
              <Card>
                <CardHeader
                  overline={c.tipo === "plataforma" ? "Trabajador de plataforma" : "Prestación de servicios"}
                  title={`${r.empleado} — ${c.cargo}`}
                  right={
                    <div className="flex items-center gap-2">
                      {r.algoritmica && (
                        <Badge tone="black">
                          <Cpu size={12} className="mr-0.5" /> Algorítmica
                        </Badge>
                      )}
                      <Badge tone={nivelTone[r.nivel]}>Riesgo {r.nivel}</Badge>
                    </div>
                  }
                />
                <div className="px-5 py-4">
                  <div className="flex items-center gap-4">
                    <div className="font-num text-[34px] leading-none" style={{ color: nivelColor[r.nivel] }}>
                      {r.puntaje}
                      <span className="text-[15px] text-ink-3">/100</span>
                    </div>
                    <Progress className="flex-1" value={r.puntaje} tone={nivelColor[r.nivel]} />
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
                    {r.indicios.map((ind) => (
                      <div key={ind.senal} className="flex items-start gap-2 text-[12.5px]">
                        {ind.presente ? (
                          <CloseCircle size={15} color="var(--red)" variant="Bold" className="mt-0.5 shrink-0" />
                        ) : (
                          <TickCircle size={15} color="var(--ink-3)" className="mt-0.5 shrink-0 opacity-40" />
                        )}
                        <span className={ind.presente ? "text-ink" : "text-ink-3 line-through opacity-60"}>
                          {ind.senal}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 hairline bg-surface-2 px-4 py-3">
                    <div className="overline mb-1">Conclusión</div>
                    <p className="text-[13px] leading-relaxed text-ink-2">{r.conclusion}</p>
                  </div>
                </div>
              </Card>
            </Reveal>
          );
        })}
      </div>
    </div>
  );
}
