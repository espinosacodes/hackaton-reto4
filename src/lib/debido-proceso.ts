import { PasoDebidoProceso } from "./types";

// ─────────────────────────────────────────────────────────────────────────
// Checklist de debido proceso disciplinario
// CN art. 29 · CST art. 115 · Decreto 1072/2015 · CSJ SL1706-2024
// ─────────────────────────────────────────────────────────────────────────

export function checklistDebidoProceso(): PasoDebidoProceso[] {
  return [
    {
      id: "dp-1",
      paso: "Existencia de procedimiento disciplinario en el reglamento interno de trabajo",
      norma: "CST art. 115; Decreto 1072/2015",
      cumplido: null,
      obligatorio: true,
    },
    {
      id: "dp-2",
      paso: "Comunicación escrita y previa de los cargos (pliego de cargos), con hechos, pruebas y normas",
      norma: "CN art. 29; CST art. 115",
      cumplido: null,
      obligatorio: true,
    },
    {
      id: "dp-3",
      paso: "Indicación de la falta y su tipificación en el reglamento o contrato",
      norma: "Principio de legalidad — CN art. 29",
      cumplido: null,
      obligatorio: true,
    },
    {
      id: "dp-4",
      paso: "Plazo razonable entre la citación y la diligencia de descargos",
      norma: "CSJ SL1706-2024",
      cumplido: null,
      obligatorio: true,
    },
    {
      id: "dp-5",
      paso: "Derecho a ser oído en diligencia de descargos",
      norma: "CN art. 29; CST art. 115",
      cumplido: null,
      obligatorio: true,
    },
    {
      id: "dp-6",
      paso: "Derecho a estar acompañado por dos representantes del sindicato o dos compañeros",
      norma: "CST art. 115",
      cumplido: null,
      obligatorio: true,
    },
    {
      id: "dp-7",
      paso: "Oportunidad de presentar y controvertir pruebas",
      norma: "CN art. 29 (derecho de defensa y contradicción)",
      cumplido: null,
      obligatorio: true,
    },
    {
      id: "dp-8",
      paso: "Decisión motivada, proporcional a la falta, y notificada por escrito",
      norma: "CN art. 29; CSJ SL1706-2024",
      cumplido: null,
      obligatorio: true,
    },
    {
      id: "dp-9",
      paso: "Posibilidad de impugnar / doble instancia cuando el reglamento la prevé",
      norma: "CN art. 29",
      cumplido: null,
      obligatorio: false,
    },
    {
      id: "dp-10",
      paso: "Respeto de términos de prescripción de la acción disciplinaria",
      norma: "CST; jurisprudencia CSJ Sala Laboral",
      cumplido: null,
      obligatorio: false,
    },
  ];
}

export function evaluarDebidoProceso(pasos: PasoDebidoProceso[]) {
  const obligatorios = pasos.filter((p) => p.obligatorio);
  const cumplidos = obligatorios.filter((p) => p.cumplido === true).length;
  const incumplidos = obligatorios.filter((p) => p.cumplido === false);
  const pendientes = obligatorios.filter((p) => p.cumplido === null);
  const pct = Math.round((cumplidos / obligatorios.length) * 100);
  const nulidad = incumplidos.length > 0;
  return {
    pct,
    cumplidos,
    totalObligatorios: obligatorios.length,
    incumplidos,
    pendientes,
    nulidad,
    veredicto: nulidad
      ? "Riesgo de NULIDAD del proceso: hay garantías obligatorias incumplidas. Un despido sustentado en este proceso podría declararse ineficaz."
      : pendientes.length > 0
      ? "Proceso en curso: faltan pasos por verificar antes de adoptar una decisión."
      : "El proceso satisface las garantías mínimas del debido proceso.",
  };
}

// Plantilla base de pliego de cargos (estructura conforme a CN art. 29 / CST art. 115).
export interface PliegoInput {
  empresa: string;
  empleado: string;
  cargo: string;
  fechaHechos: string;
  hechos: string;
  faltaReglamento: string;
}

export function generarPliegoBase(p: PliegoInput): string {
  return `PLIEGO DE CARGOS

${p.empresa}
Proceso disciplinario — ${p.empleado} (${p.cargo})

1. IDENTIFICACIÓN DEL TRABAJADOR
   Nombre: ${p.empleado}
   Cargo: ${p.cargo}

2. HECHOS QUE SE IMPUTAN
   El día ${p.fechaHechos}: ${p.hechos}

3. FALTA Y FUNDAMENTO NORMATIVO
   La conducta descrita podría constituir incumplimiento de: ${p.faltaReglamento}
   (Reglamento Interno de Trabajo — CST art. 115).

4. PRUEBAS
   Se relacionan las pruebas que sustentan los cargos [adjuntar].

5. CITACIÓN A DESCARGOS
   Se cita al trabajador a diligencia de descargos, en la que podrá:
   - Rendir su versión y ser oído (CN art. 29).
   - Estar acompañado por dos representantes del sindicato o dos compañeros (CST art. 115).
   - Presentar y controvertir pruebas (derecho de defensa y contradicción).

6. PLAZO
   Se concede un término razonable para preparar la defensa (CSJ SL1706-2024).

— Documento asistido por Centinela. Requiere revisión y firma del abogado responsable. —`;
}
