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

export interface SubordinacionSenales {
  horarioFijo?: boolean;
  exclusividad?: boolean;
  herramientasEmpleador?: boolean;
  instruccionesDetalladas?: boolean;
  remuneracionFija?: boolean;
  continuidad?: boolean; // > 6 meses continuos
  supervisionDirecta?: boolean;
  // Ley 2466/2025 — subordinación algorítmica
  asignacionAlgoritmica?: boolean;
  geolocalizacion?: boolean;
  calificacionPlataforma?: boolean;
  penalizacionRechazos?: boolean;
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

export interface ReclasificacionResultado {
  contratoId: string;
  empleado: string;
  puntaje: number; // 0–100
  nivel: "alto" | "medio" | "bajo";
  algoritmica: boolean; // dispara régimen Ley 2466/2025
  indicios: { senal: string; presente: boolean; peso: number; norma: string }[];
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
