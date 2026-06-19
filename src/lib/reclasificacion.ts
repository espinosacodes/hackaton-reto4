import {
  Contrato,
  ReclasificacionResultado,
  SubordinacionSenales,
  BucketSenal,
  ContradiccionContrato,
  ClausulaContrato,
  ConceptoElemento,
  ExposicionReclasificacion,
} from "./types";
import { liquidar, PARAMS_2026 } from "./liquidacion";
import { calcularAportes } from "./aportes";
import { cop } from "./utils";
import { HOY } from "./data/contratos";

// ─────────────────────────────────────────────────────────────────────────
// Reclasificación — CONTRATO REALIDAD (primacía de la realidad, CP art. 53,
// CST arts. 23–24) + subordinación algorítmica (Ley 2466/2025).
//
// El servicio NO analiza el papel: analiza cómo se OPERA la relación.
// Tres fuentes de evidencia (de mayor a menor fuerza):
//   1. Datos objetivos que la empresa ya tiene (huellas duras, "estilo UGPP").
//   2. Cuestionario operativo neutral: hechos que responde RRHH; el sistema infiere.
//   3. El contrato, solo para marcar la CONTRADICCIÓN con la realidad.
// Resultado: "se opera como laboral aunque el papel diga lo contrario → exposición $X".
// Herramienta de apoyo: la calificación final es del abogado y, en última instancia, del juez.
// ─────────────────────────────────────────────────────────────────────────

export interface SenalRealidad {
  key: keyof SubordinacionSenales;
  pregunta: string; // formulada como HECHO neutral (no pide un juicio jurídico)
  bucket: BucketSenal;
  elemento: string; // elemento del art. 23 que ayuda a probar
  peso: number;
  norma: string;
}

// Pesos: los datos objetivos pesan más (son prueba dura difícil de desvirtuar).
export const SENALES: SenalRealidad[] = [
  // ── Datos objetivos (la empresa ya los tiene) ──
  { key: "pagoFijoPeriodico", pregunta: "Le pagan el mismo monto el mismo día cada mes (igual que la nómina)", bucket: "dato_objetivo", elemento: "Remuneración", peso: 16, norma: "CST art. 23.c" },
  { key: "registraJornada", pregunta: "Registra entrada y salida (control de asistencia / biométrico)", bucket: "dato_objetivo", elemento: "Subordinación", peso: 14, norma: "CST art. 23.b" },
  { key: "enOrganigrama", pregunta: "Aparece en el organigrama o en evaluaciones de desempeño", bucket: "dato_objetivo", elemento: "Subordinación", peso: 12, norma: "CST art. 23.b" },
  { key: "exclusividad", pregunta: "Trabaja solo para la empresa (sin otros clientes)", bucket: "dato_objetivo", elemento: "Exclusividad", peso: 12, norma: "CST art. 23" },
  { key: "correoEquipoCorporativo", pregunta: "Tiene correo, usuario o equipos de la empresa", bucket: "dato_objetivo", elemento: "Ajenidad", peso: 10, norma: "CST art. 23" },
  { key: "continuidad", pregunta: "Lleva años seguidos prestando el servicio (relación prolongada)", bucket: "dato_objetivo", elemento: "Continuidad", peso: 10, norma: "CST art. 23.c" },
  // ── Cuestionario operativo neutral (hechos que responde RRHH) ──
  { key: "leDefinenHorario", pregunta: "La empresa le define el horario de trabajo", bucket: "cuestionario", elemento: "Subordinación", peso: 12, norma: "CST art. 23.b" },
  { key: "reportaAJefe", pregunta: "Reporta a un jefe que le da instrucciones", bucket: "cuestionario", elemento: "Subordinación", peso: 12, norma: "CST art. 23.b" },
  { key: "empresaAsignaTareas", pregunta: "Le indican qué hacer, cómo y cuándo", bucket: "cuestionario", elemento: "Subordinación", peso: 10, norma: "CST art. 23.b" },
  { key: "laborDelGiro", pregunta: "Cumple una labor permanente, propia del giro del negocio", bucket: "cuestionario", elemento: "Ajenidad", peso: 10, norma: "CST art. 23" },
  { key: "herramientasEmpleador", pregunta: "La empresa le da las herramientas o insumos", bucket: "cuestionario", elemento: "Ajenidad", peso: 8, norma: "CST art. 23" },
  { key: "pidePermisos", pregunta: "Pide permiso para ausentarse o tomar vacaciones", bucket: "cuestionario", elemento: "Subordinación", peso: 8, norma: "CST art. 23.b" },
  // ── Subordinación algorítmica — plataformas (Ley 2466/2025) ──
  { key: "asignacionAlgoritmica", pregunta: "Un algoritmo le asigna las tareas / rutas", bucket: "algoritmica", elemento: "Subordinación algorítmica", peso: 14, norma: "Ley 2466/2025" },
  { key: "penalizacionRechazos", pregunta: "Lo penalizan si rechaza tareas", bucket: "algoritmica", elemento: "Subordinación algorítmica", peso: 12, norma: "Ley 2466/2025" },
  { key: "calificacionPlataforma", pregunta: "Lo evalúan por calificación de la plataforma", bucket: "algoritmica", elemento: "Subordinación algorítmica", peso: 8, norma: "Ley 2466/2025" },
  { key: "geolocalizacion", pregunta: "Lo controlan por geolocalización en tiempo real", bucket: "algoritmica", elemento: "Subordinación algorítmica", peso: 8, norma: "Ley 2466/2025" },
];

