"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { Card, CardHeader, Badge, Progress, Button, Stat } from "@/components/ui";
import { Reveal } from "@/components/motion";
import { evaluarReclasificacion, SENALES } from "@/lib/reclasificacion";
import { useContratosConfirmados, useEmpresaActiva, useParametros, logAudit } from "@/lib/store";
import { SubordinacionSenales } from "@/lib/types";
import { cop, copShort } from "@/lib/utils";
import { Cpu, Flash, Judge, Danger, ArrowRight2, Warning2 } from "iconsax-react";

const nivelTone = { alto: "red", medio: "warning", bajo: "success" } as const;
const nivelColor = { alto: "var(--red)", medio: "var(--warning)", bajo: "var(--success)" } as const;
const nivelLabel = { alto: "Alto", medio: "Medio", bajo: "Bajo" } as const;

const OBJETIVOS = SENALES.filter((s) => s.bucket === "dato_objetivo");
const CUESTIONARIO = SENALES.filter((s) => s.bucket === "cuestionario");
const ALGORITMICOS = SENALES.filter((s) => s.bucket === "algoritmica");

export default function ReclasificacionPage() {
  const empresa = useEmpresaActiva();
  const params = useParametros();
  const hoy = empresa?.hoy ?? "2026-06-18";
  const CONTRATOS = useMemo(() => empresa?.contratos ?? [], [empresa]);
  const confirmados = useContratosConfirmados();
  const candidatos = useMemo(
    () =>
      [...confirmados, ...CONTRATOS].filter(
        (c) => c.tipo === "prestacion_servicios" || c.tipo === "plataforma"
      ),
    [confirmados, CONTRATOS]
  );

  // Señales editables por contrato (se inicializan con las del dataset).
  const [senalesPorId, setSenalesPorId] = useState<Record<string, SubordinacionSenales>>(() =>
    Object.fromEntries(candidatos.map((c) => [c.id, { ...(c.subordinacion ?? {}) }]))
  );
  const [id, setId] = useState(() => candidatos[0]?.id ?? "");
  const [desc, setDesc] = useState("");
  const [iaLoading, setIaLoading] = useState(false);
  const [iaMsg, setIaMsg] = useState<string | null>(null);

  const evals = useMemo(
    () =>
      candidatos.map((c) => {
        const senales = senalesPorId[c.id] ?? c.subordinacion ?? {};
        return { c, senales, r: evaluarReclasificacion({ ...c, subordinacion: senales }, hoy, params) };
      }),
    [candidatos, senalesPorId, hoy, params]
  );

  const selId = candidatos.some((c) => c.id === id) ? id : candidatos[0]?.id ?? "";
  const sel = evals.find((e) => e.c.id === selId);
  const totalEsperada = evals.reduce((s, e) => s + e.r.exposicion.exposicionEsperada, 0);
  const totalMax = evals.reduce((s, e) => s + e.r.exposicion.montoMaximo, 0);
  const altos = evals.filter((e) => e.r.nivel === "alto").length;

  function toggle(cid: string, key: keyof SubordinacionSenales) {
    setSenalesPorId((prev) => {
      const base = prev[cid] ?? candidatos.find((c) => c.id === cid)?.subordinacion ?? {};
      return { ...prev, [cid]: { ...base, [key]: !base[key] } };
    });
  }
  function reset(cid: string) {
    const base = candidatos.find((c) => c.id === cid)?.subordinacion ?? {};
    setSenalesPorId((prev) => ({ ...prev, [cid]: { ...base } }));
  }

  async function autodetectar() {
    if (!desc.trim() || !sel) return;
    setIaLoading(true);
    setIaMsg(null);
    try {
      const res = await fetch("/api/reclasificacion-ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: desc }),
      });
      const data = await res.json();
      if (data.senales) {
        const cid = sel.c.id;
        setSenalesPorId((prev) => ({
          ...prev,
          [cid]: { ...(prev[cid] ?? sel.c.subordinacion ?? {}), ...data.senales },
        }));
        setIaMsg(data.resumen ?? "Señales detectadas.");
        logAudit("Autodetección de realidad (reclasificación)", `${sel.c.empleado} · modo ${data._modo ?? "ia"}`);
      } else {
        setIaMsg(data.error ?? "No se pudo analizar la descripción.");
      }
    } catch {
      setIaMsg("Error de conexión con el servicio de IA.");
    } finally {
      setIaLoading(false);
    }
  }

  if (!sel) {
    return (
      <div className="mx-auto w-full max-w-5xl">
        <PageHeader
          overline="Riesgo de contrato realidad"
          title="Cómo se opera la relación, no qué dice el papel"
          subtitle="Centinela mide la brecha entre el contrato civil y la realidad operativa (primacía de la realidad, CP art. 53; CST art. 23)."
        />
        <Card className="px-5 py-12 text-center text-[13px] text-ink-2">
          Esta empresa no tiene contratos de prestación de servicios ni de plataforma para evaluar.
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl 2xl:max-w-6xl">
      <PageHeader
        overline="Riesgo de contrato realidad"
        title="Cómo se opera la relación, no qué dice el papel"
        subtitle="Centinela mide la brecha entre el contrato civil y la realidad operativa (primacía de la realidad, CP art. 53; CST art. 23) y la traduce en exposición económica. La calificación final es del abogado y, en última instancia, del juez."
      />

      {/* KPIs de cartera */}
      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat
          label="Exposición esperada (cartera)"
          value={copShort(totalEsperada)}
          sub={`Valor esperado · ${evals.length} relaciones`}
          tone="var(--red)"
          icon={<Danger size={18} />}
        />
        <Stat
          label="Exposición máxima"
          value={copShort(totalMax)}
          sub="Si todas se reclasifican"
          tone="var(--warning)"
          icon={<Warning2 size={18} />}
        />
        <Stat
          label="Relaciones en riesgo alto"
          value={altos}
          sub="Se operan como laborales"
          tone={altos ? "var(--red)" : "var(--ink)"}
          icon={<Judge size={18} />}
        />
      </div>

      {/* Radar de cartera */}
      <Card className="mb-3">
        <CardHeader
          overline="Radar de cartera"
          title="Relaciones civiles y de plataforma"
          subtitle="Ordenadas por exposición esperada. Selecciona una para ver el detalle."
          right={<Judge size={20} color="var(--red)" variant="Bulk" />}
        />
        <div className="divide-y divide-border">
          {[...evals]
            .sort((a, b) => b.r.exposicion.exposicionEsperada - a.r.exposicion.exposicionEsperada)
            .map(({ c, r }) => (
              <button
                key={c.id}
                onClick={() => setId(c.id)}
                className={`flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-surface-2 ${
                  c.id === selId ? "bg-surface-2" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-medium text-ink">{c.empleado}</span>
                    {r.algoritmica && (
                      <Badge tone="black">
                        <Cpu size={11} className="mr-0.5" /> Algorítmica
                      </Badge>
                    )}
                  </div>
                  <div className="text-[11px] text-ink-3">
                    {c.cargo} · {c.tipo === "plataforma" ? "Plataforma" : "Prestación de servicios"}
                  </div>
                </div>
                <div className="hidden w-28 sm:block">
                  <div className="mb-0.5 text-[10px] text-ink-3">Probabilidad {r.probabilidad}%</div>
                  <Progress value={r.probabilidad} tone={nivelColor[r.nivel]} />
                </div>
                <div className="w-28 text-right">
                  <div className="font-num text-[13px]" style={{ color: nivelColor[r.nivel] }}>
                    {copShort(r.exposicion.exposicionEsperada)}
                  </div>
                  <Badge tone={nivelTone[r.nivel]}>{nivelLabel[r.nivel]}</Badge>
                </div>
                <ArrowRight2 size={15} className="shrink-0 text-ink-3" />
              </button>
            ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
        {/* Captura de la realidad */}
        <div className="space-y-3 lg:col-span-3">
          <Card>
            <CardHeader
              overline="1 · Datos objetivos (la empresa ya los tiene)"
              title="Huellas de la realidad"
              subtitle="Hechos verificables — la prueba más fuerte ante la UGPP y el juez."
              right={<Danger size={18} color="var(--red)" variant="Bulk" />}
            />
            <div className="divide-y divide-border">
              {OBJETIVOS.map((s) => (
                <SenalRow
                  key={s.key}
                  pregunta={s.pregunta}
                  norma={s.norma}
                  peso={s.peso}
                  activo={Boolean(sel.senales[s.key])}
                  onClick={() => toggle(sel.c.id, s.key)}
                />
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader
              overline="2 · Cuestionario operativo"
              title="¿Cómo opera en la práctica?"
              subtitle="Responde hechos; Centinela infiere la subordinación. No marcas juicios jurídicos."
            />
            <div className="divide-y divide-border">
              {CUESTIONARIO.map((s) => (
                <SenalRow
                  key={s.key}
                  pregunta={s.pregunta}
                  norma={s.norma}
                  peso={s.peso}
                  activo={Boolean(sel.senales[s.key])}
                  onClick={() => toggle(sel.c.id, s.key)}
                />
              ))}
            </div>
          </Card>

          {sel.c.tipo === "plataforma" && (
            <Card>
              <CardHeader
                overline="Subordinación algorítmica"
                title="Señales de plataforma (Ley 2466/2025)"
                right={<Cpu size={18} color="var(--red)" />}
              />
              <div className="divide-y divide-border">
                {ALGORITMICOS.map((s) => (
                  <SenalRow
                    key={s.key}
                    pregunta={s.pregunta}
                    norma={s.norma}
                    peso={s.peso}
                    activo={Boolean(sel.senales[s.key])}
                    onClick={() => toggle(sel.c.id, s.key)}
                  />
                ))}
              </div>
            </Card>
          )}

          <Card>
            <CardHeader
              overline="Autodetección con IA"
              title="Describe cómo opera la relación"
              subtitle="La IA detecta los hechos; tú validas. Funciona sin API key (modo heurístico)."
              right={<Cpu size={18} color="var(--ink-3)" />}
            />
            <div className="space-y-3 px-5 py-4">
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Ej: Trabaja de lunes a viernes de 8 a 5, reporta a la jefe de mercadeo, le pagamos un monto fijo cada fin de mes, usa el correo y el computador de la empresa y lleva 2 años…"
                className="re-input min-h-[92px] resize-y"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={autodetectar} disabled={iaLoading || !desc.trim()}>
                  {iaLoading ? "Analizando…" : "Autodetectar señales"}
                </Button>
                {iaMsg && <span className="text-[11.5px] leading-snug text-ink-2">{iaMsg}</span>}
              </div>
            </div>
          </Card>
        </div>

        {/* Veredicto + exposición */}
        <div className="lg:col-span-2">
          <div className="space-y-3 lg:sticky lg:top-4">
            <Reveal key={`${sel.c.id}-${sel.r.puntaje}-${sel.r.probabilidad}`}>
              <Card>
                <CardHeader
                  overline="Veredicto"
                  title={sel.c.empleado}
                  right={
                    <div className="flex items-center gap-2">
                      {sel.r.algoritmica && (
                        <Badge tone="black">
                          <Cpu size={12} className="mr-0.5" /> Algorítmica
                        </Badge>
                      )}
                      <Badge tone={nivelTone[sel.r.nivel]}>Riesgo {nivelLabel[sel.r.nivel]}</Badge>
                    </div>
                  }
                />
                <div className="px-5 py-4">
                  <p className="text-[13.5px] font-medium leading-snug text-ink">
                    {sel.r.nivel === "alto"
                      ? "Se opera como un contrato laboral."
                      : sel.r.nivel === "medio"
                      ? "Señales mixtas de subordinación."
                      : "Consistente con servicios independientes."}
                  </p>
                  <div className="mt-3 flex items-center gap-4">
                    <div>
                      <div className="overline">Probabilidad</div>
                      <div
                        className="font-num text-[34px] leading-none"
                        style={{ color: nivelColor[sel.r.nivel] }}
                      >
                        {sel.r.probabilidad}
                        <span className="text-[14px] text-ink-3">%</span>
                      </div>
                    </div>
                    <Progress className="flex-1" value={sel.r.probabilidad} tone={nivelColor[sel.r.nivel]} />
                  </div>

                  <div className="mt-4 hairline bg-[var(--red-tint)] px-4 py-3">
                    <div className="overline mb-1">Exposición esperada</div>
                    <div className="font-num text-[26px] leading-none text-red-dark">
                      {cop(sel.r.exposicion.exposicionEsperada)}
                    </div>
                    <div className="mt-1 text-[11px] text-ink-3">
                      Máximo si reclasifican: {cop(sel.r.exposicion.montoMaximo)}
                    </div>
                  </div>

                  <p className="mt-3 text-[12.5px] leading-relaxed text-ink-2">{sel.r.conclusion}</p>

                  <Button variant="secondary" className="mt-3 w-full" onClick={() => reset(sel.c.id)}>
                    Restablecer señales del contrato
                  </Button>
                </div>
              </Card>
            </Reveal>

            <Card>
              <CardHeader
                overline="Exposición en pesos"
                title="Desglose de la contingencia"
                subtitle={`Ventana no prescrita: ${sel.r.exposicion.mesesExpuestos} meses (prescripción 3 años, CST 488–489).`}
              />
              <div className="divide-y divide-border">
                {sel.r.exposicion.rubros.map((ru) => (
                  <div key={ru.concepto} className="px-5 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[12.5px] text-ink">{ru.concepto}</span>
                      <span className="font-num text-[12.5px] text-ink">{cop(ru.valor)}</span>
                    </div>
                    <div className="mt-0.5 text-[10.5px] text-ink-3">
                      {ru.detalle} · {ru.norma}
                    </div>
                  </div>
                ))}
                <div className="flex items-baseline justify-between gap-3 bg-surface-2 px-5 py-3">
                  <span className="text-[12.5px] font-medium text-ink">Total exposición máxima</span>
                  <span className="font-num text-[13px] font-medium text-ink">
                    {cop(sel.r.exposicion.montoMaximo)}
                  </span>
                </div>
              </div>
            </Card>

            {sel.r.contradicciones.length > 0 && (
              <Card>
                <CardHeader
                  overline="Contrato ↔ realidad"
                  title="Contradicciones detectadas"
                  subtitle="El papel dice una cosa; la operación, otra. Eso es el corazón del dictamen."
                  right={<Warning2 size={18} color="var(--warning)" />}
                />
                <div className="divide-y divide-border">
                  {sel.r.contradicciones.map((cd, i) => (
                    <div key={i} className="px-5 py-3">
                      <Badge tone={cd.severidad === "alta" ? "red" : "warning"}>{cd.severidad}</Badge>
                      <p className="mt-1.5 text-[12px] text-ink-2">
                        <span className="text-ink-3">El contrato dice:</span> {cd.contratoDice}
                      </p>
                      <p className="mt-1 text-[12px] text-ink">
                        <span className="text-ink-3">La realidad muestra:</span> {cd.realidadMuestra}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <Card>
              <CardHeader
                overline="Concepto legal"
                title="Elementos del contrato realidad"
                subtitle="Art. 23 CST: prestación personal + subordinación + remuneración."
                right={<Judge size={18} color="var(--red)" />}
              />
              <div className="divide-y divide-border">
                {sel.r.conceptoPorElemento.map((el, i) => (
                  <div key={i} className="flex items-start gap-3 px-5 py-3">
                    <span
                      className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center border text-[11px] font-bold leading-none text-white"
                      style={{
                        borderRadius: "var(--radius)",
                        background: el.presente ? "var(--red)" : "var(--surface)",
                        borderColor: el.presente ? "var(--red)" : "var(--border-2)",
                        color: el.presente ? "#fff" : "var(--ink-3)",
                      }}
                    >
                      {el.presente ? "✓" : "–"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] font-medium text-ink">{el.elemento}</div>
                      <div className="text-[11.5px] leading-snug text-ink-2">{el.hallazgo}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-border px-5 py-3">
                <div className="overline mb-1">Acción recomendada</div>
                <p className="text-[11.5px] leading-snug text-ink-2">
                  {sel.r.nivel === "alto"
                    ? "Formalizar el vínculo laboral o reestructurar la relación para que sea verdaderamente independiente; provisionar la contingencia."
                    : sel.r.nivel === "medio"
                    ? "Mitigar y documentar las señales de subordinación; revisar cláusulas y la operación real."
                    : "Conservar evidencia de independencia (facturas, otros clientes, autonomía de horario y medios propios)."}
                </p>
              </div>
            </Card>

            <div className="hairline flex items-start gap-2 bg-[var(--info-tint)] px-4 py-3">
              <Flash size={15} color="var(--info)" className="mt-0.5 shrink-0" />
              <p className="text-[11.5px] leading-snug text-ink-2">
                Estimación de apoyo. Los montos son aproximados (el área contable y el abogado deben
                validarlos); la calificación final del contrato realidad corresponde al juez laboral.
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

function SenalRow({
  pregunta,
  norma,
  peso,
  activo,
  onClick,
}: {
  pregunta: string;
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
          {pregunta}
        </span>
        <span className="font-num mt-0.5 block text-[10.5px] text-ink-3">
          {norma} · peso {peso}
        </span>
      </span>
    </button>
  );
}
