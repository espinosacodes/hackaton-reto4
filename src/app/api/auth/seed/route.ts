// Siembra las cuentas de demostración en DynamoDB (idempotente). Lo llama el
// cliente una vez al cargar la pantalla de acceso; con condición de "no existe"
// nunca pisa cuentas reales y es seguro invocarlo en cada arranque.

import { seedDemo } from "@/lib/accounts-server";
import { ddbConfigurado } from "@/lib/ddb";

export async function POST() {
  if (!ddbConfigurado()) return Response.json({ ok: false, error: "DynamoDB no configurado" }, { status: 200 });
  try {
    const { creadas } = await seedDemo();
    return Response.json({ ok: true, creadas });
  } catch (err) {
    console.error("seed: error:", err);
    return Response.json({ ok: false, error: "No se pudo sembrar." }, { status: 500 });
  }
}
