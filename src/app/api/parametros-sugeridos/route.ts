import { NextResponse } from "next/server";

// Auto-sugerencia de SMMLV y auxilio de transporte (el usuario CONFIRMA antes de aplicar).
// Intenta una fuente web estable (MediaWiki API) con validación de rango; si falla o el
// dato no es plausible, cae al valor de referencia verificado del año. Nunca aplica solo:
// la cifra alimenta el cálculo de prestaciones, así que requiere confirmación humana.

const SEED = {
  anio: 2026,
  smmlv: 1_750_905,
  auxilioTransporte: 249_095,
  fuente: "Decretos 1469 y 1470 de 2025 (valor de referencia verificado)",
};

const plausibleSmmlv = (n: number) => n >= 1_000_000 && n <= 5_000_000;
const plausibleAux = (n: number) => n >= 100_000 && n <= 700_000;

function parseMonto(s: string): number {
  return Number(s.replace(/[^\d]/g, ""));
}

function parseWiki(wikitext: string, anio: number): { smmlv: number; auxilioTransporte: number } | null {
  const idx = wikitext.indexOf(String(anio));
  if (idx < 0) return null;
  const ventana = wikitext.slice(idx, idx + 400);
  // Montos colombianos con separador de miles de punto: 1.750.905
  const montos = (ventana.match(/\d{1,3}(?:\.\d{3})+/g) ?? []).map(parseMonto);
  const smmlv = montos.find(plausibleSmmlv);
  const auxilioTransporte = montos.find(plausibleAux);
  if (smmlv && auxilioTransporte) return { smmlv, auxilioTransporte };
  return null;
}

export async function GET() {
  const anio = SEED.anio;
  try {
    const url =
      "https://es.wikipedia.org/w/api.php?action=parse&page=Anexo:Salario_m%C3%ADnimo_en_Colombia&prop=wikitext&format=json&formatversion=2";
    const r = await fetch(url, {
      headers: { "User-Agent": "Centinela/1.0 (Legal Hack Icesi demo)" },
      signal: AbortSignal.timeout(6000),
    });
    if (r.ok) {
      const j = await r.json();
      const wt: string = j?.parse?.wikitext ?? "";
      const parsed = parseWiki(wt, anio);
      if (parsed) {
        return NextResponse.json({
          anio,
          smmlv: parsed.smmlv,
          auxilioTransporte: parsed.auxilioTransporte,
          fuente: "es.wikipedia.org — Anexo: Salario mínimo en Colombia",
          modo: "web",
          nota: "Confirme la cifra contra el decreto oficial antes de aplicarla.",
        });
      }
    }
  } catch {
    // cae al seed
  }
  return NextResponse.json({ ...SEED, modo: "referencia", nota: "Sugerencia de referencia; confirme contra el decreto oficial." });
}
