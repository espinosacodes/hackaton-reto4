import { NextRequest, NextResponse } from "next/server";
import { s3Configurado, subirContratoS3 } from "@/lib/s3";

// Node runtime: el SDK de AWS y los buffers binarios no corren en el edge.
export const runtime = "nodejs";

const MAX_BYTES = 12 * 1024 * 1024; // 12 MB (igual que el límite de lectura)

// Archiva en Amazon S3 un contrato YA procesado y validado por un humano.
// Recibe multipart/form-data:
//   - empresaId    (obligatorio) → separa el almacenamiento por empresa
//   - meta         (JSON string) → datos validados del contrato (sidecar .json)
//   - file         (opcional)    → documento original (PDF/DOCX/TXT)
//   - nombreArchivo / ts (opcionales)
//
// Sin S3 configurado → responde { _modo: "demo" } sin romper el flujo: el
// contrato ya quedó en la nómina del navegador; solo no se archiva en la nube.
export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Se esperaba multipart/form-data." }, { status: 400 });
  }

  const empresaId = String(form.get("empresaId") ?? "").trim();
  if (!empresaId) {
    return NextResponse.json({ error: "Falta empresaId." }, { status: 400 });
  }

  const ts = String(form.get("ts") ?? "") || new Date().toISOString();

  let meta: unknown = {};
  const metaRaw = form.get("meta");
  if (typeof metaRaw === "string" && metaRaw.trim()) {
    try {
      meta = JSON.parse(metaRaw);
    } catch {
      return NextResponse.json({ error: "meta no es JSON válido." }, { status: 400 });
    }
  }

  // Documento original (opcional: las fuentes de solo-texto no lo aportan).
  let bytes: Uint8Array | undefined;
  let contentType: string | undefined;
  let nombreArchivo = String(form.get("nombreArchivo") ?? "").trim();
  const file = form.get("file");
  if (file && typeof file === "object" && "arrayBuffer" in file) {
    const blob = file as Blob & { name?: string };
    if (blob.size > MAX_BYTES) {
      return NextResponse.json({ error: "El archivo supera el límite de 12 MB." }, { status: 413 });
    }
    bytes = new Uint8Array(await blob.arrayBuffer());
    contentType = blob.type || undefined;
    if (!nombreArchivo && blob.name) nombreArchivo = blob.name;
  }
  if (!nombreArchivo) nombreArchivo = "contrato";

  // Sin S3 → modo demo (no se rompe nada).
  if (!s3Configurado()) {
    return NextResponse.json({
      _modo: "demo",
      mensaje:
        "S3 no está configurado (defina S3_BUCKET y credenciales AWS). El contrato no se archivó en la nube.",
    });
  }

  try {
    const r = await subirContratoS3({ empresaId, ts, nombreArchivo, bytes, contentType, meta });
    return NextResponse.json({ _modo: "s3", ...r });
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : "No se pudo archivar en S3.";
    return NextResponse.json({ _modo: "error", error: mensaje }, { status: 502 });
  }
}
