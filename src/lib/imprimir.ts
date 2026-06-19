// Impresión / exportación a PDF de documentos de texto desde el navegador
// ("Guardar como PDF"). Opcionalmente antepone el logo de la empresa, para que
// los escritos (citación, notificación, contrato) salgan con la imagen del cliente.

export function imprimirDocumento(
  texto: string,
  titulo: string,
  empresa: string,
  logoDataUrl?: string | null,
): void {
  if (typeof window === "undefined") return;
  const w = window.open("", "_blank");
  if (!w) return;
  const safe = texto.replace(/[&<>]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[m] as string));
  const logo = logoDataUrl
    ? `<img src="${logoDataUrl}" alt="${empresa}" class="logo" />`
    : "";
  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${titulo} — ${empresa}</title>
<style>
  @page { margin: 2.2cm; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #16181d; font-size: 12px; line-height: 1.6; }
  .logo { max-height: 64px; max-width: 240px; margin-bottom: 18px; display: block; }
  pre { white-space: pre-wrap; font-family: inherit; margin: 0; }
  .pie { margin-top: 28px; font-size: 10px; color: #6b7280; border-top: 1px solid #d1d5db; padding-top: 8px; }
</style></head><body>${logo}<pre>${safe}</pre>
<div class="pie">Documento generado con Centinela — requiere revisión y firma del abogado responsable.</div>
<script>window.onload = function(){ window.print(); }<\/script>
</body></html>`);
  w.document.close();
}
