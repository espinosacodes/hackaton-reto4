import { Contrato, LiquidacionLinea, LiquidacionResultado, CausaTerminacion } from "./types";
import { days360 } from "./utils";

// ─────────────────────────────────────────────────────────────────────────
// Parámetros legales — configurables por el área contable.
// Fuente 2026: Decretos 1469 y 1470 de 2025 (Mintrabajo).
// ─────────────────────────────────────────────────────────────────────────
export const PARAMS_2026 = {
  anio: 2026,
  smmlv: 1_750_905,
  auxilioTransporte: 249_095,
  // El auxilio de transporte se causa hasta 2 SMMLV (art. 2 Ley 15/1959).
  topeAuxilioSmmlv: 2,
  // Interés sobre cesantías: 12% anual (Ley 52/1975).
  tasaInteresCesantias: 0.12,
  // Salario integral: a partir de 10 SMMLV + 30% factor prestacional => 13 SMMLV (CST art. 132).
  pisoSalarioIntegralSmmlv: 13,
};

type Params = typeof PARAMS_2026;

/** Auxilio de transporte aplicable a este contrato. */
export function auxilioAplicable(c: Contrato, p: Params = PARAMS_2026): number {
  if (c.salarioIntegral) return 0;
  if (!c.auxilioTransporte) return 0;
  if (c.salarioMensual > p.topeAuxilioSmmlv * p.smmlv) return 0;
  return p.auxilioTransporte;
}

const round = (n: number) => Math.round(n);

/**
 * Liquida prestaciones sociales de forma DETERMINISTA y auditable.
 * No interviene ningún modelo de IA: cada línea expone su fórmula y su norma.
 */
export function liquidar(
  c: Contrato,
  hasta: string,
  causa: CausaTerminacion,
  p: Params = PARAMS_2026
): LiquidacionResultado {
  const lineas: LiquidacionLinea[] = [];
  const notas: string[] = [];

  const dias = days360(c.fechaInicio, hasta);
  const aux = auxilioAplicable(c, p);
  const baseConAux = c.salarioMensual + aux; // base prestacional
  const salarioDiario = c.salarioMensual / 30;

  if (c.salarioIntegral) {
    notas.push(
      "Salario integral (CST art. 132): el factor prestacional (≥30%) ya remunera cesantías, intereses y prima. Sólo se liquidan vacaciones."
    );
  }

  // 1. Cesantías — CST arts. 249–252
  if (!c.salarioIntegral) {
    const valor = (baseConAux * dias) / 360;
    lineas.push({
      concepto: "Cesantías",
      base: `Salario + auxilio de transporte = ${baseConAux.toLocaleString("es-CO")}`,
      formula: `(${baseConAux.toLocaleString("es-CO")} × ${dias}) ÷ 360`,
      dias,
      valor: round(valor),
      norma: "CST arts. 249–252",
    });

    // 2. Intereses a las cesantías — Ley 52/1975 (12% anual)
    const intereses = (round(valor) * dias * p.tasaInteresCesantias) / 360;
    lineas.push({
      concepto: "Intereses sobre cesantías",
      base: `12% anual sobre cesantías causadas`,
      formula: `(${round(valor).toLocaleString("es-CO")} × ${dias} × 0.12) ÷ 360`,
      dias,
      valor: round(intereses),
      norma: "Ley 52 de 1975",
    });

    // 3. Prima de servicios — CST arts. 306–307 (30 días/año)
    const prima = (baseConAux * dias) / 360;
    lineas.push({
      concepto: "Prima de servicios",
      base: `Salario + auxilio de transporte (30 días por año)`,
      formula: `(${baseConAux.toLocaleString("es-CO")} × ${dias}) ÷ 360`,
      dias,
      valor: round(prima),
      norma: "CST arts. 306–307",
    });
  }

  // 4. Vacaciones — CST arts. 186–192 (15 días hábiles/año, sin auxilio)
  const vacaciones = (c.salarioMensual * dias) / 720;
  lineas.push({
    concepto: "Vacaciones",
    base: `Salario ordinario sin auxilio (15 días por año)`,
    formula: `(${c.salarioMensual.toLocaleString("es-CO")} × ${dias}) ÷ 720`,
    dias,
    valor: round(vacaciones),
    norma: "CST arts. 186–192",
  });

  // 5. Indemnización por despido sin justa causa — CST art. 64
  if (causa === "sin_justa_causa") {
    const indem = calcularIndemnizacion(c, hasta, dias, salarioDiario, p);
    if (indem) lineas.push(indem);
  } else if (causa === "renuncia" || causa === "justa_causa") {
    notas.push("No se causa indemnización (terminación por renuncia o justa causa).");
  } else if (causa === "vencimiento_plazo") {
    notas.push(
      "Terminación por vencimiento del plazo pactado: no hay indemnización si medió preaviso de 30 días (CST art. 46)."
    );
  }

  const total = lineas.reduce((s, l) => s + l.valor, 0);

  return {
    contratoId: c.id,
    empleado: c.empleado,
    desde: c.fechaInicio,
    hasta,
    diasLaborados: dias,
    baseLiquidacion: baseConAux,
    lineas,
    total: round(total),
    causa,
    notas,
  };
}

