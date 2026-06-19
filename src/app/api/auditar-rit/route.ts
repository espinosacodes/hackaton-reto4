import { NextRequest, NextResponse } from "next/server";
import { auditarReglamento, resolveProvider } from "@/lib/llm";

// Elementos exigidos a un RIT en Colombia + palabras clave para el modo demo.
const ELEMENTOS: { tema: string; norma: string; claves: string[]; riesgo: string }[] = [
  {
    tema: "Procedimiento disciplinario y diligencia de descargos",
    norma: "CST arts. 104–125, 115",
    claves: ["disciplinar", "descargo", "sanci"],
    riesgo: "Sin procedimiento reglado, las sanciones y despidos son anulables por violación del debido proceso.",
  },
  {
    tema: "Escala de faltas y sanciones",
    norma: "CST arts. 108, 114",
    claves: ["falta grave", "falta leve", "escala de sanc", "amonestaci"],
    riesgo: "Sin tipificación de faltas y sanciones no hay principio de legalidad; las sanciones se vuelven discrecionales.",
  },
  {
    tema: "Comité de Convivencia Laboral",
    norma: "Resoluciones 652 y 1356 de 2012",
    claves: ["convivencia"],
    riesgo: "Su ausencia incumple la obligación legal y debilita la gestión del acoso laboral.",
  },
  {
    tema: "Prevención del acoso laboral",
    norma: "Ley 1010 de 2006",
    claves: ["acoso"],
    riesgo: "Sin medidas preventivas la empresa responde solidariamente y enfrenta sanciones del Mintrabajo.",
  },
  {
    tema: "Jornada de trabajo (ajuste a 42h)",
    norma: "CST art. 158; Ley 2101/2021",
    claves: ["jornada", "horario"],
    riesgo: "Una jornada desactualizada (más de 42h en 2026) genera trabajo suplementario no reconocido.",
  },
  {
    tema: "Obligaciones y prohibiciones de las partes",
    norma: "CST arts. 57–60",
    claves: ["obligacion", "prohibicion", "prohíbe", "deberes"],
    riesgo: "Sin obligaciones/prohibiciones claras es difícil sustentar faltas y exigir conductas.",
  },
  {
    tema: "Trámite de quejas y reclamos",
    norma: "CST art. 108 num. 16",
    claves: ["queja", "reclamo"],
    riesgo: "Sin canal de quejas se debilita la defensa y el clima laboral.",
  },
];

function auditoriaDemo(texto: string) {
  const t = (texto || "").toLowerCase();
  const hallazgos = ELEMENTOS.map((e) => {
    const cumple = e.claves.some((k) => t.includes(k));
    return {
      tema: e.tema,
      cumple,
      riesgo: cumple ? "Contemplado en el texto cargado (verificar suficiencia)." : e.riesgo,
      norma: e.norma,
    };
  });
  const faltan = hallazgos.filter((h) => !h.cumple).length;
  return {
    resumen:
      faltan === 0
        ? "El RIT menciona todos los elementos clave revisados (verificar su suficiencia con el abogado)."
        : `Se detectaron ${faltan} posible(s) laguna(s) en el RIT. Revisión heurística (sin IA); configure una API key para un análisis a fondo.`,
    hallazgos,
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
    return NextResponse.json({ error: "Texto del reglamento vacío" }, { status: 400 });
  }

  if (!resolveProvider()) {
    return NextResponse.json(auditoriaDemo(texto));
  }

  try {
    const { data, provider, model } = await auditarReglamento(texto);
    return NextResponse.json({ ...data, _modo: "ia", _provider: provider, _model: model });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error de auditoría";
    return NextResponse.json({ ...auditoriaDemo(texto), _modo: "error", _warning: msg });
  }
}
