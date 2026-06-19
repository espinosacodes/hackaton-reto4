import { NextRequest, NextResponse } from "next/server";
import {
  analizarEvidencia,
  evidenciaDemo,
  geminiDisponible,
  MAX_EVIDENCIA_BYTES,
  type ContextoCaso,
} from "@/lib/evidencia";

// El análisis multimodal puede tardar (video/audio): ampliamos el tiempo máximo.
export const maxDuration = 60;

const MIME_OK = (m: string) =>
  m.startsWith("image/") || m.startsWith("audio/") || m.startsWith("video/");

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido (se esperaba multipart/form-data)." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No se recibió ningún archivo." }, { status: 400 });
  }
  if (!MIME_OK(file.type)) {
    return NextResponse.json(
      { error: `Tipo no soportado (${file.type || "desconocido"}). Use imagen, audio o video.` },
      { status: 415 },
    );
  }
  if (file.size > MAX_EVIDENCIA_BYTES) {
    return NextResponse.json(
      { error: `El archivo supera el límite de ${Math.round(MAX_EVIDENCIA_BYTES / 1024 / 1024)} MB para análisis inline.` },
      { status: 413 },
    );
  }

  const ctx: ContextoCaso = {
    empleado: str(form.get("empleado")),
    cargo: str(form.get("cargo")),
    hechos: str(form.get("hechos")),
    causal: str(form.get("causal")),
  };

  // Sin proveedor multimodal → análisis simulado (la demo no se rompe).
  if (!geminiDisponible()) {
    return NextResponse.json({ ...evidenciaDemo(file.type, file.name), _modo: "demo" });
  }

  try {
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const r = await analizarEvidencia(base64, file.type, ctx);
    return NextResponse.json({ ...r, _modo: "ia" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al analizar la prueba.";
    return NextResponse.json({ ...evidenciaDemo(file.type, file.name), _modo: "error", _warning: msg });
  }
}

function str(v: FormDataEntryValue | null): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}
