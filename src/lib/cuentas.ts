"use client";

// ─────────────────────────────────────────────────────────────────────────
// Cuentas de empleados de la firma Hurtado Gandini (localStorage, demo).
//  - El administrador es FIJO (correo sembrado vía env). Se activa una vez
//    fijando contraseña + verificación por código, y ve todas las empresas.
//  - Los demás empleados entran SOLO por invitación del admin, que les asigna
//    rol (admin/empleado) y a qué empresas cliente pueden acceder.
//  - Contraseñas con hash SHA-256 + salt (grado demo; en producción: backend + argon2).
// La sesión activa vive en store.ts (setUsuario / useUsuario).
// ─────────────────────────────────────────────────────────────────────────

import { Usuario, setUsuario } from "./store";
import { EMPRESAS } from "./data/empresas";

const CUENTAS_KEY = "centinela:cuentas";
const RETO_KEY = "centinela:reto-auth";

/** Correo del administrador de la firma (sembrado). Configurable en .env. */
export const ADMIN_EMAIL = (process.env.NEXT_PUBLIC_FIRM_ADMIN_EMAIL || "admin@hurtadogandini.co")
  .trim()
  .toLowerCase();

export interface Cuenta {
  email: string; // identificador de inicio de sesión (en minúsculas)
  nombre: string;
  passHash: string;
  salt: string;
  rol: "admin" | "empleado";
  empresas: string[]; // ids de empresas cliente accesibles (admin = todas)
  verificado: boolean;
  ts: string;
}

/** Contraseña compartida de las cuentas de demostración. */
export const DEMO_PASSWORD = "demo1234";

/** Cuentas sembradas para la demo (admins + empleados con distinto acceso). */
export const CUENTAS_DEMO: { email: string; nombre: string; rol: "admin" | "empleado"; empresas: string[] }[] = [
  { email: ADMIN_EMAIL, nombre: "Carolina Hurtado", rol: "admin", empresas: [] },
  { email: "daniel.gandini@hurtadogandini.co", nombre: "Daniel Gandini", rol: "admin", empresas: [] },
  { email: "ana.gomez@hurtadogandini.co", nombre: "Ana María Gómez", rol: "empleado", empresas: ["emp-demo", "emp-andina"] },
  { email: "carlos.perez@hurtadogandini.co", nombre: "Carlos Pérez", rol: "empleado", empresas: ["emp-pacifico"] },
];

interface Reto {
  email: string;
  proposito: "verificacion" | "reset";
  hash: string;
  expira: number; // epoch ms
}

// ── localStorage helpers ─────────────────────────────────────────────────────
function leer<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function guardar(key: string, val: unknown) {
  if (typeof window !== "undefined") localStorage.setItem(key, JSON.stringify(val));
}
function leerCuentas(): Cuenta[] {
  return leer<Cuenta[]>(CUENTAS_KEY, []);
}

export function buscarCuenta(email: string): Cuenta | undefined {
  const e = email.trim().toLowerCase();
  return leerCuentas().find((c) => c.email === e);
}

/** Siembra las cuentas de demo una sola vez (si el navegador no tiene cuentas). */
export async function seedDemoCuentas(): Promise<void> {
  if (typeof window === "undefined") return;
  if (leerCuentas().length > 0) return; // ya hay cuentas (sembradas o reales)
  const cuentas: Cuenta[] = [];
  for (const d of CUENTAS_DEMO) {
    const salt = randHex();
    const passHash = await hashPassword(DEMO_PASSWORD, salt);
    cuentas.push({
      email: d.email.trim().toLowerCase(),
      nombre: d.nombre,
      passHash,
      salt,
      rol: d.rol,
      empresas: d.rol === "admin" ? EMPRESAS.map((e) => e.id) : d.empresas,
      verificado: true,
      ts: new Date().toISOString(),
    });
  }
  guardar(CUENTAS_KEY, cuentas);
}

// ── Criptografía (Web Crypto) ────────────────────────────────────────────────
async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
function randHex(bytes = 16): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
async function hashPassword(password: string, salt: string): Promise<string> {
  return sha256Hex(`${salt}:${password}`);
}

// ── Activación del administrador de la firma (una sola vez) ──────────────────
export async function activarAdmin(opts: {
  nombre: string;
  email: string;
  password: string;
}): Promise<{ ok: boolean; error?: string }> {
  const email = opts.email.trim().toLowerCase();
  if (email !== ADMIN_EMAIL)
    return { ok: false, error: "Ese correo no es el administrador de la firma. Pide una invitación." };
  if (opts.password.length < 6) return { ok: false, error: "La contraseña debe tener al menos 6 caracteres." };
  if (buscarCuenta(email)) return { ok: false, error: "El administrador ya está activado. Inicia sesión." };

  const salt = randHex();
  const passHash = await hashPassword(opts.password, salt);
  const cuenta: Cuenta = {
    email,
    nombre: opts.nombre.trim() || "Administrador",
    passHash,
    salt,
    rol: "admin",
    empresas: EMPRESAS.map((e) => e.id), // el admin ve todas
    verificado: false, // se verifica con el código por correo
    ts: new Date().toISOString(),
  };
  guardar(CUENTAS_KEY, [...leerCuentas().filter((c) => c.email !== email), cuenta]);
  return { ok: true };
}

