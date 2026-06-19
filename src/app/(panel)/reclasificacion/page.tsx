"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { Card, CardHeader, Badge, Progress, Button, Stat } from "@/components/ui";
import { Reveal } from "@/components/motion";
import { evaluarReclasificacion, SENALES } from "@/lib/reclasificacion";
import { useContratosConfirmados, useEmpresaActiva, useParametros, logAudit } from "@/lib/store";
import { SubordinacionSenales } from "@/lib/types";
import { cop, copShort, fmtDate } from "@/lib/utils";
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
  const [verContrato, setVerContrato] = useState(false);
  const [verContratoLaboral, setVerContratoLaboral] = useState(false);

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
  function limpiar(cid: string) {
    setSenalesPorId((prev) => ({ ...prev, [cid]: {} }));
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
    <div className="mx-auto w-full max-w-6xl">
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

      {/* ── Detalle de la relación seleccionada ── */}
      {/* Captura de la realidad (izquierda, amplia) + Veredicto en vivo (derecha, sticky) */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
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

        {/* Veredicto en vivo (sticky) */}
        <div className="lg:col-span-2">
          <div className="lg:sticky lg:top-4">
            <Reveal key={`${sel.c.id}-${sel.r.puntaje}-${sel.r.probabilidad}`}>
              <Card>
                <CardHeader
                  overline="Veredicto en vivo"
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

                  <div className="mt-3 space-y-2">
                    <Button
                      variant="primary"
                      className="w-full"
                      onClick={() => {
                        setVerContratoLaboral(true);
                        logAudit("Contrato laboral generado (reclasificación)", `${sel.c.empleado} (${sel.c.id})`);
                        setTimeout(
                          () =>
                            document
                              .getElementById("contrato-laboral")
                              ?.scrollIntoView({ behavior: "smooth", block: "start" }),
                          60
                        );
                      }}
                    >
                      Generar contrato laboral (formalizar)
                    </Button>
                    <div className="flex gap-2">
                      <Button variant="secondary" className="flex-1" onClick={() => limpiar(sel.c.id)}>
                        Limpiar señales
                      </Button>
                      <Button variant="secondary" className="flex-1" onClick={() => reset(sel.c.id)}>
                        Restaurar detectadas
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            </Reveal>
          </div>
        </div>
      </div>

      {/* ── Análisis detallado (a todo el ancho) ── */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
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
            <div className="flex items-baseline justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <span className="text-[12.5px] text-ink">Sanción moratoria potencial (aparte)</span>
                <div className="text-[10.5px] leading-snug text-ink-3">
                  No automática; sujeta a buena fe (CST art. 65). No se incluye en la exposición esperada.
                </div>
              </div>
              <span className="font-num text-[12.5px] text-ink-2">{cop(sel.r.exposicion.sancionPotencial)}</span>
            </div>
          </div>
        </Card>

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
      </div>

      {/* ── Contradicciones contrato ↔ realidad (a todo el ancho) ── */}
      {sel.r.contradicciones.length > 0 && (
        <Card className="mt-3">
          <CardHeader
            overline="Contrato ↔ realidad"
            title="Contradicciones detectadas"
            subtitle="El papel dice una cosa; la operación, otra. Eso es el corazón del dictamen."
            right={<Warning2 size={18} color="var(--warning)" />}
          />
          <div className="grid grid-cols-1 gap-px bg-border md:grid-cols-2">
            {sel.r.contradicciones.map((cd, i) => (
              <div key={i} className="bg-surface px-5 py-3">
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

          {sel.r.clausulas.length > 0 && (
            <>
              <button
                onClick={() => setVerContrato((v) => !v)}
                className="flex w-full items-center justify-center gap-1 border-t border-border px-5 py-2.5 text-[11.5px] font-medium text-ink-2 transition-colors hover:bg-surface-2"
              >
                {verContrato ? "Ocultar contrato" : "Ver contrato y subrayar lo que se contradice"}
              </button>
              {verContrato && (
                <div className="space-y-2.5 border-t border-border bg-surface-2 px-5 py-4">
                  <div className="overline">Extracto del contrato (lo que dice el papel)</div>
                  <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                    {sel.r.clausulas.map((cl, i) => (
                      <div key={i} className="text-[11.5px] leading-relaxed">
                        <p className={cl.contradicha ? "text-ink" : "text-ink-3"}>
                          {resaltarFragmento(cl.texto, cl.destacar, cl.contradicha)}
                        </p>
                        {cl.contradicha && cl.realidad && (
                          <p className="mt-0.5 text-[10.5px] text-red-dark">↳ La realidad muestra: {cl.realidad}</p>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="pt-1 text-[10px] leading-snug text-ink-3">
                    Extracto representativo del clausulado de prestación de servicios. Para un contrato cargado, el
                    subrayado se aplicaría sobre el texto extraído del documento.
                  </p>
                </div>
              )}
            </>
          )}
        </Card>
      )}

      {verContratoLaboral && (
        <Card id="contrato-laboral" className="mt-3">
          <CardHeader
            overline="Formalización"
            title="Contrato laboral (borrador)"
            subtitle="Convierte la prestación de servicios en un contrato laboral a término indefinido para formalizar la relación y mitigar la contingencia."
            right={<Judge size={18} color="var(--red)" />}
          />
          <div className="px-5 py-4">
            <div className="max-h-96 overflow-y-auto whitespace-pre-wrap hairline bg-surface-2 px-4 py-3 text-[11.5px] leading-relaxed text-ink-2">
              {generarContratoLaboral(sel.c, empresa?.nombre, empresa?.nit, hoy)}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                onClick={() =>
                  imprimirTexto(
                    `Contrato laboral - ${sel.c.empleado}`,
                    generarContratoLaboral(sel.c, empresa?.nombre, empresa?.nit, hoy)
                  )
                }
              >
                Descargar PDF
              </Button>
              <Button variant="ghost" onClick={() => setVerContratoLaboral(false)}>
                Cerrar
              </Button>
              <span className="text-[11px] text-ink-3">
                Borrador asistido; requiere revisión y firma del abogado responsable.
              </span>
            </div>
          </div>
        </Card>
      )}

      <div className="mt-3 hairline flex items-start gap-2 bg-[var(--info-tint)] px-4 py-3">
        <Flash size={15} color="var(--info)" className="mt-0.5 shrink-0" />
        <p className="text-[11.5px] leading-snug text-ink-2">
          Estimación de apoyo. Los montos son aproximados (el área contable y el abogado deben validarlos); la
          calificación final del contrato realidad corresponde al juez laboral.
        </p>
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

// Subraya en rojo el fragmento `frag` dentro de `texto` cuando la cláusula está contradicha.
function resaltarFragmento(texto: string, frag: string, activo: boolean) {
  if (!activo || !frag) return texto;
  const i = texto.toLowerCase().indexOf(frag.toLowerCase());
  if (i < 0) return texto;
  return (
    <>
      {texto.slice(0, i)}
      <span
        className="font-medium text-red-dark underline decoration-2 underline-offset-2"
        style={{ background: "var(--red-tint)", textDecorationColor: "var(--red)" }}
      >
        {texto.slice(i, i + frag.length)}
      </span>
      {texto.slice(i + frag.length)}
    </>
  );
}

// Genera el borrador del contrato laboral que formaliza la relación (reemplaza la
// prestación de servicios) cuando se reconoce el contrato realidad.
function generarContratoLaboral(
  c: { empleado: string; documento: string; cargo: string; area: string; salarioMensual: number },
  empresaNombre: string | undefined,
  empresaNit: string | undefined,
  hoy: string
): string {
  const emp = empresaNombre ?? "[RAZÓN SOCIAL DE LA EMPRESA]";
  const nit = empresaNit ?? "[NIT]";
  return [
    "CONTRATO INDIVIDUAL DE TRABAJO A TÉRMINO INDEFINIDO",
    "",
    `Entre ${emp}, identificada con NIT ${nit}, en adelante EL EMPLEADOR, y ${c.empleado}, identificado(a) con C.C. ${c.documento}, en adelante EL TRABAJADOR, se celebra el presente contrato individual de trabajo, que FORMALIZA y RECONOCE la relación laboral existente —en reemplazo del contrato de prestación de servicios— conforme a la primacía de la realidad (CST art. 23; CP art. 53):`,
    "",
    `PRIMERA. Cargo y funciones. EL TRABAJADOR desempeñará el cargo de ${c.cargo}${c.area ? ` (área de ${c.area})` : ""}, bajo la continuada subordinación y dependencia de EL EMPLEADOR.`,
    "",
    "SEGUNDA. Jornada. La jornada de trabajo se sujeta al máximo legal de 42 horas semanales (Ley 2101/2021).",
    "",
    `TERCERA. Salario. EL EMPLEADOR pagará un salario mensual de ${cop(c.salarioMensual)}, por periodos vencidos.`,
    "",
    "CUARTA. Prestaciones y seguridad social. EL EMPLEADOR reconocerá y pagará las prestaciones sociales de ley (cesantías e intereses, prima de servicios y vacaciones) y afiliará y cotizará al Sistema de Seguridad Social Integral —salud, pensión y riesgos laborales— y a parafiscales.",
    "",
    `QUINTA. Duración. El presente contrato es a TÉRMINO INDEFINIDO y rige a partir del ${fmtDate(hoy)}.`,
    "",
    "SEXTA. Reconocimiento de la relación. Las partes reconocen que la relación se ejecutó con los elementos del contrato de trabajo (art. 23 CST). Este contrato la formaliza hacia el futuro, sin perjuicio de los derechos ya causados, que deberán liquidarse y pagarse conforme a la ley.",
    "",
    "SÉPTIMA. Reglamento. EL TRABAJADOR se obliga a cumplir el Reglamento Interno de Trabajo y las instrucciones de EL EMPLEADOR.",
    "",
    "Para constancia se firma por las partes.",
    "",
    "____________________________          ____________________________",
    `EL EMPLEADOR — ${emp}                 EL TRABAJADOR — ${c.empleado}`,
    "",
    "— Borrador asistido por Centinela. Requiere revisión y firma del abogado responsable. —",
  ].join("\n");
}

// Abre un texto en una ventana lista para imprimir / guardar como PDF.
function imprimirTexto(titulo: string, texto: string) {
  const w = window.open("", "_blank", "width=820,height=920");
  if (!w) return;
  const safe = texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  w.document.write(
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${titulo}</title>` +
      `<style>body{font-family:Georgia,'Times New Roman',serif;max-width:680px;margin:48px auto;padding:0 28px;color:#1a1a1a;font-size:13px;line-height:1.7;white-space:pre-wrap}</style>` +
      `</head><body>${safe}</body></html>`
  );
  w.document.close();
  w.focus();
  w.print();
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
