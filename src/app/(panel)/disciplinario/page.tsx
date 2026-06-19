"use client";

import { useMemo, useState } from "react";
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
import { CONTRATOS } from "@/lib/data/contratos";
import { useContratosConfirmados, useDocumentosPerfil, logAudit } from "@/lib/store";
import { Judge, DocumentText, Warning2, TickCircle, Flash, Cpu } from "iconsax-react";

const EMPRESA = "Empresa Demo S.A.S.";

export default function DisciplinarioPage() {
  const confirmados = useContratosConfirmados();
  const docsPerfil = useDocumentosPerfil();
  const todos = useMemo(() => [...confirmados, ...CONTRATOS], [confirmados]);

  const [trabajadorId, setTrabajadorId] = useState(
    CONTRATOS.find((c) => c.cargo.toLowerCase().includes("operario"))?.id ?? CONTRATOS[0].id
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
    decision: "",
  });
  const causal = JUSTAS_CAUSAS_EMPLEADOR.find((c) => c.id === form.causalId);
  const rit = docsPerfil.find((d) => d.tipo.includes("RIT")) ?? docsPerfil[0];

  const [plan, setPlan] = useState("");
  const [asesoria, setAsesoria] = useState<Record<string, unknown> | null>(null);
  const [cargando, setCargando] = useState(false);
  const [documento, setDocumento] = useState<string | null>(null);

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

  function generar() {
    if (!info.documento) return;
    setDocumento(generarDocumento(info.documento.tipo, caso));
    logAudit("Documento disciplinario generado", `${info.documento.label} — ${trab.empleado}`);
  }

  function cambiarEtapa(k: EtapaDisciplinaria) {
    setEtapa(k);
    setAsesoria(null);
    setDocumento(null);
    setPlan("");
  }

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
            <Campo label="Hechos imputados">
              <textarea className="dx" rows={2} value={form.hechos} onChange={(e) => setForm({ ...form, hechos: e.target.value })} />
            </Campo>
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

                {/* Documento de la etapa */}
                {info.documento && (
                  <div>
                    <Button variant="secondary" onClick={generar}>
                      <DocumentText size={15} /> {info.documento.label}
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          </Reveal>

          {documento && (
            <Reveal className="mt-3" key={documento.slice(0, 30)}>
              <Card>
                <CardHeader
                  overline="Borrador asistido"
                  title="Documento generado"
                  subtitle="Requiere revisión y firma del abogado responsable."
                  right={<Badge tone="warning">Requiere validación</Badge>}
                />
                <pre className="overflow-x-auto whitespace-pre-wrap px-5 py-4 font-mono text-[12px] leading-relaxed text-ink-2">
                  {documento}
                </pre>
                <div className="flex justify-end gap-2 px-5 pb-4">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      navigator.clipboard?.writeText(documento);
                      logAudit("Documento disciplinario copiado", `${info.titulo} — ${trab.empleado}`);
                    }}
                  >
                    Copiar
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => logAudit("Documento enviado a firma del abogado", `${info.titulo} — ${trab.empleado}`)}
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