// ── Unirse por invitación (empleado) ─────────────────────────────────────────
export async function aceptarInvitacion(opts: {
  token: string;
  nombre: string;
  password: string;
}): Promise<{ ok: boolean; error?: string; cuenta?: Cuenta }> {
  if (opts.password.length < 6) return { ok: false, error: "La contraseña debe tener al menos 6 caracteres." };

  const res = await fetch("/api/auth/accept-invite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: opts.token.trim() }),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    return { ok: false, error: d.error || "Invitación inválida." };
  }
  const inv = (await res.json()) as { email: string; rol: "admin" | "empleado"; empresas: string[] };

  const email = inv.email.trim().toLowerCase();
  const salt = randHex();
  const passHash = await hashPassword(opts.password, salt);
  const cuenta: Cuenta = {
    email,
    nombre: opts.nombre.trim() || email,
    passHash,
    salt,
    rol: inv.rol,
    empresas: inv.rol === "admin" ? EMPRESAS.map((e) => e.id) : inv.empresas || [],
    verificado: true, // la invitación valida el correo
    ts: new Date().toISOString(),
  };
  guardar(CUENTAS_KEY, [...leerCuentas().filter((c) => c.email !== email), cuenta]);
  return { ok: true, cuenta };
}

// ── Inicio de sesión ─────────────────────────────────────────────────────────
export async function iniciarSesion(
  email: string,
  password: string
): Promise<{ ok: boolean; error?: string; noVerificado?: boolean }> {
  const cuenta = buscarCuenta(email);
  if (!cuenta) return { ok: false, error: "No existe una cuenta con ese correo." };
  const hash = await hashPassword(password, cuenta.salt);
  if (hash !== cuenta.passHash) return { ok: false, error: "Contraseña incorrecta." };
  if (!cuenta.verificado) return { ok: false, error: "Verifica tu correo para activar la cuenta.", noVerificado: true };
  loguear(cuenta);
  return { ok: true };
}

/** Crea la sesión activa a partir de una cuenta. */
export function loguear(cuenta: Cuenta) {
  const u: Usuario = {
    nombre: cuenta.nombre,
    email: cuenta.email,
    rol: cuenta.rol,
    empresas: cuenta.empresas,
    ts: new Date().toISOString(),
  };
  setUsuario(u);
}

function marcarVerificada(email: string) {
  const e = email.trim().toLowerCase();
  guardar(CUENTAS_KEY, leerCuentas().map((c) => (c.email === e ? { ...c, verificado: true } : c)));
}

async function actualizarPassword(email: string, nueva: string) {
  const e = email.trim().toLowerCase();
  const salt = randHex();
  const passHash = await hashPassword(nueva, salt);
  guardar(CUENTAS_KEY, leerCuentas().map((c) => (c.email === e ? { ...c, salt, passHash } : c)));
}

// ── Códigos de un solo uso (verificación / reseteo) ──────────────────────────
export async function pedirCodigo(
  email: string,
  nombre: string,
  proposito: "verificacion" | "reset"
): Promise<{ ok: boolean; demoCodigo?: string; error?: string }> {
  const e = email.trim().toLowerCase();
  const res = await fetch("/api/auth/send-code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: e, nombre, proposito }),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    return { ok: false, error: d.error || "No se pudo enviar el código." };
  }
  const data = (await res.json()) as { hash: string; demoCodigo?: string };
  guardar(RETO_KEY, { email: e, proposito, hash: data.hash, expira: Date.now() + 10 * 60 * 1000 } as Reto);
  return { ok: true, demoCodigo: data.demoCodigo };
}

async function validarCodigo(email: string, proposito: "verificacion" | "reset", codigo: string): Promise<boolean> {
  const reto = leer<Reto | null>(RETO_KEY, null);
  const e = email.trim().toLowerCase();
  if (!reto || reto.email !== e || reto.proposito !== proposito) return false;
  if (Date.now() > reto.expira) return false;
  const hash = await sha256Hex(`${codigo.trim()}:${e}:${proposito}`);
  return hash === reto.hash;
}

/** Valida el código de verificación, activa la cuenta e inicia sesión. */
export async function confirmarVerificacion(email: string, codigo: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await validarCodigo(email, "verificacion", codigo))) return { ok: false, error: "Código incorrecto o vencido." };
  marcarVerificada(email);
  if (typeof window !== "undefined") localStorage.removeItem(RETO_KEY);
  const cuenta = buscarCuenta(email);
  if (cuenta) loguear({ ...cuenta, verificado: true });
  return { ok: true };
}

/** Valida el código de reseteo y cambia la contraseña. */
export async function confirmarReset(email: string, codigo: string, nueva: string): Promise<{ ok: boolean; error?: string }> {
  if (nueva.length < 6) return { ok: false, error: "La contraseña debe tener al menos 6 caracteres." };
  if (!(await validarCodigo(email, "reset", codigo))) return { ok: false, error: "Código incorrecto o vencido." };
  await actualizarPassword(email, nueva);
  if (typeof window !== "undefined") localStorage.removeItem(RETO_KEY);
  return { ok: true };
}

// ── Invitar empleado (admin) ─────────────────────────────────────────────────
export async function invitarUsuario(opts: {
  email: string;
  rol: "admin" | "empleado";
  empresas: string[];
  invitador: string;
}): Promise<{ ok: boolean; token?: string; enviado?: boolean; error?: string }> {
  const res = await fetch("/api/auth/invite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    return { ok: false, error: d.error || "No se pudo crear la invitación." };
  }
  const data = (await res.json()) as { token: string; enviado: boolean };
  return { ok: true, token: data.token, enviado: data.enviado };
}
