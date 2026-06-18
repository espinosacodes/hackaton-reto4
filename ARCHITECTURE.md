# Arquitectura — Centinela

Documento técnico del prototipo. Acompaña al `README.md` (visión de producto) y es uno
de los entregables del repositorio (Legal Hack Icesi 2026, Reto 4).

---

## 1. Principio de diseño

> **La IA lee y redacta. Un motor determinista calcula. El abogado decide.**

Toda la solución se organiza alrededor de esa separación de responsabilidades:

```
                    ┌──────────────────────────────────────────────┐
  Contrato (texto)  │  CAPA IA (no confiable para cálculo)          │
  ───────────────▶  │  • Extracción de cláusulas → JSON estructurado │
                    │  • Redacción del pliego de cargos              │
                    │  Modelo económico · salida con esquema · score │
                    └───────────────┬──────────────────────────────┘
                                    │ datos estructurados + confianza
                                    ▼
                    ┌──────────────────────────────────────────────┐
                    │  CAPA DETERMINISTA (auditable, sin IA)         │
                    │  • Liquidación de prestaciones (fórmulas+norma)│
                    │  • Motor de alertas por fechas                 │
                    │  • Scoring de reclasificación (indicios)       │
                    └───────────────┬──────────────────────────────┘
                                    │
                                    ▼
                    ┌──────────────────────────────────────────────┐
                    │  REVISIÓN DEL ABOGADO (aprobación obligatoria) │
                    │  Confirma extracción · valida cálculo · firma  │
                    └──────────────────────────────────────────────┘
```

**Por qué importa para el jurado:** un cálculo de liquidación hecho por un LLM que acierta el
99% de las veces es una demanda laboral. Por eso lo numérico es código determinista que expone
su fórmula y su norma, y lo jurídico siempre lo valida un humano.

---

## 2. Stack

| Área | Tecnología |
|------|-----------|
| Framework | Next.js 16 (App Router) + React 19 |
| Lenguaje | TypeScript (estricto) |
| Estilos | Tailwind CSS v4 (tema CSS-first en `globals.css`) |
| Animación | Motion (`motion/react`) |
| Iconos | `iconsax-react` |
| IA | `@anthropic-ai/sdk` + salidas estructuradas con Zod |
| Validación | Zod |
| Despliegue | Vercel (servidor Node, ejecuta la ruta `/api/extract`) |

Sistema de diseño: **ThoughtStream** (editorial/zen: serif Libre Baskerville + Inter, bordes
hairline, esquinas rectas, sin sombras), re-marcado a **Hurtado Gandini — negro + rojo legal
(`#c8102e`)**.

---

## 3. Estructura del repositorio

```
src/
├── app/
│   ├── layout.tsx               # fuentes (Libre Baskerville/Inter/Source Code Pro), metadata
│   ├── globals.css              # tokens del design system (tema Tailwind v4)
│   ├── (panel)/                 # grupo de rutas con el shell del dashboard
│   │   ├── layout.tsx           # envuelve las páginas en <AppShell>
│   │   ├── page.tsx             # Resumen (dashboard)
│   │   ├── contratos/page.tsx   # Lectura contractual (IA + revisión humana)
│   │   ├── liquidaciones/page.tsx
│   │   ├── alertas/page.tsx
│   │   ├── disciplinario/page.tsx
│   │   └── reclasificacion/page.tsx
│   └── api/
│       └── extract/route.ts     # ÚNICA ruta de servidor: extracción IA de contratos
├── components/
│   ├── AppShell.tsx             # sidebar + topbar + PageHeader
│   ├── Logo.tsx                 # wordmark Centinela (marca HG)
│   ├── nav.ts                   # definición de navegación
│   ├── ui.tsx                   # primitivos: Card, Badge, Button, Progress, Stat…
│   └── motion.tsx               # Reveal, Stagger, CountUp (animaciones)
└── lib/
    ├── types.ts                 # modelo de dominio (Contrato, Alerta, etc.)
    ├── utils.ts                 # cop(), fmtDate(), days360() (convención comercial 360)
    ├── liquidacion.ts           # ★ motor determinista de prestaciones
    ├── alertas.ts               # ★ motor de alertas por fechas
    ├── reclasificacion.ts       # ★ scoring de subordinación (incl. Ley 2466/2025)
    ├── debido-proceso.ts        # checklist art. 29 CN + generador de pliego
    ├── compliance.ts            # agrega todo en un índice 0–100 para el Resumen
    └── data/contratos.ts        # nómina de muestra (datos demo deterministas)
```

★ = lógica jurídica/numérica central, sin IA, unitariamente verificable.

---

## 4. Los motores deterministas

### 4.1 Liquidación (`lib/liquidacion.ts`)
Calcula prestaciones según el CST con días por convención comercial 360. Cada línea del
resultado expone `concepto`, `base`, `formula`, `valor` y `norma` para que sea auditable.

- **Cesantías** — `(salario+auxilio) × días / 360` (CST 249–252)
- **Intereses a cesantías** — `cesantías × días × 0.12 / 360` (Ley 52/1975)
- **Prima de servicios** — `(salario+auxilio) × días / 360` (CST 306–307)
- **Vacaciones** — `salario × días / 720` (CST 186–192; sin auxilio)
- **Indemnización art. 64** — escala por tipo de contrato y nivel salarial
- **Salario integral** (CST 132) — omite cesantías/intereses/prima
- `compararLiquidacion()` detecta **sub/sobre-liquidación** contra el valor pagado por la empresa.

Parámetros 2026 (`PARAMS_2026`, configurable por el área contable): SMMLV $1.750.905, auxilio
de transporte $249.095 (Decretos 1469/1470 de 2025).

