// ─────────────────────────────────────────────────────────────────────────
// Recargos, horas extra y licencias — derecho laboral colombiano 2026.
// Incorpora la reforma laboral Ley 2466 de 2025:
//  • Franja nocturna desde las 7:00 p.m. (CST art. 160, vig. 25 dic 2025).
//  • Recargo dominical/festivo escalonado: 80% (2025-2026) → 90% (jul 2026) → 100% (2027).
// Cálculo determinista y auditable; cada concepto expone su fórmula y su norma.
// ─────────────────────────────────────────────────────────────────────────

export const RECARGOS_PARAMS = {
  // Franja horaria (CST art. 160, modificado por Ley 2466/2025 art. 10).
  inicioNocturno: "7:00 p.m.",
  finNocturno: "6:00 a.m.",
  // Recargos fijos (CST art. 168).
  horaExtraDiurna: 0.25,
  horaExtraNocturna: 0.75,
  recargoNocturno: 0.35,
};

/**
 * Recargo dominical/festivo vigente en una fecha (CST art. 179, mod. Ley 2466/2025 art. 14).
 * Calendario de transición: 75% → 80% (1 jul 2025) → 90% (1 jul 2026) → 100% (1 jul 2027).
 */
export function recargoDominical(fechaISO: string): number {
  if (fechaISO >= "2027-07-01") return 1.0;
  if (fechaISO >= "2026-07-01") return 0.9;
  if (fechaISO >= "2025-07-01") return 0.8;
  return 0.75;
}

export type TipoHora =
  | "extra_diurna"
  | "extra_nocturna"
  | "recargo_nocturno"
  | "dominical"
  | "extra_diurna_dom"
  | "extra_nocturna_dom"
  | "recargo_nocturno_dom";

interface ConceptoCfg {
  key: TipoHora;
  label: string;
  // "extra" = hora completa (1 + recargo); "adicional" = solo el recargo sobre la jornada ordinaria.
  modo: "extra" | "adicional";
  factor: (fechaISO: string) => number;
  norma: string;
}

export const CONCEPTOS_RECARGO: ConceptoCfg[] = [
  { key: "extra_diurna", label: "Hora extra diurna", modo: "extra", factor: () => 0.25, norma: "CST art. 168" },
  { key: "extra_nocturna", label: "Hora extra nocturna", modo: "extra", factor: () => 0.75, norma: "CST art. 168" },
  { key: "recargo_nocturno", label: "Recargo nocturno (jornada ordinaria)", modo: "adicional", factor: () => 0.35, norma: "CST art. 168" },
  { key: "dominical", label: "Recargo dominical/festivo (jornada ordinaria)", modo: "adicional", factor: (f) => recargoDominical(f), norma: "CST art. 179 (Ley 2466/2025)" },
  { key: "extra_diurna_dom", label: "Hora extra diurna en dominical/festivo", modo: "extra", factor: (f) => recargoDominical(f) + 0.25, norma: "CST arts. 168, 179" },
  { key: "extra_nocturna_dom", label: "Hora extra nocturna en dominical/festivo", modo: "extra", factor: (f) => recargoDominical(f) + 0.75, norma: "CST arts. 168, 179" },
  { key: "recargo_nocturno_dom", label: "Recargo nocturno en dominical/festivo (jornada ordinaria)", modo: "adicional", factor: (f) => recargoDominical(f) + 0.35, norma: "CST arts. 168, 179" },
];

/**
 * Valor de la hora ordinaria. Con la jornada de 42h (Ley 2101/2021) el divisor es el número
 * real de horas mensuales (horas/semana × 4.345 semanas/mes), no el histórico 240.
 * El área contable debe confirmar el divisor según la convención de la empresa.
 */
export function valorHoraOrdinaria(salarioMensual: number, horasSemana = 42): number {
  const horasMes = horasSemana * 4.345;
  return salarioMensual / horasMes;
}

export interface ResultadoRecargo {
  label: string;
  modo: "extra" | "adicional";
  horas: number;
  factorPct: number; // % de recargo aplicado
  valorHora: number; // hora ordinaria
  valorHoraConcepto: number; // valor de 1 hora del concepto
  total: number;
  formula: string;
  norma: string;
}

export function calcularRecargo(
  salarioMensual: number,
  tipo: TipoHora,
  horas: number,
  fechaISO: string,
  horasSemana = 42
): ResultadoRecargo {
  const cfg = CONCEPTOS_RECARGO.find((c) => c.key === tipo)!;
  const vh = valorHoraOrdinaria(salarioMensual, horasSemana);
  const factor = cfg.factor(fechaISO);
  // "extra": se paga la hora completa + recargo. "adicional": solo el recargo (la hora ordinaria
  // ya está incluida en el salario mensual de la jornada ordinaria).
  const valorHoraConcepto = cfg.modo === "extra" ? vh * (1 + factor) : vh * factor;
  const total = valorHoraConcepto * horas;
  const pct = Math.round(factor * 100);
  return {
    label: cfg.label,
    modo: cfg.modo,
    horas,
    factorPct: pct,
    valorHora: Math.round(vh),
    valorHoraConcepto: Math.round(valorHoraConcepto),
    total: Math.round(total),
    formula:
      cfg.modo === "extra"
        ? `${Math.round(vh).toLocaleString("es-CO")} × (1 + ${pct}%) × ${horas} h`
        : `${Math.round(vh).toLocaleString("es-CO")} × ${pct}% × ${horas} h`,
    norma: cfg.norma,
  };
}

// ── Licencias remuneradas ───────────────────────────────────────────────────

export interface ResultadoLicencia {
  nombre: string;
  semanas: number;
  dias: number;
  valor: number;
  pagador: string;
  norma: string;
}

/** Licencia de maternidad: 18 semanas, 100% del salario, la paga la EPS (CST art. 236). */
export function licenciaMaternidad(salarioMensual: number): ResultadoLicencia {
  const semanas = 18;
  const dias = semanas * 7; // 126 días
  return {
    nombre: "Licencia de maternidad",
    semanas,
    dias,
    valor: Math.round((salarioMensual / 30) * dias),
    pagador: "EPS",
    norma: "CST art. 236 (Ley 1822/2017, Ley 2114/2021)",
  };
}

/**
 * Licencia de paternidad: 2 semanas (14 días), 100% del salario, la paga la EPS.
 * El incremento progresivo de la Ley 2114/2021 (hasta 5 semanas) NO está activado en 2026.
 */
export function licenciaPaternidad(salarioMensual: number): ResultadoLicencia {
  const semanas = 2;
  const dias = 14;
  return {
    nombre: "Licencia de paternidad",
    semanas,
    dias,
    valor: Math.round((salarioMensual / 30) * dias),
    pagador: "EPS",
    norma: "CST art. 236 par. 2 (Ley 2114/2021)",
  };
}
