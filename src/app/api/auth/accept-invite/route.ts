// Valida un token de invitación (firma + expiración) y devuelve los datos del
// tenant para que el cliente cree la cuenta del miembro localmente.

import { verificarToken } from "@/lib/email";

export async function POST(req: Request) {
  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  const payload = verificarToken(String(body.token ?? "").trim());
  if (!payload) return Response.json({ error: "Invitación inválida o expirada" }, { status: 400 });

  return Response.json({
    email: payload.email,
    rol: payload.rol,
    empresas: payload.empresas ?? [],
  });
}
