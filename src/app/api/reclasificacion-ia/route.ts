import { NextRequest, NextResponse } from "next/server";
import { inferirRealidadLaboral, resolveProvider } from "@/lib/llm";
import { inferirSenalesDeTexto } from "@/lib/reclasificacion";

// Autodetección de cómo SE OPERA la relación a partir de una descripción libre.
// La IA detecta HECHOS; el motor determinista calcula riesgo y exposición; el abogado decide.
// Sin API key (o si la IA falla) se usa un respaldo determinista por palabras clave.

function detectaDemo(texto: string) {
  const senales = inferirSenalesDeTexto(texto);
  const n = Object.values(senales).filter(Boolean).length;
  return {
    senales,
    resumen:
      n === 0
        ? "No se detectaron señales claras de subordinación en la descripción (revisión heurística sin IA)."
        : `Se detectaron ${n} señal(es) de cómo opera la relación (revisión heurística sin IA; configure una API key para un análisis a fondo).`,
    _modo: "demo" as const,
  };
}

export async function POST(req: NextRequest) {
  let texto = "";
  try {
    const body = await req.json();
    texto = String(body?.texto ?? "");
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }
  if (!texto.trim()) {
    return NextResponse.json({ error: "Descripción vacía" }, { status: 400 });
  }

  if (!resolveProvider()) {
    return NextResponse.json(detectaDemo(texto));
  }

  try {
    const { data, provider, model } = await inferirRealidadLaboral(texto);
    const { resumen, ...senales } = data;
    return NextResponse.json({ senales, resumen, _modo: "ia", _provider: provider, _model: model });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error de inferencia";
    return NextResponse.json({ ...detectaDemo(texto), _modo: "error", _warning: msg });
  }
}
