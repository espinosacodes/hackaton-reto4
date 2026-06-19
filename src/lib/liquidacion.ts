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
  // El derecho al auxilio de transporte nace de la Ley 15/1959 (art. 2); su monto
  // y el tope de 2 SMMLV los fija el Gobierno por decreto reglamentario cada año.
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

// Modo de liquidación:
//  - "periodo": liquidación definitiva del periodo NO consignado (cesantías e intereses
//    del año en curso, prima del semestre en curso, vacaciones desde el último disfrute).
//    Asume que los periodos anteriores ya se consignaron/pagaron. Es lo correcto al terminar.
//  - "acumulado": pasivo total asumiendo que NUNCA se pagó nada (mora total). Solo para
//    estimar contingencia, no como liquidación definitiva.
export type ModoLiquidacion = "periodo" | "acumulado";

const maxFecha = (a: string, b: string) => (a > b ? a : b);

/**
 * Liquida prestaciones sociales de forma DETERMINISTA y auditable.
 * No interviene ningún modelo de IA: cada línea expone su fórmula y su norma.
 */
export function liquidar(
  c: Contrato,
  hasta: string,
  causa: CausaTerminacion,
  p: Params = PARAMS_2026,
  modo: ModoLiquidacion = "periodo",
  factorVariable = 0
): LiquidacionResultado {
  const lineas: LiquidacionLinea[] = [];
  const notas: string[] = [];

  const diasTotales = days360(c.fechaInicio, hasta); // antigüedad total
  // Factor salarial variable (promedio mensual de horas extra/recargos habituales).
  // Es salario (CST art. 127) y, cuando es habitual, incrementa la base de prestaciones.
  // En salario integral ya está incluido, así que no se suma.
  const fv = c.salarioIntegral ? 0 : Math.max(0, factorVariable);
  const salarioBase = c.salarioMensual + fv;
  const aux = auxilioAplicable(c, p);
  const baseConAux = salarioBase + aux; // base prestacional (cesantías, prima)
  const salarioDiario = salarioBase / 30;

  // Periodo a liquidar por concepto (cada prestación tiene su propia causación).
  const acumulado = modo === "acumulado";
  const anio = hasta.slice(0, 4);
  const inicioAnio = `${anio}-01-01`;
  const inicioSemestre = Number(hasta.slice(5, 7)) <= 6 ? `${anio}-01-01` : `${anio}-07-01`;

  const desdeCesantias = acumulado ? c.fechaInicio : maxFecha(c.fechaInicio, inicioAnio);
  const desdePrima = acumulado ? c.fechaInicio : maxFecha(c.fechaInicio, inicioSemestre);
  const desdeVac = c.ultimasVacacionesTomadas
    ? maxFecha(c.fechaInicio, c.ultimasVacacionesTomadas)
    : c.fechaInicio;

  const diasCesantias = days360(desdeCesantias, hasta);
  const diasPrima = days360(desdePrima, hasta);
  const diasVac = days360(desdeVac, hasta);

  notas.push(
    acumulado
      ? "Modo PASIVO ACUMULADO: liquida toda la antigüedad asumiendo que no se consignó ni pagó nada (mora total). Úselo solo para estimar contingencia, no como liquidación definitiva."
      : "Modo LIQUIDACIÓN DEL PERIODO: cesantías e intereses del año en curso, prima del semestre en curso, vacaciones desde el último disfrute. Se asume que los periodos anteriores fueron consignados/pagados; el área contable debe validarlo contra los pagos reales."
  );

  if (c.salarioIntegral) {
    notas.push(
      "Salario integral (CST art. 132): el factor prestacional (≥30%) ya remunera cesantías, intereses y prima. Sólo se liquidan vacaciones."
    );
  }

  if (fv > 0) {
    notas.push(
      `Factor salarial variable incluido en la base: ${fv.toLocaleString("es-CO")}/mes (promedio de horas extra/recargos habituales, salario conforme al CST art. 127).`
    );
  }

  // 1. Cesantías — CST arts. 249–252
  if (!c.salarioIntegral) {
    const valor = (baseConAux * diasCesantias) / 360;
    lineas.push({
      concepto: "Cesantías",
      base: `Salario + auxilio = ${baseConAux.toLocaleString("es-CO")} · ${desdeCesantias} → ${hasta}`,
      formula: `(${baseConAux.toLocaleString("es-CO")} × ${diasCesantias}) ÷ 360`,
      dias: diasCesantias,
      valor: round(valor),
      norma: "CST arts. 249–252",
    });

    // 2. Intereses a las cesantías — Ley 52/1975 (12% anual sobre el saldo de cesantías).
    // En "periodo": proporcional al año en curso (≤1). En "acumulado": acumulación año a año
    // sobre el saldo creciente → factor (años+1)/2 (ni tope de 1 año ni crecimiento cuadrático).
    // Pendiente de validación final con el área contable.
    const aniosCes = diasCesantias / 360;
    const factorInteres = acumulado ? (aniosCes + 1) / 2 : Math.min(aniosCes, 1);
    const intereses = round(valor) * p.tasaInteresCesantias * factorInteres;
    lineas.push({
      concepto: "Intereses sobre cesantías",
      base: acumulado
        ? "12% anual acumulado sobre el saldo de cesantías (mora multianual)"
        : "12% anual proporcional al periodo",
      formula: acumulado
        ? `${round(valor).toLocaleString("es-CO")} × 12% × ((${aniosCes.toFixed(1)} + 1) ÷ 2)`
        : `${round(valor).toLocaleString("es-CO")} × 12% × ${factorInteres.toFixed(2)}`,
      dias: diasCesantias,
      valor: round(intereses),
      norma: "Ley 52 de 1975",
    });

    // 3. Prima de servicios — CST arts. 306–307 (30 días/año, semestral)
    const prima = (baseConAux * diasPrima) / 360;
    lineas.push({
      concepto: "Prima de servicios",
      base: `Salario + auxilio (30 días/año) · ${desdePrima} → ${hasta}`,
      formula: `(${baseConAux.toLocaleString("es-CO")} × ${diasPrima}) ÷ 360`,
      dias: diasPrima,
      valor: round(prima),
      norma: "CST arts. 306–307",
    });
  }

  // 4. Vacaciones — CST arts. 186, 189 (15 días de salario por año, sin auxilio)
  const vacaciones = (salarioBase * diasVac) / 720;
  lineas.push({
    concepto: "Vacaciones",
    base: `Salario ordinario sin auxilio (15 días/año) · ${desdeVac} → ${hasta}`,
    formula: `(${salarioBase.toLocaleString("es-CO")} × ${diasVac}) ÷ 720`,
    dias: diasVac,
    valor: round(vacaciones),
    norma: "CST arts. 186, 189",
  });

  // 5. Indemnización por despido sin justa causa — CST art. 64 (sobre la antigüedad total)
  if (causa === "sin_justa_causa") {
    const indem = calcularIndemnizacion(c, hasta, diasTotales, salarioDiario, p);
    if (indem) {
      lineas.push(indem);
      if ((c.tipo === "fijo" || c.tipo === "obra_labor" || c.tipo === "aprendizaje") && (indem.dias ?? 0) <= 0) {
        notas.push(
          "El plazo del contrato ya venció: la indemnización por tiempo faltante es $0. Verifique si la causa correcta es 'vencimiento del plazo'."
        );
      }
    }
  } else if (causa === "justa_causa") {
    notas.push("No se causa indemnización: la terminación se fundamenta en una justa causa comprobada.");
  } else if (causa === "renuncia") {
    notas.push("No se causa indemnización (renuncia voluntaria del trabajador).");
  } else if (causa === "vencimiento_plazo") {
    notas.push(
      "El vencimiento del plazo pactado es un modo legal de terminación (CST art. 61, lit. c) y no genera indemnización. El preaviso de 30 días (CST art. 46) solo evita la prórroga automática; su omisión prorroga el contrato por un periodo igual."
    );
  }

  const total = lineas.reduce((s, l) => s + l.valor, 0);

  return {
    contratoId: c.id,
    empleado: c.empleado,
    desde: c.fechaInicio,
    hasta,
    diasLaborados: diasTotales,
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
  // Término fijo / obra / aprendizaje (todos a plazo): salarios por el tiempo que falte
  // para el vencimiento (mín. 15 días en obra o labor).
  if ((c.tipo === "fijo" || c.tipo === "obra_labor" || c.tipo === "aprendizaje") && c.fechaFin) {
    const faltan = Math.max(days360(hasta, c.fechaFin), 0);
    const diasIndem = c.tipo === "obra_labor" ? Math.max(faltan, 15) : faltan;
    const esAprendiz = c.tipo === "aprendizaje";
    return {
      concepto: "Indemnización (despido sin justa causa)",
      base: esAprendiz
        ? `Salarios del tiempo faltante hasta ${c.fechaFin} (aprendizaje: contrato laboral especial, Ley 2466/2025)`
        : `Salarios del tiempo faltante hasta ${c.fechaFin}`,
      formula: `${diasIndem} días × ${round(salarioDiario).toLocaleString("es-CO")}`,
      dias: diasIndem,
      valor: round(diasIndem * salarioDiario),
      norma: esAprendiz ? "Ley 2466/2025 art. 21; CST art. 64" : "CST art. 64 (contrato a término fijo)",
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
