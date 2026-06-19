"use client";

import { useRef, useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { Card, CardHeader, Badge, Button } from "@/components/ui";
import { Reveal } from "@/components/motion";
import {
  ACCEPTED_FILE_TYPES,
  extractTextFromFile,
  FileExtractError,
} from "@/lib/extract-file";
import {
  useDocumentosPerfil,
  addDocumentoPerfil,
  removeDocumentoPerfil,
  useParametros,
  setParametros,
  resetParametros,
  logAudit,
  type DocumentoPerfil,
} from "@/lib/store";
import { cop } from "@/lib/utils";
import {
  Buildings,
  DocumentText,
  DocumentUpload,
  Flash,
  TickCircle,
  CloseCircle,
  Trash,
  Calculator,
} from "iconsax-react";

interface Hallazgo {
  tema: string;
  cumple: boolean;
  riesgo: string;
  norma: string;
}

const TIPOS: { tipo: string; desc: string }[] = [
  { tipo: "Reglamento Interno de Trabajo (RIT)", desc: "Base del régimen disciplinario y de las faltas (CST art. 115)." },
  { tipo: "Manual de convivencia / conducta", desc: "Conductas esperadas y faltas de convivencia." },
  { tipo: "PTEE (transparencia y ética)", desc: "Programa de Transparencia y Ética Empresarial." },
  { tipo: "Convención / pacto colectivo", desc: "Acuerdos colectivos aplicables." },
  { tipo: "Código de ética", desc: "Principios y deberes de conducta." },
];

export default function PerfilPage() {
  const docs = useDocumentosPerfil();
  const byTipo = (t: string) => docs.find((d) => d.tipo === t);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        overline="Perfil de la empresa"
        title="Bases normativas internas"
        subtitle="Cargue una sola vez el reglamento, el manual, el PTEE y demás documentos internos. Quedan disponibles como contexto para todos los procesos disciplinarios — no hay que subirlos en cada caso."
      />

      <div className="mb-4 hairline flex items-start gap-3 bg-[var(--info-tint)] px-4 py-3">
        <Buildings size={18} color="var(--info)" className="mt-0.5 shrink-0" />
        <p className="text-[12.5px] leading-snug text-ink-2">
          La IA usa estos documentos para <span className="font-medium text-ink">citar la norma interna
          específica</span> y asesorar los procesos disciplinarios. Se guardan solo en este navegador
          (demostración).
        </p>
      </div>

      <div className="space-y-3">
        {TIPOS.map((t, i) => (
          <Reveal key={t.tipo} delay={i * 0.04}>
            <DocSlot tipo={t.tipo} desc={t.desc} doc={byTipo(t.tipo)} />
          </Reveal>
        ))}
      </div>

      <div className="mt-4 text-[12px] text-ink-3">
        {docs.length} de {TIPOS.length} documentos cargados.
      </div>

      <ParametrosSection />
    </div>
  );
}

const CAMPOS_PARAM: { key: "smmlv" | "auxilioTransporte" | "topeAuxilioSmmlv" | "tasaInteresCesantias" | "pisoSalarioIntegralSmmlv"; label: string; help: string }[] = [
  { key: "smmlv", label: "SMMLV", help: "Salario mínimo mensual" },
  { key: "auxilioTransporte", label: "Auxilio de transporte", help: "Monto mensual" },
  { key: "topeAuxilioSmmlv", label: "Tope auxilio (en SMMLV)", help: "Hasta cuántos SMMLV aplica el auxilio" },
  { key: "tasaInteresCesantias", label: "Interés cesantías", help: "Anual (0.12 = 12%)" },
  { key: "pisoSalarioIntegralSmmlv", label: "Piso salario integral (SMMLV)", help: "Desde cuántos SMMLV" },
];

