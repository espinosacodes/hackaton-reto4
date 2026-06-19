// Genera un código de un solo uso (verificación de cuenta o reseteo de
// contraseña), lo envía por correo (Resend) y devuelve su hash al cliente.
// El código en claro solo viaja por email; el cliente compara contra el hash.
// Sin RESEND_API_KEY → modo demo: devuelve el código para mostrarlo en pantalla.

import { enviarCorreo, hashCodigo, htmlCodigo } from "@/lib/email";

export async function POST(req: Request) {
  let body: { email?: string; nombre?: string; proposito?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const proposito = body.proposito === "reset" ? "reset" : "verificacion";
  if (!email) return Response.json({ error: "Correo requerido" }, { status: 400 });

  const codigo = String(Math.floor(100000 + Math.random() * 900000));
  const hash = hashCodigo(codigo, email, proposito);
  const asunto =
    proposito === "reset"
      ? "Restablece tu contraseña — Centinela"
      : "Verifica tu cuenta — Centinela";

  try {
    const enviado = await enviarCorreo(email, asunto, htmlCodigo(String(body.nombre ?? ""), codigo, proposito));
    // Si no hay servicio de correo, o el envío falla, mostramos el código en pantalla (fallback).
    return Response.json(enviado ? { hash } : { hash, demoCodigo: codigo });
  } catch (err) {
    console.error("send-code: fallo de envío, fallback a pantalla:", err);
    return Response.json({ hash, demoCodigo: codigo });
  }
}
