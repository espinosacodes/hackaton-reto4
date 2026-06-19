// Crea una cuenta en DynamoDB. Dos modos:
//  - "admin": activa al administrador FIJO de la firma (correo === ADMIN_EMAIL).
//    Queda sin verificar; el código por correo la activa (verify-code).
//  - "invite": valida el token de invitación firmado y crea la cuenta del
//    empleado YA verificada (la invitación valida el correo).

import {
  ADMIN_EMAIL,
  crearCuentaSiNueva,
  getCuenta,
  hashPassword,
  publica,
  putCuenta,
  randSalt,
  norm,
  type Cuenta,
} from "@/lib/accounts-server";
import { verificarToken } from "@/lib/email";
import { EMPRESAS } from "@/lib/data/empresas";

export async function POST(req: Request) {
  let body: { mode?: string; nombre?: string; password?: string; email?: string; token?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  const password = String(body.password ?? "");
  if (password.length < 6) return Response.json({ error: "La contraseña debe tener al menos 6 caracteres." }, { status: 400 });
  const nombre = String(body.nombre ?? "").trim();
  const todas = EMPRESAS.map((e) => e.id);

  try {
    if (body.mode === "admin") {
      const email = norm(String(body.email ?? ""));
      if (email !== ADMIN_EMAIL)
        return Response.json({ error: "Ese correo no es el administrador de la firma. Pide una invitación." }, { status: 403 });
      if (await getCuenta(email)) return Response.json({ error: "El administrador ya está activado. Inicia sesión." }, { status: 409 });

      const salt = randSalt();
      const cuenta: Cuenta = {
        email,
        nombre: nombre || "Administrador",
        passHash: hashPassword(password, salt),
        salt,
        rol: "admin",
        empresas: todas,
        verificado: false, // se activa con el código por correo
        ts: new Date().toISOString(),
      };
      const creada = await crearCuentaSiNueva(cuenta);
      if (!creada) return Response.json({ error: "El administrador ya está activado. Inicia sesión." }, { status: 409 });
      return Response.json({ ok: true });
    }

    if (body.mode === "invite") {
      const payload = verificarToken(String(body.token ?? "").trim());
      if (!payload) return Response.json({ error: "Invitación inválida o expirada." }, { status: 400 });
      const email = norm(String(payload.email ?? ""));
      const rol = payload.rol === "admin" ? "admin" : "empleado";
      const empresas = rol === "admin" ? todas : (Array.isArray(payload.empresas) ? payload.empresas.map(String) : []);

      const salt = randSalt();
      const cuenta: Cuenta = {
        email,
        nombre: nombre || email,
        passHash: hashPassword(password, salt),
        salt,
        rol,
        empresas,
        verificado: true, // la invitación valida el correo
        ts: new Date().toISOString(),
      };
      // Si ya existía, actualiza credenciales (re-aceptar invitación).
      const nueva = await crearCuentaSiNueva(cuenta);
      if (!nueva) await putCuenta(cuenta);
      return Response.json({ usuario: publica(cuenta) });
    }

    return Response.json({ error: "Modo de registro inválido." }, { status: 400 });
  } catch (err) {
    console.error("register: error:", err);
    return Response.json({ error: "Error de servidor. Intenta de nuevo." }, { status: 500 });
  }
}
