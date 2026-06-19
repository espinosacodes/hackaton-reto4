"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { Card, CardHeader, Badge } from "@/components/ui";
import { Reveal } from "@/components/motion";
import { CONTRATOS, HOY } from "@/lib/data/contratos";
import { useContratosConfirmados } from "@/lib/store";
import {
  CONCEPTOS_RECARGO,
  calcularRecargo,
  licenciaMaternidad,
  licenciaPaternidad,
  recargoDominical,
  type TipoHora,
} from "@/lib/recargos";
import { cop } from "@/lib/utils";
import { Clock, InfoCircle, Health } from "iconsax-react";

export default function RecargosPage() {
  const confirmados = useContratosConfirmados();
  const todos = useMemo(() => [...confirmados, ...CONTRATOS], [confirmados]);

  const [id, setId] = useState(CONTRATOS[0].id);
  const [tipo, setTipo] = useState<TipoHora>("extra_diurna");
  const [horas, setHoras] = useState("4");
  const [fecha, setFecha] = useState(HOY);

  const c = todos.find((x) => x.id === id) ?? todos[0];
  const nHoras = Number(horas.replace(/[^\d.]/g, "")) || 0;

  const recargo = useMemo(
    () => calcularRecargo(c.salarioMensual, tipo, nHoras, fecha, c.horasSemana),
    [c, tipo, nHoras, fecha]
  );
  const mat = useMemo(() => licenciaMaternidad(c.salarioMensual), [c]);
  const pat = useMemo(() => licenciaPaternidad(c.salarioMensual), [c]);
  const domPct = Math.round(recargoDominical(fecha) * 100);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        overline="Novedades de nómina"
        title="Recargos, horas extra y licencias"
        subtitle="Cálculo determinista de recargos (extra, nocturno, dominical/festivo) y licencias (maternidad/paternidad), con los valores vigentes en 2026 tras la reforma laboral (Ley 2466/2025). Cada resultado muestra su fórmula y su norma."
      />

      <div className="mb-4 hairline flex items-start gap-3 bg-[var(--info-tint)] px-4 py-3">
        <InfoCircle size={18} color="var(--info)" className="mt-0.5 shrink-0" />
        <p className="text-[12.5px] leading-snug text-ink-2">
          <span className="font-medium text-ink">Reforma laboral (Ley 2466/2025):</span> la jornada
          nocturna empieza a las <span className="font-medium">7:00 p.m.</span> (antes 9 p.m.) y el
          recargo dominical/festivo sube de forma escalonada: 80% (2025–jun 2026) →{" "}
          <span className="font-medium">90% desde julio 2026</span> → 100% (2027). Hoy ({fecha}) el
          recargo dominical es del <span className="font-medium">{domPct}%</span>.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* Empleado */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader overline="Parámetros" title="Empleado y novedad" />
            <div className="space-y-4 px-5 py-4">
              <Campo label="Empleado / contrato">
                <select value={id} onChange={(e) => setId(e.target.value)} className="rc-input">
                  {todos.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.empleado} — {x.id}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo label="Tipo de recargo / hora extra">
                <select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as TipoHora)}
                  className="rc-input"
                >
                  {CONCEPTOS_RECARGO.map((x) => (
                    <option key={x.key} value={x.key}>
                      {x.label}
                    </option>
                  ))}
                </select>
              </Campo>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="N.º de horas">
                  <input
                    inputMode="decimal"
                    value={horas}
                    onChange={(e) => setHoras(e.target.value)}
                    className="rc-input font-num"
                  />
                </Campo>
                <Campo label="Fecha">
                  <input
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className="rc-input"
                  />
                </Campo>
              </div>
              <div className="hairline bg-surface-2 px-3 py-2.5 text-[12px] text-ink-2">
                <Row k="Salario mensual" v={cop(c.salarioMensual)} />
                <Row k="Jornada" v={`${c.horasSemana} h/sem`} />
                <Row k="Valor hora ordinaria" v={cop(recargo.valorHora)} />
              </div>
              <p className="text-[11px] text-ink-3">
                Hora ordinaria = salario ÷ (horas/semana × 4,345). El divisor lo confirma el área
                contable según la convención de la empresa.
              </p>
            </div>
          </Card>
        </div>

        {/* Resultado recargo */}
        <div className="lg:col-span-2">
          <Reveal key={`${id}-${tipo}-${horas}-${fecha}`}>
            <Card>
              <CardHeader
                overline="Resultado"
                title={recargo.label}
                subtitle={recargo.modo === "extra" ? "Hora completa con recargo" : "Recargo adicional al salario ordinario"}
                right={<Clock size={22} color="var(--red)" variant="Bulk" />}
              />
              <div className="px-5 py-4">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-[13px] text-ink-2">
                    {nHoras} hora{nHoras === 1 ? "" : "s"} · recargo {recargo.factorPct}%
                  </span>
                  <span className="font-num text-[28px] text-ink">{cop(recargo.total)}</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-2">
                  <span className="font-num bg-surface-2 px-1.5 py-0.5">{recargo.formula}</span>
                  <span className="text-ink-3">
                    Valor de 1 hora: {cop(recargo.valorHoraConcepto)}
                  </span>
                  <Badge tone="neutral" className="ml-auto">{recargo.norma}</Badge>
                </div>
              </div>
            </Card>
          </Reveal>

          {/* Licencias */}
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <LicenciaCard
              nombre={mat.nombre}
              semanas={mat.semanas}
              dias={mat.dias}
              valor={mat.valor}
              pagador={mat.pagador}
              norma={mat.norma}
            />
            <LicenciaCard
              nombre={pat.nombre}
              semanas={pat.semanas}
              dias={pat.dias}
              valor={pat.valor}
              pagador={pat.pagador}
              norma={pat.norma}
            />
          </div>
          <p className="mt-2 text-[11px] text-ink-3">
            Las licencias de maternidad/paternidad las paga la EPS (no el empleador). La de paternidad
            sigue en 2 semanas en 2026 (el incremento progresivo de la Ley 2114/2021 no se ha
            activado).
          </p>
        </div>
      </div>

      <style jsx global>{`
        .rc-input {
          width: 100%;
          border: 1px solid var(--border-2);
          background: var(--surface);
          padding: 8px 10px;
          font-size: 13px;
          color: var(--ink);
          border-radius: var(--radius);
        }
        .rc-input:focus {
          outline: none;
          border-color: var(--ink);
        }
      `}</style>
    </div>
  );
}

function LicenciaCard({
  nombre,
  semanas,
  dias,
  valor,
  pagador,
  norma,
}: {
  nombre: string;
  semanas: number;
  dias: number;
  valor: number;
  pagador: string;
  norma: string;
}) {
  return (
    <Card>
      <CardHeader overline="Licencia remunerada" title={nombre} right={<Health size={20} color="var(--red)" />} />
      <div className="px-5 py-4">
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] text-ink-2">
            {semanas} semanas · {dias} días
          </span>
          <span className="font-num text-[20px] text-ink">{cop(valor)}</span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Badge tone="success">Paga: {pagador}</Badge>
          <Badge tone="neutral">{norma}</Badge>
        </div>
      </div>
    </Card>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
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
