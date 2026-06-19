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

/**
 * Obligaciones PERIÓDICAS DEL EMPLEADOR derivadas del vínculo (cálculo determinista,
 * no lo "lee" la IA). Es la lista que la operación esperaba en Contratos: prestaciones
 * y aportes a cargo del empleador según el tipo de vínculo y el salario.
 */
export function obligacionesEmpleador(
  tipo: string,
  salarioMensual: number,
  salarioIntegral: boolean,
  p: Params = PARAMS_2026,
): string[] {
  // Vínculos civiles: la carga prestacional NO está a cargo del contratante.
  if (tipo === "prestacion_servicios") {
    return [
      "El contratista asume su propia seguridad social (no hay prestaciones a cargo del contratante)",
      "Verificar realidad del vínculo (riesgo de subordinación encubierta)",
    ];
  }
  if (tipo === "plataforma") {
    return [
      "Afiliación a seguridad social según Ley 2466/2025 (esquema mixto)",
      "Aportes ARL por la actividad",
    ];
  }

  const bajo2Smmlv = salarioMensual <= 2 * p.smmlv;
  const obl = ["Seguridad social: salud, pensión y ARL (PILA, mensual)"];
  // Exoneración Ley 1607/2012: salud/SENA/ICBF para trabajadores < 10 SMMLV.
  obl.push(
    salarioMensual < 10 * p.smmlv
      ? "Aportes parafiscales: Caja de Compensación (SENA/ICBF exonerados < 10 SMMLV)"
      : "Aportes parafiscales: SENA, ICBF y Caja de Compensación",
  );
  if (!salarioIntegral) {
    obl.push(
      "Prima de servicios (jun y dic)",
      "Cesantías (consignación 14-feb)",
      "Intereses a las cesantías (pago al trabajador, ene)",
    );
  }
  obl.push("Vacaciones (15 días/año)");
  if (bajo2Smmlv && !salarioIntegral) obl.push("Auxilio de transporte");
  if (bajo2Smmlv) obl.push("Dotación (3 entregas/año, Ley 11/1984)");
  return obl;
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
