// ─────────────────────────────────────────────────────────────────────────
// Justas causas de terminación unilateral por el EMPLEADOR
// CST art. 62, literal A (15 causales)
// Parágrafo: las causales 9 a 15 requieren aviso previo no menor a 15 días.
// ─────────────────────────────────────────────────────────────────────────

export interface JustaCausa {
  id: string;
  causal: string;
  /** Aviso previo de 15 días (CST art. 62, parágrafo — causales 9 a 15). */
  avisoPrevio: boolean;
}

export const JUSTAS_CAUSAS_EMPLEADOR: JustaCausa[] = [
  { id: "A1", causal: "Engaño mediante certificados falsos para la admisión o para obtener provecho indebido", avisoPrevio: false },
  { id: "A2", causal: "Violencia, injuria, malos tratos o grave indisciplina en sus labores (contra el empleador, su familia, directivos o compañeros)", avisoPrevio: false },
  { id: "A3", causal: "Violencia, injuria o malos tratos graves fuera del servicio (contra el empleador, su familia, representantes o socios)", avisoPrevio: false },
  { id: "A4", causal: "Daño material intencional a edificios, obras, maquinaria o materias primas, o grave negligencia que ponga en peligro personas o cosas", avisoPrevio: false },
  { id: "A5", causal: "Acto inmoral o delictuoso en el lugar de trabajo o en el desempeño de las labores", avisoPrevio: false },
  { id: "A6", causal: "Violación grave de obligaciones o prohibiciones (CST arts. 58 y 60) o falta grave calificada en pacto, convención, laudo, contrato o reglamento", avisoPrevio: false },
  { id: "A7", causal: "Detención preventiva por más de 30 días (salvo absolución) o arresto correccional mayor a 8 días", avisoPrevio: false },
  { id: "A8", causal: "Revelar secretos técnicos o comerciales, o asuntos reservados, con perjuicio para la empresa", avisoPrevio: false },
  { id: "A9", causal: "Deficiente rendimiento no corregido en plazo razonable pese al requerimiento del empleador", avisoPrevio: true },
  { id: "A10", causal: "Inejecución sistemática, sin razones válidas, de obligaciones legales o convencionales", avisoPrevio: true },
  { id: "A11", causal: "Todo vicio del trabajador que perturbe la disciplina del establecimiento", avisoPrevio: true },
  { id: "A12", causal: "Renuencia sistemática a aceptar medidas preventivas, profilácticas o curativas prescritas", avisoPrevio: true },
  { id: "A13", causal: "Ineptitud del trabajador para realizar la labor encomendada", avisoPrevio: true },
  { id: "A14", causal: "Reconocimiento de pensión de jubilación o invalidez estando al servicio de la empresa", avisoPrevio: true },
  { id: "A15", causal: "Enfermedad contagiosa o crónica no profesional, o lesión incapacitante, no curada en 180 días", avisoPrevio: true },
];
