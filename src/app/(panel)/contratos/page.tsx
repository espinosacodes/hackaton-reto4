"use client";

import { useRef, useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { Card, CardHeader, Badge, Button, Progress } from "@/components/ui";
import { Reveal } from "@/components/motion";
import { CONTRATOS } from "@/lib/data/contratos";
import { addContratoConfirmado, logAudit, useBusqueda, setBusqueda } from "@/lib/store";
import { Contrato } from "@/lib/types";
import { cop, fmtDate } from "@/lib/utils";
import {
  ACCEPTED_FILE_TYPES,
  extractTextFromFile,
  FileExtractError,
} from "@/lib/extract-file";
import { DocumentUpload, Flash, TickCircle, People, Cpu, Document, Warning2 } from "iconsax-react";

const tipoLabel: Record<string, string> = {
  indefinido: "Indefinido",
  fijo: "Término fijo",
  obra_labor: "Obra o labor",
  prestacion_servicios: "Prestación de servicios",
  aprendizaje: "Aprendizaje",
  plataforma: "Plataforma digital",
};

const tipoTone: Record<string, "neutral" | "warning" | "red"> = {
  prestacion_servicios: "warning",
  plataforma: "red",
};

const EJEMPLO = `CONTRATO INDIVIDUAL DE TRABAJO A TÉRMINO FIJO

Entre EMPRESA DEMO S.A.S. y la señora MARÍA CAMILA RESTREPO, identificada con C.C. 1.144.092.331, se celebra el presente contrato para el cargo de ANALISTA DE CARTERA.
Salario mensual: DOS MILLONES SEISCIENTOS MIL PESOS ($2.600.000).
Jornada: tiempo completo, 42 horas semanales.
Duración: del 1 de julio de 2025 al 30 de junio de 2026.
El empleador se obliga a pagar seguridad social, prima de servicios, cesantías y vacaciones.`;

export default function ContratosPage() {
  const [texto, setTexto] = useState("");
  const [cargando, setCargando] = useState(false);
  const [extraccion, setExtraccion] = useState<Record<string, unknown> | null>(null);
  const [archivo, setArchivo] = useState<string | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [errArchivo, setErrArchivo] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Revisión humana: copia editable de lo extraído + estado de validación.
  // Al llegar una nueva extracción reseteamos en render (patrón recomendado por React).
  const [srcExtraccion, setSrcExtraccion] = useState(extraccion);
  const [datos, setDatos] = useState<Record<string, unknown> | null>(extraccion);
  const [editando, setEditando] = useState(false);
  const [confirmado, setConfirmado] = useState<string | null>(null);
  if (srcExtraccion !== extraccion) {
    setSrcExtraccion(extraccion);
    setDatos(extraccion);
    setEditando(false);
    setConfirmado(null);
  }
  const rev = datos ?? extraccion;

  // Búsqueda global del encabezado → filtra la nómina mostrada.
  const q = useBusqueda().trim().toLowerCase();
  const nomina = q
    ? CONTRATOS.filter((c) =>
        `${c.empleado} ${c.cargo} ${c.area} ${c.id}`.toLowerCase().includes(q)
      )
    : CONTRATOS;

  function setCampo(k: string, v: string | number) {
    setDatos((prev) => ({ ...(prev ?? {}), [k]: v }));
  }

  function confirmar() {
    const d = datos ?? extraccion;
    if (!d) return;
    const nuevo: Contrato = {
      id: `C-IA-${Date.now().toString().slice(-6)}`,
      empleado: String(d.empleado ?? "Sin nombre"),
      documento: String(d.documento ?? "—"),
      cargo: String(d.cargo ?? "—"),
      area: "Extraído por IA",
      tipo: (String(d.tipo) as Contrato["tipo"]) || "indefinido",
      jornada: (String(d.jornada) as Contrato["jornada"]) || "completa",
      horasSemana: Number(d.horasSemana ?? 42),
      salarioMensual: Number(d.salarioMensual ?? 0),
      auxilioTransporte: Boolean(d.auxilioTransporte),
      salarioIntegral: Boolean(d.salarioIntegral),
      fechaInicio: String(d.fechaInicio || "2025-01-01"),
      fechaFin: d.fechaFin ? String(d.fechaFin) : undefined,
      estado: "activo",
      extraccionConfianza: Number(d.confianza ?? 0),
      fuente: "ia",
    };
    addContratoConfirmado(nuevo);
    logAudit(
      "Contrato validado",
      `${nuevo.empleado} (${nuevo.id}) · confianza ${Math.round((nuevo.extraccionConfianza ?? 0) * 100)}% · ${editando ? "con correcciones" : "sin cambios"}`
    );
    setConfirmado(new Date().toLocaleString("es-CO"));
    setEditando(false);
  }

  async function cargarArchivo(file: File) {
    setErrArchivo(null);
    setLeyendo(true);
    try {
      const t = await extractTextFromFile(file);
      setTexto(t);
      setArchivo(file.name);
      setExtraccion(null);
    } catch (err) {
      setArchivo(null);
      setErrArchivo(
        err instanceof FileExtractError
          ? err.message
          : "No se pudo procesar el archivo.",
      );
    } finally {
      setLeyendo(false);
    }
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) cargarArchivo(file);
    e.target.value = ""; // permite recargar el mismo archivo
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setArrastrando(false);
    const file = e.dataTransfer.files?.[0];
    if (file) cargarArchivo(file);
  }

  function cargarEjemplo() {
    setErrArchivo(null);
    setTexto(EJEMPLO);
    setArchivo("contrato-ejemplo.txt");
    setExtraccion(null);
  }

  async function extraer() {
    setCargando(true);
    setExtraccion(null);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: texto }),
      });
      // En el despliegue estático (GitHub Pages) no hay servidor: 404 → mock en navegador.
      if (!res.ok) {
        setExtraccion(mockClient(texto));
        return;
      }
      const ct = res.headers.get("content-type") ?? "";
      setExtraccion(ct.includes("application/json") ? await res.json() : mockClient(texto));
    } catch {
      setExtraccion(mockClient(texto));
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        overline="Lectura contractual asistida por IA"
        title="Contratos"
        subtitle="La IA extrae los datos del contrato; el resultado se muestra con su nivel de confianza para que RRHH o el abogado lo confirmen antes de usarlo. La IA nunca calcula ni decide: sólo lee."
      />

      {/* Extractor */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader
            overline="Cargar contrato"
            title="Suba el contrato (PDF, DOCX o TXT)"
            right={<DocumentUpload size={20} color="var(--red)" />}
          />
          <div className="px-5 py-4">
            {/* Carga de archivo: PDF / DOCX / TXT (lectura en el navegador, sin subir al servidor) */}
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED_FILE_TYPES}
              onChange={onPickFile}
              className="hidden"
            />
            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
              onDragLeave={() => setArrastrando(false)}
              onDrop={onDrop}
              className={`flex min-h-[180px] cursor-pointer flex-col items-center justify-center gap-3 border border-dashed px-6 py-10 text-center transition-colors ${
                arrastrando ? "border-ink bg-surface-2" : "border-border-2 hover:border-ink"
              }`}
              style={{ borderRadius: "var(--radius)" }}
            >
              {leyendo ? (
                <>
                  <Flash size={28} color="var(--red)" variant="Bold" className="animate-pulse" />
                  <span className="text-[13px] text-ink-2">Leyendo archivo…</span>
                </>
              ) : archivo ? (
                <>
                  <Document size={30} color="var(--success)" variant="Bold" />
                  <div>
                    <div className="text-[13px] font-medium text-ink">{archivo}</div>
                    <div className="mt-0.5 text-[11.5px] text-ink-3">
                      {texto.length.toLocaleString("es-CO")} caracteres extraídos · listo para analizar
                    </div>
                  </div>
                  <span className="text-[11px] text-ink-3 underline">Cambiar archivo</span>
                </>
              ) : (
                <>
                  <DocumentUpload size={30} color="var(--red)" />
                  <div>
                    <div className="text-[13px] font-medium text-ink">
                      Arrastre el contrato aquí o haga clic para buscarlo
                    </div>
                    <div className="mt-0.5 text-[11.5px] text-ink-3">
                      Formatos admitidos: PDF, DOCX o TXT · máx. 12 MB
                    </div>
                  </div>
                </>
              )}
            </div>
            {errArchivo && <p className="mt-3 text-[12px] text-red-dark">{errArchivo}</p>}
            <div className="mt-3 flex items-center justify-between">
              <button
                type="button"
                onClick={cargarEjemplo}
                className="text-[11.5px] text-ink-3 underline transition-colors hover:text-ink"
              >
                Probar con un contrato de ejemplo
              </button>
              <Button variant="primary" onClick={extraer} disabled={cargando || leyendo || !texto.trim()}>
                <Flash size={15} variant="Bold" />
                {cargando ? "Analizando…" : "Extraer con IA"}
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            overline="Revisión humana"
            title="Datos extraídos"
            right={
              extraccion?._modo ? (
                <Badge
                  tone={
                    extraccion._modo === "ia"
                      ? "success"
                      : extraccion._modo === "error"
                      ? "red"
                      : "neutral"
                  }
                >
                  {extraccion._modo === "ia" ? (
                    <><Cpu size={12} className="mr-1" /> {String(extraccion._provider ?? "IA")}</>
                  ) : extraccion._modo === "error" ? (
                    "Error IA"
                  ) : (
                    "Demo"
                  )}
                </Badge>
              ) : undefined
            }
          />
          <div className="px-5 py-4">
            {!extraccion && !cargando && (
              <p className="py-8 text-center text-[13px] text-ink-3">
                Cargue un contrato y presione “Extraer con IA”.
              </p>
            )}
            {cargando && (
              <div className="space-y-2 py-6">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-3 animate-pulse bg-surface-2" style={{ width: `${90 - i * 12}%` }} />
                ))}
              </div>
            )}
            {extraccion && !extraccion.error && (
              <div className="space-y-3">
                {extraccion._modo === "error" && (
                  <div className="hairline flex items-start gap-2 bg-[var(--red-tint)] px-3 py-2.5 text-[12px]">
                    <Warning2 size={15} color="var(--red)" variant="Bold" className="mt-0.5 shrink-0" />
                    <span className="text-ink-2">
                      <span className="font-medium text-red-dark">La IA no respondió.</span> Lo que ves
                      son datos de relleno, <span className="font-medium">no confiables</span>.{" "}
                      {String(extraccion._warning ?? "")} Reintente o capture los datos manualmente.
                    </span>
                  </div>
                )}
                <ConfRow conf={Number(rev?.confianza ?? 0)} />
                {editando ? (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12.5px]">
                    <EditCampo k="Empleado" v={String(rev?.empleado ?? "")} onChange={(x) => setCampo("empleado", x)} />
                    <EditCampo k="Documento" v={String(rev?.documento ?? "")} onChange={(x) => setCampo("documento", x)} />
                    <EditCampo k="Cargo" v={String(rev?.cargo ?? "")} onChange={(x) => setCampo("cargo", x)} />
                    <label className="block">
                      <span className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-3">Tipo</span>
                      <select
                        value={String(rev?.tipo ?? "indefinido")}
                        onChange={(e) => setCampo("tipo", e.target.value)}
                        className="mt-0.5 w-full border border-border-2 bg-surface px-2 py-1 text-[12.5px] text-ink focus:border-ink focus:outline-none"
                        style={{ borderRadius: "var(--radius)" }}
                      >
                        {Object.entries(tipoLabel).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </label>
                    <EditCampo k="Salario" type="number" v={String(rev?.salarioMensual ?? "")} onChange={(x) => setCampo("salarioMensual", Number(x) || 0)} />
                    <EditCampo k="Horas/sem" type="number" v={String(rev?.horasSemana ?? "")} onChange={(x) => setCampo("horasSemana", Number(x) || 0)} />
                    <EditCampo k="Inicio" v={String(rev?.fechaInicio ?? "")} onChange={(x) => setCampo("fechaInicio", x)} />
                    <EditCampo k="Fin" v={String(rev?.fechaFin ?? "")} onChange={(x) => setCampo("fechaFin", x)} />
                  </div>
                ) : (
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12.5px]">
                    <Campo k="Empleado" v={String(rev?.empleado ?? "")} />
                    <Campo k="Documento" v={String(rev?.documento ?? "")} />
                    <Campo k="Cargo" v={String(rev?.cargo ?? "")} />
                    <Campo k="Tipo" v={tipoLabel[String(rev?.tipo)] ?? String(rev?.tipo ?? "")} />
                    <Campo k="Salario" v={cop(Number(rev?.salarioMensual ?? 0))} />
                    <Campo k="Jornada" v={`${rev?.horasSemana ?? 0}h/sem`} />
                    <Campo k="Inicio" v={String(rev?.fechaInicio ?? "")} />
                    <Campo k="Fin" v={String(rev?.fechaFin ?? "") || "—"} />
                  </dl>
                )}
                {Array.isArray(extraccion.obligaciones) && (
                  <div>
                    <div className="overline mb-1">Obligaciones detectadas</div>
                    <div className="flex flex-wrap gap-1.5">
                      {(extraccion.obligaciones as string[]).map((o) => (
                        <Badge key={o} tone="neutral">{o}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {extraccion.observaciones ? (
                  <div className="hairline bg-[var(--warning-tint)] px-3 py-2 text-[12px] text-ink-2">
                    <span className="font-medium text-ink">Para revisar: </span>
                    {String(extraccion.observaciones)}
                  </div>
                ) : null}
                {confirmado ? (
                  <div className="hairline flex items-start gap-2 bg-[var(--success-tint)] px-3 py-2.5 text-[12.5px]">
                    <TickCircle size={16} color="var(--success)" variant="Bold" className="mt-0.5 shrink-0" />
                    <span className="text-ink">
                      <span className="font-medium">Validado por RH (demo)</span> el {confirmado}. Registrado en la
                      bitácora y disponible en Liquidaciones y Reclasificación.
                    </span>
                  </div>
                ) : (
                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="secondary"
                      className="flex-1"
                      onClick={() => {
                        const n = !editando;
                        setEditando(n);
                        if (n) logAudit("Edición de extracción", "Campos abiertos para corrección por el revisor");
                      }}
                    >
                      {editando ? "Listo" : "Corregir"}
                    </Button>
                    <Button variant="primary" className="flex-1" onClick={confirmar}>
                      <TickCircle size={15} variant="Bold" /> Confirmar
                    </Button>
                  </div>
                )}
              </div>
            )}
            {extraccion?.error ? (
              <p className="py-6 text-center text-[13px] text-red-dark">{String(extraccion.error)}</p>
            ) : null}
          </div>
        </Card>
      </div>

      {/* Nómina */}
      <div className="mt-6 mb-2 flex items-center gap-2">
        <People size={18} color="var(--ink-2)" />
        <h2 className="font-head text-[16px] text-ink">Nómina analizada</h2>
        <span className="text-[12px] text-ink-3">
          · {nomina.length}
          {q ? ` de ${CONTRATOS.length}` : ""} vínculos
        </span>
        {q && (
          <button
            onClick={() => setBusqueda("")}
            className="ml-1 text-[11.5px] text-red-dark underline hover:text-ink"
          >
            Filtrando «{q}» · limpiar
          </button>
        )}
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-ink-3">
        <span>
          <span className="font-medium text-ink-2">Conf. IA</span> = qué tan segura está la IA de
          haber leído bien ese contrato.
        </span>
        <span className="flex items-center gap-1">
          <span style={{ color: "var(--success)" }}>●</span> ≥85% confiable
        </span>
        <span className="flex items-center gap-1">
          <span style={{ color: "var(--warning)" }}>●</span> 60–84% conviene revisar
        </span>
        <span className="flex items-center gap-1">
          <span style={{ color: "var(--red)" }}>●</span> &lt;60% revisión obligatoria
        </span>
      </div>
      <Card className="overflow-hidden">
        <div className="grid grid-cols-12 gap-3 border-b border-border bg-surface-2 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
          <div className="col-span-4">Empleado</div>
          <div className="col-span-3">Tipo de vínculo</div>
          <div className="col-span-2 text-right">Salario</div>
          <div className="col-span-2">Vigencia</div>
          <div className="col-span-1 text-right">Conf. IA</div>
        </div>
        <div className="divide-y divide-border">
          {nomina.length === 0 && (
            <p className="px-5 py-8 text-center text-[13px] text-ink-3">
              Ningún vínculo coincide con «{q}».
            </p>
          )}
          {nomina.map((c, i) => (
            <Reveal key={c.id} delay={Math.min(i, 8) * 0.04}>
              <Row c={c} />
            </Reveal>
          ))}
        </div>
      </Card>
    </div>
  );
}

// Extracción heurística en el navegador — usada cuando no hay servidor (demo estática).
function mockClient(text: string): Record<string, unknown> {
  const t = text.toLowerCase();
  const tipo = t.includes("prestación de servicios") || t.includes("prestacion de servicios")
    ? "prestacion_servicios"
    : t.includes("término fijo") || t.includes("termino fijo")
    ? "fijo"
    : t.includes("plataforma") || t.includes("domicilio")
    ? "plataforma"
    : "indefinido";
  const salMatch = text.replace(/\./g, "").match(/\$?\s?(\d{6,9})/);
  const salario = salMatch ? Number(salMatch[1]) : 1_750_905;
  const horas = Number(text.match(/(\d{2})\s*horas/)?.[1] ?? 42);
  return {
    empleado: text.match(/(?:señor[a]?|trabajador[a]?)\s+([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ ]{4,40})/)?.[1]?.trim() ?? "Trabajador de muestra",
    documento: text.match(/C\.?C\.?\s*([\d.]{6,})/i)?.[1] ?? "No identificado",
    cargo: text.match(/cargo de ([A-Za-zÁÉÍÓÚÑáéíóúñ ]{3,40})/i)?.[1]?.trim() ?? "Cargo no especificado",
    tipo,
    jornada: "completa",
    horasSemana: horas,
    salarioMensual: salario,
    auxilioTransporte: salario <= 2 * 1_750_905,
    salarioIntegral: t.includes("integral"),
    fechaInicio: "2025-07-01",
    fechaFin: tipo === "fijo" ? "2026-06-30" : "",
    obligaciones: ["Pago de seguridad social", "Prima de servicios", "Cesantías", "Vacaciones"],
    confianza: 0.62,
    observaciones:
      "Extracción heurística en navegador (demo estática sin servidor). Con servidor + ANTHROPIC_API_KEY se usa el modelo de IA.",
    _modo: "demo",
  };
}

function Row({ c }: { c: Contrato }) {
  const confPct = Math.round((c.extraccionConfianza ?? 0) * 100);
  return (
    <div className="grid grid-cols-12 items-center gap-3 px-5 py-3 text-[13px] transition-colors hover:bg-surface-2">
      <div className="col-span-4">
        <div className="font-medium text-ink">{c.empleado}</div>
        <div className="text-[11px] text-ink-3">{c.cargo} · {c.area}</div>
      </div>
      <div className="col-span-3">
        <Badge tone={tipoTone[c.tipo] ?? "neutral"}>{tipoLabel[c.tipo]}</Badge>
      </div>
      <div className="col-span-2 text-right font-num text-ink">{cop(c.salarioMensual)}</div>
      <div className="col-span-2 text-[12px] text-ink-2">
        {fmtDate(c.fechaInicio)}
        {c.fechaFin && <span className="text-ink-3"> → {fmtDate(c.fechaFin)}</span>}
      </div>
      <div className="col-span-1 text-right">
        <span
          className="font-num text-[11.5px]"
          style={{
            color:
              confPct >= 85 ? "var(--success)" : confPct >= 60 ? "var(--warning)" : "var(--red)",
          }}
          title="Nivel de confianza con que la IA extrajo los datos de este contrato"
        >
          {confPct}%
        </span>
      </div>
    </div>
  );
}

function ConfRow({ conf }: { conf: number }) {
  const pct = Math.round(conf * 100);
  const tone = pct >= 85 ? "var(--success)" : pct >= 60 ? "var(--warning)" : "var(--red)";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[12px]">
        <span className="overline">Confianza de extracción</span>
        <span className="font-num" style={{ color: tone }}>{pct}%</span>
      </div>
      <Progress value={pct} tone={tone} />
    </div>
  );
}

function Campo({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-3">{k}</dt>
      <dd className="text-ink">{v}</dd>
    </div>
  );
}

function EditCampo({
  k,
  v,
  onChange,
  type = "text",
}: {
  k: string;
  v: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-3">{k}</span>
      <input
        type={type}
        value={v}
        onChange={(e) => onChange(e.target.value)}
        className="mt-0.5 w-full border border-border-2 bg-surface px-2 py-1 text-[12.5px] text-ink focus:border-ink focus:outline-none"
        style={{ borderRadius: "var(--radius)" }}
      />
    </label>
  );
}
