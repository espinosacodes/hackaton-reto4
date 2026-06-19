import { NextRequest, NextResponse } from "next/server";
import {
  driveConfigurado,
  driveServiceAccountEmail,
  extraerDriveId,
  listarCarpeta,
  descargarArchivo,
} from "@/lib/drive";

// API de Google Drive (cuenta de servicio):
//   GET /api/drive                      → estado de la conexión + correo a compartir
//   GET /api/drive?folderId=...|link    → lista de archivos de la carpeta
//   GET /api/drive?fileId=...           → contenido del archivo (bytes / texto)

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const folderId = sp.get("folderId");
  const fileId = sp.get("fileId");

  // Estado / configuración (para mostrar el correo de la cuenta de servicio).
  if (!folderId && !fileId) {
    return NextResponse.json({
      configured: driveConfigurado(),
      serviceAccountEmail: driveServiceAccountEmail(),
    });
  }

  if (!driveConfigurado()) {
    return NextResponse.json(
      { error: "La conexión con Google Drive no está configurada en el servidor." },
      { status: 501 },
    );
  }

  try {
    if (folderId) {
      const files = await listarCarpeta(extraerDriveId(folderId));
      return NextResponse.json({ files });
    }
    // fileId → contenido
    const { buffer, mimeType, nombre } = await descargarArchivo(extraerDriveId(fileId!));
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(nombre)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error de Google Drive";
    // 403/404 típicos: la carpeta no está compartida con la cuenta de servicio.
    const compartir = /permission|not found|insufficient|403|404/i.test(msg);
    return NextResponse.json(
      {
        error: compartir
          ? `No se pudo acceder. Verifique que la carpeta esté compartida con ${driveServiceAccountEmail()} (rol Lector).`
          : msg,
      },
      { status: 502 },
    );
  }
}
