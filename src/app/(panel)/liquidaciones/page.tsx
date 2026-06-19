"use client";

import { useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { Card, CardHeader, Badge, Button } from "@/components/ui";
import { Reveal } from "@/components/motion";
import { liquidar, compararLiquidacion, type ModoLiquidacion } from "@/lib/liquidacion";
import { calcularRecargo, CONCEPTOS_RECARGO, type TipoHora } from "@/lib/recargos";
import { useContratosConfirmados, useParametros, useEmpresaActiva, logAudit } from "@/lib/store";
import { CausaTerminacion, type Contrato } from "@/lib/types";
import { cop, fmtDate } from "@/lib/utils";
import { Calculator, TickCircle, CloseCircle, Warning2, InfoCircle, Clock } from "iconsax-react";

// Marcador usado sólo cuando aún no hay contratos, para que los hooks de cálculo
// no rompan antes de renderizar el empty state.
const CONTRATO_PLACEHOLDER: Contrato = {
  id: "",
  empleado: "—",
  documento: "",
  cargo: "",
  area: "",
  tipo: "indefinido",
  jornada: "completa",
  horasSemana: 42,
  salarioMensual: 0,
  auxilioTransporte: false,
  salarioIntegral: false,
  fechaInicio: "2025-01-01",
  estado: "activo",
};

const CAUSAS: { value: CausaTerminacion; label: string }[] = [
  { value: "sin_justa_causa", label: "Despido sin justa causa" },
  { value: "justa_causa", label: "Despido con justa causa" },
];

export default function LiquidacionesPage() {
  const empresa = useEmpresaActiva();
  const CONTRATOS = useMemo(() => empresa?.contratos ?? [], [empresa]);
  const HOY = empresa?.hoy ?? "2026-06-18";

  const [id, setId] = useState(CONTRATOS[0]?.id ?? "");
  const [causa, setCausa] = useState<CausaTerminacion>("sin_justa_causa");
  const [modo, setModo] = useState<ModoLiquidacion>("periodo");
  const [hasta, setHasta] = useState(HOY);
  const [desdeDeuda, setDesdeDeuda] = useState("");
  const [pagado, setPagado] = useState<string>("");
  // Guardamos la "firma" del caso enviado; el mensaje se oculta solo al cambiar el caso.
  const [enviadoKey, setEnviadoKey] = useState<string | null>(null);

  const confirmados = useContratosConfirmados();
  const params = useParametros();
  const todos = useMemo(() => [...confirmados, ...CONTRATOS], [confirmados, CONTRATOS]);
  // Si todavía no hay contratos (empresa nueva o sin extracciones confirmadas),
  // usamos un marcador para que los cálculos no rompan; abajo se muestra el empty state.
  const sinContratos = todos.length === 0;
  const contrato = todos.find((c) => c.id === id) ?? todos[0] ?? CONTRATO_PLACEHOLDER;

  // Pasivo acumulado: desde cuándo se adeuda (por defecto, el inicio del contrato).
  const desdeAcum = maxFechaStr(contrato.fechaInicio, desdeDeuda || contrato.fechaInicio);
  const mesesAdeudados = modo === "acumulado" ? mesesEntreStr(desdeAcum, hasta) : 1;

  // Horas extra / recargos → factor salarial variable de la liquidación.
  // En "acumulado" se registra el detalle MES A MES (las horas pueden variar entre
  // meses); el promedio sobre los meses adeudados entra a la base prestacional (CST 127).
  const idRef = useRef(1);
  const [nuevoTipo, setNuevoTipo] = useState<TipoHora>("extra_diurna");
  const [nuevasHoras, setNuevasHoras] = useState("");
  const [nuevoMes, setNuevoMes] = useState("");
  const [novedades, setNovedades] = useState<{ id: number; tipo: TipoHora; horas: string; mes: string }[]>([]);

  // Fecha efectiva de un recargo: en "acumulado" usa el mes en que ocurrió, para que
  // se aplique la TARIFA DE RECARGO de ese año (cambia por la Ley 2466/2025); si no,
  // la fecha de retiro. Así un caso de varios años con tarifas distintas queda bien.
  const fechaRecargo = (n: { mes: string }) => (n.mes ? `${n.mes}-15` : hasta);

  const sumaHorasExtra = useMemo(
    () =>
      novedades.reduce((s, n) => {
        const h = Number(n.horas.replace(/[^\d.]/g, "")) || 0;
        const fecha = n.mes ? `${n.mes}-15` : hasta;
        return s + calcularRecargo(contrato.salarioMensual, n.tipo, h, fecha, contrato.horasSemana).total;
      }, 0),
    [novedades, contrato, hasta]
  );
  // Total de horas extra registradas (acumulado) y promedio mensual que entra a la base.
  const totalHorasExtra = modo === "acumulado" ? Math.round(sumaHorasExtra) : 0;
  const factorVariable =
    modo === "acumulado"
      ? Math.round(sumaHorasExtra / Math.max(1, mesesAdeudados))
      : Math.round(sumaHorasExtra);

  function agregarNovedad() {
    const h = Number(nuevasHoras.replace(/[^\d.]/g, "")) || 0;
    if (h <= 0) return;
    const mes = modo === "acumulado" ? nuevoMes || hasta.slice(0, 7) : "";
    setNovedades((prev) => [...prev, { id: idRef.current++, tipo: nuevoTipo, horas: nuevasHoras, mes }]);
    setNuevasHoras("");
    setNuevoMes("");
  }

  const liq = useMemo(
    () => liquidar(contrato, hasta, causa, params, modo, factorVariable, modo === "acumulado" ? desdeAcum : undefined),
    [contrato, hasta, causa, modo, params, factorVariable, desdeAcum]
  );
  const casoKey = `${contrato.id}|${causa}|${modo}|${hasta}|${desdeAcum}|${factorVariable}`;

  const comparacion =
    pagado.trim() !== "" ? compararLiquidacion(liq.total, Number(pagado.replace(/\D/g, ""))) : null;

  if (sinContratos) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader
          overline="Verificación de prestaciones sociales"
          title="Liquidador auditable"
          subtitle="Cálculo 100% determinista de cesantías, intereses, prima, vacaciones e indemnización."
        />
        <Card>
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <Calculator size={40} color="var(--ink-3)" variant="Bulk" />
            <h3 className="font-head text-[16px] text-ink">No hay contratos para liquidar</h3>
            <p className="max-w-md text-[13px] text-ink-2">
              Agrega contratos en la sección de Contratos —manualmente o mediante extracción
              con IA— y luego vuelve aquí para liquidar prestaciones.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        overline="Verificación de prestaciones sociales"
        title="Liquidador auditable"
        subtitle="Cálculo 100% determinista —sin IA en la aritmética— de cesantías, intereses, prima, vacaciones e indemnización (CST + Ley 2101/2021). Cada línea muestra su fórmula y su norma para que el abogado la verifique."
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* Controls */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader overline="Parámetros" title="Caso a liquidar" />
            <div className="space-y-4 px-5 py-4">
              <Field label="Empleado / contrato">
                <select
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  className="input"
                >
                  {todos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.empleado} — {c.id}
                      {c.id.startsWith("C-IA") ? " · validado IA" : ""}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Causa de terminación">
                <select
                  value={causa}
                  onChange={(e) => setCausa(e.target.value as CausaTerminacion)}
                  className="input"
                >
                  {CAUSAS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Modo de cálculo">
                <select
                  value={modo}
                  onChange={(e) => setModo(e.target.value as ModoLiquidacion)}
                  className="input"
                >
                  <option value="periodo">Liquidación del periodo (definitiva)</option>
                  <option value="acumulado">Pasivo acumulado (mora total)</option>
                </select>
                <p className="mt-1.5 text-[11px] leading-snug text-ink-3">
                  {modo === "periodo"
                    ? "Liquidación definitiva: prestaciones del periodo en curso, asumiendo que los periodos anteriores ya se pagaron."
                    : "Pasivo acumulado: estima TODO lo que se le adeuda al trabajador desde la fecha indicada abajo (útil para medir la contingencia si nunca se pagó)."}
                </p>
              </Field>
              <Field label="Fecha de retiro">
                <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="input" />
              </Field>

              {modo === "acumulado" && (
                <div>
                  <Field label="Se le debe desde">
                    <input
                      type="date"
                      value={desdeDeuda || contrato.fechaInicio}
                      min={contrato.fechaInicio}
                      max={hasta}
                      onChange={(e) => setDesdeDeuda(e.target.value)}
                      className="input"
                    />
                  </Field>
                  <p className="mt-1 text-[11px] text-ink-3">
                    Por defecto, desde el inicio del contrato.{" "}
                    <span className="font-medium text-ink-2">{mesesAdeudados} mes(es)</span> adeudado(s).
                    {desdeDeuda && desdeDeuda !== contrato.fechaInicio && (
                      <button onClick={() => setDesdeDeuda("")} className="ml-1 text-red-dark underline hover:text-ink">
                        usar inicio del contrato
                      </button>
                    )}
                  </p>
                </div>
              )}

              <div className="hairline bg-surface-2 px-3 py-3 text-[12px] text-ink-2">
                <Row k="Tipo de contrato" v={tipoLabel(contrato.tipo)} />
                <Row k="Salario mensual" v={cop(contrato.salarioMensual)} />
                <Row k="Auxilio transporte" v={contrato.auxilioTransporte ? "Sí" : "No"} />
                <Row k="Salario integral" v={contrato.salarioIntegral ? "Sí" : "No"} />
                <Row k="Ingreso" v={fmtDate(contrato.fechaInicio)} />
                <Row k="Días laborados (360)" v={String(liq.diasLaborados)} />
              </div>

              <div className="border-t border-border pt-3">
                <Field label="Valor liquidado por la empresa (opcional)">
                  <input
                    inputMode="numeric"
                    placeholder="Ej: 14.000.000"
                    value={pagado}
                    onChange={(e) => setPagado(e.target.value)}
                    className="input font-num"
                  />
                </Field>
                <p className="mt-1.5 text-[11px] text-ink-3">
                  Compara el pago real contra el cálculo de referencia para detectar sub o sobre-liquidaciones.
                </p>
              </div>
            </div>
          </Card>

          <Card className="mt-3">
            <CardHeader
              overline="Factor salarial variable"
              title="Horas extra y recargos"
              right={<Clock size={18} color="var(--red)" />}
            />
            <div className="space-y-2.5 px-5 py-4">
              <p className="text-[11px] text-ink-3">
                {modo === "acumulado"
                  ? "Registra las horas extra de cada mes (pueden variar). El promedio sobre los meses adeudados entra a la base prestacional (CST art. 127)."
                  : "Promedio mensual de horas extra/recargos. Es salario (CST art. 127) y entra a la base de las prestaciones."}
              </p>
              <select
                value={nuevoTipo}
                onChange={(e) => setNuevoTipo(e.target.value as TipoHora)}
                className="input text-[12px]"
              >
                {CONCEPTOS_RECARGO.map((x) => (
                  <option key={x.key} value={x.key}>{x.label}</option>
                ))}
              </select>
              {modo === "acumulado" && (
                <input
                  type="month"
                  value={nuevoMes || hasta.slice(0, 7)}
                  min={desdeAcum.slice(0, 7)}
                  max={hasta.slice(0, 7)}
                  onChange={(e) => setNuevoMes(e.target.value)}
                  className="input"
                  aria-label="Mes de las horas extra"
                />
              )}
              <div className="flex gap-2">
                <input
                  inputMode="decimal"
                  placeholder={modo === "acumulado" ? "Horas extra de ese mes" : "Horas hechas en el mes"}
                  value={nuevasHoras}
                  onChange={(e) => setNuevasHoras(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") agregarNovedad(); }}
                  className="input font-num"
                />
                <Button variant="secondary" onClick={agregarNovedad}>Agregar</Button>
              </div>
              {modo === "acumulado" && (
                <p className="text-[10.5px] text-ink-3">
                  Agrega un registro por cada mes con horas extra; los meses sin registro cuentan como 0 en el promedio ({mesesAdeudados} meses adeudados).
                </p>
              )}

              {novedades.length > 0 && (
                <div className="hairline divide-y divide-border">
                  {[...novedades]
                    .sort((a, b) => (modo === "acumulado" ? a.mes.localeCompare(b.mes) : 0))
                    .map((n) => {
                      const h = Number(n.horas.replace(/[^\d.]/g, "")) || 0;
                      const r = calcularRecargo(contrato.salarioMensual, n.tipo, h, fechaRecargo(n), contrato.horasSemana);
                      return (
                        <div key={n.id} className="flex items-center gap-2 px-3 py-1.5 text-[11.5px]">
                          <span className="min-w-0 flex-1 truncate text-ink-2">
                            {modo === "acumulado" && n.mes ? `${mesLabel(n.mes)} · ` : ""}
                            {r.label} · {h} h
                          </span>
                          <span className="font-num text-ink">{cop(r.total)}</span>
                          <button
                            onClick={() => setNovedades((prev) => prev.filter((x) => x.id !== n.id))}
                            className="text-ink-3 hover:text-red"
                            aria-label="Quitar"
                          >
                            <CloseCircle size={14} />
                          </button>
                        </div>
                      );
                    })}
                </div>
              )}

              {factorVariable > 0 && (
                <div className="flex items-center justify-between border-t border-border pt-2 text-[12.5px]">
                  <span className="font-medium text-ink">
                    {modo === "acumulado" ? "Promedio mensual → base" : "Factor mensual → base"}
                  </span>
                  <span className="font-num text-ink">{cop(factorVariable)}</span>
                </div>
              )}
              {modo === "acumulado" && totalHorasExtra > 0 && (
                <div className="flex items-center justify-between text-[11.5px] text-ink-2">
                  <span>Total horas extra del periodo</span>
                  <span className="font-num">{cop(totalHorasExtra)}</span>
                </div>
              )}
              {contrato.salarioIntegral && novedades.length > 0 && (
                <p className="text-[11px] text-warning">
                  Salario integral: ya incluye los recargos, no se suma a la base.
                </p>
              )}
            </div>
          </Card>

          <div className="mt-3 hairline flex items-start gap-2 bg-[var(--info-tint)] px-4 py-3">
            <InfoCircle size={16} color="var(--info)" className="mt-0.5 shrink-0" />
            <p className="text-[12px] leading-snug text-ink-2">
              Parámetros {params.anio}: SMMLV {cop(params.smmlv)} · auxilio {cop(params.auxilioTransporte)} (Decretos 1469/1470 de 2025).
            </p>
          </div>
        </div>

        {/* Result */}
        <div className="lg:col-span-2">
          <Reveal key={`${id}${causa}${hasta}${modo}${desdeAcum}${factorVariable}`}>
            <Card>
              <CardHeader
                overline="Resultado"
                title={`Liquidación — ${contrato.empleado}`}
                subtitle={`${fmtDate(liq.desde)} → ${fmtDate(liq.hasta)} · ${CAUSAS.find((c) => c.value === causa)?.label}`}
                right={<Calculator size={22} color="var(--red)" variant="Bulk" />}
              />

              <div className="divide-y divide-border">
                {liq.lineas.map((l) => (
                  <div key={l.concepto} className="px-5 py-3.5">
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="text-[14px] font-medium text-ink">{l.concepto}</span>
                      <span className="font-num text-[15px] text-ink">{cop(l.valor)}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-ink-2">
                      <span className="font-num bg-surface-2 px-1.5 py-0.5">{l.formula}</span>
                      <span className="text-ink-3">{l.base}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between border-t-2 border-border-strong bg-surface-2 px-5 py-4">
                <span className="font-head text-[15px] text-ink">Total liquidación</span>
                <span className="font-num text-[24px] text-ink">{cop(liq.total)}</span>
              </div>

              {liq.notas.length > 0 && (
                <div className="space-y-1.5 px-5 py-3">
                  {liq.notas.map((n, i) => (
                    <p key={i} className="flex items-start gap-2 text-[12px] text-ink-2">
                      <InfoCircle size={14} className="mt-0.5 shrink-0 text-ink-3" /> {n}
                    </p>
                  ))}
                </div>
              )}
            </Card>
          </Reveal>

          {/* Comparison verdict */}
          {comparacion && (
            <Reveal key={pagado}>
              <div className="mt-3">
                <VerdictCard estado={comparacion.estado} diferencia={comparacion.diferencia} pct={comparacion.pct} />
              </div>
            </Reveal>
          )}

          <div className="mt-3 flex flex-col items-end gap-1.5">
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  logAudit(
                    "Liquidación exportada",
                    `${contrato.empleado} (${contrato.id}) · total ${cop(liq.total)}`
                  );
                  window.print();
                }}
              >
                Exportar PDF
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  logAudit(
                    "Liquidación enviada a revisión",
                    `${contrato.empleado} (${contrato.id}) · total ${cop(liq.total)} · ${CAUSAS.find((x) => x.value === causa)?.label}`
                  );
                  setEnviadoKey(casoKey);
                }}
              >
                Enviar a revisión del abogado
              </Button>
            </div>
            {enviadoKey === casoKey && (
              <p className="text-[12px]" style={{ color: "var(--success)" }}>
                ✓ Enviada a revisión del abogado y registrada en la bitácora.
              </p>
            )}
          </div>
        </div>
      </div>

      <style jsx global>{`
        .input {
          width: 100%;
          border: 1px solid var(--border-2);
          background: var(--surface);
          padding: 8px 10px;
          font-size: 13px;
          color: var(--ink);
          border-radius: var(--radius);
        }
        .input:focus {
          outline: none;
          border-color: var(--ink);
        }
      `}</style>
    </div>
  );
}

function VerdictCard({ estado, diferencia, pct }: { estado: string; diferencia: number; pct: number }) {
  const map = {
    correcta: { tone: "success" as const, icon: TickCircle, color: "var(--success)", title: "Liquidación correcta", msg: "El valor pagado coincide con el cálculo de referencia (diferencia < 1%)." },
    subliquidada: { tone: "red" as const, icon: CloseCircle, color: "var(--red)", title: "Subliquidación detectada", msg: "El pago es inferior al cálculo legal. Riesgo de reclamación y sanción por pago incompleto." },
    sobreliquidada: { tone: "warning" as const, icon: Warning2, color: "var(--warning)", title: "Sobreliquidación detectada", msg: "El pago supera el cálculo de referencia. Verifique conceptos adicionales o error de cálculo." },
  }[estado as "correcta" | "subliquidada" | "sobreliquidada"];
  const Icon = map.icon;
  return (
    <Card className="overflow-hidden">
      <div className="flex items-start gap-3 px-5 py-4" style={{ background: estado === "correcta" ? "var(--success-tint)" : estado === "subliquidada" ? "var(--red-tint)" : "var(--warning-tint)" }}>
        <Icon size={26} color={map.color} variant="Bold" className="mt-0.5 shrink-0" />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-head text-[15px]" style={{ color: map.color }}>{map.title}</h3>
            <Badge tone={map.tone}>{pct >= 0 ? "+" : ""}{pct.toFixed(1)}%</Badge>
          </div>
          <p className="mt-1 text-[13px] text-ink-2">{map.msg}</p>
          <p className="font-num mt-2 text-[14px] text-ink">
            Diferencia: {cop(Math.abs(diferencia))} {diferencia < 0 ? "a favor del trabajador" : "a favor de la empresa"}
          </p>
        </div>
      </div>
    </Card>
  );
}

// Mayor de dos fechas yyyy-mm-dd (sin parsear a Date).
function maxFechaStr(a: string, b: string): string {
  return a > b ? a : b;
}
// Meses completos entre dos fechas yyyy-mm-dd (mínimo 1).
function mesesEntreStr(desde: string, hasta: string): number {
  const [ay, am] = desde.split("-").map(Number);
  const [by, bm] = hasta.split("-").map(Number);
  return Math.max(1, (by - ay) * 12 + (bm - am));
}

// "2026-06" → "jun 2026"
const MESES_ABBR = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function mesLabel(m: string): string {
  const [y, mm] = m.split("-");
  return `${MESES_ABBR[Number(mm) - 1] ?? mm} ${y}`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="overline mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-ink-3">{k}</span>
      <span className="font-num text-ink">{v}</span>
    </div>
  );
}
function tipoLabel(t: string) {
  return {
    indefinido: "Término indefinido",
    fijo: "Término fijo",
    obra_labor: "Obra o labor",
    prestacion_servicios: "Prestación de servicios",
    aprendizaje: "Aprendizaje",
    plataforma: "Plataforma digital",
  }[t] ?? t;
}
