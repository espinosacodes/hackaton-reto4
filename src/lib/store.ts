"use client";

// ─────────────────────────────────────────────────────────────────────────
// Store ligero de sesión (localStorage) para cerrar el loop "el abogado decide":
//  - Bitácora de auditoría: quién hizo qué y cuándo (trazabilidad para defensa).
//  - Contratos confirmados: lo que la IA extrae y un humano valida fluye al motor.
// Es de demostración (no es una base de datos); persiste solo en el navegador.
// ─────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { Contrato } from "./types";
import { PARAMS_2026 } from "./liquidacion";
import { EMPRESAS, getEmpresa, type EmpresaCliente } from "./data/empresas";

const AUDIT_KEY = "centinela:auditoria";
const CONTRATOS_KEY = "centinela:contratos-confirmados";
const DOCS_KEY = "centinela:documentos-perfil";
const PLANTILLAS_KEY = "centinela:plantillas-disciplinario";
const LOGO_KEY = "centinela:logo-empresa";
const LINEAMIENTOS_KEY = "centinela:tipos-lineamiento";
const PARAMS_KEY = "centinela:parametros";
const NIT_KEY = "centinela:nit-empresa";
const USER_KEY = "centinela:usuario";
const EMPRESA_KEY = "centinela:empresa-activa";
const EVT = "centinela:store-cambio";

export interface AuditEvento {
  id: string;
  ts: string; // ISO
  usuario: string;
  email?: string; // correo del usuario autenticado (cadena de custodia)
  accion: string;
  detalle: string;
}

// Usuario autenticado = empleado de la firma Hurtado Gandini.
//  - rol "admin": gestiona la firma, invita empleados y ve todas las empresas cliente.
//  - rol "empleado": solo accede a las empresas cliente que se le asignaron.
// En la demo se guarda en el navegador; en producción lo respalda un backend + BD.
export interface Usuario {
  nombre: string;
  email: string;
  rol: "admin" | "empleado";
  empresas: string[]; // ids de empresas cliente accesibles (admin = todas)
  ts: string; // momento de inicio de sesión (ISO)
}

export const FIRMA = "Hurtado Gandini";

// Documento normativo interno cargado una sola vez en el Perfil de la empresa
// (RIT, manual de convivencia, PTEE, convención, código de ética).
export interface DocumentoPerfil {
  id: string;
  tipo: string; // categoría: "RIT", "Manual", "PTEE", ...
  nombre: string; // nombre del archivo
  texto: string; // texto extraído (base normativa para la IA)
  ts: string;
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, val: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(val));
  window.dispatchEvent(new Event(EVT));
}

