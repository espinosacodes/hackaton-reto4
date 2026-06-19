import { Contrato } from "./types";
import { auxilioAplicable, PARAMS_2026 } from "./liquidacion";

// ─────────────────────────────────────────────────────────────────────────
// Revisión de aportes a seguridad social y provisiones — cálculo de lo DEBIDO.
// Centinela calcula lo que el empleador debió pagar/provisionar por trabajador;
// luego se compara contra lo realmente pagado (planilla cargada, API o manual).
// Tasas estándar; el área contable debe validarlas según el caso (exoneraciones,
// FSP, clase de riesgo real, salario integral).
// ─────────────────────────────────────────────────────────────────────────

type Params = typeof PARAMS_2026;

export type ClaseRiesgo = "I" | "II" | "III" | "IV" | "V";

export const TASAS = {
  salud: 0.125, // 8,5% empleador + 4% trabajador
  pension: 0.16, // 12% empleador + 4% trabajador
  arl: { I: 0.00522, II: 0.01044, III: 0.02436, IV: 0.0435, V: 0.0696 } as Record<ClaseRiesgo, number>,
  cesantias: 1 / 12, // 8,33% mensual (1 mes/año)
  interesesAnual: 0.12, // 12% anual sobre cesantías
  prima: 1 / 12, // 8,33% mensual (1 mes/año)
  vacaciones: 15 / 360, // 4,17% (15 días/año)
};

export interface LineaAporte {
  concepto: string;
  base: number;
  tasa: string;
  valor: number;
  grupo: "seguridad_social" | "provision";
  pagador: string;
  norma: string;
}

export interface AportesContrato {
  contratoId: string;
  empleado: string;
  ibc: number; // base de cotización a seguridad social
  lineas: LineaAporte[];
  totalSeguridadSocial: number; // lo que va por PILA cada mes
  totalProvisiones: number; // provisiones mensuales (cesantías, prima, vacaciones)
}

const round = (n: number) => Math.round(n);

/** Calcula lo DEBIDO por un contrato en un mes: seguridad social + provisiones. */
export function calcularAportes(
  c: Contrato,
  p: Params = PARAMS_2026,
  clase: ClaseRiesgo = "I"
): AportesContrato {
  const aux = auxilioAplicable(c, p);
  const baseConAux = c.salarioMensual + aux; // base de cesantías y prima

  // IBC de seguridad social: salario sin auxilio; integral = 70%; piso 1 y tope 25 SMMLV.
  let ibc = c.salarioIntegral ? c.salarioMensual * 0.7 : c.salarioMensual;
  ibc = Math.min(Math.max(ibc, p.smmlv), 25 * p.smmlv);

  const lineas: LineaAporte[] = [
    { concepto: "Salud (EPS)", base: ibc, tasa: "12,5%", valor: round(ibc * TASAS.salud), grupo: "seguridad_social", pagador: "PILA → EPS", norma: "Ley 100/1993" },
    { concepto: "Pensión (AFP)", base: ibc, tasa: "16%", valor: round(ibc * TASAS.pension), grupo: "seguridad_social", pagador: "PILA → AFP", norma: "Ley 100/1993" },
    {
      concepto: `ARL (clase ${clase})`,
      base: ibc,
      tasa: (TASAS.arl[clase] * 100).toLocaleString("es-CO", { maximumFractionDigits: 3 }) + "%",
      valor: round(ibc * TASAS.arl[clase]),
      grupo: "seguridad_social",
      pagador: "PILA → ARL",
      norma: "Decreto 1072/2015",
    },
  ];

  if (!c.salarioIntegral) {
    const cesMes = baseConAux * TASAS.cesantias;
    lineas.push(
      { concepto: "Cesantías", base: baseConAux, tasa: "8,33%", valor: round(cesMes), grupo: "provision", pagador: "Fondo de cesantías (consigna 14-feb)", norma: "CST 249–252" },
      { concepto: "Intereses a cesantías", base: baseConAux, tasa: "1% mensual", valor: round(cesMes * TASAS.interesesAnual), grupo: "provision", pagador: "Pago al trabajador (feb)", norma: "Ley 52/1975" },
      { concepto: "Prima de servicios", base: baseConAux, tasa: "8,33%", valor: round(baseConAux * TASAS.prima), grupo: "provision", pagador: "Pago al trabajador (jun/dic)", norma: "CST 306–307" }
    );
  }
  // Vacaciones: 15 días de salario por año, sin auxilio.
  lineas.push({
    concepto: "Vacaciones",
    base: c.salarioMensual,
    tasa: "4,17%",
    valor: round(c.salarioMensual * TASAS.vacaciones),
    grupo: "provision",
    pagador: "Provisión / disfrute",
    norma: "CST 186–189",
  });

  const totalSeguridadSocial = lineas.filter((l) => l.grupo === "seguridad_social").reduce((s, l) => s + l.valor, 0);
  const totalProvisiones = lineas.filter((l) => l.grupo === "provision").reduce((s, l) => s + l.valor, 0);

  return { contratoId: c.id, empleado: c.empleado, ibc: round(ibc), lineas, totalSeguridadSocial, totalProvisiones };
}

export type EstadoAporte = "ok" | "no_pagado" | "subaporte" | "sobreaporte";

/** Compara lo debido contra lo efectivamente pagado (de la planilla, API o manual). */
export function compararAporte(debido: number, pagado: number): { dif: number; pct: number; estado: EstadoAporte } {
  const dif = pagado - debido;
  const pct = debido === 0 ? 0 : (dif / debido) * 100;
  let estado: EstadoAporte;
  if (pagado <= 0) estado = "no_pagado";
  else if (Math.abs(pct) < 1) estado = "ok";
  else if (dif < 0) estado = "subaporte";
  else estado = "sobreaporte";
  return { dif, pct, estado };
}
