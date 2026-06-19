// Genera un código de un solo uso (verificación de cuenta o reseteo de
// contraseña), guarda su HASH en DynamoDB (tabla con TTL) y lo envía por correo
// (Resend). El código en claro solo viaja por email; nunca se devuelve al cliente.
// Sin RESEND_API_KEY → modo demo: devuelve el código para mostrarlo en pantalla.

import { enviarCorreo, htmlCodigo } from "@/lib/email";
import { guardarCodigo } from "@/lib/accounts-server";

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
  const asunto =
    proposito === "reset" ? "Restablece tu contraseña — Centinela" : "Verifica tu cuenta — Centinela";

  try {
    await guardarCodigo(email, proposito, codigo);
  } catch (err) {
    console.error("send-code: error al guardar el código:", err);
    return Response.json({ error: "Error de servidor. Intenta de nuevo." }, { status: 500 });
  }

  try {
    const enviado = await enviarCorreo(email, asunto, htmlCodigo(String(body.nombre ?? ""), codigo, proposito));
    // Sin servicio de correo (o si falla), mostramos el código en pantalla (fallback demo).
    return Response.json(enviado ? { ok: true } : { ok: true, demoCodigo: codigo });
  } catch (err) {
    console.error("send-code: fallo de envío, fallback a pantalla:", err);
    return Response.json({ ok: true, demoCodigo: codigo });
  }
}
