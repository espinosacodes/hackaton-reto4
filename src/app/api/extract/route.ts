import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

// Extracción de cláusulas: tarea de alto volumen y bajo riesgo → modelo económico.
// Configurable; por defecto Haiku 4.5 (clasificación/extracción es su punto fuerte).
const EXTRACT_MODEL = process.env.CENTINELA_EXTRACT_MODEL ?? "claude-haiku-4-5";

const ExtraccionSchema = z.object({
  empleado: z.string().describe("Nombre completo del trabajador"),
  documento: z.string().describe("Número de identificación, o 'No identificado'"),
  cargo: z.string(),
  tipo: z
    .enum(["indefinido", "fijo", "obra_labor", "prestacion_servicios", "aprendizaje", "plataforma"])
    .describe("Tipo de vínculo según el contrato"),
  jornada: z.enum(["completa", "parcial", "por_horas"]),
  horasSemana: z.number().describe("Horas semanales pactadas (máx. legal 42 desde 2026)"),
  salarioMensual: z.number().describe("Salario mensual en pesos colombianos (solo número)"),
  auxilioTransporte: z.boolean().describe("Si tiene derecho a auxilio de transporte"),
  salarioIntegral: z.boolean().describe("Si es salario integral (CST art. 132)"),
  fechaInicio: z.string().describe("Fecha de inicio en formato AAAA-MM-DD"),
  fechaFin: z.string().describe("Fecha de terminación AAAA-MM-DD, o cadena vacía si es indefinido"),
  obligaciones: z.array(z.string()).describe("Obligaciones periódicas del empleador detectadas"),
  confianza: z.number().describe("Confianza de la extracción entre 0 y 1"),
  observaciones: z.string().describe("Riesgos o ambigüedades para que el abogado revise"),
});

const SYSTEM = `Eres un asistente de extracción documental para una firma de abogados laboralistas en Colombia.
Tu única función es LEER un contrato laboral y devolver sus datos estructurados. No calculas prestaciones ni emites conceptos jurídicos: eso lo hace un motor determinista y lo valida un abogado.
Extrae con precisión. Si un dato no aparece, infiérelo de forma conservadora y refléjalo en 'confianza' y 'observaciones'. Identifica señales de subordinación en contratos de prestación de servicios.`;

// Fallback determinista para la demo cuando no hay API key.
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
      "Extracción simulada (sin API key configurada). Configure ANTHROPIC_API_KEY para análisis real con IA.",
    _modo: "demo" as const,
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

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ ...mockExtraccion(text), _modo: "demo" });
  }

  try {
    const client = new Anthropic();
    const response = await client.messages.parse({
      model: EXTRACT_MODEL,
      max_tokens: 2048,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Extrae los datos estructurados de este contrato laboral:\n\n"""${text.slice(0, 20000)}"""`,
        },
      ],
      output_config: { format: zodOutputFormat(ExtraccionSchema) },
    });

    const data = response.parsed_output;
    if (!data) {
      return NextResponse.json({ error: "No se pudo extraer" }, { status: 502 });
    }
    return NextResponse.json({ ...data, _modo: "ia", _model: EXTRACT_MODEL });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error de extracción";
    // Degradación elegante: cae al mock para no romper la demo.
    return NextResponse.json({ ...mockExtraccion(text), _modo: "demo", _warning: msg });
  }
}
