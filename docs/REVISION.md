# Revisión técnica y jurídica — Centinela

**Reto 4 · Legal Hack Icesi 2026 · Hurtado Gandini Abogados**
Revisión realizada el 18 de junio de 2026 (rama `local/pruebas`).

Metodología: revisión multi-agente en 6 dimensiones (legal, numérica, UX, código,
seguridad, estrategia ante el jurado) con **verificación adversarial** de los hallazgos
de mayor severidad. Resultado: 60 hallazgos; de los P0/P1 verificados, **16 confirmados,
7 matizados, 1 refutado**.

> Este documento es para el contador y el abogado del equipo. Las cifras y citas marcadas
> como "verificar" deben confirmarse contra fuente primaria antes de la presentación.

---

## 1. Cambios ya aplicados en esta rama

### Ajustes solicitados
- **Contratos:** se eliminó la caja de texto; la carga es solo por archivo (PDF/DOCX/TXT)
  con zona de arrastre. La columna "IA" de la nómina se renombró a **"Conf. IA"** (nivel de
  confianza con que la IA leyó cada contrato) y se coloreó por umbral.
- **Liquidaciones:** el desplegable de causa se redujo a **"sin justa causa" / "con justa
  causa"**. Se quitaron las etiquetas de norma bajo cada línea. *(Nota: esto reduce la
  auditabilidad línea a línea que vende el pitch; reversible.)*
- **Reclasificación:** se reconstruyó como herramienta **interactiva** (marcar/desmarcar
  indicios recalcula el puntaje en vivo). Antes era estática.
- **Disciplinario:** se agregó carga del **reglamento interno / manual de conducta** y, para
  la causal 6, una nota que exige remitir a la falta grave del reglamento.

### Correcciones de la revisión
- **Liquidación — modelo del periodo (corrige el riesgo P0):** el motor ahora liquida cesantías
  e intereses del año en curso, prima del semestre en curso y vacaciones desde el último
  disfrute (modo "Liquidación del periodo"), con opción "Pasivo acumulado (mora total)".
  Se corrigió el **interés a las cesantías que crecía al cuadrado** del tiempo.
- **Obra o labor:** ya no se le aplica el preaviso de 30 días ni la prórroga automática del
  término fijo (CST art. 45 vs 46).
- **Nota de vencimiento del plazo:** reformulada (CST art. 61 lit. c; el preaviso solo evita
  la prórroga, no exime de indemnización).
- **Cita del auxilio de transporte:** el tope de 2 SMMLV lo fija el decreto anual, no la
  Ley 15/1959 art. 2.
- **Manejo de error de IA:** cuando la IA falla, la interfaz lo **advierte en rojo** ("datos
  de relleno, no confiables") en vez de disimularlo.
- **Inyección de prompt:** el system prompt instruye tratar el contrato como dato, no como
  instrucciones.
- **Control humano (eje del pitch):** se cablearon los botones muertos: "Confirmar"/"Corregir"
  en contratos, "Exportar/Enviar a revisión" en liquidaciones, "Copiar/Enviar a firma" en el
  pliego. Se agregó una **Bitácora de auditoría** (quién validó qué y cuándo) y la extracción
  validada **fluye al motor** (aparece en Liquidaciones y Reclasificación).

---

## 2. Pendiente — requiere validación del equipo (NO automatizable)

| # | Tema | Acción requerida |
|---|------|------------------|
| 1 | **Modelo de liquidación** | El contador debe validar el supuesto de "periodo no consignado" vs "pasivo acumulado" caso por caso, contra los pagos reales del cliente. |
| 2 | **`CSJ SL1706-2024`** | Verificar la radicación exacta y que la sentencia sostenga lo que se le atribuye (debido proceso). Si hay duda, suavizar a "jurisprudencia consolidada de la Sala Laboral". |
| 3 | **Ley 2466/2025** | Confirmar el alcance real: hoy el sistema afirma una "presunción automática de vínculo" para plataformas y fuerza el puntaje a 60. Verificar el texto de la ley con el abogado — es el elemento diferenciador y no puede estar mal. |
| 4 | **Base de la indemnización (term. fijo)** | Decidir y documentar si la base incluye el auxilio de transporte (postura CSJ). |

---

## 3. Hallazgos confirmados / matizados (referencia)

### Legal
- **Preaviso de 30 días aplicado a obra o labor** (CST art. 45 vs 46) — *corregido*.
- **Presunción de plataforma afirmada como hecho** (`reclasificacion.ts`, `alertas.ts`) — *verificar Ley 2466*.
- **Nota de vencimiento confunde preaviso con exención de indemnización** — *corregido*.
- **Cita del auxilio de transporte** (`liquidacion.ts`) — *corregido*.
- **Vacaciones: comentario decía "15 días hábiles" liquidando salario** — *aclarado a CST arts. 186, 189*.

### Numérica
- **Intereses a las cesantías crecían al cuadrado del tiempo** (`liquidacion.ts`) — *corregido*.
- **Prima acumulaba toda la historia en vez del semestre en curso** — *corregido (modo periodo)*.
- **Cesantías acumulaban todo el periodo asumiendo cero consignaciones** — *corregido (modo periodo) / opción acumulado*.

### UX / demo
- **Botones "Confirmar/Corregir" inertes** — *corregidos*.
- **Botones "Exportar PDF / Enviar a revisión" inertes** — *corregidos*.
- **No existía registro de auditoría** — *agregada la Bitácora*.
- **Pliego no se podía copiar/exportar/firmar** — *corregido*.
- **Buscador y campana del header decorativos** — *pendiente (P3)*.

### Seguridad / privacidad
- **Texto íntegro del contrato (datos personales) enviado al LLM; DeepSeek (China) por
  defecto problemático** (Ley 1581/2012) — *pendiente: seudonimizar y restringir proveedor*.
- **Inyección de prompt vía contrato** — *mitigado en el system prompt*.

### Estrategia ante el jurado
- **El error de IA se disimulaba** en vez de hacerse visible — *corregido*.
- **La extracción IA no fluía al motor** (dos demos desconectadas) — *corregido*.
- **El "abogado decide" eran botones muertos** — *corregido*.
- **Citas presentadas como "RAG" sin serlo** — *pendiente: ajustar el discurso o enlazar a fuente*.

### Código
- **Reglamento se carga pero su texto no se usa** en el pliego — *pendiente: extracción IA de faltas (siguiente nivel)*.
- **Lógica de extracción mock duplicada** (`route.ts` vs `contratos/page.tsx`) — *pendiente: unificar*.

---

*Generado a partir de la revisión multi-agente de Centinela. Toda salida del sistema requiere
validación del abogado responsable.*
