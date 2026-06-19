import { Contrato } from "./types";
import { cop, fmtDate } from "./utils";

// ─────────────────────────────────────────────────────────────────────────
// Borrador de CONTRATO LABORAL para formalizar un vínculo mal clasificado.
// Tras una reclasificación de riesgo alto, la acción recomendada es formalizar;
// esta plantilla genera el borrador a partir de los datos del contratista para
// que el abogado lo revise, ajuste y firme. No reemplaza el criterio jurídico.
// ─────────────────────────────────────────────────────────────────────────

export function generarContratoLaboral(c: Contrato, empresa: string): string {
  const hoy = new Date().toISOString().slice(0, 10);
  const salario = c.salarioMensual ? cop(c.salarioMensual) : "[salario a definir]";
  const inicio = c.fechaInicio ? fmtDate(c.fechaInicio) : "[fecha de inicio]";

  return `CONTRATO INDIVIDUAL DE TRABAJO A TÉRMINO INDEFINIDO
(Borrador de formalización — revisión y firma del abogado responsable)

Entre ${empresa} (en adelante, EL EMPLEADOR) y ${c.empleado || "[nombre del trabajador]"}, identificado(a) con C.C. ${c.documento || "[número de documento]"} (en adelante, EL TRABAJADOR), se celebra el presente contrato individual de trabajo, regido por el Código Sustantivo del Trabajo, conforme a las siguientes cláusulas:

PRIMERA — OBJETO Y CARGO
EL TRABAJADOR se obliga a prestar sus servicios personales en el cargo de ${c.cargo || "[cargo]"}, bajo continuada subordinación y dependencia de EL EMPLEADOR.

SEGUNDA — NATURALEZA Y ANTECEDENTE
Las partes reconocen que la relación se formaliza como laboral en aplicación del principio de primacía de la realidad (C.P. art. 53; CST art. 23). Se deja constancia de que la prestación del servicio inició el ${inicio}, fecha que se tiene en cuenta para efectos de antigüedad y prestaciones sociales.

TERCERA — REMUNERACIÓN
EL EMPLEADOR pagará un salario mensual de ${salario}${c.salarioIntegral ? " (salario integral, CST art. 132)" : ""}, pagadero por periodos vencidos.

CUARTA — JORNADA
La jornada será de ${c.horasSemana || 42} horas semanales, conforme a la Ley 2101 de 2021 y al Reglamento Interno de Trabajo.

QUINTA — PRESTACIONES Y SEGURIDAD SOCIAL
EL EMPLEADOR afiliará a EL TRABAJADOR al Sistema de Seguridad Social Integral (salud, pensión y riesgos laborales) y reconocerá las prestaciones sociales legales: prima de servicios, cesantías, intereses a las cesantías y vacaciones${c.salarioMensual && c.salarioMensual <= 0 ? "" : ""}.

SEXTA — DURACIÓN
El contrato es a término indefinido y se rige por el Reglamento Interno de Trabajo de EL EMPLEADOR.

SÉPTIMA — LUGAR Y FECHA
Se firma a los ${fmtDate(hoy)}.

EL EMPLEADOR                                   EL TRABAJADOR
${empresa}                                     ${c.empleado || "[nombre del trabajador]"}
                                               C.C. ${c.documento || "[documento]"}

— Borrador generado con Centinela. Requiere revisión y firma del abogado responsable. —`;
}
