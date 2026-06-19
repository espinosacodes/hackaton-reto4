// Extracción de texto de archivos (PDF / DOCX / TXT) en el navegador.
// Se ejecuta del lado del cliente para funcionar tanto en Vercel como en la
// demo estática: el texto resultante alimenta el flujo de /api/extract.

export const ACCEPTED_FILE_TYPES = ".pdf,.docx,.doc,.txt";
export const MAX_FILE_BYTES = 12 * 1024 * 1024; // 12 MB

export class FileExtractError extends Error {}

function ext(name: string): string {
  return name.slice(name.lastIndexOf(".") + 1).toLowerCase();
}

// Tiempo máximo para leer un PDF antes de abortar (evita el "Leyendo archivo…"
// infinito que se veía con ciertos PDF reales cuyo worker no resolvía nunca).
const PDF_TIMEOUT_MS = 45_000;

async function extractPdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  // Worker servido desde /public (estable en Turbopack dev y en Vercel).
  // El archivo se copia de node_modules/pdfjs-dist/build/pdf.worker.min.mjs (mismo número de versión).
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const buf = await file.arrayBuffer();
  const task = pdfjs.getDocument({
    data: new Uint8Array(buf),
    // Recursos necesarios para PDF del mundo real (contratos exportados desde
    // Word/LibreOffice): mapas de caracteres y fuentes estándar. Sin ellos, el
    // texto salía vacío o ilegible y parecía que "no leía el PDF". Se sirven
    // como estáticos desde /public/pdfjs (copiados de pdfjs-dist).
    cMapUrl: "/pdfjs/cmaps/",
    cMapPacked: true,
    standardFontDataUrl: "/pdfjs/standard_fonts/",
    // Sin sistema de fuentes del navegador no hace falta renderizar: solo texto.
    disableFontFace: true,
  });

  // Carrera contra un timeout: si el worker se cuelga, abortamos con un error
  // claro en vez de dejar la interfaz girando para siempre.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new FileExtractError(
        "La lectura del PDF tardó demasiado y se canceló. Conviértalo a DOCX/TXT o pegue el texto manualmente.",
      )),
      PDF_TIMEOUT_MS,
    );
  });

  try {
    const doc = await Promise.race([task.promise, timeout]);
    const partes: string[] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await Promise.race([doc.getPage(p), timeout]);
      const content = await Promise.race([page.getTextContent(), timeout]);
      const linea = content.items
        .map((it) => ("str" in it ? it.str : ""))
        .join(" ");
      partes.push(linea);
    }
    return partes.join("\n").replace(/[ \t]+/g, " ").trim();
  } finally {
    clearTimeout(timer);
    task.destroy().catch(() => {});
  }
}

async function extractDocx(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const buf = await file.arrayBuffer();
  const { value } = await mammoth.extractRawText({ arrayBuffer: buf });
  return value.trim();
}

async function extractTxt(file: File): Promise<string> {
  return (await file.text()).trim();
}

// Devuelve el texto plano de un contrato cargado como PDF, DOCX o TXT.
export async function extractTextFromFile(file: File): Promise<string> {
  if (file.size > MAX_FILE_BYTES) {
    throw new FileExtractError("El archivo supera el límite de 12 MB.");
  }

  const e = ext(file.name);
  let texto = "";
  try {
    if (e === "pdf") texto = await extractPdf(file);
    else if (e === "docx") texto = await extractDocx(file);
    else if (e === "txt") texto = await extractTxt(file);
    else if (e === "doc") {
      throw new FileExtractError(
        "El formato .doc (Word 97-2003) no es compatible. Conviértalo a .docx o PDF.",
      );
    } else {
      throw new FileExtractError("Formato no soportado. Use PDF, DOCX o TXT.");
    }
  } catch (err) {
    if (err instanceof FileExtractError) throw err;
    console.error("[extract-file] error real:", err);
    throw new FileExtractError(
      "No se pudo leer el archivo. ¿Está protegido o es una imagen escaneada?",
    );
  }

  if (!texto.trim()) {
    throw new FileExtractError(
      "El archivo no contiene texto seleccionable (¿es un PDF escaneado?). Pegue el texto manualmente.",
    );
  }
  return texto;
}

// Descarga un documento desde la URL del bucket de la empresa (S3/GCS/Azure o
// cualquier URL HTTPS) y extrae su texto reutilizando el mismo flujo que la
// carga local. El bucket debe permitir CORS para que el navegador lo lea.
export async function extractTextFromUrl(url: string): Promise<string> {
  // Primero intentamos el proxy del servidor (evita el bloqueo CORS de la mayoría
  // de nubes, incluido Google Drive). Si no hay servidor (demo estática) o el
  // proxy no responde, caemos a la descarga directa desde el navegador.
  let res: Response | null = null;
  try {
    const viaProxy = await fetch(`/api/fetch-doc?url=${encodeURIComponent(url)}`);
    if (viaProxy.ok) {
      res = viaProxy;
    } else {
      // El proxy existe pero rechazó: propagamos su mensaje (Drive, permisos, etc.).
      const ct = viaProxy.headers.get("content-type") ?? "";
      if (ct.includes("application/json")) {
        const body = (await viaProxy.json().catch(() => null)) as { error?: string } | null;
        if (body?.error) throw new FileExtractError(body.error);
      }
    }
  } catch (err) {
    if (err instanceof FileExtractError) throw err;
    // Sin servidor → intento directo abajo.
  }

  if (!res) {
    try {
      res = await fetch(url);
    } catch {
      throw new FileExtractError(
        "No se pudo conectar con el bucket. Verifique la URL y que el almacenamiento permita acceso CORS desde el navegador (o use Google Drive con el archivo compartido públicamente).",
      );
    }
  }
  if (!res.ok) {
    throw new FileExtractError(
      `El bucket respondió ${res.status}. Verifique la ruta del documento y los permisos de lectura.`,
    );
  }

  const blob = await res.blob();
  if (blob.size > MAX_FILE_BYTES) {
    throw new FileExtractError("El documento supera el límite de 12 MB.");
  }

  // Nombre/extensión a partir de la ruta para reutilizar el extractor por tipo.
  const path = url.split(/[?#]/)[0];
  const name = decodeURIComponent(path.slice(path.lastIndexOf("/") + 1)) || "documento.txt";
  const file = new File([blob], name, { type: blob.type });
  return extractTextFromFile(file);
}

// Lee un archivo de Google Drive por su id (vía /api/drive, con cuenta de servicio)
// y extrae su texto reutilizando el mismo flujo que un archivo local.
export async function extractTextFromDriveFile(fileId: string, nombre: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`/api/drive?fileId=${encodeURIComponent(fileId)}`);
  } catch {
    throw new FileExtractError("No se pudo conectar con Google Drive.");
  }
  if (!res.ok) {
    let msg = "No se pudo leer el archivo de Google Drive.";
    try {
      const j = (await res.json()) as { error?: string };
      if (j?.error) msg = j.error;
    } catch {
      /* respuesta sin JSON */
    }
    throw new FileExtractError(msg);
  }
  const blob = await res.blob();
  if (blob.size > MAX_FILE_BYTES) {
    throw new FileExtractError("El documento supera el límite de 12 MB.");
  }
  const file = new File([blob], nombre || "documento", { type: blob.type });
  return extractTextFromFile(file);
}
