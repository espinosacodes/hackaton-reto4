import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import OpenAI from "openai";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────
// Capa de IA agnóstica de proveedor.
// La extracción de contratos es una tarea de alto volumen y bajo riesgo:
// soportamos varios proveedores para demostrar una solución COSTO-EFECTIVA.
// Claude usa su SDK; OpenAI, DeepSeek y Gemini comparten la API compatible
// con OpenAI (solo cambia baseURL + modelo).
// ─────────────────────────────────────────────────────────────────────────

export const ExtraccionSchema = z.object({
  empleado: z.string().describe("Nombre completo del trabajador"),
  documento: z.string().describe("Número de identificación, o 'No identificado'"),
  cargo: z.string(),
  tipo: z.enum([
    "indefinido",
    "fijo",
    "obra_labor",
    "prestacion_servicios",
    "aprendizaje",
    "plataforma",
  ]),
  jornada: z.enum(["completa", "parcial", "por_horas"]),
  horasSemana: z.number(),
  salarioMensual: z.number(),
  auxilioTransporte: z.boolean(),
  salarioIntegral: z.boolean(),
  fechaInicio: z.string().describe("AAAA-MM-DD"),
  fechaFin: z.string().describe("AAAA-MM-DD o cadena vacía si es indefinido"),
  obligaciones: z.array(z.string()),
  confianza: z.number().describe("0 a 1"),
  observaciones: z.string().describe("Riesgos o ambigüedades para que el abogado revise"),
});

export type Extraccion = z.infer<typeof ExtraccionSchema>;

type Kind = "anthropic" | "openai";

interface ProviderCfg {
  label: string;
  keyEnv: string;
  kind: Kind;
  baseURL?: string;
  model: string; // modelo económico por defecto
}

// Modelos por defecto: el escalón más barato de cada proveedor.
export const PROVIDERS: Record<string, ProviderCfg> = {
  anthropic: { label: "Claude (Anthropic)", keyEnv: "ANTHROPIC_API_KEY", kind: "anthropic", model: "claude-haiku-4-5" },
  openai: { label: "OpenAI", keyEnv: "OPENAI_API_KEY", kind: "openai", model: "gpt-4o-mini" },
  deepseek: { label: "DeepSeek", keyEnv: "DEEPSEEK_API_KEY", kind: "openai", baseURL: "https://api.deepseek.com", model: "deepseek-chat" },
  gemini: { label: "Gemini (Google)", keyEnv: "GEMINI_API_KEY", kind: "openai", baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/", model: "gemini-2.0-flash" },
};

const ORDER = ["anthropic", "openai", "deepseek", "gemini"] as const;

/** Resuelve el proveedor activo: LLM_PROVIDER explícito, o el primero con API key. */
export function resolveProvider(): { id: string; cfg: ProviderCfg } | null {
  const explicit = process.env.LLM_PROVIDER?.toLowerCase();
  if (explicit && PROVIDERS[explicit] && process.env[PROVIDERS[explicit].keyEnv]) {
    return { id: explicit, cfg: PROVIDERS[explicit] };
  }
  for (const id of ORDER) {
    if (process.env[PROVIDERS[id].keyEnv]) return { id, cfg: PROVIDERS[id] };
  }
  return null;
}

const SYSTEM = `Eres un asistente de extracción documental para una firma de abogados laboralistas en Colombia.
Tu única función es LEER un contrato laboral y devolver sus datos estructurados. No calculas prestaciones ni emites conceptos jurídicos: eso lo hace un motor determinista y lo valida un abogado.
Extrae con precisión. Si un dato no aparece, infiérelo de forma conservadora y refléjalo en 'confianza' y 'observaciones'. Identifica señales de subordinación en contratos de prestación de servicios.`;

// Plantilla de JSON para los proveedores en modo json_object (OpenAI/DeepSeek/Gemini).
const JSON_HINT = `Responde ÚNICAMENTE con un objeto JSON válido con esta forma exacta:
{
  "empleado": string, "documento": string, "cargo": string,
  "tipo": "indefinido"|"fijo"|"obra_labor"|"prestacion_servicios"|"aprendizaje"|"plataforma",
  "jornada": "completa"|"parcial"|"por_horas",
  "horasSemana": number, "salarioMensual": number,
  "auxilioTransporte": boolean, "salarioIntegral": boolean,
  "fechaInicio": "AAAA-MM-DD", "fechaFin": "AAAA-MM-DD" o "",
  "obligaciones": string[], "confianza": number (0..1), "observaciones": string
}`;

function userPrompt(text: string) {
  return `Extrae los datos estructurados de este contrato laboral:\n\n"""${text.slice(0, 20000)}"""`;
}

function stripFences(s: string): string {
  return s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

export interface ExtraccionResult {
  data: Extraccion;
  provider: string; // label legible
  model: string;
}

/** Ejecuta la extracción con el proveedor activo. Lanza si la API falla. */
export async function extraerContrato(text: string): Promise<ExtraccionResult> {
  const resolved = resolveProvider();
  if (!resolved) throw new Error("Sin proveedor: define una API key (ANTHROPIC/OPENAI/DEEPSEEK/GEMINI).");
  const { id, cfg } = resolved;
  const model = process.env.CENTINELA_EXTRACT_MODEL ?? cfg.model;

  if (cfg.kind === "anthropic") {
    const client = new Anthropic();
    const res = await client.messages.parse({
      model,
      max_tokens: 2048,
      system: SYSTEM,
      messages: [{ role: "user", content: userPrompt(text) }],
      output_config: { format: zodOutputFormat(ExtraccionSchema) },
    });
    if (!res.parsed_output) throw new Error("Respuesta sin parsear");
    return { data: res.parsed_output, provider: cfg.label, model };
  }

  // OpenAI / DeepSeek / Gemini — API compatible con OpenAI.
  const client = new OpenAI({
    apiKey: process.env[cfg.keyEnv],
    baseURL: cfg.baseURL,
  });
  const completion = await client.chat.completions.create({
    model,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: `${SYSTEM}\n\n${JSON_HINT}` },
      { role: "user", content: userPrompt(text) },
    ],
  });
  const raw = completion.choices[0]?.message?.content ?? "";
  const parsed = ExtraccionSchema.safeParse(JSON.parse(stripFences(raw)));
  if (!parsed.success) throw new Error("JSON no cumple el esquema: " + parsed.error.message);
  return { data: parsed.data, provider: cfg.label, model };
}
