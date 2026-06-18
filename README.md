# Centinela — Compliance laboral proactivo

**Legal Hack Icesi 2026 · Reto 4 (Laboral & Compliance) · Hurtado Gandini Abogados**

Centinela es una herramienta de IA que permite a HG ofrecer a sus clientes empresariales
un servicio de **compliance laboral proactivo** y una **gestión asistida de procesos
disciplinarios**, sobre la nómina de empresas con vínculo laboral directo (50–500 trabajadores).

---

## La idea en una frase

> **La IA lee y redacta; un motor determinista calcula; el abogado decide.**

No dejamos que la IA haga aritmética ni invente derecho. Esa separación es el corazón del
diseño y la respuesta a las preguntas del jurado.

## Arquitectura

| Capa | Tecnología | Por qué |
|------|-----------|---------|
| **Lectura de contratos** | IA (modelo económico: Haiku 4.5) + salida estructurada | Extracción/clasificación — los errores son baratos de detectar y se muestran para revisión humana |
| **Liquidación de prestaciones** | **Código determinista, sin IA** | El cálculo debe ser exacto y auditable. Una IA "99% correcta" en una liquidación es una demanda |
| **Alertas de vencimientos** | Motor de reglas por fechas | Pura aritmética de fechas, no requiere IA |
| **Pliego de cargos / debido proceso** | Checklist + plantilla con citas (RAG sobre normativa) | Garantías mínimas verificadas antes de decidir; cada afirmación citada |
| **Riesgo de reclasificación** | Scoring de indicios ponderados + IA | Subordinación (CST art. 23) y **subordinación algorítmica (Ley 2466/2025)** |

### Cómo responde a las preguntas del jurado
- **¿Por qué este enfoque y no otro?** La IA no calcula ni decide; extrae y redacta. Lo
  numérico es determinista y auditable; lo jurídico lo valida un abogado.
- **¿Qué pasa cuando la IA se equivoca?** La extracción se muestra con su nivel de confianza,
  lado a lado con el contrato, para confirmación humana. Los cálculos exponen su fórmula y su norma.
- **¿Quién responde legalmente?** El abogado: la herramienta es de **decisión asistida** con
  aprobación humana obligatoria. Nunca presenta nada de forma automática.

## Módulos

1. **Resumen** — índice de compliance, pasivo prestacional estimado, alertas prioritarias.
2. **Contratos** — lectura contractual asistida por IA con revisión humana (confianza por extracción).
3. **Liquidaciones** — liquidador determinista y auditable (cesantías, intereses 12%, prima,
   vacaciones, indemnización art. 64) + **detección de sub/sobre-liquidación** contra el valor pagado.
4. **Alertas** — vencimientos de término fijo (preaviso art. 46), vacaciones acumuladas, mora en
   seguridad social, exceso de jornada (Ley 2101/2021).
5. **Disciplinario** — checklist de debido proceso (CN art. 29, CST art. 115, CSJ SL1706-2024) +
   asistente de pliego de cargos.
6. **Reclasificación** — test de contrato realidad y **subordinación algorítmica (Ley 2466/2025)**.

## Marco normativo implementado
CST (arts. 22–23, 46, 61, 64, 115, 127–128, 132, 186–192, 249–252, 306–307) · Ley 52/1975 ·
Ley 2101/2021 · Ley 2466/2025 · Decreto 1072/2015 · CN art. 29 · CSJ SL1706-2024 ·
Parámetros 2026: SMMLV $1.750.905, auxilio de transporte $249.095 (Decretos 1469/1470 de 2025).

## Stack
Next.js 16 (App Router) · TypeScript · Tailwind v4 · Motion · iconsax-react · Anthropic SDK.
Sistema de diseño **ThoughtStream** (editorial, serif Libre Baskerville + Inter, bordes
hairline, sin sombras) re-marcado a **Hurtado Gandini: negro + rojo**.

## Ejecutar

```bash
npm install
cp .env.example .env.local   # opcional: añade ANTHROPIC_API_KEY para IA real
npm run dev                  # http://localhost:3000
```

Sin `ANTHROPIC_API_KEY`, la extracción de contratos funciona en **modo demo** (heurística local).
Con la clave, usa el modelo de IA (`CENTINELA_EXTRACT_MODEL`, por defecto Haiku 4.5).

## Desplegar (Vercel)

El módulo de contratos usa una **ruta de servidor** (`/api/extract`) que ejecuta la API de
Anthropic, así que el destino es **Vercel** (un host estático como GitHub Pages no puede correr
esa ruta). Vercel detecta Next.js automáticamente; no hace falta configuración extra.

```bash
npx vercel        # primer despliegue (preview) — pide login la primera vez
npx vercel --prod # producción
```

En **Project → Settings → Environment Variables** define `ANTHROPIC_API_KEY` (y, opcional,
`CENTINELA_EXTRACT_MODEL`) para habilitar la IA real. Sin la clave, el sitio corre en **modo demo**
(heurística local), sin romper la interfaz.

## Implementación en 90 días (pregunta del jurado)
1. **Semanas 1–3:** conectar la fuente de nómina del cliente (lectura, no escritura) y validar el
   motor de liquidación contra liquidaciones históricas reales (lo valida el área contable).
2. **Semanas 4–8:** piloto de alertas + reclasificación sobre 1–2 clientes; ajuste de prompts de
   extracción con contratos reales anonimizados.
3. **Semanas 9–12:** módulo disciplinario con revisión obligatoria del abogado y trazabilidad
   (quién aprobó qué). Presupuesto dominado por integración y horas de abogado, no por la IA.

> Datos de demostración. Toda salida requiere validación del abogado responsable.
