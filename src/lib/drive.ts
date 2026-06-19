import { google, drive_v3 } from "googleapis";

// ─────────────────────────────────────────────────────────────────────────
// Conexión a Google Drive por API (Service Account).
// La firma comparte su carpeta de Drive con el correo de la cuenta de servicio
// (GOOGLE_DRIVE_SA_EMAIL) y Centinela lista y lee los documentos directamente,
// reflejando lo que se vaya subiendo. La cuenta de servicio NO almacena nada:
// solo lee lo que se le comparte (no requiere almacenamiento propio).
// ─────────────────────────────────────────────────────────────────────────

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  esCarpeta: boolean;
}

let cached: drive_v3.Drive | null = null;

function credentials(): { client_email: string; private_key: string } | null {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_B64;
  if (!b64) return null;
  try {
    const json = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
    if (json.client_email && json.private_key) return json;
  } catch {
    /* credenciales inválidas */
  }
  return null;
}

/** ¿Está configurada la conexión de Drive (hay cuenta de servicio)? */
export function driveConfigurado(): boolean {
  return credentials() !== null;
}

/** Correo de la cuenta de servicio con el que la firma debe compartir su carpeta. */
export function driveServiceAccountEmail(): string {
  return process.env.GOOGLE_DRIVE_SA_EMAIL ?? credentials()?.client_email ?? "";
}

function client(): drive_v3.Drive {
  if (cached) return cached;
  const creds = credentials();
  if (!creds) throw new Error("Drive no configurado: falta GOOGLE_SERVICE_ACCOUNT_B64.");
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
  cached = google.drive({ version: "v3", auth });
  return cached;
}

const CARPETA = "application/vnd.google-apps.folder";

/** Extrae el id de carpeta/archivo desde una URL de Drive o lo devuelve tal cual. */
export function extraerDriveId(input: string): string {
  const s = input.trim();
  const m =
    s.match(/\/folders\/([\w-]+)/) ||
    s.match(/\/file\/d\/([\w-]+)/) ||
    s.match(/[?&]id=([\w-]+)/);
  return m ? m[1] : s;
}

/** Lista los archivos (y subcarpetas) de una carpeta compartida con la cuenta de servicio. */
export async function listarCarpeta(folderId: string): Promise<DriveFile[]> {
  const drive = client();
  const res = await drive.files.list({
    q: `'${folderId.replace(/'/g, "")}' in parents and trashed=false`,
    fields: "files(id,name,mimeType,modifiedTime)",
    orderBy: "folder,modifiedTime desc",
    pageSize: 200,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return (res.data.files ?? []).map((f) => ({
    id: f.id!,
    name: f.name ?? "(sin nombre)",
    mimeType: f.mimeType ?? "",
    modifiedTime: f.modifiedTime ?? undefined,
    esCarpeta: f.mimeType === CARPETA,
  }));
}

// MIME de exportación para documentos nativos de Google (Docs/Sheets/Slides).
const EXPORT: Record<string, { mime: string; ext: string }> = {
  "application/vnd.google-apps.document": { mime: "text/plain", ext: "txt" },
  "application/vnd.google-apps.spreadsheet": { mime: "text/csv", ext: "csv" },
  "application/vnd.google-apps.presentation": { mime: "text/plain", ext: "txt" },
};

export interface DriveContenido {
  buffer: Buffer;
  mimeType: string;
  nombre: string;
}

/** Descarga el contenido de un archivo de Drive (exporta los documentos nativos a texto). */
export async function descargarArchivo(fileId: string): Promise<DriveContenido> {
  const drive = client();
  const meta = await drive.files.get({
    fileId,
    fields: "name,mimeType",
    supportsAllDrives: true,
  });
  const nombreBase = meta.data.name ?? "documento";
  const mime = meta.data.mimeType ?? "application/octet-stream";

  const exp = EXPORT[mime];
  if (exp) {
    const res = await drive.files.export(
      { fileId, mimeType: exp.mime },
      { responseType: "arraybuffer" },
    );
    const nombre = /\.[a-z0-9]+$/i.test(nombreBase) ? nombreBase : `${nombreBase}.${exp.ext}`;
    return { buffer: Buffer.from(res.data as ArrayBuffer), mimeType: exp.mime, nombre };
  }

  const res = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "arraybuffer" },
  );
  return { buffer: Buffer.from(res.data as ArrayBuffer), mimeType: mime, nombre: nombreBase };
}
