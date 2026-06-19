import { NextRequest, NextResponse } from "next/server";
import { aconsejarDisciplinario, resolveProvider } from "@/lib/llm";

interface DocCtx {
  tipo: string;
  nombre: string;
  texto?: string;
}

interface Body {
  empleado?: string;
  cargo?: string;
  hechos?: string;
  fechaHechos?: string;
  etapa?: string;
  etapaTitulo?: string;
  garantias?: string[];
  causalTexto?: string;
  normaInterna?: string;
  planUsuario?: string;
  documentos?: DocCtx[];
  // Contexto acumulado del proceso (lo aprovecha sobre todo la etapa de decisión).
  preguntasRespuestas?: string;
  oportunidadPruebas?: string;
  pruebasAportadas?: boolean;
}

// Asesoría determinista por etapa, para la demo sin proveedor de IA.
function asesoriaDemo(b: Body) {
  const porEtapa: Record<string, { rec: string; sig: string; riesgos: string[] }> = {
    hechos: {
      rec: "Documente los hechos y verifique que la conducta esté tipificada como falta en el RIT o el contrato. Confirme que la acción disciplinaria no haya prescrito antes de continuar.",
      sig: "Elaborar y enviar la citación a descargos.",
      riesgos: ["Sancionar una conducta no tipificada (principio de legalidad)", "Prescripción de la acción disciplinaria"],
    },
    citacion: {
      rec: "Envíe una citación escrita y previa con los hechos, la norma infringida, las pruebas y la fecha/hora/lugar de la diligencia, informando el derecho a estar acompañado. Otorgue un plazo razonable para preparar la defensa.",
      sig: "Realizar la diligencia de descargos en la fecha citada.",
      riesgos: ["Citar sin precisar los cargos o la norma", "Plazo insuficiente para la defensa"],
    },
    descargos: {
      rec: "Realice la audiencia garantizando que el trabajador sea oído y pueda estar acompañado por dos representantes del sindicato o dos compañeros. Levante un acta firmada.",
      sig: "Valorar las pruebas y los descargos antes de decidir.",
      riesgos: ["Omitir el acompañamiento (causal de nulidad, art. 115)", "No dejar acta de lo actuado"],
    },
    pruebas: {
      rec: "Permita presentar y controvertir pruebas. Valore objetivamente los descargos y las pruebas antes de adoptar cualquier decisión.",
      sig: "Adoptar una decisión motivada y proporcional.",
      riesgos: ["Decidir sin valorar las pruebas", "Vulnerar el derecho de contradicción"],
    },
    decision: {
      rec: "Adopte una decisión motivada y proporcional a la gravedad de la falta y a los antecedentes. Si la sanción es el despido, verifique la justa causa y los fueros aplicables.",
      sig: "Notificar la decisión por escrito.",
      riesgos: ["Sanción desproporcionada", "Despido sin justa causa comprobada o sin respetar fueros"],
    },
    notificacion: {
      rec: "Notifique la decisión por escrito y deje constancia del recibido. Informe los recursos que prevea el reglamento.",
      sig: "Archivar el expediente con toda la trazabilidad.",
      riesgos: ["No notificar formalmente", "No informar los recursos cuando el RIT los prevé"],
    },
  };
  const e = porEtapa[b.etapa ?? "hechos"] ?? porEtapa.hechos;
  const tieneDocs = (b.documentos ?? []).length > 0;
  return {
    recomendacion: e.rec,
    fundamento: `Art. 115 CST y debido proceso (CN art. 29). ${
      tieneDocs ? "Remítase al reglamento interno cargado en el Perfil." : "Cargue el RIT en el Perfil para citar la norma interna específica."
    }`,
    riesgos: e.riesgos,
    siguientePaso: e.sig,
    evaluacionPlan: b.planUsuario?.trim()
      ? "Asesoría simulada (sin IA configurada): no se evaluó automáticamente su plan. Configure una API key para el análisis con IA."
      : "",
    _modo: "demo" as const,
  };
}

function construirPrompt(b: Body): string {
  const docs = (b.documentos ?? [])
    .map((d) => `### ${d.tipo} — ${d.nombre}\n${(d.texto ?? "").slice(0, 4000)}`)
    .join("\n\n");

  // Contexto del expediente: descargos y pruebas, útil para valorar/decidir.
  const expediente = [
    b.preguntasRespuestas?.trim() ? `Diligencia de descargos (preguntas y respuestas):\n"""${b.preguntasRespuestas.trim()}"""` : "",
    b.oportunidadPruebas?.trim() ? `Pruebas y oportunidad: """${b.oportunidadPruebas.trim()}"""` : "",
    typeof b.pruebasAportadas === "boolean" ? `¿El trabajador aportó pruebas? ${b.pruebasAportadas ? "Sí" : "No"}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const cierreDecision =
    b.etapa === "decision"
      ? "\n\nComo es la etapa de DECISIÓN, valora conjuntamente los descargos, las pruebas y la situación planteada y entrega tu CONSIDERACIÓN sobre qué debería hacerse (sanción proporcional, archivo o terminación con justa causa) y por qué. Recomienda y motiva; NO impongas la decisión: el abogado y la empresa deciden."
      : "";

  return `CASO DISCIPLINARIO
Trabajador: ${b.empleado ?? "—"} (${b.cargo ?? "—"})
Hechos (${b.fechaHechos ?? "—"}): ${b.hechos ?? "—"}
Causal invocada: ${b.causalTexto ?? "—"}
Norma interna señalada: ${b.normaInterna ?? "—"}
Etapa actual del proceso: ${b.etapaTitulo ?? b.etapa ?? "—"}
Garantías que deben cubrirse en esta etapa: ${(b.garantias ?? []).join("; ") || "—"}
${expediente ? `\nEXPEDIENTE HASTA AHORA:\n${expediente}\n` : ""}
${b.planUsuario?.trim() ? `Lo que la empresa piensa hacer: """${b.planUsuario.trim()}"""` : "La empresa aún no ha indicado qué hará."}

${docs ? `BASES NORMATIVAS INTERNAS (Perfil de la empresa):\n${docs}` : "No se cargaron documentos internos en el Perfil."}

Asesora a la empresa para esta etapa: qué debe hacer, con qué fundamento, qué riesgos evitar y cuál es el siguiente paso. Si la empresa indicó un plan, evalúalo.${cierreDecision}`;
}

export async function POST(req: NextRequest) {
  let b: Body = {};
  try {
    b = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  if (!resolveProvider()) {
    return NextResponse.json(asesoriaDemo(b));
  }

  try {
    const { data, provider, model } = await aconsejarDisciplinario(construirPrompt(b));
    return NextResponse.json({ ...data, _modo: "ia", _provider: provider, _model: model });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error de asesoría";
    return NextResponse.json({ ...asesoriaDemo(b), _modo: "error", _warning: msg });
  }
}
