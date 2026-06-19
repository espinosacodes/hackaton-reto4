// ─────────────────────────────────────────────────────────────────────────
// Operaciones de cuentas en DynamoDB (SOLO servidor). Fuente de verdad de los
// usuarios de la firma: persisten entre navegadores y dispositivos (a diferencia
// del modo demo anterior en localStorage).
//
//  - Contraseñas con scrypt (Node crypto, sin dependencias) + salt por usuario.
//  - Códigos de un solo uso en tabla aparte con TTL (se autolimpian).
//  - Invitaciones siguen siendo tokens firmados (HMAC), sin estado (ver email.ts).
// ─────────────────────────────────────────────────────────────────────────

import crypto from "crypto";
import { GetCommand, PutCommand, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE } from "./ddb";
import { hashCodigo } from "./email";
import { EMPRESAS } from "./data/empresas";
import { ADMIN_EMAIL, DEMO_PASSWORD, CUENTAS_DEMO, type Rol } from "./data/cuentas-demo";

export { ADMIN_EMAIL };

export interface Cuenta {
  email: string; // PK, en minúsculas
  nombre: string;
  passHash: string;
  salt: string;
  rol: Rol;
  empresas: string[];
  verificado: boolean;
  ts: string;
}

/** Vista de la cuenta sin secretos, segura para devolver al cliente. */
export type CuentaPublica = Omit<Cuenta, "passHash" | "salt">;

export function publica(c: Cuenta): CuentaPublica {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passHash, salt, ...rest } = c;
  return rest;
}

export function norm(email: string): string {
  return email.trim().toLowerCase();
}

// ── Criptografía ─────────────────────────────────────────────────────────────
export function randSalt(): string {
  return crypto.randomBytes(16).toString("hex");
}
export function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}
export function verifyPassword(password: string, salt: string, hash: string): boolean {
  const calc = Buffer.from(hashPassword(password, salt), "hex");
  const ref = Buffer.from(hash, "hex");
  return calc.length === ref.length && crypto.timingSafeEqual(calc, ref);
}

// ── Cuentas ──────────────────────────────────────────────────────────────────
export async function getCuenta(email: string): Promise<Cuenta | null> {
  const res = await ddb().send(new GetCommand({ TableName: TABLE("users"), Key: { email: norm(email) } }));
  return (res.Item as Cuenta | undefined) ?? null;
}

export async function putCuenta(c: Cuenta): Promise<void> {
  await ddb().send(new PutCommand({ TableName: TABLE("users"), Item: { ...c, email: norm(c.email) } }));
}

/** Crea la cuenta solo si no existe (evita pisar una cuenta real). */
export async function crearCuentaSiNueva(c: Cuenta): Promise<boolean> {
  try {
    await ddb().send(
      new PutCommand({
        TableName: TABLE("users"),
        Item: { ...c, email: norm(c.email) },
        ConditionExpression: "attribute_not_exists(email)",
      })
    );
    return true;
  } catch (err) {
    if (err instanceof Error && err.name === "ConditionalCheckFailedException") return false;
    throw err;
  }
}

export async function marcarVerificada(email: string): Promise<void> {
  await ddb().send(
    new UpdateCommand({
      TableName: TABLE("users"),
      Key: { email: norm(email) },
      UpdateExpression: "SET verificado = :v",
      ExpressionAttributeValues: { ":v": true },
    })
  );
}

export async function actualizarPassword(email: string, password: string): Promise<void> {
  const salt = randSalt();
  const passHash = hashPassword(password, salt);
  await ddb().send(
    new UpdateCommand({
      TableName: TABLE("users"),
      Key: { email: norm(email) },
      UpdateExpression: "SET passHash = :h, salt = :s",
      ExpressionAttributeValues: { ":h": passHash, ":s": salt },
    })
  );
}

// ── Códigos de un solo uso (tabla con TTL) ────────────────────────────────────
type Proposito = "verificacion" | "reset";
const VENTANA_MS = 10 * 60 * 1000;

function codeId(email: string, proposito: Proposito): string {
  return `${norm(email)}#${proposito}`;
}

export async function guardarCodigo(email: string, proposito: Proposito, codigo: string): Promise<void> {
  const e = norm(email);
  const ahora = Date.now();
  await ddb().send(
    new PutCommand({
      TableName: TABLE("codes"),
      Item: {
        id: codeId(e, proposito),
        hash: hashCodigo(codigo, e, proposito),
        expira: ahora + VENTANA_MS,
        ttl: Math.floor((ahora + VENTANA_MS) / 1000), // epoch segundos para TTL de DynamoDB
      },
    })
  );
}

export async function validarCodigo(email: string, proposito: Proposito, codigo: string): Promise<boolean> {
  const e = norm(email);
  const res = await ddb().send(new GetCommand({ TableName: TABLE("codes"), Key: { id: codeId(e, proposito) } }));
  const item = res.Item as { hash: string; expira: number } | undefined;
  if (!item) return false;
  if (Date.now() > item.expira) return false;
  const esperado = hashCodigo(codigo.trim(), e, proposito);
  if (item.hash.length !== esperado.length) return false;
  const ok = crypto.timingSafeEqual(Buffer.from(item.hash), Buffer.from(esperado));
  if (ok) await borrarCodigo(e, proposito); // un solo uso
  return ok;
}

export async function borrarCodigo(email: string, proposito: Proposito): Promise<void> {
  await ddb().send(new DeleteCommand({ TableName: TABLE("codes"), Key: { id: codeId(email, proposito) } }));
}

// ── Sembrado de cuentas demo (idempotente) ────────────────────────────────────
export async function seedDemo(): Promise<{ creadas: number }> {
  let creadas = 0;
  const todas = EMPRESAS.map((e) => e.id);
  for (const d of CUENTAS_DEMO) {
    const salt = randSalt();
    const cuenta: Cuenta = {
      email: norm(d.email),
      nombre: d.nombre,
      passHash: hashPassword(DEMO_PASSWORD, salt),
      salt,
      rol: d.rol,
      empresas: d.rol === "admin" ? todas : d.empresas,
      verificado: true,
      ts: new Date().toISOString(),
    };
    if (await crearCuentaSiNueva(cuenta)) creadas++;
  }
  return { creadas };
}