### 4.2 Alertas (`lib/alertas.ts`)
Reglas por fechas sobre cada contrato activo: vencimiento de término fijo y preaviso (CST 46),
vacaciones acumuladas/vencidas (CST 187/190), mora en seguridad social, jornada > 42h
(Ley 2101/2021), y señal temprana de reclasificación. Ordena por severidad y urgencia.

### 4.3 Reclasificación (`lib/reclasificacion.ts`)
Test de contrato realidad (primacía de la realidad, CP art. 53 / CST art. 23) con indicios
ponderados; incluye los indicios de **subordinación algorítmica de la Ley 2466/2025**
(asignación por algoritmo, geolocalización, calificación, penalización por rechazos).
Las plataformas de reparto reciben presunción de vínculo.

### 4.4 Debido proceso (`lib/debido-proceso.ts`)
Checklist de garantías mínimas (CN art. 29, CST art. 115, CSJ SL1706-2024) y plantilla de
pliego de cargos. Detecta riesgo de **nulidad** si falta una garantía obligatoria.

---

## 5. La capa de IA (`lib/llm.ts` + `app/api/extract/route.ts`)

Única ruta de servidor. Recibe el texto del contrato y devuelve datos estructurados. La lógica de
proveedor vive en `lib/llm.ts` (agnóstica) y la ruta sólo orquesta y degrada con elegancia.

- **Multi-proveedor / costo-efectivo:** soporta **Claude, OpenAI, DeepSeek y Gemini**. Claude usa
  su propio SDK; OpenAI, DeepSeek y Gemini comparten la **API compatible con OpenAI** (mismo SDK,
  sólo cambia `baseURL` + modelo). Selección: `LLM_PROVIDER` explícito, o el primer proveedor con
  API key (orden: anthropic → openai → deepseek → gemini).
- **Modelo económico** por defecto (el escalón más barato de cada proveedor): `claude-haiku-4-5`,
  `gpt-4o-mini`, `deepseek-chat`, `gemini-2.0-flash`. Override con `CENTINELA_EXTRACT_MODEL`.
- **Salida estructurada**: Claude usa `messages.parse` + `zodOutputFormat`; los demás usan
  `response_format: json_object` y se validan con el **mismo esquema Zod** → JSON válido garantizado.
- **Confianza + observaciones** en cada extracción, para revisión humana.
- **Degradación elegante**: sin proveedor, o si la API falla, devuelve una extracción heurística
  (`_modo: "demo"`) para que la interfaz nunca se rompa en la demostración. El cliente además tiene
  un *fallback* en navegador por si la ruta no existe.

Flujo: `Contratos` (cliente) → `POST /api/extract` → `extraerContrato()` (proveedor activo, salida
estructurada) → tarjeta de revisión con confianza y proveedor → el humano **Confirma** o **Corrige**.

---

## 6. Variables de entorno

Define **solo la API key del proveedor que uses**. Todas son opcionales: sin ninguna, la app corre
en **modo demo** (heurística local).

| Variable | Requerida | Por defecto | Para qué |
|----------|-----------|-------------|----------|
| `ANTHROPIC_API_KEY` | No | — | Usar **Claude**. |
| `OPENAI_API_KEY` | No | — | Usar **OpenAI** (GPT). |
| `DEEPSEEK_API_KEY` | No | — | Usar **DeepSeek** — la opción más costo-efectiva. |
| `GEMINI_API_KEY` | No | — | Usar **Gemini** (Google). |
| `LLM_PROVIDER` | No | auto | Fuerza el proveedor: `anthropic`｜`openai`｜`deepseek`｜`gemini`. Si se omite, se elige el primero con key. |
| `CENTINELA_EXTRACT_MODEL` | No | el más barato del proveedor | Sobrescribe el modelo (p. ej. `deepseek-chat`, `gpt-4o-mini`, `claude-haiku-4-5`, `gemini-2.0-flash`). |

> No hay base de datos ni otros secretos. El resto de la app (6 páginas del dashboard) funciona
> sin ninguna variable de entorno.

### Local
```bash
cp .env.example .env.local
# edita .env.local y pega la API key de UN proveedor (opcional)
npm install
npm run dev          # http://localhost:3000
```

### Vercel
1. Importa el repo en Vercel (detecta Next.js solo; sin configuración extra).
2. **Project → Settings → Environment Variables**, añade para *Production* (y *Preview*) la key del
   proveedor que uses, p. ej.:
   - `DEEPSEEK_API_KEY` = `sk-...` *(más costo-efectivo)* — o `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GEMINI_API_KEY`
   - `LLM_PROVIDER` = `deepseek` *(opcional, si defines varias keys)*
   - `CENTINELA_EXTRACT_MODEL` = `deepseek-chat` *(opcional)*
3. Despliega: `npx vercel --prod` (o push a la rama conectada). **Redeploy tras cambiar variables.**

`/api/extract` corre como función de servidor en Vercel (en el build aparece como `ƒ Dynamic`);
las 6 páginas del dashboard se prerenderizan estáticas (`○ Static`).

---

## 7. Estado del prototipo

Hecho y verificado:
- 6 páginas del dashboard funcionando (verificadas en navegador).
- Motor de liquidación con aritmética comprobada a mano (indefinido 2 años, despido sin justa
  causa = $15.409.279).
- Ruta de extracción IA con salida estructurada + degradación elegante.
- Sistema de diseño ThoughtStream → HG (negro/rojo) aplicado en toda la app.
- `next build` limpio (TypeScript sin errores).

Pendiente / siguiente iteración (no requerido para la demo):
- Persistencia (hoy los datos son de muestra deterministas).
- Trazabilidad de aprobaciones del abogado (quién aprobó qué y cuándo).
- RAG real sobre el texto completo de la normativa para citas dinámicas en el pliego.
- Pruebas unitarias del motor de liquidación en CI.
