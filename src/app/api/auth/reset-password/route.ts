// Valida el código de RESET (un solo uso, contra DynamoDB) y cambia la contraseña.

import { validarCodigo, actualizarPassword, getCuenta } from "@/lib/accounts-server";

export async function POST(req: Request) {
  let body: { email?: string; codigo?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const codigo = String(body.codigo ?? "").trim();
  const password = String(body.password ?? "");
  if (password.length < 6) return Response.json({ error: "La contraseña debe tener al menos 6 caracteres." }, { status: 400 });
  if (!email || !codigo) return Response.json({ error: "Correo y código requeridos" }, { status: 400 });

  try {
    if (!(await getCuenta(email))) return Response.json({ error: "No existe una cuenta con ese correo." }, { status: 404 });
    if (!(await validarCodigo(email, "reset", codigo)))
      return Response.json({ error: "Código incorrecto o vencido." }, { status: 400 });
    await actualizarPassword(email, password);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("reset-password: error:", err);
    return Response.json({ error: "Error de servidor. Intenta de nuevo." }, { status: 500 });
  }
}
