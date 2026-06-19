import { Contrato } from "../types";

// Fecha de referencia del sistema: 18 de junio de 2026.
export const HOY = "2026-06-18";

// Nómina de la empresa. Sin contratos semilla: la nómina se construye con los
// contratos reales cargados/validados por el usuario (flujo de extracción IA).
export const CONTRATOS: Contrato[] = [];

export function getContrato(id: string): Contrato | undefined {
  return CONTRATOS.find((c) => c.id === id);
}
