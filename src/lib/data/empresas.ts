import { Contrato } from "../types";
import { CONTRATOS, HOY } from "./contratos";

// ─────────────────────────────────────────────────────────────────────────
// Empresas CLIENTE de la firma Hurtado Gandini. Cada empleado de la firma tiene
// acceso a un subconjunto de estas empresas y trabaja una a la vez (empresa activa).
// Cada empresa tiene su propia nómina (datos separados).
// ─────────────────────────────────────────────────────────────────────────

export interface EmpresaCliente {
  id: string;
  nombre: string;
  nit: string;
  hoy: string; // fecha de referencia (demo determinista)
  contratos: Contrato[];
}

// ── Empresa 2 — Comercial Andina Ltda. (retail) ──────────────────────────────
const ANDINA: Contrato[] = [
  {
    id: "A-001",
    empleado: "Diana Marcela Quintero",
    documento: "1.061.778.220",
    cargo: "Cajera principal",
    area: "Tienda",
    tipo: "indefinido",
    jornada: "completa",
    horasSemana: 45, // ⚠️ excede 42h (Ley 2101/2021)
    salarioMensual: 1_500_000,
    auxilioTransporte: true,
    salarioIntegral: false,
    fechaInicio: "2023-03-15",
    estado: "activo",
    ultimoPagoSeguridadSocial: "2026-06-08",
    ultimasVacacionesTomadas: "2025-08-01",
    diasVacacionesPendientes: 10,
    extraccionConfianza: 0.95,
    fuente: "ia",
  },
  {
    id: "A-002",
    empleado: "Sebastián Gómez Ríos",
    documento: "1.130.554.901",
    cargo: "Auxiliar de bodega",
    area: "Logística",
    tipo: "fijo",
    jornada: "completa",
    horasSemana: 42,
    salarioMensual: 1_423_500,
    auxilioTransporte: true,
    salarioIntegral: false,
    fechaInicio: "2025-08-01",
    fechaFin: "2026-07-31", // ⚠️ vence pronto
    estado: "activo",
    ultimoPagoSeguridadSocial: "2026-06-09",
    ultimasVacacionesTomadas: "2025-12-20",
    diasVacacionesPendientes: 4,
    extraccionConfianza: 0.92,
    fuente: "ia",
  },
  {
    id: "A-003",
    empleado: "Paula Andrea Castaño",
    documento: "66.890.451",
    cargo: "Diseñadora de vitrinas",
    area: "Mercadeo",
    tipo: "prestacion_servicios",
    jornada: "completa",
    horasSemana: 40,
    salarioMensual: 2_200_000,
    auxilioTransporte: false,
    salarioIntegral: false,
    fechaInicio: "2024-02-01",
    estado: "activo",
    subordinacion: {
      pagoFijoPeriodico: true,
      correoEquipoCorporativo: true,
      registraJornada: true,
      enOrganigrama: true,
      exclusividad: true,
      continuidad: true,
      prestacionPersonal: true,
      leDefinenHorario: true,
      reportaAJefe: true,
      empresaAsignaTareas: true,
      controlMetodo: true,
      poderDisciplinario: true,
      herramientasEmpleador: true,
      laborDelGiro: true,
    },
    extraccionConfianza: 0.9,
    fuente: "ia",
  },
  {
    id: "A-004",
    empleado: "Julián Esteban Mora",
    documento: "1.000.221.118",
    cargo: "Aprendiz SENA",
    area: "Tienda",
    tipo: "aprendizaje",
    jornada: "completa",
    horasSemana: 42,
    salarioMensual: 1_423_500,
    auxilioTransporte: false,
    salarioIntegral: false,
    fechaInicio: "2026-01-15",
    estado: "activo",
    extraccionConfianza: 0.88,
    fuente: "manual",
  },
];

// ── Empresa 3 — Logística del Pacífico S.A.S. (transporte) ───────────────────
const PACIFICO: Contrato[] = [
  {
    id: "L-001",
    empleado: "Andrés Camilo Valencia",
    documento: "94.551.302",
    cargo: "Conductor de reparto",
    area: "Operaciones",
    tipo: "plataforma",
    jornada: "completa",
    horasSemana: 48,
    salarioMensual: 1_700_000,
    auxilioTransporte: true,
    salarioIntegral: false,
    fechaInicio: "2024-09-01",
    estado: "activo",
    subordinacion: {
      continuidad: true,
      pagoFijoPeriodico: true,
      asignacionAlgoritmica: true,
      geolocalizacion: true,
      calificacionPlataforma: true,
      penalizacionRechazos: true,
      tarifaUnilateral: true,
    },
    extraccionConfianza: 0.86,
    fuente: "ia",
  },
  {
    id: "L-002",
    empleado: "Martha Lucía Cifuentes",
    documento: "31.998.776",
    cargo: "Coordinadora de rutas",
    area: "Operaciones",
    tipo: "indefinido",
    jornada: "completa",
    horasSemana: 42,
    salarioMensual: 3_100_000,
    auxilioTransporte: false,
    salarioIntegral: false,
    fechaInicio: "2021-05-10",
    estado: "activo",
    ultimoPagoSeguridadSocial: "2026-05-05", // ⚠️ posible mora
    ultimasVacacionesTomadas: "2024-03-01", // ⚠️ vacaciones vencidas
    diasVacacionesPendientes: 24,
    extraccionConfianza: 0.96,
    fuente: "ia",
  },
  {
    id: "L-003",
    empleado: "Óscar Mauricio Lerma",
    documento: "1.115.667.402",
    cargo: "Auxiliar de cargue",
    area: "Bodega",
    tipo: "obra_labor",
    jornada: "completa",
    horasSemana: 44, // ⚠️ excede 42h
    salarioMensual: 1_423_500,
    auxilioTransporte: true,
    salarioIntegral: false,
    fechaInicio: "2026-01-10",
    fechaFin: "2026-07-10", // ⚠️ obra termina pronto
    estado: "activo",
    ultimoPagoSeguridadSocial: "2026-06-07",
    extraccionConfianza: 0.83,
    fuente: "ia",
  },
];

export const EMPRESAS: EmpresaCliente[] = [
  { id: "emp-demo", nombre: "Empresa Demo S.A.S.", nit: "900.123.456-7", hoy: HOY, contratos: CONTRATOS },
  { id: "emp-andina", nombre: "Comercial Andina Ltda.", nit: "901.555.221-3", hoy: HOY, contratos: ANDINA },
  { id: "emp-pacifico", nombre: "Logística del Pacífico S.A.S.", nit: "901.888.004-1", hoy: HOY, contratos: PACIFICO },
];

export function getEmpresa(id: string | null | undefined): EmpresaCliente | undefined {
  return EMPRESAS.find((e) => e.id === id);
}