// ── Helpers de fecha (estimación; el área contable valida) ────────────────────
function mesesEntre(desde: string, hasta: string): number {
  const [ay, am] = desde.split("-").map(Number);
  const [by, bm] = hasta.split("-").map(Number);
  return Math.max(0, (by - ay) * 12 + (bm - am));
}

function restarMeses(fecha: string, n: number): string {
  const [y, m, d] = fecha.split("-").map(Number);
  const total = y * 12 + (m - 1) - n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const PARAFISCAL_CAJA = 0.04; // Caja de compensación (Ley 21/1982) — siempre aplica
const PARAFISCAL_SENA_ICBF = 0.05; // SENA 2% + ICBF 3% (exonerable, Ley 1819/2016)
const TOPE_MORA_MESES = 24; // sanción moratoria art. 65: tope antes de convertirse en intereses
const PRESCRIPCION_MESES = 36; // prescripción 3 años (CST arts. 488–489)

/**
 * Exposición en PESOS si un juez reclasifica la relación a contrato laboral.
 * Reutiliza los motores deterministas de liquidación y aportes (cada rubro
 * muestra su norma). La probabilidad pondera el "valor esperado".
 */
export function calcularExposicion(
  c: Contrato,
  hoy: string,
  params = PARAMS_2026,
  probabilidad: number
): ExposicionReclasificacion {
  const mesesRel = mesesEntre(c.fechaInicio, hoy);
  const mesesExpuestos = Math.min(mesesRel, PRESCRIPCION_MESES);
  const fechaDesde = restarMeses(hoy, mesesExpuestos);

  // Tratado como contrato laboral dentro de la ventana no prescrita.
  const cLab: Contrato = {
    ...c,
    fechaInicio: fechaDesde,
    salarioIntegral: false,
    auxilioTransporte: c.salarioMensual <= 2 * params.smmlv,
    ultimasVacacionesTomadas: undefined,
  };

  // 1. Prestaciones sociales retroactivas (cesantías + intereses + prima + vacaciones), sin indemnización.
  const liq = liquidar(cLab, hoy, "renuncia", params, "acumulado");
  const prestaciones = liq.total;

  // 2. Seguridad social no pagada (salud + pensión + ARL) mensual × meses.
  const ap = calcularAportes(cLab, params);
  const segSocial = ap.totalSeguridadSocial * mesesExpuestos;

  // 3. Parafiscales.
  const caja = Math.round(ap.ibc * PARAFISCAL_CAJA * mesesExpuestos);
  const senaIcbf = Math.round(ap.ibc * PARAFISCAL_SENA_ICBF * mesesExpuestos);

  // 4. Sanción moratoria (art. 65 CST): a la terminación, 1 día de salario por día de mora (tope 24 meses).
  const sancion = Math.round(c.salarioMensual * TOPE_MORA_MESES);

  const rubros = [
    {
      concepto: "Prestaciones sociales retroactivas",
      valor: prestaciones,
      detalle: `Cesantías, intereses, prima y vacaciones · ${mesesExpuestos} meses (ventana no prescrita)`,
      norma: "CST 249–252, 306–307, 186; Ley 52/1975",
    },
    {
      concepto: "Seguridad social no pagada",
      valor: segSocial,
      detalle: `Salud + pensión + ARL · ${cop(ap.totalSeguridadSocial)}/mes × ${mesesExpuestos}`,
      norma: "Ley 100/1993",
    },
    {
      concepto: "Caja de compensación",
      valor: caja,
      detalle: `4% sobre IBC × ${mesesExpuestos} meses`,
      norma: "Ley 21/1982",
    },
    {
      concepto: "SENA e ICBF",
      valor: senaIcbf,
      detalle: `5% sobre IBC × ${mesesExpuestos} meses (puede no aplicar por exoneración Ley 1819/2016 si <10 SMMLV)`,
      norma: "Ley 89/1988; Ley 119/1994",
    },
    {
      concepto: "Sanción moratoria (potencial)",
      valor: sancion,
      detalle: `1 día de salario por día de mora a la terminación, hasta ${TOPE_MORA_MESES} meses`,
      norma: "CST art. 65",
    },
  ];

  const montoMaximo = rubros.reduce((s, r) => s + r.valor, 0);
  const exposicionEsperada = Math.round((montoMaximo * probabilidad) / 100);
  return { rubros, montoMaximo, exposicionEsperada, mesesExpuestos };
}

function detectarContradicciones(c: Contrato, s: SubordinacionSenales): ContradiccionContrato[] {
  if (c.tipo !== "prestacion_servicios" && c.tipo !== "plataforma") return [];
  const out: ContradiccionContrato[] = [];

  if (s.registraJornada || s.leDefinenHorario || s.reportaAJefe || s.empresaAsignaTareas) {
    out.push({
      contratoDice: "Autonomía e independencia, sin horario ni subordinación (cláusula típica del contrato de prestación de servicios)",
      realidadMuestra: "Cumple horario, marca asistencia o recibe instrucciones de un superior",
      severidad: "alta",
    });
  }
  if (s.exclusividad) {
    out.push({
      contratoDice: "El contratista puede prestar sus servicios a otros clientes",
      realidadMuestra: "Trabaja en exclusividad para la empresa",
      severidad: "alta",
    });
  }
  if (s.pagoFijoPeriodico) {
    out.push({
      contratoDice: "Honorarios por entregable o contra factura",
      realidadMuestra: "Recibe un pago fijo y periódico, igual que la nómina",
      severidad: "media",
    });
  }
  if (s.herramientasEmpleador || s.correoEquipoCorporativo) {
    out.push({
      contratoDice: "El contratista aporta sus propios medios y herramientas",
      realidadMuestra: "Usa correo, equipos o herramientas de la empresa",
      severidad: "media",
    });
  }
  if (s.laborDelGiro) {
    out.push({
      contratoDice: "Servicio temporal y especializado, ajeno al giro ordinario",
      realidadMuestra: "Cumple una labor permanente, propia del giro del negocio",
      severidad: "media",
    });
  }
  return out;
}

// Clausulado típico de un contrato civil de prestación de servicios (extracto):
// son las "promesas" de independencia que la realidad operativa suele desmentir.
const CLAUSULAS_BASE: { eje: ClausulaContrato["eje"]; texto: string; destacar: string }[] = [
  {
    eje: "objeto",
    texto:
      "PRIMERA. Objeto. EL CONTRATISTA prestará sus servicios de forma autónoma e independiente, con plena libertad técnica, administrativa y directiva, sin subordinación ni dependencia respecto de EL CONTRATANTE.",
    destacar: "sin subordinación ni dependencia",
  },
  {
    eje: "horario",
    texto:
      "SEGUNDA. Autonomía. EL CONTRATISTA no estará sujeto a horario ni a jornada de trabajo y organizará su tiempo con plena independencia.",
    destacar: "no estará sujeto a horario ni a jornada de trabajo",
  },
  {
    eje: "remuneracion",
    texto:
      "TERCERA. Honorarios. EL CONTRATANTE pagará honorarios contra la presentación de factura o cuenta de cobro por los entregables efectivamente realizados.",
    destacar: "contra la presentación de factura o cuenta de cobro",
  },
  {
    eje: "exclusividad",
    texto:
      "CUARTA. No exclusividad. EL CONTRATISTA podrá prestar sus servicios a terceros, sin que exista relación de exclusividad con EL CONTRATANTE.",
    destacar: "podrá prestar sus servicios a terceros",
  },
  {
    eje: "medios",
    texto:
      "QUINTA. Medios propios. EL CONTRATISTA ejecutará la labor con sus propios medios, herramientas y equipos, asumiendo los riesgos de su actividad.",
    destacar: "con sus propios medios, herramientas y equipos",
  },
];

/** Extracto del contrato con las cláusulas que la realidad operativa contradice. */
function evaluarClausulas(c: Contrato, s: SubordinacionSenales): ClausulaContrato[] {
  if (c.tipo !== "prestacion_servicios" && c.tipo !== "plataforma") return [];
  const haySubordinacion =
    s.registraJornada || s.leDefinenHorario || s.reportaAJefe || s.empresaAsignaTareas || s.pidePermisos || s.enOrganigrama;
  return CLAUSULAS_BASE.map((cl) => {
    let contradicha = false;
    let realidad: string | undefined;
    switch (cl.eje) {
      case "objeto":
        contradicha = Boolean(haySubordinacion || s.laborDelGiro);
        if (contradicha) realidad = "En la práctica la empresa dirige y controla la prestación (subordinación).";
        break;
      case "horario":
        contradicha = Boolean(s.leDefinenHorario || s.registraJornada);
        if (contradicha) realidad = "Cumple un horario definido por la empresa y/o registra entrada y salida.";
        break;
      case "remuneracion":
        contradicha = Boolean(s.pagoFijoPeriodico);
        if (contradicha) realidad = "Recibe un pago fijo y periódico, igual que la nómina (no honorarios por entregable).";
        break;
      case "exclusividad":
        contradicha = Boolean(s.exclusividad);
        if (contradicha) realidad = "Trabaja en exclusividad para la empresa.";
        break;
      case "medios":
        contradicha = Boolean(s.herramientasEmpleador || s.correoEquipoCorporativo);
        if (contradicha) realidad = "Usa correo, equipos o herramientas de la empresa.";
        break;
    }
    return { ...cl, contradicha, realidad };
  });
}

function construirConcepto(s: SubordinacionSenales, algoritmica: boolean): ConceptoElemento[] {
  const subord =
    s.registraJornada || s.leDefinenHorario || s.reportaAJefe || s.empresaAsignaTareas || s.pidePermisos || s.enOrganigrama || algoritmica;
  const remun = Boolean(s.pagoFijoPeriodico);
  const ajenidad = Boolean(s.laborDelGiro || s.herramientasEmpleador || s.correoEquipoCorporativo || s.exclusividad);
  return [
    {
      elemento: "Prestación personal del servicio (CST art. 23.a)",
      presente: true,
      hallazgo: "El servicio lo presta directamente una persona natural.",
    },
    {
      elemento: "Subordinación y dependencia continuada (CST art. 23.b)",
      presente: Boolean(subord),
      hallazgo: subord
        ? "Hay horario, instrucciones, reporte a un superior o control (incluido el algorítmico): el elemento decisivo del vínculo laboral."
        : "No se observan señales claras de subordinación.",
    },
    {
      elemento: "Remuneración como contraprestación (CST art. 23.c)",
      presente: remun,
      hallazgo: remun
        ? "El pago es fijo y periódico, equivalente a un salario."
        : "El pago es variable por entregable (consistente con honorarios).",
    },
    {
      elemento: "Ajenidad e integración a la empresa",
      presente: ajenidad,
      hallazgo: ajenidad
        ? "Usa medios de la empresa y cumple una labor del giro del negocio."
        : "Aporta sus propios medios; la labor es ajena al giro ordinario.",
    },
  ];
}

/**
 * Evalúa el riesgo de contrato realidad de una relación, a partir de cómo SE OPERA.
 * Determinista y explicable: cada señal aporta peso y se puede auditar.
 */
export function evaluarReclasificacion(
  c: Contrato,
  hoy: string = HOY,
  params = PARAMS_2026
): ReclasificacionResultado {
  const s = c.subordinacion ?? {};
  let puntaje = 0;
  let algoritmica = false;
  const indicios = SENALES.map((sn) => {
    const presente = Boolean(s[sn.key]);
    if (presente) {
      puntaje += sn.peso;
      if (sn.bucket === "algoritmica") algoritmica = true;
    }
    return { senal: sn.pregunta, presente, peso: sn.peso, norma: sn.norma, bucket: sn.bucket };
  });

  // Plataformas de reparto: presunción legal de vínculo (Ley 2466/2025).
  if (c.tipo === "plataforma") {
    puntaje = Math.max(puntaje, 60);
    algoritmica = true;
  }
  puntaje = Math.min(puntaje, 100);

  const nivel = puntaje >= 60 ? "alto" : puntaje >= 35 ? "medio" : "bajo";
  const probabilidad = Math.min(95, Math.max(5, Math.round(puntaje * 0.9) + (algoritmica ? 5 : 0)));

  const contradicciones = detectarContradicciones(c, s);
  const clausulas = evaluarClausulas(c, s);
  const exposicion = calcularExposicion(c, hoy, params, probabilidad);
  const conceptoPorElemento = construirConcepto(s, algoritmica);

  const conclusion =
    nivel === "alto"
      ? `Esta relación se OPERA como un contrato laboral aunque el papel diga lo contrario. Los datos objetivos y la operación evidencian subordinación; ante un juez se configuraría contrato realidad. Exposición estimada: ${cop(exposicion.exposicionEsperada)} (máx. ${cop(exposicion.montoMaximo)}).`
      : nivel === "medio"
      ? `Riesgo moderado: hay señales de subordinación que deben mitigarse o documentarse para sostener la naturaleza civil. Exposición estimada: ${cop(exposicion.exposicionEsperada)}.`
      : "Riesgo bajo: la operación es consistente con un contrato de prestación de servicios verdaderamente independiente.";

  return {
    contratoId: c.id,
    empleado: c.empleado,
    puntaje,
    nivel,
    probabilidad,
    algoritmica,
    indicios,
    contradicciones,
    clausulas,
    exposicion,
    conceptoPorElemento,
    conclusion,
  };
}

/**
 * Autodetección DETERMINISTA: infiere las señales presentes a partir de una
 * descripción libre de cómo opera la relación (respaldo sin IA; la ruta
 * /api/reclasificacion-ia usa un LLM cuando hay API key y cae a esto si no).
 */
export function inferirSenalesDeTexto(texto: string): SubordinacionSenales {
  const t = texto.toLowerCase();
  const has = (...ws: string[]) => ws.some((w) => t.includes(w));
  return {
    leDefinenHorario: has("horario", "de lunes a viernes", "de 8", "jornada", "turno"),
    registraJornada: has("marca", "registr", "biom", "entrada y salida", "asistencia", "huella"),
    reportaAJefe: has("jefe", "reporta", "supervis", "coordinador", "su superior", "le rinde"),
    empresaAsignaTareas: has("le asignan", "le indican", "instruc", "órdenes", "ordenes", "le dicen"),
    pagoFijoPeriodico: has("fijo", "mensual", "misma fecha", "cada mes", "quincenal", "nómina", "nomina"),
    exclusividad: has("exclusiv", "solo para", "únicamente", "unicamente", "no puede trabajar"),
    continuidad: has(" años", " anos", "lleva ", "continu", "permanente", "desde hace"),
    herramientasEmpleador: has("herramient", "le da el equipo", "le entrega", "insumo", "le da computador"),
    correoEquipoCorporativo: has("correo", "@", "usuario", "credencial", "equipo de la empresa", "portátil de la empresa"),
    enOrganigrama: has("organigrama", "evaluación de desempeño", "evaluacion de desempeno", "evaluaciones", "hace parte del equipo"),
    laborDelGiro: has("permanente", "parte del", "giro", "core", "misma labor", "todos los días", "todos los dias"),
    pidePermisos: has("permiso", "autoriza", "le aprueban", "solicita vacaciones"),
  };
}
