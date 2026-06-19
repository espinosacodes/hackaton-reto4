// ─────────────────────────────────────────────────────────────────────────
// Utilidades de servidor para autenticación por correo (rutas /api/auth/*).
//  - enviarCorreo: envía vía Resend si hay RESEND_API_KEY; si no, "modo demo"
//    (devuelve false y el código/token se muestra en pantalla). Nunca rompe.
//  - hashCodigo: hash del código de verificación (el código solo viaja por email).
//  - firmarToken / verificarToken: invitaciones autocontenidas firmadas con HMAC,
//    para que funcionen entre navegadores sin base de datos.
// ─────────────────────────────────────────────────────────────────────────

import crypto from "crypto";

const FROM = process.env.EMAIL_FROM || "Centinela <onboarding@resend.dev>";
const SECRET = process.env.AUTH_SECRET || "centinela-demo-secret-cambiar-en-produccion";

/** Envía un correo con Resend. Devuelve true si se envió; false si no hay API key (modo demo). */
export async function enviarCorreo(to: string, subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY || process.env.RESEND_API;
  if (!key) return false;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
  return true;
}

/** Hash del código de un solo uso. El código en claro solo existe en el correo. */
export function hashCodigo(codigo: string, email: string, proposito: string): string {
  return crypto.createHash("sha256").update(`${codigo}:${email}:${proposito}`).digest("hex");
}

/** Firma un payload de invitación (HMAC) → token autocontenido y verificable. */
export function firmarToken(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

/** Verifica firma y expiración de un token de invitación. Devuelve el payload o null. */
export function verificarToken(token: string): Record<string, unknown> | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const esperado = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(esperado);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as Record<string, unknown>;
    if (typeof payload.exp === "number" && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

// ── Plantillas de correo (HTML mínimo y sobrio) ──────────────────────────────

function envoltura(titulo: string, cuerpo: string): string {
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1a1a1a">
    <div style="font-weight:700;font-size:18px;margin-bottom:4px">Centinela</div>
    <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#888;margin-bottom:20px">Hurtado Gandini</div>
    <h2 style="font-size:17px;margin:0 0 12px">${titulo}</h2>
    ${cuerpo}
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
    <p style="font-size:11px;color:#999">Si no esperabas este correo, puedes ignorarlo.</p>
  </div>`;
}

export function htmlCodigo(nombre: string, codigo: string, proposito: string): string {
  const accion = proposito === "reset" ? "restablecer tu contraseña" : "verificar tu cuenta";
  return envoltura(
    `Tu código para ${accion}`,
    `<p style="font-size:14px">Hola${nombre ? " " + nombre : ""}, usa este código (válido 10 minutos):</p>
     <div style="font-size:32px;font-weight:700;letter-spacing:8px;background:#f5f5f5;border-radius:8px;padding:16px;text-align:center;margin:12px 0">${codigo}</div>`
  );
}

export function htmlInvitacion(invitador: string, empresa: string, token: string): string {
  return envoltura(
    `Te invitaron a ${empresa} en Centinela`,
    `<p style="font-size:14px">${invitador || "Un administrador"} te invitó a unirte al espacio de <b>${empresa}</b>.</p>
     <p style="font-size:13px;color:#555">Abre Centinela, elige <b>"Tengo una invitación"</b> y pega este código:</p>
     <div style="font-size:12px;word-break:break-all;background:#f5f5f5;border-radius:8px;padding:14px;margin:12px 0;font-family:ui-monospace,monospace">${token}</div>`
  );
}
