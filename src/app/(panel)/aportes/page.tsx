"use client";

import { useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { Card, CardHeader, Badge, Button } from "@/components/ui";
import { Reveal } from "@/components/motion";
import { CONTRATOS } from "@/lib/data/contratos";
import { useContratosConfirmados, useParametros, logAudit } from "@/lib/store";
import { calcularAportes, compararAporte, type ClaseRiesgo, type EstadoAporte } from "@/lib/aportes";
import { ACCEPTED_FILE_TYPES, extractTextFromFile, FileExtractError } from "@/lib/extract-file";
import { cop } from "@/lib/utils";
import { ShieldTick, DocumentUpload, Document, Flash, Cpu, InfoCircle, Calculator, TickCircle, Warning2 } from "iconsax-react";

const LABORALES = ["indefinido", "fijo", "obra_labor", "aprendizaje"];

const OPERADORES = ["Aportes en Línea (SUAPORTE)", "SOI", "MiPlanilla (Compensar)", "Simple", "Asopagos", "Enlace Operativo", "ARUS"];

type Modo = "motor" | "planilla" | "api";

const estadoTone: Record<EstadoAporte, "success" | "red" | "warning"> = {
  ok: "success",
  no_pagado: "red",
  subaporte: "red",
  sobreaporte: "warning",
};
const estadoLabel: Record<EstadoAporte, string> = {
  ok: "Correcto",
  no_pagado: "No pagado",
  subaporte: "Subaporte",
  sobreaporte: "Sobreaporte",
};

export default function AportesPage() {
  const confirmados = useContratosConfirmados();
  const params = useParametros();
  const [clase, setClase] = useState<ClaseRiesgo>("I");
  const [modo, setModo] = useState<Modo>("motor");

  const trabajadores = useMemo(
    () => [...confirmados, ...CONTRATOS].filter((c) => c.estado === "activo" && LABORALES.includes(c.tipo)),
    [confirmados]
  );
  const aportes = useMemo(
    () => trabajadores.map((c) => calcularAportes(c, params, clase)),
    [trabajadores, params, clase]
  );

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        overline="Compliance de seguridad social"
        title="Revisión de aportes y provisiones"
        subtitle="Centinela calcula lo que se debió pagar y provisionar por cada trabajador (salud, pensión, ARL, cesantías, intereses, prima y vacaciones) y lo compara con lo realmente pagado. Tú eliges la fuente del dato."
      />

      <div className="mb-4 hairline flex items-start gap-3 bg-[var(--info-tint)] px-4 py-3">
        <InfoCircle size={18} color="var(--info)" className="mt-0.5 shrink-0" />
        <p className="text-[12.5px] leading-snug text-ink-2">
          El pago de aportes vive en la <span className="font-medium text-ink">PILA</span>, tras las
          credenciales del empleador. Por eso Centinela calcula <span className="font-medium">lo debido</span> y
          lo contrasta con la fuente que elijas. Prima y vacaciones no son pagos a terceros: son{" "}
          <span className="font-medium">provisiones</span> que se pagan al trabajador.
        </p>
      </div>

      {/* Selector de modo + clase de riesgo */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 hairline bg-surface-2 p-1">
          {([
            ["motor", "Solo cálculo", Calculator],
            ["planilla", "Cargar planilla", DocumentUpload],
            ["api", "Conectar API", Cpu],
          ] as const).map(([k, label, Icon]) => (
            <button
              key={k}
              onClick={() => setModo(k)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] transition-colors"
              style={{
                background: modo === k ? "var(--surface)" : "transparent",
                color: modo === k ? "var(--ink)" : "var(--ink-3)",
                borderRadius: "var(--radius)",
                fontWeight: modo === k ? 600 : 400,
              }}
            >
              <Icon size={15} color={modo === k ? "var(--red)" : "currentColor"} /> {label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-[12px] text-ink-2">
          Clase de riesgo (ARL)
          <select value={clase} onChange={(e) => setClase(e.target.value as ClaseRiesgo)} className="ap-input w-auto">
            {(["I", "II", "III", "IV", "V"] as ClaseRiesgo[]).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>

      {modo === "motor" && <ModoMotor aportes={aportes} />}
      {modo === "planilla" && <ModoPlanilla aportes={aportes} />}
      {modo === "api" && <ModoApi />}

      <style jsx global>{`
        .ap-input {
          width: 100%;
          border: 1px solid var(--border-2);
          background: var(--surface);
          padding: 6px 9px;
          font-size: 12.5px;
          color: var(--ink);
          border-radius: var(--radius);
        }
        .ap-input:focus { outline: none; border-color: var(--ink); }
      `}</style>
    </div>
  );
}

// ── Modo 1: solo cálculo ─────────────────────────────────────────────────────
function ModoMotor({ aportes }: { aportes: ReturnType<typeof calcularAportes>[] }) {
  const [sel, setSel] = useState(0);
  const totSS = aportes.reduce((s, a) => s + a.totalSeguridadSocial, 0);
  const totProv = aportes.reduce((s, a) => s + a.totalProvisiones, 0);
  const detalle = aportes[sel];

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <Card className="overflow-hidden">
          <div className="grid grid-cols-12 gap-2 border-b border-border bg-surface-2 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
            <div className="col-span-5">Trabajador</div>
            <div className="col-span-2 text-right">IBC</div>
            <div className="col-span-3 text-right">Seg. social/mes</div>
            <div className="col-span-2 text-right">Provisión/mes</div>
          </div>
          <div className="divide-y divide-border">
            {aportes.map((a, i) => (
              <button
                key={a.contratoId}
                onClick={() => setSel(i)}
                className="grid w-full grid-cols-12 items-center gap-2 px-5 py-2.5 text-left text-[12.5px] transition-colors hover:bg-surface-2"
                style={{ background: i === sel ? "var(--surface-2)" : undefined }}
              >
                <div className="col-span-5 font-medium text-ink">{a.empleado}</div>
                <div className="col-span-2 text-right font-num text-ink-2">{cop(a.ibc)}</div>
                <div className="col-span-3 text-right font-num text-ink">{cop(a.totalSeguridadSocial)}</div>
                <div className="col-span-2 text-right font-num text-ink-2">{cop(a.totalProvisiones)}</div>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-12 gap-2 border-t-2 border-border-strong bg-surface-2 px-5 py-3 text-[12.5px]">
            <div className="col-span-7 font-head text-ink">Total nómina laboral / mes</div>
            <div className="col-span-3 text-right font-num text-ink">{cop(totSS)}</div>
            <div className="col-span-2 text-right font-num text-ink-2">{cop(totProv)}</div>
          </div>
        </Card>
      </div>

      <div className="lg:col-span-2">
        {detalle && (
          <Reveal key={detalle.contratoId}>
            <Card>
              <CardHeader overline="Detalle" title={detalle.empleado} right={<ShieldTick size={20} color="var(--red)" variant="Bulk" />} />
              <div className="divide-y divide-border">
                {detalle.lineas.map((l) => (
                  <div key={l.concepto} className="flex items-baseline justify-between gap-3 px-5 py-2.5">
                    <div className="min-w-0">
                      <div className="text-[12.5px] text-ink">{l.concepto}</div>
                      <div className="font-num text-[10.5px] text-ink-3">{l.tasa} · {l.pagador}</div>
                    </div>
                    <span className="font-num text-[13px] text-ink">{cop(l.valor)}</span>
                  </div>
                ))}
              </div>
            </Card>
          </Reveal>
        )}
      </div>
    </div>
  );
}

// ── Modo 2: cargar planilla y comparar ───────────────────────────────────────
function ModoPlanilla({ aportes }: { aportes: ReturnType<typeof calcularAportes>[] }) {
  const [archivo, setArchivo] = useState<string | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pagados, setPagados] = useState<Record<string, string>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  async function cargar(file: File) {
    setErr(null);
    setLeyendo(true);
    try {
      await extractTextFromFile(file); // valida que sea legible; el texto queda como soporte
      setArchivo(file.name);
      logAudit("Planilla PILA cargada (soporte)", file.name);
    } catch (e) {
      setErr(e instanceof FileExtractError ? e.message : "No se pudo procesar el archivo.");
    } finally {
      setLeyendo(false);
    }
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader overline="Soporte" title="Cargar planilla PILA pagada (PDF / DOCX / TXT)" right={<DocumentUpload size={20} color="var(--red)" />} />
        <div className="px-5 py-4">
          <input ref={inputRef} type="file" accept={ACCEPTED_FILE_TYPES} onChange={(e) => { const f = e.target.files?.[0]; if (f) cargar(f); e.target.value = ""; }} className="hidden" />
          <div
            onClick={() => inputRef.current?.click()}
            className="flex cursor-pointer items-center gap-2 border border-dashed border-border-2 px-4 py-3 text-[12px] transition-colors hover:border-ink"
            style={{ borderRadius: "var(--radius)" }}
          >
            {leyendo ? (
              <><Flash size={16} color="var(--red)" variant="Bold" className="animate-pulse" /> <span className="text-ink-2">Leyendo…</span></>
            ) : archivo ? (
              <><Document size={16} color="var(--success)" variant="Bold" /> <span className="text-ink"><span className="font-medium">{archivo}</span> cargado como soporte</span></>
            ) : (
              <><DocumentUpload size={16} color="var(--red)" /> <span className="text-ink-2">Arrastre o haga clic para subir la planilla</span></>
            )}
          </div>
          {err && <p className="mt-2 text-[11.5px] text-red-dark">{err}</p>}
          <p className="mt-2 text-[11px] text-ink-3">
            Ingrese al frente lo efectivamente pagado de seguridad social por cada trabajador; Centinela lo
            compara con lo debido y marca no pago, subaporte o sobreaporte.
          </p>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-12 gap-2 border-b border-border bg-surface-2 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
          <div className="col-span-4">Trabajador</div>
          <div className="col-span-3 text-right">Debido (seg. social)</div>
          <div className="col-span-3 text-right">Pagado</div>
          <div className="col-span-2 text-right">Estado</div>
        </div>
        <div className="divide-y divide-border">
          {aportes.map((a) => {
            const pagado = Number((pagados[a.contratoId] ?? "").replace(/\D/g, ""));
            const cmp = compararAporte(a.totalSeguridadSocial, pagado);
            return (
              <div key={a.contratoId} className="grid grid-cols-12 items-center gap-2 px-5 py-2.5 text-[12.5px]">
                <div className="col-span-4 font-medium text-ink">{a.empleado}</div>
                <div className="col-span-3 text-right font-num text-ink-2">{cop(a.totalSeguridadSocial)}</div>
                <div className="col-span-3 text-right">
                  <input
                    inputMode="numeric"
                    placeholder="0"
                    value={pagados[a.contratoId] ?? ""}
                    onChange={(e) => setPagados((p) => ({ ...p, [a.contratoId]: e.target.value }))}
                    className="ap-input text-right font-num"
                  />
                </div>
                <div className="col-span-2 flex justify-end">
                  {(pagados[a.contratoId] ?? "") === "" ? (
                    <span className="text-[11px] text-ink-3">—</span>
                  ) : (
                    <Badge tone={estadoTone[cmp.estado]}>{estadoLabel[cmp.estado]}</Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ── Modo 3: conectar API del operador ────────────────────────────────────────
function ModoApi() {
  const [operador, setOperador] = useState(OPERADORES[0]);
  const [endpoint, setEndpoint] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState<Record<string, unknown> | null>(null);

  async function consultar() {
    setCargando(true);
    setResultado(null);
    try {
      const res = await fetch("/api/aportes-consulta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operador, endpoint }),
      });
      setResultado(await res.json());
    } catch {
      setResultado({ error: "No se pudo consultar." });
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <Card>
        <CardHeader overline="Integración" title="Conectar con tu operador PILA" right={<Cpu size={20} color="var(--red)" />} />
        <div className="space-y-3 px-5 py-4">
          <p className="text-[12px] text-ink-3">
            Si tu empresa tiene convenio/API con su operador, conéctalo para consultar la planilla pagada
            automáticamente (con tu autorización). El conector queda listo; el acceso depende de tu operador.
          </p>
          <label className="block">
            <span className="overline mb-1 block">Operador</span>
            <select value={operador} onChange={(e) => setOperador(e.target.value)} className="ap-input">
              {OPERADORES.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="overline mb-1 block">Endpoint del operador (URL)</span>
            <input value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder="https://api.operador.com/..." className="ap-input" />
          </label>
          <label className="block">
            <span className="overline mb-1 block">API key / token (no se almacena)</span>
            <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="••••••••" className="ap-input" />
          </label>
          <Button variant="primary" onClick={consultar} disabled={cargando}>
            <Flash size={15} variant="Bold" /> {cargando ? "Consultando…" : "Consultar planilla"}
          </Button>
        </div>
      </Card>

      <div className="space-y-3">
        {resultado && (
          <div className="hairline flex items-start gap-2 bg-[var(--warning-tint)] px-4 py-3">
            <Warning2 size={16} color="var(--warning)" variant="Bold" className="mt-0.5 shrink-0" />
            <p className="text-[12px] leading-snug text-ink-2">{String(resultado.mensaje ?? resultado.error ?? "")}</p>
          </div>
        )}
        <Card>
          <CardHeader overline="Operadores con API" title="A cuáles te puedes conectar" />
          <div className="px-5 py-4">
            <ul className="space-y-1.5 text-[12.5px] text-ink-2">
              {OPERADORES.map((o) => (
                <li key={o} className="flex items-center gap-2">
                  <TickCircle size={14} color="var(--success)" /> {o}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-ink-3">
              Las APIs de los operadores son para que el aportante gestione/consulte su propia planilla. La
              conexión por credenciales con bóveda es la evolución a 90 días (ver deck).
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