function uid(): string {
  return `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
}

/**
 * Registra un evento en la bitácora de auditoría.
 * Si no se pasa `usuario`, se atribuye al usuario autenticado de la sesión
 * (quién valida / decide), de modo que cada acción queda firmada por su responsable.
 */
export function logAudit(accion: string, detalle: string, usuario?: string) {
  const actual = getUsuarioActual();
  const quien = usuario ?? actual?.nombre ?? "RH (demo)";
  const ev: AuditEvento = {
    id: uid(),
    ts: new Date().toISOString(),
    usuario: quien,
    email: actual?.email,
    accion,
    detalle,
  };
  const all = read<AuditEvento[]>(AUDIT_KEY, []);
  write(AUDIT_KEY, [ev, ...all].slice(0, 200));
}

/** Limpia la bitácora de auditoría (útil para reiniciar la demo). */
export function clearAudit() {
  write(AUDIT_KEY, []);
}

// ── Sesión de usuario (login con Google) ─────────────────────────────────────

/** Lectura síncrona del usuario autenticado (para usar fuera de React). */
export function getUsuarioActual(): Usuario | null {
  return read<Usuario | null>(USER_KEY, null);
}

/** Inicia sesión: guarda al usuario autenticado y lo deja en la bitácora. */
export function setUsuario(u: Usuario) {
  write(USER_KEY, u);
  logAudit("Inicio de sesión", `${u.nombre} · ${u.email} · ${FIRMA} (${u.rol})`, u.nombre);
}

/** Cierra sesión (y olvida la empresa activa). */
export function clearUsuario() {
  const actual = getUsuarioActual();
  if (actual) logAudit("Cierre de sesión", `${actual.nombre} · ${actual.email}`, actual.nombre);
  if (typeof window === "undefined") return;
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(EMPRESA_KEY);
  window.dispatchEvent(new Event(EVT));
}

/** Hook reactivo del usuario autenticado (null si no hay sesión). */
export function useUsuario(): Usuario | null {
  return useStore<Usuario | null>(USER_KEY, null);
}

// ── Empresa cliente activa (se trabaja una a la vez) ─────────────────────────

/** Empresas cliente a las que el usuario tiene acceso (admin = todas). */
export function empresasAccesibles(u: Usuario | null): EmpresaCliente[] {
  if (!u) return [];
  if (u.rol === "admin") return EMPRESAS;
  return EMPRESAS.filter((e) => u.empresas.includes(e.id));
}

/** Selecciona la empresa cliente activa y lo registra en la bitácora. */
export function setEmpresaActiva(id: string) {
  const emp = getEmpresa(id);
  write(EMPRESA_KEY, id);
  if (emp) logAudit("Empresa seleccionada", emp.nombre);
}

export function clearEmpresaActiva() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(EMPRESA_KEY);
  window.dispatchEvent(new Event(EVT));
}

/** Hook con la empresa cliente activa (null si no se ha elegido). */
export function useEmpresaActiva(): EmpresaCliente | null {
  const id = useStore<string | null>(EMPRESA_KEY, null);
  return getEmpresa(id) ?? null;
}

/** Agrega (o reemplaza por id) un contrato validado por un humano. */
export function addContratoConfirmado(c: Contrato) {
  const all = read<Contrato[]>(CONTRATOS_KEY, []);
  write(CONTRATOS_KEY, [c, ...all.filter((x) => x.id !== c.id)]);
}

/** Elimina un contrato que un humano agregó (p. ej. cargado por error). */
export function removeContratoConfirmado(id: string) {
  const all = read<Contrato[]>(CONTRATOS_KEY, []);
  write(CONTRATOS_KEY, all.filter((x) => x.id !== id));
}

function useStore<T>(key: string, fallback: T): T {
  // Inicializador perezoso: lee localStorage de forma síncrona en el primer
  // render del CLIENTE. Así un componente recién montado ya tiene el valor real
  // (no el fallback), evitando un estado transitorio nulo que rompía las páginas
  // del panel (p. ej. empresa/contratos undefined en el primer render). En el
  // servidor `read` devuelve el fallback (no hay window), y el panel no se
  // renderiza en SSR (AuthGate retorna null hasta montar), por lo que no hay
  // desajuste de hidratación.
  const [val, setVal] = useState<T>(() => read<T>(key, fallback));
  useEffect(() => {
    const sync = () => setVal(read<T>(key, fallback));
    sync();
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener("storage", sync);
    };
    // fallback es estable (literal en el sitio de llamada); key no cambia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return val;
}

export function useAuditLog(): AuditEvento[] {
  return useStore<AuditEvento[]>(AUDIT_KEY, []);
}

export function useContratosConfirmados(): Contrato[] {
  return useStore<Contrato[]>(CONTRATOS_KEY, []);
}

// ── Documentos del Perfil de la empresa ──────────────────────────────────────

/** Agrega (o reemplaza por tipo) un documento normativo interno del Perfil. */
export function addDocumentoPerfil(d: DocumentoPerfil) {
  const all = read<DocumentoPerfil[]>(DOCS_KEY, []);
  write(DOCS_KEY, [d, ...all.filter((x) => x.tipo !== d.tipo)]);
}

export function removeDocumentoPerfil(id: string) {
  const all = read<DocumentoPerfil[]>(DOCS_KEY, []);
  write(DOCS_KEY, all.filter((x) => x.id !== id));
}

export function useDocumentosPerfil(): DocumentoPerfil[] {
  return useStore<DocumentoPerfil[]>(DOCS_KEY, []);
}

// ── Plantillas de documentos disciplinarios (citación, notificación, etc.) ────
// La empresa sube su propio formato; al generar el escrito se rellena con el caso
// y se exporta con su logo, para que salga listo con su letra/estructura.

export interface PlantillaDisciplinaria {
  tipo: string; // a qué documento aplica: "citacion" | "notificacion" | "decision" | "acta" | ...
  nombre: string;
  texto: string;
  ts: string;
}

export function addPlantilla(p: PlantillaDisciplinaria) {
  const all = read<PlantillaDisciplinaria[]>(PLANTILLAS_KEY, []);
  write(PLANTILLAS_KEY, [p, ...all.filter((x) => x.tipo !== p.tipo)]);
}

export function removePlantilla(tipo: string) {
  const all = read<PlantillaDisciplinaria[]>(PLANTILLAS_KEY, []);
  write(PLANTILLAS_KEY, all.filter((x) => x.tipo !== tipo));
}

export function usePlantillas(): PlantillaDisciplinaria[] {
  return useStore<PlantillaDisciplinaria[]>(PLANTILLAS_KEY, []);
}

// ── Logo de la empresa cliente (para los escritos exportados a PDF) ───────────

export function setLogoEmpresa(dataUrl: string | null) {
  if (dataUrl) write(LOGO_KEY, dataUrl);
  else if (typeof window !== "undefined") {
    localStorage.removeItem(LOGO_KEY);
    window.dispatchEvent(new Event(EVT));
  }
}

export function useLogoEmpresa(): string | null {
  return useStore<string | null>(LOGO_KEY, null);
}

// ── Tipos de lineamiento interno (categorías de documentos del Perfil) ────────
// Editables: la empresa puede agregar (SARLAFT, SST…) o eliminar los que no use.

export interface TipoLineamiento {
  tipo: string;
  desc: string;
}

export const LINEAMIENTOS_DEFAULT: TipoLineamiento[] = [
  { tipo: "Reglamento Interno de Trabajo (RIT)", desc: "Base del régimen disciplinario y de las faltas (CST art. 115)." },
  { tipo: "Manual de convivencia / conducta", desc: "Conductas esperadas y faltas de convivencia." },
  { tipo: "PTEE (transparencia y ética)", desc: "Programa de Transparencia y Ética Empresarial." },
  { tipo: "Convención / pacto colectivo", desc: "Acuerdos colectivos aplicables." },
  { tipo: "Código de ética", desc: "Principios y deberes de conducta." },
];

export function useTiposLineamiento(): TipoLineamiento[] {
  return useStore<TipoLineamiento[]>(LINEAMIENTOS_KEY, LINEAMIENTOS_DEFAULT);
}

export function addTipoLineamiento(tipo: string, desc = "Lineamiento interno de la empresa.") {
  const all = read<TipoLineamiento[]>(LINEAMIENTOS_KEY, LINEAMIENTOS_DEFAULT);
  if (all.some((t) => t.tipo.toLowerCase() === tipo.toLowerCase())) return;
  write(LINEAMIENTOS_KEY, [...all, { tipo, desc }]);
}

export function removeTipoLineamiento(tipo: string) {
  const all = read<TipoLineamiento[]>(LINEAMIENTOS_KEY, LINEAMIENTOS_DEFAULT);
  write(LINEAMIENTOS_KEY, all.filter((t) => t.tipo !== tipo));
}

// ── Parámetros de liquidación 2026 (editables por la empresa) ────────────────

export type Parametros = typeof PARAMS_2026;

export function setParametros(p: Parametros) {
  write(PARAMS_KEY, p);
}

export function resetParametros() {
  write(PARAMS_KEY, PARAMS_2026);
}

export function useParametros(): Parametros {
  return useStore<Parametros>(PARAMS_KEY, PARAMS_2026);
}

// ── Búsqueda global (filtra la nómina desde el buscador del encabezado) ───────

const BUSQUEDA_KEY = "centinela:busqueda";

export function setBusqueda(q: string) {
  write(BUSQUEDA_KEY, q);
}

export function useBusqueda(): string {
  return useStore<string>(BUSQUEDA_KEY, "");
}

// ── Datos de la empresa: NIT (2 últimos dígitos, para el calendario PILA) ──────

export function setNitEmpresa(nit: string) {
  write(NIT_KEY, nit);
}

export function useNitEmpresa(): string {
  return useStore<string>(NIT_KEY, "00");
}

// ── Liquidaciones registradas (seguimiento de sanción moratoria, CST art. 65) ──
// Una liquidación se registra como "pendiente" desde la fecha de retiro; mientras
// no se marque "pagada", se acumula la sanción moratoria (1 día de salario por día).
const LIQ_REG_KEY = "centinela:liquidaciones-registradas";

export interface LiquidacionRegistrada {
  id: string;
  contratoId: string;
  empleado: string;
  fechaRetiro: string; // fecha de terminación del contrato (inicio de la mora)
  total: number; // total de la liquidación de referencia
  salarioMensual: number; // base del "día de salario" (CST art. 65)
  causaLabel: string;
  ts: string; // fecha de registro (ISO)
  estado: "pendiente" | "pagada" | "anulada"; // anulada = revertida, el trabajador vuelve a activos
  fechaPago?: string; // congela la mora al pagar
}

export function addLiquidacionRegistrada(l: LiquidacionRegistrada) {
  const all = read<LiquidacionRegistrada[]>(LIQ_REG_KEY, []);
  write(LIQ_REG_KEY, [l, ...all.filter((x) => x.id !== l.id)]);
}

export function marcarLiquidacionPagada(id: string, fechaPago: string) {
  const all = read<LiquidacionRegistrada[]>(LIQ_REG_KEY, []);
  write(
    LIQ_REG_KEY,
    all.map((x) => (x.id === id ? { ...x, estado: "pagada" as const, fechaPago } : x))
  );
}

// Anula la liquidación: el trabajador vuelve a los contratos activos y se detiene la mora.
export function anularLiquidacion(id: string) {
  const all = read<LiquidacionRegistrada[]>(LIQ_REG_KEY, []);
  write(LIQ_REG_KEY, all.map((x) => (x.id === id ? { ...x, estado: "anulada" as const } : x)));
}

export function removeLiquidacionRegistrada(id: string) {
  const all = read<LiquidacionRegistrada[]>(LIQ_REG_KEY, []);
  write(LIQ_REG_KEY, all.filter((x) => x.id !== id));
}

export function useLiquidacionesRegistradas(): LiquidacionRegistrada[] {
  return useStore<LiquidacionRegistrada[]>(LIQ_REG_KEY, []);
}
