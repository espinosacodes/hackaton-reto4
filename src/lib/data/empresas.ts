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
// Sin contratos semilla: la nómina se construye con contratos reales cargados.
const ANDINA: Contrato[] = [];

// ── Empresa 3 — Logística del Pacífico S.A.S. (transporte) ───────────────────
// Sin contratos semilla: la nómina se construye con contratos reales cargados.
const PACIFICO: Contrato[] = [];

export const EMPRESAS: EmpresaCliente[] = [
  { id: "emp-demo", nombre: "Empresa Demo S.A.S.", nit: "900.123.456-7", hoy: HOY, contratos: CONTRATOS },
  { id: "emp-andina", nombre: "Comercial Andina Ltda.", nit: "901.555.221-3", hoy: HOY, contratos: ANDINA },
  { id: "emp-pacifico", nombre: "Logística del Pacífico S.A.S.", nit: "901.888.004-1", hoy: HOY, contratos: PACIFICO },
];

export function getEmpresa(id: string | null | undefined): EmpresaCliente | undefined {
  return EMPRESAS.find((e) => e.id === id);
}
