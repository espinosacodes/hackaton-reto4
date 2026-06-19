import { Contrato } from "./types";
import { generarAlertas } from "./alertas";
import { evaluarReclasificacion } from "./reclasificacion";

/** Agrega el estado de compliance de una nómina en un único índice 0–100. */
export function resumenCompliance(contratos: Contrato[], hoy: string) {
  const alertas = generarAlertas(contratos, hoy);

  const criticas = alertas.filter((a) => a.severidad === "critica").length;
  const altas = alertas.filter((a) => a.severidad === "alta").length;
  const medias = alertas.filter((a) => a.severidad === "media").length;

  const recla = contratos
    .filter((c) => c.tipo === "prestacion_servicios" || c.tipo === "plataforma")
    .map((c) => evaluarReclasificacion(c, hoy));
  const reclaAlto = recla.filter((r) => r.nivel === "alto").length;
  // Exposición esperada de la cartera por contrato realidad (valor esperado en pesos).
  const reclaExposicion = recla.reduce((s, r) => s + r.exposicion.exposicionEsperada, 0);

  // Penalización ponderada → índice de compliance.
  const penalizacion = criticas * 12 + altas * 6 + medias * 2 + reclaAlto * 5;
  const score = Math.max(0, Math.min(100, 100 - penalizacion));

  const banda =
    score >= 80 ? "Saludable" : score >= 55 ? "En observación" : "Crítico";
  const bandaColor =
    score >= 80 ? "var(--success)" : score >= 55 ? "var(--warning)" : "var(--red)";

  return {
    contratos,
    alertas,
    score,
    banda,
    bandaColor,
    criticas,
    altas,
    medias,
    recla,
    reclaAlto,
    reclaExposicion,
    total: contratos.length,
  };
}
