"use client";

import { PageHeader } from "@/components/AppShell";
import { Card, CardHeader, Badge, Button } from "@/components/ui";
import { Reveal } from "@/components/motion";
import { useAuditLog, clearAudit } from "@/lib/store";
import { ClipboardText, TickCircle } from "iconsax-react";

function fmtTs(ts: string): string {
  try {
    return new Date(ts).toLocaleString("es-CO", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return ts;
  }
}

const tono: Record<string, "success" | "warning" | "red" | "neutral"> = {
  "Contrato validado": "success",
  "Liquidación enviada a revisión": "success",
  "Pliego enviado a firma del abogado": "success",
  "Pliego de cargos generado": "neutral",
  "Liquidación exportada": "neutral",
  "Pliego copiado": "neutral",
  "Edición de extracción": "warning",
};

export default function BitacoraPage() {
  const eventos = useAuditLog();

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        overline="Trazabilidad y control humano"
        title="Bitácora de decisiones"
        subtitle="Registro auditable de cada acción humana sobre las salidas de Centinela: quién validó, qué y cuándo. Es la respuesta a '¿quién responde legalmente?' — la cadena de custodia que respalda al abogado."
      />

      <div className="mb-3 flex items-center justify-between">
        <span className="text-[12px] text-ink-3">
          {eventos.length} evento{eventos.length === 1 ? "" : "s"} registrado
          {eventos.length === 1 ? "" : "s"} en esta sesión
        </span>
        {eventos.length > 0 && (
          <Button variant="secondary" onClick={() => clearAudit()}>
            Limpiar bitácora
          </Button>
        )}
      </div>

      {eventos.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 px-5 py-14 text-center">
            <ClipboardText size={34} color="var(--ink-3)" />
            <p className="text-[13px] text-ink-3">
              Aún no hay eventos. Valide un contrato, envíe una liquidación a revisión o genere un
              pliego, y aparecerán aquí con su fecha y responsable.
            </p>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <CardHeader
            overline="Registro"
            title="Historial de acciones"
            right={<ClipboardText size={20} color="var(--red)" />}
          />
          <div className="divide-y divide-border">
            {eventos.map((ev, i) => (
              <Reveal key={ev.id} delay={Math.min(i, 8) * 0.03}>
                <div className="flex items-start gap-3 px-5 py-3">
                  <TickCircle
                    size={16}
                    color="var(--success)"
                    variant="Bold"
                    className="mt-0.5 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-medium text-ink">{ev.accion}</span>
                      <Badge tone={tono[ev.accion] ?? "neutral"}>{ev.usuario}</Badge>
                    </div>
                    <p className="mt-0.5 text-[12px] text-ink-2">{ev.detalle}</p>
                    {ev.email && (
                      <p className="mt-0.5 text-[11px] text-ink-3">{ev.email}</p>
                    )}
                  </div>
                  <span className="font-num shrink-0 text-[11px] text-ink-3">{fmtTs(ev.ts)}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </Card>
      )}

      <div className="mt-3 hairline bg-[var(--info-tint)] px-4 py-3 text-[12px] text-ink-2">
        Registro de demostración (se guarda solo en este navegador). En producción se persiste con
        sello de tiempo, usuario autenticado y hash del documento para una cadena de custodia válida
        ante una eventual controversia.
      </div>
    </div>
  );
}
