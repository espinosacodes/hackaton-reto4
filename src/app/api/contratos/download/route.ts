import { NextRequest, NextResponse } from "next/server";
import { descargarContratoS3, s3Configurado } from "@/lib/s3";

// Node runtime: el SDK de AWS y los buffers binarios no corren en el edge.
export const runtime = "nodejs";

// Descarga el documento ORIGINAL de un contrato desde S3.
//   GET /api/contratos/download?key=contratos/<empresaId>/…&name=archivo.pdf
// La clave se valida en s3.ts (debe vivir bajo el prefijo de contratos).
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key") ?? "";
  const name = req.nextUrl.searchParams.get("name") || key.split("/").pop() || "contrato";
  if (!key) {
    return NextResponse.json({ error: "Falta el parámetro key." }, { status: 400 });
  }
  if (!s3Configurado()) {
    return NextResponse.json({ error: "S3 no está configurado en el servidor." }, { status: 503 });
  }
  try {
    const { bytes, contentType } = await descargarContratoS3(key);
    // Nombre seguro para la cabecera Content-Disposition (sin saltos ni comillas).
    const safe = name.replace(/[\r\n"]/g, "_");
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${safe}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "No se pudo descargar el documento.";
    const status = /no permitida/i.test(msg) ? 400 : /NoSuchKey|not.*exist/i.test(msg) ? 404 : 502;
    return NextResponse.json({ error: msg }, { status });
  }
}
