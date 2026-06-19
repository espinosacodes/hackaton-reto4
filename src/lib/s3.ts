// ─────────────────────────────────────────────────────────────────────────
// Cliente Amazon S3 (solo servidor) para ARCHIVAR los contratos procesados.
//
// Cada contrato que un humano valida en la pestaña Contratos se sube a S3
// SEPARADO POR EMPRESA: la clave del objeto vive bajo  <prefijo>/<empresaId>/…
// de modo que la nube de cada empresa cliente queda aislada de las demás.
//
// Credenciales: se leen de S3_* y, como respaldo, de AWS_* (mismo patrón que
// ddb.ts). En local basta con las AWS_* del .env; en Vercel/Lambda conviene usar
// nombres propios (S3_*) porque Lambda inyecta sus AWS_* (rol de ejecución).
//
// Sin S3_BUCKET configurado → el archivado queda en "modo demo" (no se sube
// nada y la app no se rompe: el contrato ya quedó en la nómina del navegador).
// ─────────────────────────────────────────────────────────────────────────

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const REGION =
  process.env.S3_REGION ||
  process.env.AWS_DEFAULT_REGION ||
  process.env.AWS_REGION ||
  "us-east-1";

const ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;

const BUCKET = process.env.S3_BUCKET || "";
// Prefijo raíz dentro del bucket (carpeta lógica). Por defecto "contratos".
const PREFIX = (process.env.S3_PREFIX || "contratos").replace(/^\/+|\/+$/g, "");

/** True si hay bucket + credenciales para hablar con S3. */
export function s3Configurado(): boolean {
  return Boolean(BUCKET && ACCESS_KEY_ID && SECRET_ACCESS_KEY);
}

// Cliente perezoso y reutilizado entre invocaciones (cálido en serverless).
let _s3: S3Client | null = null;

function s3(): S3Client {
  if (_s3) return _s3;
  _s3 = new S3Client({
    region: REGION,
    ...(ACCESS_KEY_ID && SECRET_ACCESS_KEY
      ? { credentials: { accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY } }
      : {}),
  });
  return _s3;
}

/** Normaliza un fragmento para usarlo en una clave de S3 (sin acentos ni espacios). */
function slug(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "sin-nombre";
}

/** Clave base (carpeta) de una empresa dentro del bucket: <prefijo>/<empresaId>/. */
export function carpetaEmpresa(empresaId: string): string {
  return `${PREFIX}/${slug(empresaId)}/`;
}

export interface SubirContratoArgs {
  empresaId: string;
  /** Marca de tiempo (ISO) para nombrar el objeto de forma estable y ordenable. */
  ts: string;
  /** Nombre del archivo original (para conservar la extensión). */
  nombreArchivo: string;
  /** Bytes del documento original (PDF/DOCX/TXT). Opcional. */
  bytes?: Uint8Array;
  contentType?: string;
  /** Metadatos del contrato validado (se guardan como sidecar .json). */
  meta?: unknown;
}

export interface SubirContratoResult {
  bucket: string;
  /** Clave del documento original (si se subió). */
  docKey?: string;
  /** Clave del sidecar JSON con los datos validados. */
  metaKey: string;
  region: string;
}

/**
 * Archiva un contrato procesado en S3, bajo la carpeta de su empresa.
 * Sube el documento original (si viene) y un sidecar JSON con los datos validados.
 */
export async function subirContratoS3(args: SubirContratoArgs): Promise<SubirContratoResult> {
  if (!s3Configurado()) {
    throw new Error("S3 no está configurado (falta S3_BUCKET o credenciales).");
  }
  const carpeta = carpetaEmpresa(args.empresaId);
  // Sello de tiempo seguro para clave: 2026-06-19T18-30-00-000Z
  const stamp = args.ts.replace(/[:.]/g, "-");
  const base = `${carpeta}${stamp}__${slug(args.nombreArchivo || "contrato")}`;

  const cli = s3();
  let docKey: string | undefined;

  if (args.bytes && args.bytes.byteLength > 0) {
    docKey = base;
    await cli.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: docKey,
        Body: args.bytes,
        ContentType: args.contentType || "application/octet-stream",
        Metadata: { empresa: slug(args.empresaId) },
      }),
    );
  }

  // El sidecar comparte el mismo prefijo de nombre que el documento → quedan juntos.
  const metaKey = `${base}.json`;
  await cli.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: metaKey,
      Body: JSON.stringify(args.meta ?? {}, null, 2),
      ContentType: "application/json",
      Metadata: { empresa: slug(args.empresaId) },
    }),
  );

  return { bucket: BUCKET, docKey, metaKey, region: REGION };
}
