import { NextRequest, NextResponse } from "next/server";
import { sugerirCausalNorma, resolveProvider } from "@/lib/llm";
import { JUSTAS_CAUSAS_EMPLEADOR } from "@/lib/data/justas-causas";

interface DocCtx {
  tipo: string;
  nombre: string;
  texto?: string;
}

interface Body {
  hechos?: string;
  cargo?: string;
  documentos?: DocCtx[];
}

// Heurística determinista para la demo sin proveedor de IA: empareja por
// palabras clave de los hechos con la causal más probable del CST art. 62-A.
function sugerenciaDemo(b: Body) {
  const h = (b.hechos ?? "").toLowerCase();
  const reglas: { id: string; claves: string[] }[] = [
    { id: "A10", claves: ["inasisten", "no asist", "abandon", "falta de asistencia", "incumpl", "no ejecut", "no realiz"] },
    { id: "A2", claves: ["agres", "golpe", "injuria", "insult", "malos tratos", "violencia", "indisciplina", "amenaz"] },
    { id: "A5", claves: ["robo", "hurto", "fraud", "delito", "inmoral", "acoso", "droga", "alcohol"] },
    { id: "A4", claves: ["daño", "destru", "negligencia", "maquinaria"] },
    { id: "A8", claves: ["secreto", "confidencial", "filtr", "revel"] },
    { id: "A9", claves: ["rendimiento", "desempeño", "productividad"] },
    { id: "A6", claves: ["prohibici", "obligaci", "reglamento", "falta grave", "política", "seguridad"] },
  ];
  let causalId = "";
  for (const r of reglas) {
    if (r.claves.some((k) => h.includes(k))) {
      causalId = r.id;
      break;
    }
  }
  const causal = JUSTAS_CAUSAS_EMPLEADOR.find((c) => c.id === causalId);
  const tieneRit = (b.documentos ?? []).some((d) => d.tipo?.includes("RIT") || /reglamento/i.test(d.nombre ?? ""));
  return {
    causalId,
    justificacionCausal: causal
      ? `Los hechos descritos encuadrarían en «${causal.causal}» (CST art. 62-A, causal ${causal.id.slice(1)})${
          causal.avisoPrevio ? ", que requiere aviso previo de 15 días" : ""
        }. Confírmelo o cámbielo.`
      : "No fue posible asociar los hechos a una causal específica por palabras clave; revíselo manualmente.",
    normaInterna: tieneRit
      ? "Revise el RIT cargado y cite el artículo/numeral que tipifica esta conducta."
      : "",
    justificacionNorma: tieneRit
      ? "Hay un RIT cargado en el Perfil; verifique el artículo aplicable."
      : "No hay RIT cargado: súbalo en el Perfil para citar la norma interna específica.",
    alternativas: [] as string[],
    _modo: "demo" as const,
  };
}

function construirPrompt(b: Body): string {
  const causales = JUSTAS_CAUSAS_EMPLEADOR.map((c) => `${c.id}: ${c.causal}${c.avisoPrevio ? " (requiere aviso previo 15 días)" : ""}`).join("\n");
  const docs = (b.documentos ?? [])
    .map((d) => `### ${d.tipo} — ${d.nombre}\n${(d.texto ?? "").slice(0, 4000)}`)
    .join("\n\n");
  return `HECHOS IMPUTADOS (${b.cargo ?? "—"}): ${b.hechos ?? "—"}

CAUSALES DISPONIBLES (CST art. 62, literal A):
${causales}

${docs ? `REGLAMENTO INTERNO / DOCUMENTOS INTERNOS:\n${docs}` : "No se cargaron documentos internos en el Perfil."}

Sugiere la causal (A1..A15) más aplicable a estos hechos y, si hay RIT, la norma interna posiblemente infringida.`;
}

export async function POST(req: NextRequest) {
  let b: Body = {};
  try {
    b = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  if (!(b.hechos ?? "").trim()) {
    return NextResponse.json({ error: "Faltan los hechos" }, { status: 400 });
  }

  if (!resolveProvider()) {
    return NextResponse.json(sugerenciaDemo(b));
  }

  try {
    const { data, provider, model } = await sugerirCausalNorma(construirPrompt(b));
    return NextResponse.json({ ...data, _modo: "ia", _provider: provider, _model: model });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error de sugerencia";
    return NextResponse.json({ ...sugerenciaDemo(b), _modo: "error", _warning: msg });
  }
}
