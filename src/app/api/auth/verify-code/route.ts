// Valida el código de VERIFICACIÓN (un solo uso, contra DynamoDB), activa la
// cuenta y devuelve el usuario público para iniciar sesión.

import { validarCodigo, marcarVerificada, getCuenta, publica } from "@/lib/accounts-server";

export async function POST(req: Request) {
  let body: { email?: string; codigo?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const codigo = String(body.codigo ?? "").trim();
  if (!email || !codigo) return Response.json({ error: "Correo y código requeridos" }, { status: 400 });

  try {
    const cuenta = await getCuenta(email);
    if (!cuenta) return Response.json({ error: "La cuenta no existe." }, { status: 404 });
    if (!(await validarCodigo(email, "verificacion", codigo)))
      return Response.json({ error: "Código incorrecto o vencido." }, { status: 400 });
    await marcarVerificada(email);
    return Response.json({ usuario: publica({ ...cuenta, verificado: true }) });
  } catch (err) {
    console.error("verify-code: error:", err);
    return Response.json({ error: "Error de servidor. Intenta de nuevo." }, { status: 500 });
  }
}
