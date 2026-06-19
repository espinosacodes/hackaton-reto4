"use client";

import { useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { Card, CardHeader, Badge, Button, Progress } from "@/components/ui";
import { Reveal } from "@/components/motion";
import { DocumentSource } from "@/components/DocumentSource";
import { addContratoConfirmado, removeContratoConfirmado, logAudit, useBusqueda, setBusqueda, useEmpresaActiva, useContratosConfirmados } from "@/lib/store";
import { obligacionesEmpleador } from "@/lib/aportes";
import { Contrato } from "@/lib/types";
import { cop, fmtDate, norm } from "@/lib/utils";
import { DocumentUpload, Flash, TickCircle, People, Cpu, Warning2, ArrowDown2, Trash, CloseCircle, AddCircle } from "iconsax-react";

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

const TITULOS: Record<string, string> = {
  indefinido: "CONTRATO INDIVIDUAL DE TRABAJO A TÉRMINO INDEFINIDO",
  fijo: "CONTRATO INDIVIDUAL DE TRABAJO A TÉRMINO FIJO",
  obra_labor: "CONTRATO DE TRABAJO POR DURACIÓN DE LA OBRA O LABOR",
  aprendizaje: "CONTRATO DE APRENDIZAJE",
  prestacion_servicios: "CONTRATO DE PRESTACIÓN DE SERVICIOS",
  plataforma: "CONTRATO DE VINCULACIÓN — PLATAFORMA DIGITAL",
};

const EJEMPLO = `CONTRATO INDIVIDUAL DE TRABAJO A TÉRMINO FIJO

Entre EMPRESA DEMO S.A.S. y la señora MARÍA CAMILA RESTREPO, identificada con C.C. 1.144.092.331, se celebra el presente contrato para el cargo de ANALISTA DE CARTERA.
Salario mensual: DOS MILLONES SEISCIENTOS MIL PESOS ($2.600.000).
Jornada: tiempo completo, 42 horas semanales.
Duración: del 1 de julio de 2025 al 30 de junio de 2026.
El empleador se obliga a pagar seguridad social, prima de servicios, cesantías y vacaciones.`;

export default function ContratosPage() {
  const empresa = useEmpresaActiva();
  // Nómina = contratos semilla de la empresa + los que el revisor confirmó (IA).
  // Así el contrato que se sube y valida "se queda abajo" en la nómina analizada.
  const confirmados = useContratosConfirmados();
  const CONTRATOS = [...confirmados, ...(empresa?.contratos ?? [])];
  const [texto, setTexto] = useState("");
  const [cargando, setCargando] = useState(false);
  const [extraccion, setExtraccion] = useState<Record<string, unknown> | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [expandido, setExpandido] = useState<string | null>(null);

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
  // Tolerante a tildes: "maria" encuentra "María" (se normaliza con `norm`).
  const qRaw = useBusqueda().trim();
  const q = norm(qRaw);
  const nomina = q
    ? CONTRATOS.filter((c) =>
        norm(`${c.empleado} ${c.cargo} ${c.area} ${c.id}`).includes(q)
      )
    : CONTRATOS;

  function setCampo(k: string, v: string | number) {
    setDatos((prev) => ({ ...(prev ?? {}), [k]: v }));
  }

  // Obligaciones periódicas del EMPLEADOR (editables por el revisor).
  const obligaciones: string[] = Array.isArray(rev?.obligaciones)
    ? (rev!.obligaciones as string[])
    : [];
  function setObligaciones(arr: string[]) {
    setDatos((prev) => ({ ...(prev ?? {}), obligaciones: arr }));
  }
  const [nuevaObl, setNuevaObl] = useState("");
  function agregarObligacion(texto: string) {
    const t = texto.trim();
    if (!t || obligaciones.includes(t)) return;
    setObligaciones([...obligaciones, t]);
    setNuevaObl("");
  }
  // Sugerencia determinista a partir del tipo de vínculo y el salario (no la "lee" la IA).
  function sugerirObligaciones() {
    const sug = obligacionesEmpleador(
      String(rev?.tipo ?? "indefinido"),
      Number(rev?.salarioMensual ?? 0),
      Boolean(rev?.salarioIntegral),
    );
    setObligaciones(Array.from(new Set([...obligaciones, ...sug])));
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
      `${nuevo.empleado} (${nuevo.id}) · confianza ${Math.round((nuevo.extraccionConfianza ?? 0) * 100)}% · ${editando ? "con correcciones" : "sin cambios"} · ${obligaciones.length} obligaciones del empleador`
    );
    setConfirmado(new Date().toLocaleString("es-CO"));
    setEditando(false);
  }

  function eliminarContrato(c: Contrato) {
    if (typeof window !== "undefined" &&
        !window.confirm(`¿Eliminar el contrato de ${c.empleado}? Se quitará de la nómina analizada.`)) return;
    removeContratoConfirmado(c.id);
    logAudit("Contrato eliminado", `${c.empleado} (${c.id}) · removido de la nómina por el revisor`);
    setExpandido(null);
  }

  function cargarEjemplo() {
    setTexto(EJEMPLO);
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
            {/* Origen del documento: archivo local o bucket propio de la empresa */}
            <DocumentSource
              onText={(t) => {
                setTexto(t);
                setExtraccion(null);
              }}
              onBusyChange={setLeyendo}
            />
            {texto.trim() && (
              <p className="mt-2 text-[11.5px] text-ink-3">
                {texto.length.toLocaleString("es-CO")} caracteres extraídos · listo para analizar
              </p>
            )}
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
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="overline">Obligaciones periódicas del empleador</span>
                    {editando && (
                      <button
                        type="button"
                        onClick={sugerirObligaciones}
                        className="text-[11px] text-red-dark underline hover:text-ink"
                        title="Completar con las obligaciones legales según el tipo de vínculo y el salario"
                      >
                        Sugerir según ley
                      </button>
                    )}
                  </div>
                  {obligaciones.length === 0 && !editando && (
                    <p className="text-[11.5px] text-ink-3">
                      Sin obligaciones a cargo del empleador (o no detectadas). Use “Corregir” para añadirlas.
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {obligaciones.map((o) => (
                      <span
                        key={o}
                        className="inline-flex items-center gap-1 bg-surface-2 px-2 py-0.5 text-[11.5px] text-ink-2"
                        style={{ borderRadius: "var(--radius)" }}
                      >
                        {o}
                        {editando && (
                          <button
                            type="button"
                            onClick={() => setObligaciones(obligaciones.filter((x) => x !== o))}
                            className="text-ink-3 hover:text-red"
                            aria-label={`Quitar ${o}`}
                          >
                            <CloseCircle size={13} />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                  {editando && (
                    <div className="mt-2 flex gap-2">
                      <input
                        value={nuevaObl}
                        onChange={(e) => setNuevaObl(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") agregarObligacion(nuevaObl); }}
                        placeholder="Añadir obligación del empleador…"
                        className="flex-1 border border-border-2 bg-surface px-2 py-1 text-[12px] text-ink focus:border-ink focus:outline-none"
                        style={{ borderRadius: "var(--radius)" }}
                      />
                      <Button variant="secondary" onClick={() => agregarObligacion(nuevaObl)}>
                        <AddCircle size={14} /> Añadir
                      </Button>
                    </div>
                  )}
                </div>
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
            Filtrando «{qRaw}» · limpiar
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
              Ningún vínculo coincide con «{qRaw}».
            </p>
          )}
          {nomina.map((c, i) => (
            <Reveal key={c.id} delay={Math.min(i, 8) * 0.04}>
              <Row
                c={c}
                abierto={expandido === c.id}
                onToggle={() => setExpandido((e) => (e === c.id ? null : c.id))}
                onDelete={c.id.startsWith("C-IA") ? () => eliminarContrato(c) : undefined}
              />
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
    obligaciones: obligacionesEmpleador(tipo, salario, t.includes("integral")),
    confianza: 0.62,
    observaciones:
      "Extracción heurística en navegador (demo estática sin servidor). Con servidor + ANTHROPIC_API_KEY se usa el modelo de IA.",
    _modo: "demo",
  };
}

// Genera un documento de contrato legible a partir de los datos estructurados.
// (Representativo: el texto original del PDF no se persiste en la demo.)
function generarTextoContrato(c: Contrato): string {
  const esCivil = c.tipo === "prestacion_servicios" || c.tipo === "plataforma";
  const rol = esCivil ? "EL CONTRATISTA" : "EL TRABAJADOR";
  const parte = esCivil ? "EL CONTRATANTE" : "EL EMPLEADOR";
  const L: string[] = [];
  L.push(TITULOS[c.tipo] ?? "CONTRATO");
  L.push("");
  L.push(
    `Entre la empresa, en adelante ${parte}, y ${c.empleado}, identificado(a) con documento ${c.documento}, en adelante ${rol}, se celebra el presente contrato, regido por las siguientes cláusulas:`
  );
  L.push("");
  L.push(
    `PRIMERA. ${esCivil ? "Objeto" : "Cargo y funciones"}. ${rol} ${
      esCivil
        ? `prestará sus servicios de ${c.cargo} de forma autónoma e independiente, sin subordinación ni dependencia respecto de ${parte}.`
        : `desempeñará el cargo de ${c.cargo} en el área de ${c.area}, bajo la subordinación y dependencia continuada de ${parte}.`
    }`
  );
  L.push("");
  L.push(
    `SEGUNDA. ${esCivil ? "Autonomía" : "Jornada"}. ${
      esCivil
        ? `${rol} no estará sujeto a horario ni a jornada de trabajo y organizará su tiempo con plena independencia.`
        : `La jornada será de ${c.horasSemana} horas semanales (jornada ${c.jornada}).`
    }`
  );
  L.push("");
  L.push(
    `TERCERA. ${esCivil ? "Honorarios" : "Remuneración"}. ${
      esCivil
        ? `${parte} pagará honorarios de ${cop(c.salarioMensual)} mensuales contra presentación de factura o cuenta de cobro.`
        : `${parte} pagará un salario mensual de ${cop(c.salarioMensual)}${
            c.salarioIntegral ? ", en la modalidad de salario integral (CST art. 132)" : ""
          }${c.auxilioTransporte ? ", más el auxilio de transporte de ley" : ""}.`
    }`
  );
  L.push("");
  if (esCivil) {
    L.push(`CUARTA. No exclusividad. ${rol} podrá prestar sus servicios a terceros, sin relación de exclusividad con ${parte}.`);
    L.push("");
    L.push(`QUINTA. Medios propios. ${rol} ejecutará la labor con sus propios medios, herramientas y equipos, asumiendo los riesgos de su actividad.`);
  } else {
    L.push(`CUARTA. Prestaciones. ${parte} reconocerá las prestaciones sociales de ley: cesantías e intereses, prima de servicios, vacaciones y seguridad social integral.`);
    L.push("");
    L.push(`QUINTA. Obligaciones. ${rol} cumplirá el Reglamento Interno de Trabajo, las instrucciones de ${parte} y las normas de seguridad y salud en el trabajo.`);
  }
  L.push("");
  L.push(
    `SEXTA. Vigencia. ${
      c.fechaFin
        ? `El presente contrato regirá del ${fmtDate(c.fechaInicio)} al ${fmtDate(c.fechaFin)}.`
        : `El presente contrato regirá a partir del ${fmtDate(c.fechaInicio)} por término indefinido.`
    }`
  );
  L.push("");
  L.push("Para constancia se firma por las partes.");
  L.push("");
  L.push("____________________________");
  L.push(`${parte}`);
  L.push("");
  L.push("____________________________");
  L.push(`${rol}`);
  return L.join("\n");
}

// Abre el documento en una ventana lista para imprimir / guardar como PDF.
function imprimirContrato(c: Contrato) {
  const texto = generarTextoContrato(c);
  const w = window.open("", "_blank", "width=820,height=920");
  if (!w) return;
  const safe = texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  w.document.write(
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Contrato — ${c.empleado}</title>` +
      `<style>body{font-family:Georgia,'Times New Roman',serif;max-width:680px;margin:48px auto;padding:0 28px;color:#1a1a1a;font-size:13px;line-height:1.7;white-space:pre-wrap}</style>` +
      `</head><body>${safe}</body></html>`
  );
  w.document.close();
  w.focus();
  w.print();
}

function Row({ c, abierto, onToggle, onDelete }: { c: Contrato; abierto: boolean; onToggle: () => void; onDelete?: () => void }) {
  const [verDoc, setVerDoc] = useState(false);
  const confPct = Math.round((c.extraccionConfianza ?? 0) * 100);
  const confColor = confPct >= 85 ? "var(--success)" : confPct >= 60 ? "var(--warning)" : "var(--red)";
  return (
    <div>
      <button
        onClick={onToggle}
        className="grid w-full grid-cols-12 items-center gap-3 px-5 py-3 text-left text-[13px] transition-colors hover:bg-surface-2"
        style={{ background: abierto ? "var(--surface-2)" : undefined }}
        aria-expanded={abierto}
      >
        <div className="col-span-4 flex items-center gap-2">
          <ArrowDown2
            size={13}
            color="var(--ink-3)"
            style={{ transform: abierto ? "rotate(180deg)" : "none", transition: "transform .15s" }}
            className="shrink-0"
          />
          <div className="min-w-0">
            <div className="font-medium text-ink">{c.empleado}</div>
            <div className="text-[11px] text-ink-3">{c.cargo} · {c.area}</div>
          </div>
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
            style={{ color: confColor }}
            title="Nivel de confianza con que la IA extrajo los datos de este contrato"
          >
            {confPct}%
          </span>
        </div>
      </button>

      {abierto && (
        <div className="border-t border-border bg-surface px-5 py-3.5">
          <div className="overline mb-2">Datos extraídos del contrato</div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12px] sm:grid-cols-3">
            <Campo k="Documento" v={c.documento} />
            <Campo k="Tipo de vínculo" v={tipoLabel[c.tipo] ?? c.tipo} />
            <Campo k="Jornada" v={`${c.horasSemana} h/sem`} />
            <Campo k="Salario" v={cop(c.salarioMensual)} />
            <Campo k="Salario integral" v={c.salarioIntegral ? "Sí" : "No"} />
            <Campo k="Auxilio transporte" v={c.auxilioTransporte ? "Sí" : "No"} />
            <Campo k="Ingreso" v={fmtDate(c.fechaInicio)} />
            <Campo k="Vencimiento" v={c.fechaFin ? fmtDate(c.fechaFin) : "—"} />
            <Campo k="Estado" v={c.estado} />
            {c.ultimasVacacionesTomadas ? (
              <Campo k="Últimas vacaciones" v={fmtDate(c.ultimasVacacionesTomadas)} />
            ) : null}
            {c.diasVacacionesPendientes != null ? (
              <Campo k="Vac. pendientes" v={`${c.diasVacacionesPendientes} días`} />
            ) : null}
            {c.ultimoPagoSeguridadSocial ? (
              <Campo k="Últ. pago seg. social" v={fmtDate(c.ultimoPagoSeguridadSocial)} />
            ) : null}
            <Campo k="Confianza IA" v={`${confPct}%`} />
            <Campo k="Fuente" v={c.fuente === "ia" ? "IA" : "Manual"} />
          </dl>

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <Button variant="secondary" onClick={() => setVerDoc((v) => !v)}>
              {verDoc ? "Ocultar documento" : "Ver documento del contrato"}
            </Button>
            <Button variant="secondary" onClick={() => imprimirContrato(c)}>
              Descargar PDF
            </Button>
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="ml-auto inline-flex items-center gap-1.5 text-[12px] text-ink-3 transition-colors hover:text-red"
                title="Quitar este contrato de la nómina (cargado por error)"
              >
                <Trash size={14} /> Eliminar de la nómina
              </button>
            )}
          </div>
          {verDoc && (
            <div className="mt-2 max-h-80 overflow-y-auto hairline bg-surface-2 px-4 py-3">
              <div className="whitespace-pre-wrap text-[11.5px] leading-relaxed text-ink-2">
                {generarTextoContrato(c)}
              </div>
              <p className="mt-2 text-[10px] leading-snug text-ink-3">
                Documento generado a partir de los datos extraídos (representativo). No reemplaza el contrato firmado original.
              </p>
            </div>
          )}
        </div>
      )}
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
