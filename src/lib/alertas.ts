import { Alerta, Contrato } from "./types";
import { daysBetween, addDays, toISO } from "./utils";
import { PARAMS_2026 } from "./liquidacion";

// Ventanas de alerta (días).
const PREAVISO_FIJO = 30; // CST art. 46 — preaviso de no renovación
const VAC_LIMITE = 360; // vacaciones deben concederse dentro del año siguiente
const SS_LIMITE = 30; // periodicidad mensual de aportes
const HORAS_2101 = 42; // Ley 2101/2021 (vigencia plena 2026)

/** Motor de alertas determinista basado en fechas y parámetros del contrato. */
export function generarAlertas(contratos: Contrato[], hoy: string): Alerta[] {
  const alertas: Alerta[] = [];

  for (const c of contratos) {
    if (c.estado !== "activo") continue;

    // 1a. Término fijo: vencimiento y preaviso de no renovación (CST art. 46)
    if (c.tipo === "fijo" && c.fechaFin) {
      const dias = daysBetween(hoy, c.fechaFin);
      if (dias <= PREAVISO_FIJO) {
        const preavisoLimite = toISO(addDays(c.fechaFin, -PREAVISO_FIJO));
        const vencidoPreaviso = daysBetween(hoy, preavisoLimite) < 0;
        alertas.push({
          id: `${c.id}-venc`,
          contratoId: c.id,
          empleado: c.empleado,
          tipo: vencidoPreaviso ? "preaviso_no_renovacion" : "vencimiento_contrato",
          severidad: dias <= 0 ? "critica" : vencidoPreaviso ? "alta" : "media",
          titulo: vencidoPreaviso
            ? "Preaviso de no renovación vencido"
            : `Contrato a término fijo vence en ${dias} días`,
          detalle: vencidoPreaviso
            ? `El preaviso de 30 días venció el ${preavisoLimite}. Sin preaviso oportuno el contrato se prorroga automáticamente por un periodo igual.`
            : `El contrato finaliza el ${c.fechaFin}. Defina renovación o terminación con preaviso de 30 días.`,
          norma: "CST art. 46",
          diasRestantes: dias,
          accion: vencidoPreaviso
            ? "Asumir la prórroga o documentar la terminación inmediatamente; evaluar indemnización."
            : "Notificar por escrito la decisión de renovar o no renovar.",
        });
      }
    }

    // 1b. Obra o labor: termina al concluir la obra, sin preaviso ni prórroga (CST art. 45)
    if (c.tipo === "obra_labor" && c.fechaFin) {
      const dias = daysBetween(hoy, c.fechaFin);
      if (dias <= PREAVISO_FIJO) {
        alertas.push({
          id: `${c.id}-venc`,
          contratoId: c.id,
          empleado: c.empleado,
          tipo: "vencimiento_contrato",
          severidad: dias <= 0 ? "critica" : "media",
          titulo:
            dias <= 0
              ? "Obra o labor concluida — formalizar terminación"
              : `Obra o labor finaliza en ~${dias} días`,
          detalle:
            "El contrato por duración de obra o labor termina al concluir la obra pactada, sin preaviso de 30 días ni prórroga automática. Documente la culminación y liquide.",
          norma: "CST art. 45",
          diasRestantes: dias,
          accion: "Verificar la conclusión de la obra y preparar la liquidación.",
        });
      }
    }

    // 2. Vacaciones acumuladas / vencidas
    if (c.ultimasVacacionesTomadas) {
      const transcurridos = daysBetween(c.ultimasVacacionesTomadas, hoy);
      if (transcurridos > VAC_LIMITE || (c.diasVacacionesPendientes ?? 0) >= 15) {
        const vencidas = transcurridos > VAC_LIMITE;
        alertas.push({
          id: `${c.id}-vac`,
          contratoId: c.id,
          empleado: c.empleado,
          tipo: "vacaciones_vencidas",
          severidad: vencidas ? "alta" : "media",
          titulo: vencidas
            ? `Vacaciones vencidas (${c.diasVacacionesPendientes ?? 0} días acumulados)`
            : `Vacaciones acumuladas: ${c.diasVacacionesPendientes ?? 0} días`,
          detalle: `Último disfrute: ${c.ultimasVacacionesTomadas}. Las vacaciones deben concederse a más tardar dentro del año siguiente a su causación.`,
          norma: "CST arts. 187, 190",
          diasRestantes: VAC_LIMITE - transcurridos,
          accion: "Programar el disfrute; acumular más de un periodo genera contingencia y riesgo de compensación en dinero.",
        });
      }
    }

    // 3. Mora en seguridad social
    if (c.ultimoPagoSeguridadSocial) {
      const dias = daysBetween(c.ultimoPagoSeguridadSocial, hoy);
      if (dias > SS_LIMITE) {
        alertas.push({
          id: `${c.id}-ss`,
          contratoId: c.id,
          empleado: c.empleado,
          tipo: "seguridad_social",
          severidad: "critica",
          titulo: `Posible mora en seguridad social (${dias} días)`,
          detalle: `Último aporte registrado: ${c.ultimoPagoSeguridadSocial}. La mora genera sanciones, intereses y traslado del riesgo de salud/pensión al empleador.`,
          norma: "Ley 100/1993; Decreto 1072/2015",
          diasRestantes: SS_LIMITE - dias,
          accion: "Verificar y regularizar la PILA del periodo inmediatamente.",
        });
      }
    }

    // 4. Jornada — Ley 2101/2021 (42h en 2026)
    if (c.horasSemana > HORAS_2101) {
      alertas.push({
        id: `${c.id}-jornada`,
        contratoId: c.id,
        empleado: c.empleado,
        tipo: "jornada_2101",
        severidad: "alta",
        titulo: `Jornada de ${c.horasSemana}h excede el máximo legal (42h)`,
        detalle: `Desde 2026 la jornada máxima es de 42 horas semanales. El exceso debe remunerarse como trabajo suplementario.`,
        norma: "Ley 2101/2021",
        accion: "Ajustar la jornada a 42h o liquidar y pagar horas extra; actualizar el contrato.",
      });
    }

    // 5. Riesgo de reclasificación (señal temprana para civiles/plataforma)
    if (c.tipo === "prestacion_servicios" || c.tipo === "plataforma") {
      alertas.push({
        id: `${c.id}-recla`,
        contratoId: c.id,
        empleado: c.empleado,
        tipo: "reclasificacion",
        severidad: c.tipo === "plataforma" ? "alta" : "media",
        titulo:
          c.tipo === "plataforma"
            ? "Trabajador de plataforma — revisar Ley 2466/2025"
            : "Contrato civil con posibles indicios de subordinación",
        detalle:
          c.tipo === "plataforma"
            ? "La Ley 2466/2025 creó un régimen especial para trabajadores de plataformas (modalidad dependiente o independiente); su vigencia está diferida a la reglamentación del Gobierno. Evalúe la subordinación, incluida la algorítmica."
            : "La continuidad y dependencia pueden configurar contrato realidad (primacía de la realidad).",
        norma: c.tipo === "plataforma" ? "Ley 2466/2025 arts. 24–30" : "CST art. 23; CP art. 53",
        accion: "Ejecutar el test de reclasificación y documentar la independencia o formalizar el vínculo.",
      });
    }

    // 6. Reforma laboral Ley 2466/2025 — avisos informativos por modalidad
    if (c.tipo === "fijo" || c.tipo === "obra_labor") {
      alertas.push({
        id: `${c.id}-2466`,
        contratoId: c.id,
        empleado: c.empleado,
        tipo: "reforma_2466",
        severidad: "info",
        titulo:
          c.tipo === "fijo"
            ? "Término fijo: tope de 4 años y regla del indefinido (Ley 2466/2025)"
            : "Obra o labor: debe constar por escrito con descripción precisa (Ley 2466/2025)",
        detalle:
          c.tipo === "fijo"
            ? "La reforma fija un tope de 4 años (incluidas prórrogas) y consagra el contrato indefinido como regla general; el uso del término fijo debe justificarse. Transición: contratos vigentes al 25/06/2025 hasta el 25/06/2029."
            : "El contrato por obra o labor debe constar por escrito describiendo de forma precisa la obra; de lo contrario se arriesga la reclasificación a indefinido.",
        norma: "CST art. 46 (mod. Ley 2466/2025)",
        accion: "Verificar duración acumulada y formalización; evaluar conversión a término indefinido.",
      });
    }
    if (c.tipo === "aprendizaje") {
      alertas.push({
        id: `${c.id}-2466`,
        contratoId: c.id,
        empleado: c.empleado,
        tipo: "reforma_2466",
        severidad: "info",
        titulo: "Aprendizaje: ahora es contrato laboral especial (Ley 2466/2025)",
        detalle:
          "El contrato de aprendizaje dejó de ser una relación no laboral: 75% del SMLMV en fase lectiva y 100% en fase práctica, con prestaciones y afiliación a seguridad social. Revise remuneración y afiliaciones.",
        norma: "Ley 2466/2025 art. 21; Decreto 223/2026",
        accion: "Ajustar la remuneración y las afiliaciones del aprendiz al nuevo régimen.",
      });
    }
  }

  // Orden por severidad y urgencia.
  const peso = { critica: 0, alta: 1, media: 2, info: 3 } as const;
  return alertas.sort((a, b) => {
    if (peso[a.severidad] !== peso[b.severidad]) return peso[a.severidad] - peso[b.severidad];
    return (a.diasRestantes ?? 999) - (b.diasRestantes ?? 999);
  });
}

export const PARAMS = PARAMS_2026;
