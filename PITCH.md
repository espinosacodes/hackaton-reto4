# Centinela — Guion de presentación y argumentos

Documento de apoyo para la ronda de evaluación (Legal Hack Icesi 2026, Reto 4).
Reúne el mensaje central, las respuestas a las preguntas del jurado, el argumento
costo-efectivo con su tabla, y un guion de demostración.

---

## 1. Mensaje central (una frase)

> **La IA lee y redacta. Un motor determinista calcula. El abogado decide.**

Centinela le permite a Hurtado Gandini ofrecer **compliance laboral proactivo** y
**gestión asistida de procesos disciplinarios** sobre la nómina de sus clientes
(empresas de 50–500 trabajadores con vínculo laboral directo).

---

## 2. Por qué este enfoque técnico (y no otro)

La solución tiene **dos tipos de trabajo** que NO se deben mezclar:

| Trabajo | Cómo lo resolvemos | Por qué |
|---------|--------------------|---------|
| Leer el contrato (extraer tipo, jornada, salario, fechas) | **IA** (modelo económico, salida estructurada) | Extracción/clasificación: la IA es muy buena y los errores son baratos de detectar |
| Liquidar prestaciones (cesantías, prima, vacaciones…) | **Código determinista, SIN IA** | El cálculo debe ser exacto y auditable. Una IA "99% correcta" en una liquidación es una demanda |
| Alertas por vencimientos | **Motor de reglas por fechas** | Pura aritmética de fechas |
| Pliego de cargos / debido proceso | **Checklist con citas + plantilla** | Garantías mínimas verificadas antes de decidir |

**Frase para el jurado:** *"No dejamos que la IA haga aritmética ni invente derecho.
La IA extrae y redacta; lo numérico es determinista y auditable; lo jurídico lo valida
un abogado."*

---

## 3. Respuestas a las preguntas del jurado

**¿Por qué escogieron este enfoque técnico y no otro?**
Porque separa lo que la IA hace bien (leer, redactar) de lo que NO debe hacer (calcular,
decidir). Cada liquidación expone su **fórmula y su norma**; el abogado puede verificar
cada peso.

**¿Qué pasa cuando la IA comete un error? ¿Cómo lo detecta el abogado?**
La extracción se muestra con su **nivel de confianza** y observaciones, lado a lado con el
contrato, para confirmación humana. Los cálculos no dependen de la IA: son deterministas y
muestran cómo se obtuvieron. Cada afirmación jurídica lleva su cita (CST, CN, jurisprudencia).

**¿Quién responde legalmente si el sistema genera una contestación incorrecta?**
El abogado. La herramienta es de **decisión asistida** con aprobación humana obligatoria;
nunca presenta ni radica nada de forma automática. Centinela es un asistente, no un sustituto.

**¿Cómo se implementaría en la firma en 90 días con presupuesto real?**
- Semanas 1–3: conectar la fuente de nómina del cliente (solo lectura) y validar el motor de
  liquidación contra liquidaciones históricas reales (lo valida el área contable).
- Semanas 4–8: piloto de alertas + reclasificación con 1–2 clientes; ajuste de la extracción
  con contratos reales anonimizados.
- Semanas 9–12: módulo disciplinario con revisión obligatoria del abogado y trazabilidad.
- El presupuesto lo dominan la integración y las horas de abogado, **no la IA** (ver §4).

**¿Qué normas regulan el uso de IA en la práctica legal en Colombia hoy?**
No hay una ley específica de IA legal; aplican los deberes del abogado (lealtad, diligencia,
secreto profesional — Ley 1123/2007), el régimen de datos personales (Ley 1581/2012) y los
lineamientos de la rama judicial sobre uso responsable de IA. Por eso el diseño mantiene
**al abogado como responsable** y la IA como apoyo trazable y auditable.

---

## 4. Argumento costo-efectivo (multi-proveedor)

> *"La lógica jurídica es determinista y no depende del proveedor de IA. Para el paso de
> lectura comparamos cuatro proveedores y corremos el más costo-efectivo que cumpla la
> calidad. Cambiar de proveedor es una sola variable de entorno."*

La extracción soporta **Claude, OpenAI, DeepSeek y Gemini** con un mismo esquema de salida.
Se elige por la variable `LLM_PROVIDER` (o automáticamente por la API key presente).

### Costo estimado de leer **1.000 contratos**

Supuestos: ~2.000 tokens de entrada (contrato + instrucción) y ~300 de salida (JSON) por
contrato → 2,0 M de entrada + 0,3 M de salida por cada 1.000 contratos.
*(Precios aproximados USD por millón de tokens, junio 2026 — verificar con cada proveedor.)*

| Modelo (escalón económico) | Entrada $/1M | Salida $/1M | **Costo / 1.000 contratos** |
|----------------------------|-------------:|------------:|----------------------------:|
| Gemini 2.0 Flash | $0,10 | $0,40 | **≈ $0,32** |
| GPT-4o mini (OpenAI) | $0,15 | $0,60 | **≈ $0,48** |
| DeepSeek-chat | $0,27 | $1,10 | **≈ $0,87** |
| Claude Haiku 4.5 | $1,00 | $5,00 | **≈ $3,50** |
| — referencia premium — Claude Opus 4.8 | $5,00 | $25,00 | ≈ $17,50 |

**Conclusión:** leer 1.000 contratos cuesta **entre ~$0,32 y ~$3,50 USD** según el proveedor
(≈ $1.300 – $14.000 COP a ~$4.000 COP/USD), frente a **~$17,50 USD** con un modelo premium.
La IA es la parte **más barata** del proyecto; el costo real está en integración y horas de
abogado. Con DeepSeek y los descuentos por horario valle, el costo baja aún más.

**Frase para el jurado:** *"Leer mil contratos cuesta centavos de dólar. Y si mañana sale un
modelo mejor o más barato, lo cambiamos con una línea de configuración, sin reescribir nada."*

---

## 5. Elemento diferenciador — Ley 2466 de 2025

Centinela incorpora el análisis de **subordinación algorítmica** (asignación por algoritmo,
geolocalización, calificación de la plataforma, penalización por rechazos) y aplica la
**presunción de vínculo laboral** para trabajadores de plataformas de reparto. Es justo el
criterio que el enunciado premia en **impacto y escalabilidad**.

---

## 6. Guion de demostración (≈ 4 minutos)

1. **Resumen (15s):** índice de compliance, pasivo prestacional estimado, alertas críticas.
   *"Una sola pantalla le dice al área de RRHH dónde está el riesgo hoy."*
2. **Contratos (45s):** pegar un contrato → "Extraer con IA" → mostrar datos extraídos con su
   **confianza** y el **proveedor** usado. *"La IA lee; el humano confirma."*
3. **Liquidaciones (60s):** elegir un empleado, causa "despido sin justa causa" → mostrar cada
   línea con su **fórmula y su norma**. Pegar el valor que pagó la empresa → el sistema detecta
   una **subliquidación**. *(Aquí el compañero de contaduría valida un número en vivo.)*
4. **Disciplinario (45s):** marcar una garantía como incumplida → el sistema advierte **riesgo
   de nulidad** del proceso (art. 29 CN). Generar el pliego de cargos.
5. **Reclasificación (45s):** abrir el repartidor de plataforma → puntaje de riesgo + etiqueta
   **"Algorítmica"** (Ley 2466/2025).
6. **Cierre (20s):** *"IA económica para leer, motor determinista para calcular, abogado para
   decidir. Funciona en el entorno jurídico colombiano real y se implementa en 90 días."*

> Recordar en todo momento: **datos de demostración; toda salida requiere validación del
> abogado responsable.**
