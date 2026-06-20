import { NextRequest, NextResponse } from "next/server";
import { recomendarSancion, resolveProvider } from "@/lib/llm";

interface DocCtx {
  tipo: string;
  nombre: string;
  texto?: string;
}

interface DescargoQA {
  pregunta: string;
  respuesta: string;
}

interface Body {
  hechos?: string;
  fechaHechos?: string;
  cargo?: string;
  empleado?: string;
  causal?: string; // justa causa imputada (texto)
  normaInterna?: string; // artículo del RIT imputado
  descargos?: DescargoQA[]; // preguntas y respuestas del trabajador
  pruebas?: string; // pruebas aportadas / decretadas
  documentos?: DocCtx[]; // RIT y otros documentos del Perfil
}

type TipoSancion = "llamado_atencion" | "suspension" | "terminacion_justa_causa" | "absolucion";

const SANCION_LABEL: Record<TipoSancion, string> = {
  llamado_atencion: "Llamado de atención escrito",
  suspension: "Suspensión del contrato",
  terminacion_justa_causa: "Terminación con justa causa",
  absolucion: "Absolución / archivo",
};

// Heurística determinista para la demo sin proveedor de IA: gradúa la sanción
// por la gravedad de los hechos (CST art. 62-A) y matiza con los descargos.
function recomendacionDemo(b: Body) {
  const h = (b.hechos ?? "").toLowerCase();
  const desc = (b.descargos ?? []).map((d) => (d.respuesta ?? "").toLowerCase()).join(" ");
  const tieneRit = (b.documentos ?? []).some((d) => d.tipo?.includes("RIT") || /reglamento/i.test(d.nombre ?? ""));

  const graves = ["robo", "hurto", "fraud", "delito", "agres", "golpe", "violencia", "acoso", "droga", "alcohol", "amenaz", "arma"];
  const medias = ["reiterad", "reincid", "segunda vez", "nuevamente", "otra vez", "abandono", "incumpl", "negligencia", "daño", "insubordin", "indisciplina"];

  let tipo: TipoSancion;
  let proporcionalidad: string;
  if (graves.some((k) => h.includes(k))) {
    tipo = "terminacion_justa_causa";
    proporcionalidad =
      "Los hechos descritos revisten especial gravedad y podrían configurar justa causa (CST art. 62-A). Verifique que las pruebas la acrediten plenamente y que los descargos no la desvirtúen; la terminación es la medida más gravosa y debe reservarse a faltas graves probadas.";
  } else if (medias.some((k) => h.includes(k))) {
    tipo = "suspension";
    proporcionalidad =
      "Los hechos sugieren una falta de gravedad media o reiterada que justificaría una suspensión gradual conforme a la escala del RIT, sin llegar aún a la terminación.";
  } else {
    tipo = "llamado_atencion";
    proporcionalidad =
      "Por tratarse aparentemente de una falta leve o primera ocurrencia, la medida proporcional sería un llamado de atención escrito, dejando constancia para efectos de reincidencia.";
  }

  // Si los descargos parecen desvirtuar los hechos, sugiere revisar la absolución.
  if (/no es cierto|niego|no ocurri|no sucedi|falso|no fui|no particip/.test(desc)) {
    proporcionalidad +=
      " Atención: en los descargos el trabajador controvierte los hechos; si las pruebas no los acreditan, lo procedente sería la absolución/archivo.";
  }

  return {
    tipo,
    sancion: SANCION_LABEL[tipo],
    fundamento: tieneRit
      ? "Aplique la escala de faltas y sanciones del RIT cargado en el Perfil y los arts. 62, 104 a 115 del CST. Cite el artículo/numeral específico del RIT que tipifica la conducta."
      : "Base: CST arts. 62 (justas causas) y 104 a 115 (régimen disciplinario). No hay RIT cargado; súbalo en el Perfil para citar la norma interna específica.",
    proporcionalidad,
    alternativas:
      tipo === "terminacion_justa_causa"
        ? ["Suspensión del contrato (según la escala del RIT)", "Llamado de atención escrito"]
        : tipo === "suspension"
          ? ["Llamado de atención escrito", "Terminación con justa causa (solo si los hechos lo justifican)"]
          : ["Suspensión del contrato (si hay reincidencia)"],
    _modo: "demo" as const,
  };
}

function fmt(s?: string) {
  const t = (s ?? "").trim();
  return t || "—";
}

function construirPrompt(b: Body): string {
  const descargos = (b.descargos ?? [])
    .map((d, i) => `${i + 1}. P: ${fmt(d.pregunta)}\n   R: ${fmt(d.respuesta)}`)
    .join("\n");
  const docs = (b.documentos ?? [])
    .map((d) => `### ${d.tipo} — ${d.nombre}\n${(d.texto ?? "").slice(0, 5000)}`)
    .join("\n\n");
  return `CASO DISCIPLINARIO — recomendación de sanción.

TRABAJADOR: ${fmt(b.empleado)} (${fmt(b.cargo)})
HECHOS IMPUTADOS (${fmt(b.fechaHechos)}): ${fmt(b.hechos)}
JUSTA CAUSA IMPUTADA: ${fmt(b.causal)}
NORMA INTERNA INVOCADA (RIT): ${fmt(b.normaInterna)}

DESCARGOS RENDIDOS POR EL TRABAJADOR:
${descargos || "No se registraron descargos."}

PRUEBAS PRESENTADAS / DECRETADAS:
${fmt(b.pruebas)}

${docs ? `REGLAMENTO INTERNO / DOCUMENTOS DEL PERFIL:\n${docs}` : "No se cargó RIT ni documentos internos en el Perfil."}

Con base EXCLUSIVAMENTE en el RIT (si se aportó), el CST (arts. 62 y 104-125), los descargos y las pruebas, recomienda la sanción más proporcional. Si las pruebas no acreditan la falta o los descargos la desvirtúan, recomienda la absolución/archivo. Recuerda: es una recomendación de apoyo que el abogado debe validar.`;
}

export async function POST(req: NextRequest) {
  let b: Body = {};
  try {
    b = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  if (!(b.hechos ?? "").trim()) {
    return NextResponse.json({ error: "Faltan los hechos imputados" }, { status: 400 });
  }

  if (!resolveProvider()) {
    return NextResponse.json(recomendacionDemo(b));
  }

  try {
    const { data, provider, model } = await recomendarSancion(construirPrompt(b));
    return NextResponse.json({ ...data, _modo: "ia", _provider: provider, _model: model });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error de recomendación";
    return NextResponse.json({ ...recomendacionDemo(b), _modo: "error", _warning: msg });
  }
}
