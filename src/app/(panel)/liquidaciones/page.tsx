"use client";

import { useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { Card, CardHeader, Badge, Button } from "@/components/ui";
import { Reveal } from "@/components/motion";
import { CONTRATOS, HOY } from "@/lib/data/contratos";
import { liquidar, compararLiquidacion, type ModoLiquidacion } from "@/lib/liquidacion";
import { calcularRecargo, CONCEPTOS_RECARGO, type TipoHora } from "@/lib/recargos";
import { useContratosConfirmados, useParametros, logAudit } from "@/lib/store";
import { CausaTerminacion } from "@/lib/types";
import { cop, fmtDate } from "@/lib/utils";
import { Calculator, TickCircle, CloseCircle, Warning2, InfoCircle, Clock } from "iconsax-react";

const CAUSAS: { value: CausaTerminacion; label: string }[] = [
  { value: "sin_justa_causa", label: "Despido sin justa causa" },
  { value: "justa_causa", label: "Despido con justa causa" },
];

export default function LiquidacionesPage() {
  const [id, setId] = useState(CONTRATOS[0].id);
  const [causa, setCausa] = useState<CausaTerminacion>("sin_justa_causa");
  const [modo, setModo] = useState<ModoLiquidacion>("periodo");
  const [hasta, setHasta] = useState(HOY);
  const [pagado, setPagado] = useState<string>("");
  // Guardamos la "firma" del caso enviado; el mensaje se oculta solo al cambiar el caso.
  const [enviadoKey, setEnviadoKey] = useState<string | null>(null);

  const confirmados = useContratosConfirmados();
  const params = useParametros();
  const todos = useMemo(() => [...confirmados, ...CONTRATOS], [confirmados]);
  const contrato = todos.find((c) => c.id === id) ?? todos[0];

  // Horas extra / recargos del periodo → factor salarial variable de la liquidación.
  const idRef = useRef(1);
  const [nuevoTipo, setNuevoTipo] = useState<TipoHora>("extra_diurna");
  const [nuevasHoras, setNuevasHoras] = useState("");
  const [novedades, setNovedades] = useState<{ id: number; tipo: TipoHora; horas: string }[]>([]);
  const factorVariable = useMemo(
    () =>
      novedades.reduce((s, n) => {
        const h = Number(n.horas.replace(/[^\d.]/g, "")) || 0;
        return s + calcularRecargo(contrato.salarioMensual, n.tipo, h, hasta, contrato.horasSemana).total;
      }, 0),
    [novedades, contrato, hasta]
  );
  function agregarNovedad() {
    const h = Number(nuevasHoras.replace(/[^\d.]/g, "")) || 0;
    if (h <= 0) return;
    setNovedades((prev) => [...prev, { id: idRef.current++, tipo: nuevoTipo, horas: nuevasHoras }]);
    setNuevasHoras("");
  }

  const liq = useMemo(
    () => liquidar(contrato, hasta, causa, params, modo, factorVariable),
    [contrato, hasta, causa, modo, params, factorVariable]
  );
  const casoKey = `${contrato.id}|${causa}|${modo}|${hasta}|${factorVariable}`;

  const comparacion =
    pagado.trim() !== "" ? compararLiquidacion(liq.total, Number(pagado.replace(/\D/g, ""))) : null;

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
              </Field>
              <Field label="Fecha de retiro">
                <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="input" />
              </Field>

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
                Promedio mensual de horas extra/recargos. Es salario (CST art. 127) y entra a la base de las prestaciones.
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
              <div className="flex gap-2">
                <input
                  inputMode="decimal"
                  placeholder="Horas/mes"
                  value={nuevasHoras}
                  onChange={(e) => setNuevasHoras(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") agregarNovedad(); }}
                  className="input font-num"
                />
                <Button variant="secondary" onClick={agregarNovedad}>Agregar</Button>
              </div>

              {novedades.length > 0 && (
                <div className="hairline divide-y divide-border">
                  {novedades.map((n) => {
                    const h = Number(n.horas.replace(/[^\d.]/g, "")) || 0;
                    const r = calcularRecargo(contrato.salarioMensual, n.tipo, h, hasta, contrato.horasSemana);
                    return (
                      <div key={n.id} className="flex items-center gap-2 px-3 py-1.5 text-[11.5px]">
                        <span className="min-w-0 flex-1 truncate text-ink-2">{r.label} · {h} h</span>
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
                  <span className="font-medium text-ink">Factor mensual → base</span>
                  <span className="font-num text-ink">{cop(factorVariable)}</span>
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
          <Reveal key={`${id}${causa}${hasta}${modo}${factorVariable}`}>
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
