// ─────────────────────────────────────────────────────────────────────────
// Cliente DynamoDB (solo servidor) para el backend de cuentas/sesiones.
//
// Credenciales: se leen de DDB_* y, como respaldo, de AWS_*. Esto es DELIBERADO:
// en Vercel las funciones corren sobre AWS Lambda, que INYECTA sus propias
// AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY (rol de ejecución, sin permisos de
// DynamoDB). Por eso en producción usamos nombres propios (DDB_*) y pasamos las
// credenciales explícitamente; en local basta con las AWS_* del .env.
//
// Tablas: prefijo "hackaton-reto4" → TABLE("users") = "hackaton-reto4-users".
// ─────────────────────────────────────────────────────────────────────────

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const REGION =
  process.env.DDB_REGION ||
  process.env.AWS_DEFAULT_REGION ||
  process.env.AWS_REGION ||
  "us-east-1";

const ACCESS_KEY_ID = process.env.DDB_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.DDB_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;

const PREFIX = process.env.DDB_TABLE_PREFIX || "hackaton-reto4";

/** Nombre completo de tabla: TABLE("users") → "hackaton-reto4-users". */
export function TABLE(name: string): string {
  return `${PREFIX}-${name}`;
}

/** True si hay credenciales explícitas para hablar con DynamoDB. */
export function ddbConfigurado(): boolean {
  return Boolean(ACCESS_KEY_ID && SECRET_ACCESS_KEY);
}

// Cliente perezoso y reutilizado entre invocaciones (cálido en serverless).
let _doc: DynamoDBDocumentClient | null = null;

export function ddb(): DynamoDBDocumentClient {
  if (_doc) return _doc;
  const base = new DynamoDBClient({
    region: REGION,
    // Si no hay credenciales explícitas, se deja la cadena por defecto del SDK
    // (perfiles locales). En Vercel SIEMPRE deben venir las DDB_*.
    ...(ACCESS_KEY_ID && SECRET_ACCESS_KEY
      ? { credentials: { accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY } }
      : {}),
  });
  _doc = DynamoDBDocumentClient.from(base, {
    marshallOptions: { removeUndefinedValues: true },
  });
  return _doc;
}
