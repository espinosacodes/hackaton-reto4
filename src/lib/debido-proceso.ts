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
  faltaReglamento: string; // causal invocada (CST art. 62-A) + cita
  normaInterna?: string; // artículo del reglamento interno infringido
  reglamentoNombre?: string; // documento fuente cargado como base normativa interna
}

export function generarPliegoBase(p: PliegoInput): string {
  const fundamentoInterno = p.normaInterna
    ? `   Norma interna infringida: ${p.normaInterna}\n`
    : "";
  const fuente = p.reglamentoNombre
    ? `   Documento fuente: «${p.reglamentoNombre}» (Reglamento Interno de Trabajo — CST art. 115).\n`
    : `   (Reglamento Interno de Trabajo — CST art. 115).\n`;

  return `PLIEGO DE CARGOS

${p.empresa}
Proceso disciplinario — ${p.empleado} (${p.cargo})

1. IDENTIFICACIÓN DEL TRABAJADOR
   Nombre: ${p.empleado}
   Cargo: ${p.cargo}

2. HECHOS QUE SE IMPUTAN
   El día ${p.fechaHechos}: ${p.hechos}

3. FALTA Y FUNDAMENTO NORMATIVO
   Causal invocada: ${p.faltaReglamento}
${fundamentoInterno}${fuente}
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

// ─────────────────────────────────────────────────────────────────────────
// Proceso disciplinario por ETAPAS (art. 115 CST + debido proceso CN art. 29)
// ─────────────────────────────────────────────────────────────────────────

export type EtapaDisciplinaria =
  | "hechos"
  | "citacion"
  | "descargos"
  | "pruebas"
  | "decision"
  | "notificacion";

export interface EtapaInfo {
  key: EtapaDisciplinaria;
  num: number;
  titulo: string;
  descripcion: string;
  norma: string;
  garantias: string[];
  documento?: { label: string; tipo: string };
}

export const ETAPAS: EtapaInfo[] = [
  {
    key: "hechos",
    num: 1,
    titulo: "Hechos / falta presunta",
    descripcion:
      "Identificación de la conducta y su tipificación en el reglamento o contrato; verificación de que la acción disciplinaria no haya prescrito.",
    norma: "Principio de legalidad — CN art. 29",
    garantias: ["Tipificación de la falta en el RIT/contrato", "Acción disciplinaria no prescrita"],
    documento: { label: "Generar redacción de hechos (texto)", tipo: "hechos" },
  },
  {
    key: "citacion",
    num: 2,
    titulo: "Citación a descargos",
    descripcion:
      "Comunicación escrita y previa de los cargos, con hechos, pruebas, norma infringida y fecha/hora/lugar de la diligencia, informando el derecho a estar acompañado.",
    norma: "CST art. 115; CN art. 29",
    garantias: [
      "Comunicación escrita y previa de los cargos",
      "Indicación de la norma infringida",
      "Plazo razonable para preparar la defensa",
    ],
    documento: { label: "Generar situación de descargos (texto)", tipo: "situacion" },
  },
  {
    key: "descargos",
    num: 3,
    titulo: "Diligencia de descargos",
    descripcion:
      "Audiencia en la que el trabajador es oído, puede estar acompañado de dos representantes del sindicato o dos compañeros y rendir su versión.",
    norma: "CST art. 115; CN art. 29",
    garantias: [
      "Derecho a ser oído en descargos",
      "Acompañamiento (2 del sindicato o 2 compañeros)",
    ],
    documento: { label: "Generar acta de descargos", tipo: "acta" },
  },
  {
    key: "pruebas",
    num: 4,
    titulo: "Valoración de pruebas",
    descripcion:
      "Oportunidad de presentar y controvertir pruebas antes de adoptar cualquier decisión.",
    norma: "CN art. 29 (defensa y contradicción)",
    garantias: ["Oportunidad de presentar y controvertir pruebas"],
  },
  {
    key: "decision",
    num: 5,
    titulo: "Decisión",
    descripcion:
      "Decisión motivada y proporcional a la falta: sanción, archivo o terminación del contrato.",
    norma: "CST art. 115; CSJ SL1706-2024",
    garantias: ["Decisión motivada", "Proporcionalidad de la sanción"],
    documento: { label: "Generar decisión motivada", tipo: "decision" },
  },
  {
    key: "notificacion",
    num: 6,
    titulo: "Notificación y recursos",
    descripcion:
      "Notificación por escrito de la decisión y, cuando el reglamento lo prevea, oportunidad de recursos.",
    norma: "CN art. 29",
    garantias: ["Notificación por escrito", "Recursos cuando el RIT los prevea"],
    documento: { label: "Generar notificación", tipo: "notificacion" },
  },
];

export function etapaInfo(key: EtapaDisciplinaria): EtapaInfo {
  return ETAPAS.find((e) => e.key === key) ?? ETAPAS[0];
}

export interface CasoDisciplinario {
  empresa: string;
  empleado: string;
  cargo: string;
  fechaHechos: string;
  hechos: string;
  causalTexto?: string; // causal CST art. 62-A + cita
  normaInterna?: string; // artículo del RIT infringido
  reglamentoNombre?: string; // documento fuente (Perfil)
  fechaDiligencia?: string;
  lugarDiligencia?: string;
  linkDiligencia?: string; // enlace (Zoom/Meet) si la audiencia es virtual — opcional
  preguntasRespuestas?: string; // preguntas y respuestas de la diligencia de descargos
  pruebasAportadas?: boolean; // si el trabajador aportó pruebas en la diligencia
  oportunidadPruebas?: string; // si las pruebas se aportaron oportunamente y su descripción
  decision?: string; // texto de la sanción/archivo
  tipoNotificacion?: "sancion" | "despido"; // qué notifica: sanción o despido con justa causa
}

const PIE = "— Documento asistido por Centinela. Requiere revisión y firma del abogado responsable. —";

// Indenta un bloque de texto libre (preguntas/respuestas, descripción de pruebas)
// para que conserve el formato del documento.
function indentar(texto: string): string {
  return texto
    .trim()
    .split("\n")
    .map((l) => `   ${l}`)
    .join("\n");
}

function fundamento(c: CasoDisciplinario): string {
  const causal = c.causalTexto ? `   Causal invocada: ${c.causalTexto}\n` : "";
  const interna = c.normaInterna ? `   Norma interna infringida: ${c.normaInterna}\n` : "";
  const fuente = c.reglamentoNombre
    ? `   Documento fuente: «${c.reglamentoNombre}» (Reglamento Interno de Trabajo — CST art. 115).\n`
    : `   (Reglamento Interno de Trabajo — CST art. 115).\n`;
  return `${causal}${interna}${fuente}`;
}

/**
 * Rellena una PLANTILLA cargada por la empresa: sustituye los marcadores entre
 * corchetes [ASÍ] por los datos del caso. Lo que no reconoce lo deja intacto
 * (para que el abogado lo complete). `documento` es la cédula del trabajador.
 */
export function rellenarPlantilla(texto: string, c: CasoDisciplinario, documento?: string): string {
  const hoy = new Date().toISOString().slice(0, 10);
  const sancion =
    c.tipoNotificacion === "despido" ? "TERMINACIÓN DEL CONTRATO CON JUSTA CAUSA" : (c.decision || "");
  return texto.replace(/\[([^\]]+)\]/g, (match, inner) => {
    const k = inner.toUpperCase();
    const has = (...ws: string[]) => ws.some((w) => k.includes(w));
    if (has("RAZÓN SOCIAL", "RAZON SOCIAL") || (has("EMPRESA") && !has("TRABAJADOR"))) return c.empresa;
    if (has("NOMBRE") && has("TRABAJADOR")) return c.empleado;
    if (has("CÉDULA", "CEDULA", "NÚMERO DE DOCUMENTO", "NUMERO DE DOCUMENTO") && documento) return documento;
    if (has("CARGO") && has("TRABAJADOR")) return c.cargo;
    if (has("CARGO") && !has("SUSCRIBE")) return c.cargo;
    if (has("RELACIÓN", "RELACION", "HECHOS")) return `El día ${c.fechaHechos}: ${c.hechos}`;
    if (has("FUNDAMENTACIÓN", "FUNDAMENTACION", "NORMAS APLICABLES")) {
      return [c.causalTexto, c.normaInterna].filter(Boolean).join("; ") || match;
    }
    if (has("DESCRIPCIÓN", "DESCRIPCION") && has("SANCIÓN", "SANCION")) return sancion || match;
    if (has("DECISIÓN", "DECISION")) return c.decision || match;
    if (has("FECHA")) return hoy;
    return match; // desconocido: lo deja para que el abogado lo llene
  });
}

/** Genera el documento que corresponde a la etapa indicada. */
export function generarDocumento(tipo: string, c: CasoDisciplinario): string {
  if (tipo === "hechos") return generarHechos(c);
  if (tipo === "situacion") return generarSituacionDescargos(c);
  if (tipo === "citacion") return generarCitacion(c);
  if (tipo === "acta") return generarActaDescargos(c);
  if (tipo === "decision") return generarDecision(c);
  if (tipo === "notificacion") return generarNotificacion(c);
  return generarCitacion(c);
}

/**
 * Etapa 1 — Redacción de los hechos y la falta presunta, en TEXTO editable.
 * El abogado lo lee, lo ajusta y luego lo integra a la situación de descargos.
 */
export function generarHechos(c: CasoDisciplinario): string {
  return `HECHOS Y FALTA PRESUNTA (borrador para revisión)

${c.empresa}
Proceso disciplinario — ${c.empleado} (${c.cargo})

1. RELATO DE LOS HECHOS
   El día ${c.fechaHechos}: ${c.hechos}

2. FALTA PRESUNTA Y FUNDAMENTO
${fundamento(c)}
3. TIPIFICACIÓN (principio de legalidad — CN art. 29)
   Verifique que la conducta esté tipificada como falta en el RIT o el contrato y que la
   acción disciplinaria no haya prescrito antes de continuar con la citación a descargos.

${PIE}`;
}

/**
 * Etapa 2 — «Situación de descargos» en TEXTO: hechos + falta + fundamento.
 * Es el cuerpo que se pone en conocimiento del trabajador; la citación formal
 * (generarCitacion) lo integra junto con la fecha/lugar/enlace de la audiencia.
 */
export function generarSituacionDescargos(c: CasoDisciplinario): string {
  return `SITUACIÓN DE DESCARGOS (texto — revisión del abogado)

${c.empresa}
Señor(a) ${c.empleado} — ${c.cargo}

Se pone en su conocimiento la siguiente situación, respecto de la cual será oído(a) en diligencia de descargos:

1. HECHOS
   El día ${c.fechaHechos}: ${c.hechos}

2. FALTA Y FUNDAMENTO NORMATIVO
${fundamento(c)}
3. GARANTÍAS
   En la diligencia podrá rendir su versión y ser oído(a) (CN art. 29), estar acompañado(a)
   por dos representantes del sindicato o dos compañeros (CST art. 115) y presentar y
   controvertir las pruebas.

${PIE}`;
}

export function generarCitacion(c: CasoDisciplinario): string {
  return `CITACIÓN A DILIGENCIA DE DESCARGOS

${c.empresa}
Señor(a) ${c.empleado} — ${c.cargo}

1. COMUNICACIÓN DE CARGOS
   Por medio de la presente se le comunica que se adelanta un proceso disciplinario en su contra.

2. HECHOS QUE SE IMPUTAN
   El día ${c.fechaHechos}: ${c.hechos}

3. FALTA Y FUNDAMENTO NORMATIVO
${fundamento(c)}
4. CITACIÓN A DESCARGOS
   Se le cita a diligencia de descargos el ${c.fechaDiligencia ?? "[fecha]"} en ${c.lugarDiligencia ?? "[lugar]"}.${
     c.linkDiligencia ? `\n   Enlace de la audiencia (virtual): ${c.linkDiligencia}` : ""
   }
   En ella usted podrá:
   - Rendir su versión y ser oído (CN art. 29).
   - Estar acompañado por dos representantes del sindicato o dos compañeros (CST art. 115).
   - Presentar y controvertir las pruebas.

5. PLAZO
   Se concede un término razonable para preparar la defensa (CSJ SL1706-2024).

${PIE}`;
}

export function generarActaDescargos(c: CasoDisciplinario): string {
  return `ACTA DE DILIGENCIA DE DESCARGOS

${c.empresa}
Proceso disciplinario — ${c.empleado} (${c.cargo})
Fecha de la diligencia: ${c.fechaDiligencia ?? "[fecha]"} · Lugar: ${c.lugarDiligencia ?? "[lugar]"}${
    c.linkDiligencia ? ` · Enlace: ${c.linkDiligencia}` : ""
  }

1. ASISTENTES
   Trabajador: ${c.empleado}
   Acompañante(s) del trabajador: ____________________ (CST art. 115)
   Por la empresa: ____________________

2. HECHOS PUESTOS EN CONOCIMIENTO
   El día ${c.fechaHechos}: ${c.hechos}

3. PREGUNTAS Y RESPUESTAS / VERSIÓN DEL TRABAJADOR (descargos)
${c.preguntasRespuestas ? indentar(c.preguntasRespuestas) : "   ____________________________________________________________"}

4. PRUEBAS APORTADAS / CONTROVERTIDAS
${
    c.oportunidadPruebas
      ? indentar(c.oportunidadPruebas)
      : c.pruebasAportadas === false
        ? "   El trabajador no aportó pruebas en la diligencia."
        : "   ____________________________________________________________"
  }

5. CONSTANCIAS
   Se deja constancia de que se respetó el derecho a ser oído y a estar acompañado.

Firmas: ____________________   ____________________

${PIE}`;
}

export function generarDecision(c: CasoDisciplinario): string {
  return `DECISIÓN MOTIVADA — PROCESO DISCIPLINARIO

${c.empresa}
Señor(a) ${c.empleado} — ${c.cargo}

1. ANTECEDENTES
   Hechos (${c.fechaHechos}): ${c.hechos}
   Se surtió la citación, la diligencia de descargos y la valoración de pruebas.

2. FUNDAMENTO
${fundamento(c)}
3. DECISIÓN
   ${c.decision ?? "[Sanción proporcional a la falta / archivo del proceso — describir y motivar]"}

4. MOTIVACIÓN Y PROPORCIONALIDAD
   La decisión es motivada y proporcional a la gravedad de la falta, los antecedentes del trabajador
   y las circunstancias (CST art. 115; CSJ SL1706-2024).

5. RECURSOS
   Contra esta decisión proceden los recursos que prevea el Reglamento Interno de Trabajo.

${PIE}`;
}

export function generarNotificacion(c: CasoDisciplinario): string {
  const esDespido = c.tipoNotificacion === "despido";
  const titulo = esDespido
    ? "NOTIFICACIÓN DE TERMINACIÓN DEL CONTRATO CON JUSTA CAUSA"
    : "NOTIFICACIÓN DE SANCIÓN DISCIPLINARIA";
  const cuerpo = esDespido
    ? `Por medio de la presente se le NOTIFICA la decisión de DAR POR TERMINADO su contrato de trabajo
con JUSTA CAUSA, adoptada dentro del proceso disciplinario relacionado con los hechos del ${c.fechaHechos},
una vez surtidas la citación, la diligencia de descargos y la valoración de pruebas.

Causa de la terminación:
${fundamento(c)}
Decisión: ${c.decision ?? "[resumen de la decisión de terminación con justa causa]"}`
    : `Por medio de la presente se le NOTIFICA la SANCIÓN DISCIPLINARIA adoptada dentro del proceso
relacionado con los hechos del ${c.fechaHechos}, una vez surtidas la citación, la diligencia de
descargos y la valoración de pruebas.

Fundamento:
${fundamento(c)}
Decisión: ${c.decision ?? "[resumen de la sanción impuesta]"}`;

  // Cláusula de recursos: SIEMPRE debe informarse la posibilidad de impugnar (CN art. 29).
  return `${titulo}

${c.empresa}
Señor(a) ${c.empleado} — ${c.cargo}

${cuerpo}

RECURSOS
   Se le informa que, conforme al Reglamento Interno de Trabajo y al debido proceso (CN art. 29),
   podrá interponer los recursos o apelaciones que el reglamento prevea dentro del término establecido.

Fecha de notificación: ____________________
Firma del trabajador (recibido): ____________________

${PIE}`;
}
