"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/AppShell";
import { Card, CardHeader, Badge, Button } from "@/components/ui";
import { Reveal } from "@/components/motion";
import {
  ETAPAS,
  etapaInfo,
  generarDocumento,
  type CasoDisciplinario,
  type EtapaDisciplinaria,
} from "@/lib/debido-proceso";
import { JUSTAS_CAUSAS_EMPLEADOR } from "@/lib/data/justas-causas";
import { useContratosConfirmados, useDocumentosPerfil, useEmpresaActiva, logAudit } from "@/lib/store";
import { extractTextFromFile, ACCEPTED_FILE_TYPES } from "@/lib/extract-file";
import { EvidenciaPanel } from "@/components/EvidenciaPanel";
import {
  Judge,
  DocumentText,
  DocumentUpload,
  Warning2,
  TickCircle,
  Flash,
  Cpu,
  InfoCircle,
  Magicpen,
  DocumentDownload,
} from "iconsax-react";

export default function DisciplinarioPage() {
  const empresa = useEmpresaActiva();
  const CONTRATOS = useMemo(() => empresa?.contratos ?? [], [empresa]);
  const EMPRESA = empresa?.nombre ?? "—";
  const confirmados = useContratosConfirmados();
  const docsPerfil = useDocumentosPerfil();
  const todos = useMemo(() => [...confirmados, ...CONTRATOS], [confirmados, CONTRATOS]);

  const [trabajadorId, setTrabajadorId] = useState(
    CONTRATOS.find((c) => c.cargo.toLowerCase().includes("operario"))?.id ?? CONTRATOS[0]?.id ?? ""
  );
  const trab = todos.find((c) => c.id === trabajadorId) ?? todos[0];

  const [etapa, setEtapa] = useState<EtapaDisciplinaria>("hechos");
  const info = etapaInfo(etapa);
  const idxActual = ETAPAS.findIndex((e) => e.key === etapa);

  const [form, setForm] = useState({
    fechaHechos: "2026-06-10",
    hechos: "Inasistencia injustificada durante tres (3) días consecutivos.",
    causalId: "A10",
    normaInterna: "Art. 7, num. 4 del Reglamento Interno (faltas de asistencia).",
    fechaDiligencia: "",
    lugarDiligencia: "",
    linkDiligencia: "",
    preguntasRespuestas: "",
    pruebasAportadas: "" as "" | "si" | "no",
    oportunidadPruebas: "",
    tipoNotificacion: "sancion" as "sancion" | "despido",
    decision: "",
  });
  const causal = JUSTAS_CAUSAS_EMPLEADOR.find((c) => c.id === form.causalId);
  const rit = docsPerfil.find((d) => d.tipo.includes("RIT")) ?? docsPerfil[0];

  const [plan, setPlan] = useState("");
  const [asesoria, setAsesoria] = useState<Record<string, unknown> | null>(null);
  const [cargando, setCargando] = useState(false);
  const [documento, setDocumento] = useState<{ texto: string; titulo: string } | null>(null);

  // Información contextual (qué escribir en los hechos imputados).
  const [mostrarInfo, setMostrarInfo] = useState(false);

  // Sugerencia de causal y norma con IA (preselección que el abogado confirma).
  const [sugiriendo, setSugiriendo] = useState(false);
  const [sugerencia, setSugerencia] = useState<Record<string, unknown> | null>(null);

  // Carga del documento de descargos anotado en la audiencia.
  const docInputRef = useRef<HTMLInputElement>(null);
  const [cargandoDoc, setCargandoDoc] = useState(false);
  const [errorDoc, setErrorDoc] = useState<string | null>(null);

  const caso: CasoDisciplinario = {
    empresa: EMPRESA,
    empleado: trab.empleado,
    cargo: trab.cargo,
    fechaHechos: form.fechaHechos,
    hechos: form.hechos,
    causalTexto: causal
      ? `${causal.causal} (CST art. 62-A, causal ${causal.id.slice(1)})${causal.avisoPrevio ? " — requiere aviso previo de 15 días" : ""}`
      : undefined,
    normaInterna: form.normaInterna || undefined,
    reglamentoNombre: rit?.nombre,
    fechaDiligencia: form.fechaDiligencia || undefined,
    lugarDiligencia: form.lugarDiligencia || undefined,
    linkDiligencia: form.linkDiligencia || undefined,
    preguntasRespuestas: form.preguntasRespuestas || undefined,
    pruebasAportadas: form.pruebasAportadas === "" ? undefined : form.pruebasAportadas === "si",
    oportunidadPruebas: form.oportunidadPruebas || undefined,
    tipoNotificacion: form.tipoNotificacion,
    decision: form.decision || undefined,
  };

  async function pedirAsesoria() {
    setCargando(true);
    setAsesoria(null);
    try {
      const res = await fetch("/api/disciplinario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empleado: trab.empleado,
          cargo: trab.cargo,
          hechos: form.hechos,
          fechaHechos: form.fechaHechos,
          etapa,
          etapaTitulo: info.titulo,
          garantias: info.garantias,
          causalTexto: caso.causalTexto,
          normaInterna: form.normaInterna,
          planUsuario: plan,
          preguntasRespuestas: caso.preguntasRespuestas,
          oportunidadPruebas: caso.oportunidadPruebas,
          pruebasAportadas: caso.pruebasAportadas,
          documentos: docsPerfil.map((d) => ({ tipo: d.tipo, nombre: d.nombre, texto: d.texto })),
        }),
      });
      const data = await res.json();
      setAsesoria(data);
      logAudit("Asesoría disciplinaria solicitada", `${trab.empleado} · etapa: ${info.titulo}`);
    } catch {
      setAsesoria({ error: "No se pudo obtener la asesoría." });
    } finally {
      setCargando(false);
    }
  }

  // IA: sugiere causal (CST art. 62-A) y norma interna a partir de los hechos.
  // Preselecciona los campos; el abogado los confirma o cambia.
  async function sugerirCausal() {
    setSugiriendo(true);
    setSugerencia(null);
    try {
      const res = await fetch("/api/sugerir-causal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hechos: form.hechos,
          cargo: trab.cargo,
          documentos: docsPerfil.map((d) => ({ tipo: d.tipo, nombre: d.nombre, texto: d.texto })),
        }),
      });
      const data = await res.json();
      setSugerencia(data);
      const sugId = String(data.causalId ?? "");
      const existe = JUSTAS_CAUSAS_EMPLEADOR.some((c) => c.id === sugId);
      setForm((f) => ({
        ...f,
        causalId: existe ? sugId : f.causalId,
        normaInterna: data.normaInterna ? String(data.normaInterna) : f.normaInterna,
      }));
      logAudit("Sugerencia de causal/norma (IA)", `${trab.empleado} · ${existe ? sugId : "sin causal"}`);
    } catch {
      setSugerencia({ error: "No se pudo obtener la sugerencia." });
    } finally {
      setSugiriendo(false);
    }
  }

  function generar(tipo: string, label: string) {
    setDocumento({ texto: generarDocumento(tipo, caso), titulo: label });
    logAudit("Documento disciplinario generado", `${label} — ${trab.empleado}`);
  }

  // Carga el documento anotado durante la audiencia y vuelca su texto en el acta.
  async function cargarDocDescargos(file: File) {
    setCargandoDoc(true);
    setErrorDoc(null);
    try {
      const texto = await extractTextFromFile(file);
      setForm((f) => ({
        ...f,
        preguntasRespuestas: f.preguntasRespuestas
          ? `${f.preguntasRespuestas}\n\n[De «${file.name}»]\n${texto}`
          : texto,
      }));
      logAudit("Documento de descargos cargado", `${file.name} — ${trab.empleado}`);
    } catch (e) {
      setErrorDoc(e instanceof Error ? e.message : "No se pudo leer el archivo.");
    } finally {
      setCargandoDoc(false);
    }
  }

  // Genera un PDF imprimible (el navegador permite «Guardar como PDF»).
  function descargarPDF(texto: string, titulo: string) {
    const w = window.open("", "_blank");
    if (!w) return;
    const safe = texto.replace(/[&<>]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[m] as string));
    w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${titulo} — ${EMPRESA}</title>
