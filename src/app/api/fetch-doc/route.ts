import { NextRequest, NextResponse } from "next/server";

// Proxy de descarga de documentos del "bucket" de la empresa.
// El navegador no puede leer la mayoría de nubes (Google Drive, S3 privado, etc.)
// por CORS; por eso la descarga la hace el servidor y devuelve los bytes al cliente,
// que extrae el texto con el mismo flujo que un archivo local.
// Nota: en el despliegue estático sin servidor este route no existe y el cliente
// cae a la descarga directa (fetch del navegador).

const MAX_BYTES = 12 * 1024 * 1024;

function esUrlPermitida(u: URL): boolean {
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  // Bloqueo básico anti-SSRF: nada de localhost ni rangos privados/metadata.
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h === "0.0.0.0" || h.endsWith(".local")) return false;
  if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false;
  if (h === "169.254.169.254") return false; // metadata cloud
  return true;
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) return NextResponse.json({ error: "Falta el parámetro url" }, { status: 400 });

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return NextResponse.json({ error: "URL inválida" }, { status: 400 });
  }
  if (!esUrlPermitida(url)) {
    return NextResponse.json({ error: "URL no permitida" }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(url.toString(), { redirect: "follow" });
  } catch {
    return NextResponse.json(
      { error: "No se pudo conectar con el origen del documento." },
      { status: 502 },
    );
  }
  if (!res.ok) {
    return NextResponse.json(
      { error: `El origen respondió ${res.status}. Verifique la ruta y los permisos de lectura.` },
      { status: 502 },
    );
  }

  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "El documento supera el límite de 12 MB." }, { status: 413 });
  }

  const ct = res.headers.get("content-type") ?? "application/octet-stream";
  // HTML suele indicar una página de login/permisos de Drive, no el archivo.
  if (ct.includes("text/html") && buf.byteLength < 50_000) {
    return NextResponse.json(
      {
        error:
          "El enlace no devolvió un documento (parece una página de permisos). En Google Drive comparta el archivo como 'Cualquiera con el enlace' y use el enlace del archivo, no de la carpeta.",
      },
      { status: 422 },
    );
  }

  return new NextResponse(buf, {
    status: 200,
    headers: { "Content-Type": ct, "Cache-Control": "no-store" },
  });
}
