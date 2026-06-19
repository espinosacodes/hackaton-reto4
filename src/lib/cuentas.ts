"use client";

// ─────────────────────────────────────────────────────────────────────────
// Cuentas de la firma Hurtado Gandini — cliente.
// La FUENTE DE VERDAD es DynamoDB (vía /api/auth/*): los usuarios persisten
// entre navegadores y dispositivos. Este módulo solo orquesta las llamadas y
// fija la sesión activa local (store.ts). El hash de contraseña vive en el
// servidor (scrypt); aquí ya no se hashea nada.
// ─────────────────────────────────────────────────────────────────────────

import { Usuario, setUsuario } from "./store";
import { ADMIN_EMAIL, DEMO_PASSWORD, CUENTAS_DEMO } from "./data/cuentas-demo";

// Re-exportados para la UI (pantalla de acceso).
export { ADMIN_EMAIL, DEMO_PASSWORD, CUENTAS_DEMO };

interface UsuarioApi {
  email: string;
  nombre: string;
  rol: "admin" | "empleado";
  empresas: string[];
}

function aUsuario(u: UsuarioApi): Usuario {
  return { nombre: u.nombre, email: u.email, rol: u.rol, empresas: u.empresas, ts: new Date().toISOString() };
}

async function post(path: string, body: unknown): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "No hay conexión con el servidor." } };
  }
}

/** Crea la sesión activa a partir de un usuario (lo persiste store.ts). */
export function loguear(u: Usuario) {
  setUsuario(aUsuario(u));
}

/** Siembra (idempotente, en el servidor) las cuentas de demo. Best-effort. */
export async function seedDemoCuentas(): Promise<void> {
  await post("/api/auth/seed", {});
}

// ── Inicio de sesión ─────────────────────────────────────────────────────────
export async function iniciarSesion(
  email: string,
  password: string
): Promise<{ ok: boolean; error?: string; noVerificado?: boolean }> {
  const { ok, data } = await post("/api/auth/login", { email, password });
  if (!ok) return { ok: false, error: String(data.error ?? "No se pudo iniciar sesión."), noVerificado: Boolean(data.noVerificado) };
  setUsuario(aUsuario(data.usuario as UsuarioApi));
  return { ok: true };
}

// ── Activación del administrador de la firma ─────────────────────────────────
export async function activarAdmin(opts: {
  nombre: string;
  email: string;
  password: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { ok, data } = await post("/api/auth/register", { mode: "admin", ...opts });
  return ok ? { ok: true } : { ok: false, error: String(data.error ?? "No se pudo activar el administrador.") };
}

// ── Unirse por invitación (empleado) ─────────────────────────────────────────
export async function aceptarInvitacion(opts: {
  token: string;
  nombre: string;
  password: string;
}): Promise<{ ok: boolean; error?: string; cuenta?: Usuario }> {
  const { ok, data } = await post("/api/auth/register", { mode: "invite", ...opts });
  if (!ok) return { ok: false, error: String(data.error ?? "Invitación inválida.") };
  return { ok: true, cuenta: aUsuario(data.usuario as UsuarioApi) };
}

// ── Códigos de un solo uso (verificación / reseteo) ──────────────────────────
export async function pedirCodigo(
  email: string,
  nombre: string,
  proposito: "verificacion" | "reset"
): Promise<{ ok: boolean; demoCodigo?: string; error?: string }> {
  const { ok, data } = await post("/api/auth/send-code", { email, nombre, proposito });
  if (!ok) return { ok: false, error: String(data.error ?? "No se pudo enviar el código.") };
  return { ok: true, demoCodigo: data.demoCodigo ? String(data.demoCodigo) : undefined };
}

/** Valida el código de verificación, activa la cuenta e inicia sesión. */
export async function confirmarVerificacion(email: string, codigo: string): Promise<{ ok: boolean; error?: string }> {
  const { ok, data } = await post("/api/auth/verify-code", { email, codigo });
  if (!ok) return { ok: false, error: String(data.error ?? "Código incorrecto o vencido.") };
  setUsuario(aUsuario(data.usuario as UsuarioApi));
  return { ok: true };
}

/** Valida el código de reseteo y cambia la contraseña. */
export async function confirmarReset(email: string, codigo: string, nueva: string): Promise<{ ok: boolean; error?: string }> {
  const { ok, data } = await post("/api/auth/reset-password", { email, codigo, password: nueva });
  return ok ? { ok: true } : { ok: false, error: String(data.error ?? "No se pudo cambiar la contraseña.") };
}

// ── Invitar empleado (admin) ─────────────────────────────────────────────────
export async function invitarUsuario(opts: {
  email: string;
  rol: "admin" | "empleado";
  empresas: string[];
  invitador: string;
}): Promise<{ ok: boolean; token?: string; enviado?: boolean; error?: string }> {
  const { ok, data } = await post("/api/auth/invite", opts);
  if (!ok) return { ok: false, error: String(data.error ?? "No se pudo crear la invitación.") };
  return { ok: true, token: data.token ? String(data.token) : undefined, enviado: Boolean(data.enviado) };
}
