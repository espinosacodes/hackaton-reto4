import { NextRequest, NextResponse } from "next/server";

// Modo "Conectar API" del módulo de aportes.
// Honesto: no existe una consulta pública de pagos PILA por terceros. La verificación
// automática requiere que el operador del aportante exponga una API y que la empresa
// autorice la conexión (convenio + credenciales en bóveda). Aquí dejamos el conector
// listo: si se configura un endpoint válido, se intentaría la consulta; de lo contrario
// se informa el estado y la vía correcta.
export async function POST(req: NextRequest) {
  let endpoint = "";
  let operador = "";
  try {
    const body = await req.json();
    endpoint = String(body?.endpoint ?? "").trim();
    operador = String(body?.operador ?? "operador");
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  if (!endpoint) {
    return NextResponse.json({
      conectado: false,
      mensaje:
        `Conector listo para ${operador}. Para consultar la planilla automáticamente necesitas el endpoint de la API y la autorización de la empresa (convenio con el operador). Las APIs de los operadores son para que el aportante gestione/consulte su propia planilla; no hay consulta pública de terceros.`,
    });
  }

  return NextResponse.json({
    conectado: false,
    mensaje:
      `No se realizó la consulta: la integración con ${operador} requiere un convenio y credenciales válidas del aportante (no se almacenan en la demo). En producción, este conector usaría la API oficial del operador con la autorización de la empresa, en modo solo-lectura y con trazabilidad en la bitácora.`,
  });
}
