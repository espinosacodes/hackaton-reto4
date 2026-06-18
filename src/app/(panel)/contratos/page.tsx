"use client";

import { useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { Card, CardHeader, Badge, Button, Progress } from "@/components/ui";
import { Reveal } from "@/components/motion";
import { DocumentSource } from "@/components/DocumentSource";
import { CONTRATOS } from "@/lib/data/contratos";
import { Contrato } from "@/lib/types";
import { cop, fmtDate } from "@/lib/utils";
import { DocumentUpload, Flash, TickCircle, People, Cpu } from "iconsax-react";

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
  const [texto, setTexto] = useState(EJEMPLO);
  const [cargando, setCargando] = useState(false);
  const [extraccion, setExtraccion] = useState<Record<string, unknown> | null>(null);
  const [leyendo, setLeyendo] = useState(false);

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
            title="Pegue el texto del contrato"
            right={<DocumentUpload size={20} color="var(--red)" />}
          />
          <div className="px-5 py-4">
            {/* Origen del documento: archivo local o bucket propio de la empresa */}
            <DocumentSource
              onText={(t) => { setTexto(t); setExtraccion(null); }}
              onBusyChange={setLeyendo}
            />
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={9}
              placeholder="…o pegue el texto del contrato aquí."
              className="w-full border border-border-2 bg-surface p-3 font-mono text-[12px] leading-relaxed text-ink focus:border-ink focus:outline-none"
              style={{ borderRadius: "var(--radius)" }}
            />
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[11px] text-ink-3">{texto.length} caracteres</span>
              <Button variant="primary" onClick={extraer} disabled={cargando || leyendo}>
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
                <Badge tone={extraccion._modo === "ia" ? "success" : "neutral"}>
                  {extraccion._modo === "ia" ? (
                    <><Cpu size={12} className="mr-1" /> {String(extraccion._provider ?? "IA")}</>
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
                Pegue un contrato y presione “Extraer con IA”.
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
                <ConfRow conf={Number(extraccion.confianza ?? 0)} />
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12.5px]">
                  <Campo k="Empleado" v={String(extraccion.empleado)} />
                  <Campo k="Documento" v={String(extraccion.documento)} />
                  <Campo k="Cargo" v={String(extraccion.cargo)} />
                  <Campo k="Tipo" v={tipoLabel[String(extraccion.tipo)] ?? String(extraccion.tipo)} />
                  <Campo k="Salario" v={cop(Number(extraccion.salarioMensual))} />
                  <Campo k="Jornada" v={`${extraccion.horasSemana}h/sem`} />
                  <Campo k="Inicio" v={String(extraccion.fechaInicio)} />
                  <Campo k="Fin" v={String(extraccion.fechaFin) || "—"} />
                </dl>
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
                <div className="flex gap-2 pt-1">
                  <Button variant="secondary" className="flex-1">Corregir</Button>
                  <Button variant="primary" className="flex-1">
                    <TickCircle size={15} variant="Bold" /> Confirmar
                  </Button>
                </div>
              </div>
            )}
            {extraccion?.error ? (
              <p className="py-6 text-center text-[13px] text-red-dark">{String(extraccion.error)}</p>
            ) : null}
          </div>
        </Card>
      </div>

      {/* Nómina */}
      <div className="mt-6 mb-3 flex items-center gap-2">
        <People size={18} color="var(--ink-2)" />
        <h2 className="font-head text-[16px] text-ink">Nómina analizada</h2>
        <span className="text-[12px] text-ink-3">· {CONTRATOS.length} vínculos</span>
      </div>
      <Card className="overflow-hidden">
        <div className="grid grid-cols-12 gap-3 border-b border-border bg-surface-2 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
          <div className="col-span-4">Empleado</div>
          <div className="col-span-3">Tipo de vínculo</div>
          <div className="col-span-2 text-right">Salario</div>
          <div className="col-span-2">Vigencia</div>
          <div className="col-span-1 text-right">IA</div>
        </div>
        <div className="divide-y divide-border">
          {CONTRATOS.map((c, i) => (
            <Reveal key={c.id} delay={i * 0.04}>
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
        <span className="font-num text-[11px] text-ink-3">
          {Math.round((c.extraccionConfianza ?? 0) * 100)}%
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
