// El admin de la firma invita a un empleado. Genera un token de invitación
// firmado (HMAC) y autocontenido — funciona entre navegadores sin base de datos —
// con el rol y las empresas cliente asignadas, y lo envía por correo (Resend).
// Sin RESEND_API_KEY → modo demo: devuelve el token para compartirlo manualmente.

import { enviarCorreo, firmarToken, htmlInvitacion } from "@/lib/email";

const DIAS_7 = 7 * 24 * 60 * 60 * 1000;

export async function POST(req: Request) {
  let body: { email?: string; rol?: string; empresas?: string[]; invitador?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const rol = body.rol === "admin" ? "admin" : "empleado";
  const empresas = Array.isArray(body.empresas) ? body.empresas.map(String) : [];
  if (!email) return Response.json({ error: "Correo requerido" }, { status: 400 });
  if (rol === "empleado" && empresas.length === 0)
    return Response.json({ error: "Asigna al menos una empresa al empleado." }, { status: 400 });

  const token = firmarToken({ email, rol, empresas, exp: Date.now() + DIAS_7 });
  const asunto = "Invitación a Hurtado Gandini — Centinela";

  try {
    const enviado = await enviarCorreo(email, asunto, htmlInvitacion(String(body.invitador ?? ""), "Hurtado Gandini", token));
    return Response.json({ token, enviado });
  } catch (err) {
    // Si el envío falla, igual devolvemos el token para compartirlo manualmente (fallback).
    console.error("invite: fallo de envío, se comparte el token manualmente:", err);
    return Response.json({ token, enviado: false });
  }
}
