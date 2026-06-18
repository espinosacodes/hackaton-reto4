import { Contrato, ReclasificacionResultado } from "./types";

// ─────────────────────────────────────────────────────────────────────────
// Test de reclasificación — primacía de la realidad (CP art. 53, CST art. 23)
// + subordinación algorítmica (Ley 2466/2025).
// Cada indicio tiene un peso; el puntaje agregado define el nivel de riesgo.
// ─────────────────────────────────────────────────────────────────────────

interface Indicio {
  key: keyof NonNullable<Contrato["subordinacion"]>;
  senal: string;
  peso: number;
  norma: string;
  algoritmica?: boolean;
}

const INDICIOS: Indicio[] = [
  { key: "horarioFijo", senal: "Cumple un horario fijo impuesto", peso: 14, norma: "CST art. 23.b" },
  { key: "supervisionDirecta", senal: "Está sujeto a supervisión y control directo", peso: 14, norma: "CST art. 23.b" },
  { key: "instruccionesDetalladas", senal: "Recibe instrucciones detalladas sobre cómo ejecutar la labor", peso: 12, norma: "CST art. 23.b" },
  { key: "exclusividad", senal: "Trabaja en exclusividad para el contratante", peso: 10, norma: "CST art. 23" },
  { key: "continuidad", senal: "Prestación continua y prolongada (> 6 meses)", peso: 10, norma: "CST art. 23.c" },
  { key: "herramientasEmpleador", senal: "Usa herramientas/recursos del contratante", peso: 8, norma: "CST art. 23" },
  { key: "remuneracionFija", senal: "Remuneración fija y periódica (tipo salario)", peso: 8, norma: "CST art. 23.c" },
  // Subordinación algorítmica — Ley 2466/2025
  { key: "asignacionAlgoritmica", senal: "Asignación de tareas mediante algoritmo", peso: 12, norma: "Ley 2466/2025", algoritmica: true },
  { key: "penalizacionRechazos", senal: "Penalización por rechazar tareas", peso: 10, norma: "Ley 2466/2025", algoritmica: true },
  { key: "calificacionPlataforma", senal: "Evaluación por calificación de la plataforma", peso: 8, norma: "Ley 2466/2025", algoritmica: true },
  { key: "geolocalizacion", senal: "Control por geolocalización en tiempo real", peso: 6, norma: "Ley 2466/2025", algoritmica: true },
];

export function evaluarReclasificacion(c: Contrato): ReclasificacionResultado {
  const s = c.subordinacion ?? {};
  let puntaje = 0;
  let algoritmica = false;
  const indicios = INDICIOS.map((i) => {
    const presente = Boolean(s[i.key]);
    if (presente) {
      puntaje += i.peso;
      if (i.algoritmica) algoritmica = true;
    }
    return { senal: i.senal, presente, peso: i.peso, norma: i.norma };
  });

  // Las plataformas de reparto tienen presunción legal de vínculo (Ley 2466/2025).
  if (c.tipo === "plataforma") {
    puntaje = Math.max(puntaje, 60);
    algoritmica = true;
  }

  puntaje = Math.min(puntaje, 100);
  const nivel = puntaje >= 60 ? "alto" : puntaje >= 35 ? "medio" : "bajo";

  const conclusion =
    nivel === "alto"
      ? algoritmica
        ? "Alto riesgo de vínculo laboral por subordinación algorítmica (Ley 2466/2025). Se recomienda formalizar el contrato laboral o documentar rigurosamente la independencia."
        : "Alto riesgo de contrato realidad. Los indicios de subordinación superan el umbral; un juez probablemente declararía vínculo laboral."
      : nivel === "medio"
      ? "Riesgo moderado. Existen indicios de subordinación que deben mitigarse o documentarse para sostener la naturaleza civil del contrato."
      : "Riesgo bajo. La relación es consistente con un contrato de prestación de servicios independiente.";

  return {
    contratoId: c.id,
    empleado: c.empleado,
    puntaje,
    nivel,
    algoritmica,
    indicios,
    conclusion,
  };
}
