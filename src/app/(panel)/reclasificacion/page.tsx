"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { Card, CardHeader, Badge, Progress, Button } from "@/components/ui";
import { Reveal } from "@/components/motion";
import { CONTRATOS } from "@/lib/data/contratos";
import { evaluarReclasificacion, INDICIOS } from "@/lib/reclasificacion";
import { useContratosConfirmados } from "@/lib/store";
import { SubordinacionSenales } from "@/lib/types";
import { Cpu, Flash, Judge } from "iconsax-react";

const nivelTone = { alto: "red", medio: "warning", bajo: "success" } as const;
const nivelColor = { alto: "var(--red)", medio: "var(--warning)", bajo: "var(--success)" } as const;
const nivelLabel = { alto: "Alto", medio: "Medio", bajo: "Bajo" } as const;

const CLASICOS = INDICIOS.filter((i) => !i.algoritmica);
const ALGORITMICOS = INDICIOS.filter((i) => i.algoritmica);

export default function ReclasificacionPage() {
  const confirmados = useContratosConfirmados();
  const candidatos = useMemo(
    () =>
      [...confirmados, ...CONTRATOS].filter(
        (c) => c.tipo === "prestacion_servicios" || c.tipo === "plataforma"
      ),
    [confirmados]
  );

  // Señales editables por contrato (se inicializan con las del dataset).
  const [senalesPorId, setSenalesPorId] = useState<Record<string, SubordinacionSenales>>(() =>
    Object.fromEntries(candidatos.map((c) => [c.id, { ...(c.subordinacion ?? {}) }]))
  );
  const [id, setId] = useState(candidatos[0].id);

  const c = candidatos.find((x) => x.id === id)!;
  const senales = useMemo(() => senalesPorId[id] ?? {}, [senalesPorId, id]);
  const r = useMemo(
    () => evaluarReclasificacion({ ...c, subordinacion: senales }),
    [c, senales]
  );

  function toggle(key: keyof SubordinacionSenales) {
    setSenalesPorId((prev) => ({
      ...prev,
      [id]: { ...prev[id], [key]: !prev[id]?.[key] },
    }));
  }
  function reset() {
    setSenalesPorId((prev) => ({ ...prev, [id]: { ...(c.subordinacion ?? {}) } }));
  }

  const activos = INDICIOS.filter((i) => senales[i.key]).length;

  return (
    <div className="mx-auto w-full max-w-5xl 2xl:max-w-6xl">
      <PageHeader
        overline="Detección de riesgo laboral"
        title="Test de reclasificación de contratos"
        subtitle="Marque los indicios de subordinación presentes en la relación; el puntaje de riesgo se recalcula en vivo frente a la primacía de la realidad (CP art. 53, CST art. 23) y la subordinación algorítmica de la Ley 2466/2025."
      />

      <div className="mb-4 hairline flex items-start gap-3 bg-[var(--red-tint)] px-4 py-3">
        <Flash size={18} color="var(--red)" variant="Bold" className="mt-0.5 shrink-0" />
        <p className="text-[12.5px] leading-snug text-ink-2">
          <span className="font-medium text-ink">Elemento diferenciador — Ley 2466 de 2025.</span>{" "}
          La reforma creó un régimen especial para trabajadores de plataformas digitales (modalidad dependiente o
          independiente), con <span className="font-medium">vigencia diferida a su reglamentación</span>. Evalúa la
          subordinación —incluida la algorítmica (asignación por algoritmo, geolocalización, calificación,
          penalización por rechazos)— para definir el vínculo.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
        {/* Selector + indicios editables */}
        <div className="space-y-3 lg:col-span-3">
          <Card>
            <CardHeader
              overline="Caso a evaluar"
              title="Contrato civil o de plataforma"
              right={<Judge size={20} color="var(--red)" variant="Bulk" />}
            />
            <div className="px-5 py-4">
              <select value={id} onChange={(e) => setId(e.target.value)} className="re-input">
                {candidatos.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.empleado} — {x.cargo} (
                    {x.tipo === "plataforma" ? "Plataforma" : "Prestación de servicios"})
                  </option>
                ))}
              </select>
            </div>
          </Card>

          <Card>
            <CardHeader
              overline="Indicios de subordinación"
              title="Marque los que apliquen"
              subtitle="Subordinación clásica — CST art. 23"
            />
            <div className="divide-y divide-border">
              {CLASICOS.map((i) => (
                <IndicioRow
                  key={i.key}
                  senal={i.senal}
                  norma={i.norma}
                  peso={i.peso}
                  activo={Boolean(senales[i.key])}
                  onClick={() => toggle(i.key)}
                />
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader
              overline="Subordinación algorítmica"
              title="Indicios de plataforma (Ley 2466/2025)"
              right={<Cpu size={18} color="var(--red)" />}
            />
            <div className="divide-y divide-border">
              {ALGORITMICOS.map((i) => (
                <IndicioRow
                  key={i.key}
                  senal={i.senal}
                  norma={i.norma}
                  peso={i.peso}
                  activo={Boolean(senales[i.key])}
                  onClick={() => toggle(i.key)}
                />
              ))}
            </div>
          </Card>
        </div>

        {/* Resultado en vivo */}
        <div className="lg:col-span-2">
          <div className="space-y-3 lg:sticky lg:top-4">
            <Reveal key={`${r.puntaje}-${r.nivel}`}>
              <Card>
                <CardHeader
                  overline="Resultado del test"
                  title={c.empleado}
                  right={
                    <div className="flex items-center gap-2">
                      {r.algoritmica && (
                        <Badge tone="black">
                          <Cpu size={12} className="mr-0.5" /> Algorítmica
                        </Badge>
                      )}
                      <Badge tone={nivelTone[r.nivel]}>Riesgo {nivelLabel[r.nivel]}</Badge>
                    </div>
                  }
                />
                <div className="px-5 py-4">
                  <div className="flex items-center gap-4">
                    <div
                      className="font-num text-[40px] leading-none"
                      style={{ color: nivelColor[r.nivel] }}
                    >
                      {r.puntaje}
                      <span className="text-[15px] text-ink-3">/100</span>
                    </div>
                    <Progress className="flex-1" value={r.puntaje} tone={nivelColor[r.nivel]} />
                  </div>
                  <p className="mt-2 text-[11.5px] text-ink-3">
                    {activos} indicio{activos === 1 ? "" : "s"} marcado{activos === 1 ? "" : "s"}
                    {c.tipo === "plataforma" && " · régimen especial Ley 2466/2025 (piso 60/100)"}
                  </p>

                  <div className="mt-4 hairline bg-surface-2 px-4 py-3">
                    <div className="overline mb-1">Conclusión</div>
                    <p className="text-[13px] leading-relaxed text-ink-2">{r.conclusion}</p>
                  </div>

                  <Button variant="secondary" className="mt-3 w-full" onClick={reset}>
                    Restablecer indicios del contrato
                  </Button>
                </div>
              </Card>
            </Reveal>

            <div className="hairline flex items-start gap-2 bg-[var(--info-tint)] px-4 py-3">
              <Flash size={15} color="var(--info)" className="mt-0.5 shrink-0" />
              <p className="text-[11.5px] leading-snug text-ink-2">
                Herramienta de apoyo. La calificación final de un contrato realidad corresponde al
                abogado y, en última instancia, al juez laboral.
              </p>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .re-input {
          width: 100%;
          border: 1px solid var(--border-2);
          background: var(--surface);
          padding: 8px 10px;
          font-size: 13px;
          color: var(--ink);
          border-radius: var(--radius);
        }
        .re-input:focus {
          outline: none;
          border-color: var(--ink);
        }
      `}</style>
    </div>
  );
}

function IndicioRow({
  senal,
  norma,
  peso,
  activo,
  onClick,
}: {
  senal: string;
  norma: string;
  peso: number;
  activo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-start gap-3 px-5 py-3 text-left transition-colors hover:bg-surface-2"
    >
      <span
        className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center border text-[11px] font-bold leading-none transition-colors"
        style={{
          borderRadius: "var(--radius)",
          background: activo ? "var(--red)" : "var(--surface)",
          borderColor: activo ? "var(--red)" : "var(--border-2)",
          color: "#fff",
        }}
      >
        {activo ? "✓" : ""}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[12.5px] ${activo ? "font-medium text-ink" : "text-ink-2"}`}>
          {senal}
        </span>
        <span className="font-num mt-0.5 block text-[10.5px] text-ink-3">
          {norma} · peso {peso}
        </span>
      </span>
    </button>
  );
}
