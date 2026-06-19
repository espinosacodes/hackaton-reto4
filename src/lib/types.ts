// ─────────────────────────────────────────────────────────────────────────
// Domain model — Compliance laboral colombiano (Reto 4)
// ─────────────────────────────────────────────────────────────────────────

export type TipoContrato =
  | "indefinido" // término indefinido (CST art. 47)
  | "fijo" // término fijo (CST art. 46)
  | "obra_labor" // por duración de obra o labor (CST art. 45)
  | "prestacion_servicios" // contrato civil — riesgo de reclasificación
  | "aprendizaje" // contrato de aprendizaje (Ley 789/2002)
  | "plataforma"; // trabajador de plataforma digital (Ley 2466/2025)

export type TipoJornada =
  | "completa" // 42h/sem (Ley 2101/2021, vigencia plena 2026)
  | "parcial"
  | "por_horas";

export type EstadoContrato = "activo" | "terminado" | "suspendido";

export interface Contrato {
  id: string;
  empleado: string;
  documento: string;
  cargo: string;
  area: string;
  tipo: TipoContrato;
  jornada: TipoJornada;
  horasSemana: number;
  salarioMensual: number; // salario básico
  auxilioTransporte: boolean; // aplica si salario <= 2 SMMLV
  salarioIntegral: boolean; // CST art. 132 (>= 13 SMMLV)
  fechaInicio: string; // ISO yyyy-mm-dd
  fechaFin?: string; // sólo término fijo / obra labor
  estado: EstadoContrato;
  // Seguimiento de obligaciones periódicas
  ultimoPagoSeguridadSocial?: string;
  ultimasVacacionesTomadas?: string; // último periodo de vacaciones disfrutado
  diasVacacionesPendientes?: number;
  // Señales de subordinación (para reclasificación de civiles)
  subordinacion?: SubordinacionSenales;
  // Confianza de la extracción IA (0–1)
  extraccionConfianza?: number;
  fuente?: "ia" | "manual";
}

// Señales de cómo se OPERA la relación (no juicios jurídicos: hechos verificables).
// Tres fuentes, de mayor a menor fuerza probatoria:
export interface SubordinacionSenales {
  // ── Datos objetivos: huellas duras que la empresa ya tiene ("estilo UGPP") ──
  pagoFijoPeriodico?: boolean; // mismo monto, mismo día cada mes (parece nómina)
  correoEquipoCorporativo?: boolean; // correo / usuario / equipos de la empresa
  registraJornada?: boolean; // marca entrada y salida (control de asistencia)
  enOrganigrama?: boolean; // figura en el organigrama o en evaluaciones de desempeño
  exclusividad?: boolean; // trabaja solo para la empresa
  continuidad?: boolean; // relación prolongada (años seguidos)
  // ── Cuestionario operativo neutral: hechos que responde RRHH ──
  leDefinenHorario?: boolean; // la empresa le fija el horario
  reportaAJefe?: boolean; // reporta a un superior que le da instrucciones
  empresaAsignaTareas?: boolean; // le indican qué, cómo y cuándo hacer
  herramientasEmpleador?: boolean; // la empresa le da herramientas / insumos
  laborDelGiro?: boolean; // labor permanente y parte del giro del negocio
  pidePermisos?: boolean; // pide permiso para ausentarse o tomar vacaciones
  // ── Subordinación algorítmica — plataformas (Ley 2466/2025) ──
  asignacionAlgoritmica?: boolean;
  penalizacionRechazos?: boolean;
  calificacionPlataforma?: boolean;
  geolocalizacion?: boolean;
}

// ── Liquidación ────────────────────────────────────────────────────────────

export interface LiquidacionLinea {
  concepto: string;
  base: string; // explicación de la base de cálculo
  formula: string;
  dias?: number;
  valor: number;
  norma: string; // referencia legal
}

export interface LiquidacionResultado {
  contratoId: string;
  empleado: string;
  desde: string;
  hasta: string;
  diasLaborados: number;
  baseLiquidacion: number; // salario + auxilio (si aplica)
  lineas: LiquidacionLinea[];
  total: number;
  causa: CausaTerminacion;
  notas: string[];
}

export type CausaTerminacion =
  | "renuncia"
  | "justa_causa"
  | "sin_justa_causa"
  | "vencimiento_plazo"
  | "mutuo_acuerdo";

// ── Alertas ──────────────────────────────────────────────────────────────

export type Severidad = "critica" | "alta" | "media" | "info";

export interface Alerta {
  id: string;
  contratoId: string;
  empleado: string;
  tipo:
    | "vencimiento_contrato"
    | "preaviso_no_renovacion"
    | "vacaciones_vencidas"
    | "liquidacion_pendiente"
    | "seguridad_social"
    | "reclasificacion"
    | "jornada_2101"
    | "reforma_2466";
  severidad: Severidad;
  titulo: string;
  detalle: string;
  norma: string;
  diasRestantes?: number; // negativo = vencido
  accion: string; // recomendación accionable para RRHH
}

// ── Reclasificación ─────────────────────────────────────────────────────────

export type BucketSenal = "dato_objetivo" | "cuestionario" | "algoritmica";

export interface ContradiccionContrato {
  contratoDice: string; // lo que pretende el contrato civil
  realidadMuestra: string; // lo que muestra la operación
  severidad: "alta" | "media";
}

// Cláusula del extracto del contrato, para mostrarlo y subrayar lo que se contradice.
export interface ClausulaContrato {
  eje: "objeto" | "horario" | "remuneracion" | "exclusividad" | "medios";
  texto: string; // lo que dice el contrato (el "papel")
  destacar: string; // fragmento a subrayar dentro de `texto`
  contradicha: boolean; // la realidad operativa la contradice
  realidad?: string; // qué muestra la realidad (si está contradicha)
}

export interface RubroExposicion {
  concepto: string;
  valor: number;
  detalle: string;
  norma: string;
}

export interface ExposicionReclasificacion {
  rubros: RubroExposicion[];
  montoMaximo: number; // exposición total si un juez reclasifica
  exposicionEsperada: number; // probabilidad × monto máximo
  mesesExpuestos: number; // meses dentro de la prescripción (≤ 36)
}

export interface ConceptoElemento {
  elemento: string; // elemento del art. 23 CST
  presente: boolean;
  hallazgo: string;
}

export interface ReclasificacionResultado {
  contratoId: string;
  empleado: string;
  puntaje: number; // 0–100: índice de subordinación inferida
  nivel: "alto" | "medio" | "bajo";
  probabilidad: number; // 0–100: % estimado de que un juez reclasifique
  algoritmica: boolean; // dispara régimen Ley 2466/2025
  indicios: { senal: string; presente: boolean; peso: number; norma: string; bucket: BucketSenal }[];
  contradicciones: ContradiccionContrato[];
  clausulas: ClausulaContrato[]; // extracto del contrato con lo contradicho marcado
  exposicion: ExposicionReclasificacion;
  conceptoPorElemento: ConceptoElemento[];
  conclusion: string;
}

// ── Proceso disciplinario ────────────────────────────────────────────────────

export interface PasoDebidoProceso {
  id: string;
  paso: string;
  norma: string;
  cumplido: boolean | null; // null = pendiente
  obligatorio: boolean;
  nota?: string;
}
