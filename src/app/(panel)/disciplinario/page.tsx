"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { Card, CardHeader, Badge, Button, Progress } from "@/components/ui";
import { Reveal } from "@/components/motion";
import {
  checklistDebidoProceso,
  evaluarDebidoProceso,
  generarPliegoBase,
} from "@/lib/debido-proceso";
import { PasoDebidoProceso } from "@/lib/types";
import { TickCircle, CloseCircle, Judge, DocumentText, Warning2 } from "iconsax-react";

export default function DisciplinarioPage() {
  const [pasos, setPasos] = useState<PasoDebidoProceso[]>(checklistDebidoProceso);
  const evalr = useMemo(() => evaluarDebidoProceso(pasos), [pasos]);

  const [form, setForm] = useState({
    empresa: "Empresa Demo S.A.S.",
    empleado: "Jhon Fredy Loaiza",
    cargo: "Operario de producción",
    fechaHechos: "2026-06-10",
    hechos: "Inasistencia injustificada durante tres (3) días consecutivos.",
    faltaReglamento: "Art. 7, num. 4 del Reglamento Interno (faltas de asistencia).",
  });
  const [pliego, setPliego] = useState<string | null>(null);

  function set(id: string, value: boolean) {
    setPasos((prev) => prev.map((p) => (p.id === id ? { ...p, cumplido: value } : p)));
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        overline="Gestión de procesos disciplinarios"
        title="Debido proceso y pliego de cargos"
        subtitle="Verifica que el procedimiento disciplinario cumpla las garantías mínimas (CN art. 29, CST art. 115, CSJ SL1706-2024) antes de adoptar una decisión, y asiste la elaboración del pliego de cargos."
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
        {/* Checklist */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader
              overline="Garantías del debido proceso"
              title="Checklist de cumplimiento"
              right={<Judge size={22} color="var(--red)" variant="Bulk" />}
            />
            <div className="divide-y divide-border">
              {pasos.map((p) => (
                <div key={p.id} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13.5px] font-medium text-ink">{p.paso}</span>
                        {!p.obligatorio && <Badge tone="neutral">Opcional</Badge>}
                      </div>
                      <div className="font-num mt-0.5 text-[11px] text-ink-3">{p.norma}</div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Toggle active={p.cumplido === true} tone="success" onClick={() => set(p.id, true)}>
                        <TickCircle size={16} variant={p.cumplido === true ? "Bold" : "Linear"} />
                      </Toggle>
                      <Toggle active={p.cumplido === false} tone="red" onClick={() => set(p.id, false)}>
                        <CloseCircle size={16} variant={p.cumplido === false ? "Bold" : "Linear"} />
                      </Toggle>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Verdict + pliego */}
        <div className="space-y-3 lg:col-span-2">
          <Reveal key={evalr.pct + String(evalr.nulidad)}>
            <Card>
              <CardHeader overline="Evaluación" title="Garantías cubiertas" />
              <div className="px-5 py-4">
                <div className="flex items-end justify-between">
                  <span className="font-num text-[34px] leading-none text-ink">{evalr.pct}%</span>
                  <span className="text-[12px] text-ink-2">
                    {evalr.cumplidos}/{evalr.totalObligatorios} obligatorias
                  </span>
                </div>
                <Progress
                  className="mt-3"
                  value={evalr.pct}
                  tone={evalr.nulidad ? "var(--red)" : evalr.pendientes.length ? "var(--warning)" : "var(--success)"}
                />
                <div
                  className="mt-4 hairline flex items-start gap-2 px-3 py-3"
                  style={{ background: evalr.nulidad ? "var(--red-tint)" : evalr.pendientes.length ? "var(--warning-tint)" : "var(--success-tint)" }}
                >
                  <Warning2 size={16} color={evalr.nulidad ? "var(--red)" : evalr.pendientes.length ? "var(--warning)" : "var(--success)"} variant="Bold" className="mt-0.5 shrink-0" />
                  <p className="text-[12.5px] leading-snug text-ink-2">{evalr.veredicto}</p>
                </div>
                {evalr.incumplidos.length > 0 && (
                  <div className="mt-3">
                    <div className="overline mb-1.5">Garantías incumplidas</div>
                    <ul className="space-y-1">
                      {evalr.incumplidos.map((p) => (
                        <li key={p.id} className="flex items-start gap-1.5 text-[12px] text-red-dark">
                          <CloseCircle size={13} className="mt-0.5 shrink-0" /> {p.paso}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Card>
          </Reveal>

          <Card>
            <CardHeader overline="Asistente" title="Generar pliego de cargos" right={<DocumentText size={20} color="var(--red)" />} />
            <div className="space-y-3 px-5 py-4">
              <Inp label="Empleado" value={form.empleado} onChange={(v) => setForm({ ...form, empleado: v })} />
              <Inp label="Hechos imputados" value={form.hechos} onChange={(v) => setForm({ ...form, hechos: v })} textarea />
              <Inp label="Falta del reglamento" value={form.faltaReglamento} onChange={(v) => setForm({ ...form, faltaReglamento: v })} />
              <Button variant="primary" className="w-full" onClick={() => setPliego(generarPliegoBase(form))}>
                Generar borrador
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {pliego && (
        <Reveal className="mt-3">
          <Card>
            <CardHeader
              overline="Borrador asistido"
              title="Pliego de cargos"
              subtitle="Estructura conforme a CN art. 29 / CST art. 115. Requiere revisión y firma del abogado."
              right={<Badge tone="warning">Requiere validación</Badge>}
            />
            <pre className="overflow-x-auto whitespace-pre-wrap px-5 py-4 font-mono text-[12px] leading-relaxed text-ink-2">
              {pliego}
            </pre>
          </Card>
        </Reveal>
      )}

      <style jsx global>{`
        .di {
          width: 100%;
          border: 1px solid var(--border-2);
          background: var(--surface);
          padding: 7px 9px;
          font-size: 12.5px;
          color: var(--ink);
          border-radius: var(--radius);
        }
        .di:focus { outline: none; border-color: var(--ink); }
      `}</style>
    </div>
  );
}

function Toggle({ active, tone, onClick, children }: { active: boolean; tone: "success" | "red"; onClick: () => void; children: React.ReactNode }) {
  const color = tone === "success" ? "var(--success)" : "var(--red)";
  return (
    <button
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center border transition-colors"
      style={{
        borderRadius: "var(--radius)",
        background: active ? (tone === "success" ? "var(--success-tint)" : "var(--red-tint)") : "var(--surface)",
        borderColor: active ? color : "var(--border-2)",
        color: active ? color : "var(--ink-3)",
      }}
    >
      {children}
    </button>
  );
}

function Inp({ label, value, onChange, textarea }: { label: string; value: string; onChange: (v: string) => void; textarea?: boolean }) {
  return (
    <label className="block">
      <span className="overline mb-1 block">{label}</span>
      {textarea ? (
        <textarea className="di" rows={2} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className="di" value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}