function ParametrosSection() {
  const params = useParametros();
  const [sug, setSug] = useState<{ smmlv: number; auxilioTransporte: number; fuente: string; nota?: string } | null>(null);
  const [cargandoSug, setCargandoSug] = useState(false);

  function set(key: string, value: number) {
    setParametros({ ...params, [key]: value });
  }
  async function sugerir() {
    setCargandoSug(true);
    try {
      const res = await fetch("/api/parametros-sugeridos");
      setSug(await res.json());
    } catch {
      setSug(null);
    } finally {
      setCargandoSug(false);
    }
  }
  function aplicarSugerencia() {
    if (!sug) return;
    setParametros({ ...params, smmlv: sug.smmlv, auxilioTransporte: sug.auxilioTransporte });
    logAudit(
      "Parámetros actualizados (sugerencia)",
      `SMMLV ${sug.smmlv.toLocaleString("es-CO")} · auxilio ${sug.auxilioTransporte.toLocaleString("es-CO")} — ${sug.fuente}`
    );
    setSug(null);
  }

  return (
    <Card className="mt-6">
      <CardHeader
        overline="Parámetros de liquidación 2026"
        title="Valores configurables por la empresa"
        right={<Calculator size={20} color="var(--red)" />}
      />
      <div className="px-5 py-4">
        <p className="mb-3 text-[12px] text-ink-3">
          Estos valores alimentan el liquidador y el pasivo del dashboard. Por defecto se usan los
          parámetros legales 2026 (Decretos 1469/1470 de 2025); ajústalos según tu empresa.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CAMPOS_PARAM.map((c) => (
            <label key={c.key} className="block">
              <span className="overline mb-1 block">{c.label}</span>
              <input
                type="number"
                step="any"
                value={params[c.key]}
                onChange={(e) => set(c.key, Number(e.target.value) || 0)}
                className="w-full border border-border-2 bg-surface px-2.5 py-1.5 text-[13px] text-ink focus:border-ink focus:outline-none"
                style={{ borderRadius: "var(--radius)" }}
              />
              <span className="mt-0.5 block text-[10.5px] text-ink-3">{c.help}</span>
            </label>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={sugerir} disabled={cargandoSug}>
            <Flash size={14} variant="Bold" /> {cargandoSug ? "Buscando…" : "Sugerir valores del año"}
          </Button>
          <Button variant="secondary" onClick={() => resetParametros()}>
            Restablecer 2026
          </Button>
          <span className="text-[11.5px] text-ink-3">
            Vista previa: SMMLV {cop(params.smmlv)} · auxilio {cop(params.auxilioTransporte)}
          </span>
        </div>
        {sug && (
          <div className="mt-3 hairline flex flex-wrap items-center justify-between gap-3 bg-[var(--info-tint)] px-4 py-3">
            <div className="text-[12px] text-ink-2">
              <span className="font-medium text-ink">Sugerencia:</span> SMMLV {cop(sug.smmlv)} · auxilio{" "}
              {cop(sug.auxilioTransporte)} <span className="text-ink-3">— {sug.fuente}</span>
              {sug.nota && <div className="mt-0.5 text-[11px] text-ink-3">{sug.nota}</div>}
            </div>
            <div className="flex shrink-0 gap-2">
              <Button variant="secondary" onClick={() => setSug(null)}>Descartar</Button>
              <Button variant="primary" onClick={aplicarSugerencia}>Aplicar</Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function DocSlot({ tipo, desc, doc }: { tipo: string; desc: string; doc?: DocumentoPerfil }) {
  const [leyendo, setLeyendo] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [auditando, setAuditando] = useState(false);
  const [auditoria, setAuditoria] = useState<Record<string, unknown> | null>(null);
  const esRIT = tipo.includes("RIT");

  async function auditar() {
    if (!doc) return;
    setAuditando(true);
    setAuditoria(null);
    try {
      const res = await fetch("/api/auditar-rit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: doc.texto }),
      });
      setAuditoria(await res.json());
      logAudit("Auditoría de RIT con IA", `${tipo}: ${doc.nombre}`);
    } catch {
      setAuditoria({ error: "No se pudo auditar." });
    } finally {
      setAuditando(false);
    }
  }

  async function cargar(file: File) {
    setErr(null);
    setLeyendo(true);
    try {
      const texto = await extractTextFromFile(file);
      addDocumentoPerfil({
        id: `${Date.now()}-${Math.round(Math.random() * 1e6)}`,
        tipo,
        nombre: file.name,
        texto,
        ts: new Date().toISOString(),
      });
      logAudit("Documento de perfil cargado", `${tipo}: ${file.name}`);
    } catch (e) {
      setErr(e instanceof FileExtractError ? e.message : "No se pudo procesar el archivo.");
    } finally {
      setLeyendo(false);
    }
  }

  return (
    <Card>
      <CardHeader
        overline="Documento interno"
        title={tipo}
        right={doc ? <Badge tone="success"><TickCircle size={12} className="mr-1" /> Cargado</Badge> : undefined}
      />
      <div className="px-5 py-4">
        <p className="mb-3 text-[12px] text-ink-3">{desc}</p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_FILE_TYPES}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) cargar(f);
            e.target.value = "";
          }}
          className="hidden"
        />
        {doc ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 hairline bg-surface-2 px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <DocumentText size={16} color="var(--success)" variant="Bold" className="shrink-0" />
                <span className="truncate text-[12.5px] text-ink">
                  <span className="font-medium">{doc.nombre}</span> ·{" "}
                  {doc.texto.length.toLocaleString("es-CO")} caracteres
                </span>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="secondary" onClick={() => inputRef.current?.click()}>
                  Reemplazar
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    removeDocumentoPerfil(doc.id);
                    logAudit("Documento de perfil eliminado", `${tipo}: ${doc.nombre}`);
                  }}
                >
                  <Trash size={14} /> Quitar
                </Button>
              </div>
            </div>

            {esRIT && (
              <div>
                <Button variant="primary" onClick={auditar} disabled={auditando}>
                  <Flash size={14} variant="Bold" /> {auditando ? "Auditando…" : "Auditar RIT con IA"}
                </Button>
                {auditoria && !auditoria.error && (
                  <div className="mt-3 space-y-2">
                    {auditoria._modo === "error" && (
                      <p className="text-[11px] text-red-dark">
                        IA no disponible; auditoría heurística. {String(auditoria._warning ?? "")}
                      </p>
                    )}
                    <p className="text-[12px] text-ink-2">{String(auditoria.resumen ?? "")}</p>
                    <div className="hairline divide-y divide-border">
                      {((auditoria.hallazgos as Hallazgo[]) ?? []).map((h, idx) => (
                        <div key={idx} className="flex items-start gap-2 px-3 py-2 text-[12px]">
                          {h.cumple ? (
                            <TickCircle size={14} color="var(--success)" variant="Bold" className="mt-0.5 shrink-0" />
                          ) : (
                            <CloseCircle size={14} color="var(--red)" variant="Bold" className="mt-0.5 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <div className="font-medium text-ink">{h.tema}</div>
                            {!h.cumple && <div className="text-ink-2">{h.riesgo}</div>}
                            <div className="font-num text-[10.5px] text-ink-3">{h.norma}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <Badge tone={auditoria._modo === "ia" ? "success" : "neutral"}>
                      {auditoria._modo === "ia" ? String(auditoria._provider ?? "IA") : "Heurística (sin IA)"}
                    </Badge>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setArrastrando(true);
            }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={(e) => {
              e.preventDefault();
              setArrastrando(false);
              const f = e.dataTransfer.files?.[0];
              if (f) cargar(f);
            }}
            className={`flex cursor-pointer items-center gap-2 border border-dashed px-4 py-3 text-[12px] transition-colors ${
              arrastrando ? "border-ink bg-surface-2" : "border-border-2 hover:border-ink"
            }`}
            style={{ borderRadius: "var(--radius)" }}
          >
            {leyendo ? (
              <>
                <Flash size={16} color="var(--red)" variant="Bold" className="animate-pulse" />
                <span className="text-ink-2">Leyendo…</span>
              </>
            ) : (
              <>
                <DocumentUpload size={16} color="var(--red)" className="shrink-0" />
                <span className="text-ink-2">Arrastre o haga clic para subir (PDF, DOCX o TXT)</span>
              </>
            )}
          </div>
        )}
        {err && <p className="mt-2 text-[11.5px] text-red-dark">{err}</p>}
      </div>
    </Card>
  );
}