<style>
  @page { margin: 2.2cm; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #16181d; font-size: 12px; line-height: 1.6; }
  pre { white-space: pre-wrap; font-family: inherit; margin: 0; }
  .pie { margin-top: 28px; font-size: 10px; color: #6b7280; border-top: 1px solid #d1d5db; padding-top: 8px; }
</style></head><body><pre>${safe}</pre>
<div class="pie">Documento generado con Centinela — requiere revisión y firma del abogado responsable.</div>
<script>window.onload = function(){ window.print(); }<\/script>
</body></html>`);
    w.document.close();
    logAudit("Documento exportado a PDF", `${titulo} — ${trab.empleado}`);
  }

  function cambiarEtapa(k: EtapaDisciplinaria) {
    setEtapa(k);
    setAsesoria(null);
    setDocumento(null);
    setPlan("");
  }

  // Botones de documento por etapa (la citación ofrece dos: texto y documento completo).
  const docBotones: { label: string; tipo: string }[] =
    etapa === "citacion"
      ? [
          { label: "Generar situación de descargos (texto)", tipo: "situacion" },
          { label: "Generar documento completo (hechos + citación)", tipo: "citacion" },
        ]
      : info.documento
        ? [{ label: info.documento.label, tipo: info.documento.tipo }]
        : [];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        overline="Gestión de procesos disciplinarios"
        title="Asistente del debido proceso (art. 115 CST)"
        subtitle="Elige al trabajador y la etapa del proceso; el asistente te muestra qué corresponde, te aconseja con IA (tú decides) y genera el documento de cada etapa. Las garantías se evalúan por etapa, sin listas interminables."
      />

      {docsPerfil.length === 0 && (
        <div className="mb-4 hairline flex items-start gap-3 bg-[var(--warning-tint)] px-4 py-3">
          <Warning2 size={18} color="var(--warning)" variant="Bold" className="mt-0.5 shrink-0" />
          <p className="text-[12.5px] leading-snug text-ink-2">
            No has cargado documentos internos. Ve a{" "}
            <Link href="/perfil" className="font-medium text-ink underline">
              Perfil
            </Link>{" "}
            y sube el RIT/manual una sola vez para que la IA cite la norma interna específica.
          </p>
        </div>
      )}

      {/* Datos del caso */}
      <Card>
        <CardHeader overline="Caso" title="Trabajador y hechos" right={<Judge size={20} color="var(--red)" variant="Bulk" />} />
        <div className="grid grid-cols-1 gap-3 px-5 py-4 md:grid-cols-2">
          <Campo label="Trabajador">
            <select className="dx" value={trabajadorId} onChange={(e) => setTrabajadorId(e.target.value)}>
              {todos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.empleado} — {c.cargo}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Fecha de los hechos">
            <input type="date" className="dx" value={form.fechaHechos} onChange={(e) => setForm({ ...form, fechaHechos: e.target.value })} />
          </Campo>
          <div className="md:col-span-2">
            <label className="block">
              <span className="overline mb-1 flex items-center gap-1.5">
                Hechos imputados
                <button
                  type="button"
                  onClick={() => setMostrarInfo((v) => !v)}
                  className="inline-flex items-center gap-1 text-[10px] font-medium normal-case tracking-normal text-red hover:underline"
                  title="¿Qué escribir aquí?"
                >
                  <InfoCircle size={13} color="var(--red)" variant="Bold" /> ¿Qué escribir aquí?
                </button>
              </span>
              {mostrarInfo && (
                <div className="hairline mb-2 bg-[var(--info-tint)] px-3 py-2 text-[11.5px] leading-snug text-ink-2">
                  <p className="mb-1 font-medium text-ink">Describe la conducta de forma concreta y objetiva:</p>
                  <ul className="list-disc space-y-0.5 pl-4">
                    <li><span className="font-medium">Qué pasó</span> (acción u omisión), sin calificarla jurídicamente.</li>
                    <li><span className="font-medium">Cuándo y dónde</span> (fechas, lugar, turno).</li>
                    <li><span className="font-medium">Quiénes</span> intervinieron y cómo se conoció el hecho.</li>
                    <li><span className="font-medium">Evidencia</span> que lo respalda (correos, registros, testigos).</li>
                  </ul>
                  <p className="mt-1 text-ink-3">
                    Ej.: «El 10/06/2026 el trabajador no asistió a su turno (7:00–16:00) sin justificación ni aviso, según el
                    registro de acceso; igual el 11 y 12 de junio.» La causal y la norma interna las sugiere la IA abajo.
                  </p>
                </div>
              )}
              <textarea className="dx" rows={2} value={form.hechos} onChange={(e) => setForm({ ...form, hechos: e.target.value })} />
            </label>
          </div>
          <Campo label="Causal (CST art. 62-A)">
            <select className="dx" value={form.causalId} onChange={(e) => setForm({ ...form, causalId: e.target.value })}>
              {JUSTAS_CAUSAS_EMPLEADOR.map((c) => (
                <option key={c.id} value={c.id}>{`${c.id} — ${c.causal}`}</option>
              ))}
            </select>
          </Campo>
          <Campo label="Norma interna infringida">
            <input className="dx" value={form.normaInterna} onChange={(e) => setForm({ ...form, normaInterna: e.target.value })} />
          </Campo>
          <div className="md:col-span-2">
            <Button variant="secondary" onClick={sugerirCausal} disabled={sugiriendo}>
              <Magicpen size={15} variant="Bold" color="var(--red)" />{" "}
              {sugiriendo ? "Analizando los hechos…" : "Sugerir causal y norma con IA"}
            </Button>
            {sugerencia && !sugerencia.error && (
              <div className="hairline mt-2 bg-surface-2 px-3 py-2.5 text-[12px] leading-snug">
                <div className="mb-1.5 flex items-center gap-1.5">
                  <Cpu size={14} color="var(--red)" />
                  <span className="font-medium text-ink">Preselección de la IA</span>
                  <span className="text-[10.5px] text-ink-3">— se aplicó arriba; tú confirmas o cambias</span>
                </div>
                {String(sugerencia.justificacionCausal ?? "") && (
                  <p className="text-ink-2"><span className="font-medium text-ink">Causal: </span>{String(sugerencia.justificacionCausal)}</p>
                )}
                {String(sugerencia.justificacionNorma ?? "") && (
                  <p className="mt-1 text-ink-2"><span className="font-medium text-ink">Norma interna: </span>{String(sugerencia.justificacionNorma)}</p>
                )}
                {Array.isArray(sugerencia.alternativas) && (sugerencia.alternativas as string[]).length > 0 && (
                  <p className="mt-1 text-ink-3">Otras causales posibles: {(sugerencia.alternativas as string[]).join(", ")}</p>
                )}
                <div className="mt-1.5">
                  <Badge tone={sugerencia._modo === "ia" ? "success" : "neutral"}>
                    {sugerencia._modo === "ia" ? String(sugerencia._provider ?? "IA") : "Sugerencia base (sin IA)"}
                  </Badge>
                </div>
              </div>
            )}
            {Boolean(sugerencia?.error) && <p className="mt-2 text-[12px] text-red-dark">{String(sugerencia?.error)}</p>}
          </div>
        </div>
      </Card>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-5">
        {/* Línea de tiempo del proceso */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader overline="Proceso" title="¿En qué etapa estás?" />
            <div className="divide-y divide-border">
              {ETAPAS.map((e, i) => {
                const estado = i < idxActual ? "hecha" : i === idxActual ? "actual" : "pendiente";
                const color = estado === "hecha" ? "var(--success)" : estado === "actual" ? "var(--red)" : "var(--ink-3)";
                return (
                  <button
                    key={e.key}
                    onClick={() => cambiarEtapa(e.key)}
                    className="flex w-full items-start gap-3 px-5 py-3 text-left transition-colors hover:bg-surface-2"
                    style={{ background: estado === "actual" ? "var(--surface-2)" : undefined }}
                  >
                    <span
                      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold"
                      style={{
                        borderColor: color,
                        color: estado === "pendiente" ? "var(--ink-3)" : "#fff",
                        background: estado === "pendiente" ? "var(--surface)" : color,
                      }}
                    >
                      {estado === "hecha" ? "✓" : e.num}
                    </span>
                    <span className="min-w-0">
                      <span className={`block text-[13px] ${estado === "actual" ? "font-semibold text-ink" : "text-ink-2"}`}>
                        {e.titulo}
                      </span>
                      <span className="font-num text-[10.5px] text-ink-3">{e.norma}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Panel de la etapa activa */}
        <div className="lg:col-span-3">
          <Reveal key={etapa}>
            <Card>
              <CardHeader
                overline={`Etapa ${info.num} de ${ETAPAS.length}`}
                title={info.titulo}
                right={<Badge tone="neutral">{info.norma}</Badge>}
              />
              <div className="space-y-4 px-5 py-4">
                <p className="text-[13px] leading-relaxed text-ink-2">{info.descripcion}</p>

                <div>
                  <div className="overline mb-1.5">Qué debe cumplirse en esta etapa</div>
                  <ul className="space-y-1">
                    {info.garantias.map((g) => (
                      <li key={g} className="flex items-start gap-2 text-[12.5px] text-ink-2">
                        <TickCircle size={14} color="var(--ink-3)" className="mt-0.5 shrink-0" /> {g}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Etapa 2 — datos de la audiencia (los pone el abogado; la IA no los conoce) */}
                {etapa === "citacion" && (
                  <div className="hairline bg-surface-2 px-4 py-3">
                    <div className="overline mb-2">Datos de la audiencia de descargos</div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <Campo label="Fecha y hora de la audiencia">
                        <input
                          type="datetime-local"
                          className="dx"
                          value={form.fechaDiligencia}
                          onChange={(e) => setForm({ ...form, fechaDiligencia: e.target.value })}
                        />
                      </Campo>
                      <Campo label="Lugar (oficina / dirección)">
                        <input
                          className="dx"
                          placeholder="Sala de juntas, sede principal…"
                          value={form.lugarDiligencia}
                          onChange={(e) => setForm({ ...form, lugarDiligencia: e.target.value })}
                        />
                      </Campo>
                      <div className="md:col-span-2">
                        <Campo label="Enlace de la audiencia (opcional — Zoom/Meet si es virtual)">
                          <input
                            className="dx"
                            placeholder="https://… (déjalo vacío si es presencial)"
                            value={form.linkDiligencia}
                            onChange={(e) => setForm({ ...form, linkDiligencia: e.target.value })}
                          />
                        </Campo>
                      </div>
                    </div>
                    <p className="mt-2 text-[11px] leading-snug text-ink-3">
                      La fecha, el lugar y el enlace los define la empresa: la IA no puede fijarlos. Se incorporan al
                      documento completo de citación.
                    </p>
                  </div>
                )}

                {/* Etapa 3 — preguntas/respuestas de la diligencia + carga del documento anotado */}
                {etapa === "descargos" && (
                  <div className="hairline bg-surface-2 px-4 py-3">
                    <div className="overline mb-2">Diligencia de descargos</div>
                    <Campo label="Preguntas y respuestas de la audiencia">
                      <textarea
                        className="dx"
                        rows={5}
                        placeholder={"P: ¿Por qué no asistió los días 10, 11 y 12 de junio?\nR: …\nP: …\nR: …"}
                        value={form.preguntasRespuestas}
                        onChange={(e) => setForm({ ...form, preguntasRespuestas: e.target.value })}
                      />
                    </Campo>
                    <input
                      ref={docInputRef}
                      type="file"
                      accept={ACCEPTED_FILE_TYPES}
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) cargarDocDescargos(f);
                        e.target.value = "";
                      }}
                    />
                    <Button variant="secondary" className="mt-2" onClick={() => docInputRef.current?.click()} disabled={cargandoDoc}>
                      <DocumentUpload size={15} /> {cargandoDoc ? "Leyendo documento…" : "Subir documento anotado (PDF/DOCX/TXT)"}
                    </Button>
                    {errorDoc && <p className="mt-1.5 text-[12px] text-red-dark">{errorDoc}</p>}
                    <p className="mt-2 text-[11px] leading-snug text-ink-3">
                      Lo escrito aquí (o el documento que subas) se incorpora al acta de descargos.
                    </p>
                  </div>
                )}

                {/* Etapa 4 — oportunidad de pruebas (antes del análisis multimodal) */}
                {etapa === "pruebas" && (
                  <div className="hairline bg-surface-2 px-4 py-3">
                    <div className="overline mb-2">Pruebas del trabajador</div>
                    <Campo label="¿El trabajador aportó pruebas oportunamente?">
                      <select
                        className="dx"
                        value={form.pruebasAportadas}
                        onChange={(e) => setForm({ ...form, pruebasAportadas: e.target.value as "" | "si" | "no" })}
                      >
                        <option value="">— Selecciona —</option>
                        <option value="si">Sí, aportó pruebas oportunamente</option>
                        <option value="no">No aportó pruebas</option>
                      </select>
                    </Campo>
                    <div className="mt-3">
                      <Campo label="Descripción de las pruebas (escribe lo que muestran; útil para video/cámaras)">
                        <textarea
                          className="dx"
                          rows={3}
                          placeholder="Ej.: La cámara de seguridad del acceso no registra ingreso del trabajador los días 10, 11 y 12…"
                          value={form.oportunidadPruebas}
                          onChange={(e) => setForm({ ...form, oportunidadPruebas: e.target.value })}
                        />
                      </Campo>
                    </div>
                    <p className="mt-2 text-[11px] leading-snug text-ink-3">
                      Describe la prueba en texto para que la IA la analice; o súbela abajo (imagen/audio/video). La IA
                      describe; el abogado valora si prueba la falta.
                    </p>
                  </div>
                )}

                {/* Etapa 5 — la decisión del abogado (la IA aconseja arriba) */}
                {etapa === "decision" && (
                  <div className="hairline bg-surface-2 px-4 py-3">
                    <div className="overline mb-2">Decisión del abogado</div>
                    <Campo label="Decisión adoptada (sanción, archivo o terminación con justa causa)">
                      <textarea
                        className="dx"
                        rows={3}
                        placeholder="Ej.: Terminación del contrato con justa causa por inejecución sistemática de obligaciones…"
                        value={form.decision}
                        onChange={(e) => setForm({ ...form, decision: e.target.value })}
                      />
                    </Campo>
                    <p className="mt-2 text-[11px] leading-snug text-ink-3">
                      La IA entrega su consideración (abajo); la decisión final la toma el abogado. Este texto alimenta la
                      decisión motivada y la notificación.
                    </p>
                  </div>
                )}

                {/* Etapa 6 — tipo de notificación */}
                {etapa === "notificacion" && (
                  <div className="hairline bg-surface-2 px-4 py-3">
                    <div className="overline mb-2">Tipo de notificación</div>
                    <Campo label="¿Qué se notifica?">
                      <select
                        className="dx"
                        value={form.tipoNotificacion}
                        onChange={(e) => setForm({ ...form, tipoNotificacion: e.target.value as "sancion" | "despido" })}
                      >
                        <option value="sancion">Sanción disciplinaria</option>
                        <option value="despido">Terminación del contrato con justa causa (despido)</option>
                      </select>
                    </Campo>
                    {!form.decision && (
                      <div className="mt-2">
                        <Campo label="Resumen de la decisión (opcional)">
                          <textarea
                            className="dx"
                            rows={2}
                            value={form.decision}
                            onChange={(e) => setForm({ ...form, decision: e.target.value })}
                          />
                        </Campo>
                      </div>
                    )}
                    <p className="mt-2 text-[11px] leading-snug text-ink-3">
                      La notificación se genera según la decisión e informa siempre la posibilidad de recursos (CN art. 29).
                    </p>
                  </div>
                )}

                {/* Análisis multimodal de pruebas — solo en la etapa de valoración */}
                {etapa === "pruebas" && (
                  <EvidenciaPanel
                    caso={{
                      empleado: trab.empleado,
                      cargo: trab.cargo,
                      hechos: form.hechos,
                      causal: caso.causalTexto,
                    }}
                  />
                )}

                {/* Asesoría IA */}
                <div className="hairline bg-surface-2 px-4 py-3">
                  <div className="mb-2 flex items-center gap-2">
                    <Cpu size={16} color="var(--red)" />
                    <span className="text-[13px] font-medium text-ink">Asesoría de la IA</span>
                    <span className="text-[11px] text-ink-3">— aconseja; tú decides</span>
                  </div>
                  <label className="block">
                    <span className="overline mb-1 block">¿Qué piensa hacer la empresa? (opcional)</span>
                    <textarea
                      className="dx"
                      rows={2}
                      placeholder="Escribe tu plan y la IA lo evalúa…"
                      value={plan}
                      onChange={(e) => setPlan(e.target.value)}
                    />
                  </label>
                  <Button variant="primary" className="mt-2" onClick={pedirAsesoria} disabled={cargando}>
                    <Flash size={15} variant="Bold" /> {cargando ? "Analizando…" : "Pedir asesoría a la IA"}
                  </Button>

                  {asesoria && !asesoria.error && (
                    <div className="mt-3 space-y-2 text-[12.5px]">
                      {asesoria._modo === "error" && (
                        <p className="text-[11.5px] text-red-dark">
                          La IA falló; mostrando asesoría base. {String(asesoria._warning ?? "")}
                        </p>
                      )}
                      <Linea k="Recomendación" v={String(asesoria.recomendacion ?? "")} />
                      <Linea k="Fundamento" v={String(asesoria.fundamento ?? "")} />
                      {Array.isArray(asesoria.riesgos) && (asesoria.riesgos as string[]).length > 0 && (
                        <div>
                          <span className="overline">Riesgos a evitar</span>
                          <ul className="mt-1 space-y-1">
                            {(asesoria.riesgos as string[]).map((r) => (
                              <li key={r} className="flex items-start gap-1.5 text-ink-2">
                                <Warning2 size={13} color="var(--warning)" className="mt-0.5 shrink-0" /> {r}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <Linea k="Siguiente paso" v={String(asesoria.siguientePaso ?? "")} />
                      {String(asesoria.evaluacionPlan ?? "") && (
                        <div className="hairline bg-[var(--info-tint)] px-3 py-2">
                          <span className="font-medium text-ink">Sobre tu plan: </span>
                          {String(asesoria.evaluacionPlan)}
                        </div>
                      )}
                      <div className="pt-1">
                        <Badge tone={asesoria._modo === "ia" ? "success" : "neutral"}>
                          {asesoria._modo === "ia" ? String(asesoria._provider ?? "IA") : "Asesoría base (sin IA)"}
                        </Badge>
                      </div>
                    </div>
                  )}
                </div>

                {/* Documento(s) de la etapa */}
                {docBotones.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {docBotones.map((d) => (
                      <Button key={d.tipo} variant="secondary" onClick={() => generar(d.tipo, d.label)}>
                        <DocumentText size={15} /> {d.label}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </Reveal>

          {documento && (
            <Reveal className="mt-3" key={documento.texto.slice(0, 30)}>
              <Card>
                <CardHeader
                  overline="Borrador asistido"
                  title={documento.titulo}
                  subtitle="Texto editable para revisión. Requiere validación y firma del abogado responsable."
                  right={<Badge tone="warning">Requiere validación</Badge>}
                />
                <textarea
                  className="w-full resize-y overflow-x-auto whitespace-pre-wrap border-0 bg-transparent px-5 py-4 font-mono text-[12px] leading-relaxed text-ink-2 focus:outline-none"
                  rows={Math.min(28, documento.texto.split("\n").length + 2)}
                  value={documento.texto}
                  onChange={(e) => setDocumento((d) => (d ? { ...d, texto: e.target.value } : d))}
                />
                <div className="flex flex-wrap justify-end gap-2 px-5 pb-4">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      navigator.clipboard?.writeText(documento.texto);
                      logAudit("Documento disciplinario copiado", `${documento.titulo} — ${trab.empleado}`);
                    }}
                  >
                    Copiar
                  </Button>
                  <Button variant="secondary" onClick={() => descargarPDF(documento.texto, documento.titulo)}>
                    <DocumentDownload size={15} /> Descargar PDF
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => logAudit("Documento enviado a firma del abogado", `${documento.titulo} — ${trab.empleado}`)}
                  >
                    Enviar a firma del abogado
                  </Button>
                </div>
              </Card>
            </Reveal>
          )}
        </div>
      </div>

      <style jsx global>{`
        .dx {
          width: 100%;
          border: 1px solid var(--border-2);
          background: var(--surface);
          padding: 7px 9px;
          font-size: 12.5px;
          color: var(--ink);
          border-radius: var(--radius);
        }
        .dx:focus {
          outline: none;
          border-color: var(--ink);
        }
      `}</style>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="overline mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function Linea({ k, v }: { k: string; v: string }) {
  if (!v) return null;
  return (
    <div>
      <span className="overline">{k}</span>
      <p className="text-ink-2">{v}</p>
    </div>
  );
}