function calcularIndemnizacion(
  c: Contrato,
  hasta: string,
  dias: number,
  salarioDiario: number,
  p: Params
): LiquidacionLinea | null {
  // Término fijo / obra: salarios por el tiempo que falte para el vencimiento (mín. 15 días).
  if ((c.tipo === "fijo" || c.tipo === "obra_labor") && c.fechaFin) {
    const faltan = Math.max(days360(hasta, c.fechaFin), 0);
    const diasIndem = c.tipo === "obra_labor" ? Math.max(faltan, 15) : faltan;
    return {
      concepto: "Indemnización (despido sin justa causa)",
      base: `Salarios del tiempo faltante hasta ${c.fechaFin}`,
      formula: `${diasIndem} días × ${round(salarioDiario).toLocaleString("es-CO")}`,
      dias: diasIndem,
      valor: round(diasIndem * salarioDiario),
      norma: "CST art. 64 (contrato a término fijo)",
    };
  }

  // Término indefinido — escala por nivel salarial.
  const menorA10 = c.salarioMensual < 10 * p.smmlv;
  let diasIndem: number;
  let detalleEscala: string;
  if (dias <= 360) {
    diasIndem = menorA10 ? 30 : 20;
    detalleEscala = menorA10 ? "30 días (≤1 año, <10 SMMLV)" : "20 días (≤1 año, ≥10 SMMLV)";
  } else {
    const adicional = (dias - 360) / 360;
    if (menorA10) {
      diasIndem = 30 + 20 * adicional;
      detalleEscala = "30 días + 20 días por año adicional (<10 SMMLV)";
    } else {
      diasIndem = 20 + 15 * adicional;
      detalleEscala = "20 días + 15 días por año adicional (≥10 SMMLV)";
    }
  }
  return {
    concepto: "Indemnización (despido sin justa causa)",
    base: detalleEscala,
    formula: `${diasIndem.toFixed(1)} días × ${round(salarioDiario).toLocaleString("es-CO")}`,
    dias: Math.round(diasIndem),
    valor: round(diasIndem * salarioDiario),
    norma: "CST art. 64 (contrato a término indefinido)",
  };
}

/**
 * Compara una liquidación de referencia (Centinela) contra el valor pagado
 * por la empresa, para detectar liquidaciones incorrectas.
 */
export function compararLiquidacion(referencia: number, pagado: number) {
  const diferencia = pagado - referencia;
  const pct = referencia === 0 ? 0 : (diferencia / referencia) * 100;
  let estado: "correcta" | "subliquidada" | "sobreliquidada";
  if (Math.abs(pct) < 1) estado = "correcta";
  else if (diferencia < 0) estado = "subliquidada";
  else estado = "sobreliquidada";
  return { diferencia, pct, estado };
}
