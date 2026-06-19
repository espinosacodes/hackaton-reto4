import { NextRequest, NextResponse } from "next/server";
import { extraerContrato, resolveProvider } from "@/lib/llm";

// Fallback determinista para la demo cuando no hay ningún proveedor configurado.
function mockExtraccion(text: string) {
  const lower = text.toLowerCase();
  const tipo = lower.includes("prestación de servicios") || lower.includes("prestacion de servicios")
    ? "prestacion_servicios"
    : lower.includes("término fijo") || lower.includes("termino fijo")
    ? "fijo"
    : "indefinido";
  return {
    empleado: "Trabajador de muestra",
    documento: "No identificado",
    cargo: "Cargo no especificado",
    tipo,
    jornada: "completa" as const,
    horasSemana: 42,
    salarioMensual: 1_750_905,
    auxilioTransporte: true,
    salarioIntegral: lower.includes("integral"),
    fechaInicio: "2025-01-01",
    fechaFin: tipo === "fijo" ? "2025-12-31" : "",
    obligaciones: ["Pago de seguridad social", "Prima de servicios", "Vacaciones"],
    confianza: 0.55,
    observaciones:
      "Extracción simulada (sin proveedor de IA configurado). Define una API key (ANTHROPIC/OPENAI/DEEPSEEK/GEMINI) para análisis real.",
  };
}

export async function POST(req: NextRequest) {
  let text = "";
  try {
    const body = await req.json();
    text = String(body?.text ?? "");
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }
  if (!text.trim()) {
    return NextResponse.json({ error: "Texto de contrato vacío" }, { status: 400 });
  }

  // Sin proveedor → modo demo.
  if (!resolveProvider()) {
    return NextResponse.json({ ...mockExtraccion(text), _modo: "demo" });
  }

  try {
    const { data, provider, model } = await extraerContrato(text);
    return NextResponse.json({ ...data, _modo: "ia", _provider: provider, _model: model });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error de extracción";
    // La IA falló: NO disimular. Devolvemos datos de relleno marcados como NO confiables
    // (_modo: "error") para que la interfaz lo advierta de forma prominente al usuario.
    return NextResponse.json({ ...mockExtraccion(text), _modo: "error", _warning: msg });
  }
}
