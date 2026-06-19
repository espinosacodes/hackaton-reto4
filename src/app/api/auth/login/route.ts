// Inicia sesión contra DynamoDB: verifica contraseña (scrypt) y devuelve el
// usuario público. La sesión activa la fija el cliente (store.ts).

import { getCuenta, verifyPassword, publica } from "@/lib/accounts-server";

export async function POST(req: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!email || !password) return Response.json({ error: "Correo y contraseña requeridos" }, { status: 400 });

  let cuenta;
  try {
    cuenta = await getCuenta(email);
  } catch (err) {
    console.error("login: error DynamoDB:", err);
    return Response.json({ error: "Error de servidor. Intenta de nuevo." }, { status: 500 });
  }

  // Mensaje genérico para no revelar si el correo existe.
  if (!cuenta || !verifyPassword(password, cuenta.salt, cuenta.passHash)) {
    return Response.json({ error: "Correo o contraseña incorrectos." }, { status: 401 });
  }
  if (!cuenta.verificado) {
    return Response.json({ error: "Verifica tu correo para activar la cuenta.", noVerificado: true }, { status: 403 });
  }

  return Response.json({ usuario: publica(cuenta) });
}
