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

const AUDIT_KEY = "centinela:auditoria";
const CONTRATOS_KEY = "centinela:contratos-confirmados";
const DOCS_KEY = "centinela:documentos-perfil";
const PARAMS_KEY = "centinela:parametros";
const EVT = "centinela:store-cambio";

export interface AuditEvento {
  id: string;
  ts: string; // ISO
  usuario: string;
  accion: string;
  detalle: string;
}

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

/** Registra un evento en la bitácora de auditoría. */
export function logAudit(accion: string, detalle: string, usuario = "RH (demo)") {
  const ev: AuditEvento = { id: uid(), ts: new Date().toISOString(), usuario, accion, detalle };
  const all = read<AuditEvento[]>(AUDIT_KEY, []);
  write(AUDIT_KEY, [ev, ...all].slice(0, 200));
}

/** Limpia la bitácora de auditoría (útil para reiniciar la demo). */
export function clearAudit() {
  write(AUDIT_KEY, []);
}

/** Agrega (o reemplaza por id) un contrato validado por un humano. */
export function addContratoConfirmado(c: Contrato) {
  const all = read<Contrato[]>(CONTRATOS_KEY, []);
  write(CONTRATOS_KEY, [c, ...all.filter((x) => x.id !== c.id)]);
}

function useStore<T>(key: string, fallback: T): T {
  const [val, setVal] = useState<T>(fallback);
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
