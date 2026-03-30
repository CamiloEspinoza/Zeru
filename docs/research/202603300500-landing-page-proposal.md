# Propuesta de Landing Page - Zeru 2026

**Fecha:** 28 de marzo de 2026
**Autor:** Equipo de auditoria landing + marketing
**Objetivo:** Reescritura completa del landing page para reflejar la plataforma actual, con foco en Inteligencia Organizacional como diferenciador principal.

---

## A. Auditoria del Landing Actual

### A.1 Estructura actual

El landing actual se compone de 6 secciones servidas desde `apps/web/app/(marketing)/`:

| # | Seccion | Componente | Proposito |
|---|---------|-----------|-----------|
| 1 | Hero | `hero-section.tsx` + `hero-typewriter.tsx` + `hero-chat.tsx` + `hero-cta.tsx` | Headline animado tipo typewriter + mockup de chat contable |
| 2 | Features | `features-section.tsx` | Grid de 6 funcionalidades (todas contables) |
| 3 | Roadmap | `roadmap-section.tsx` | 15 items en 3 columnas por timeline |
| 4 | Open Source | `opensource-section.tsx` | Modelo de costos, pilares de transparencia, proveedores IA |
| 5 | Developer | `developer-section.tsx` | Bio de Camilo Espinoza, timeline, proyectos |
| 6 | Footer | `marketing-footer.tsx` | Links, legal, tech stack |

Navegacion: `marketing-nav.tsx` con links a Funcionalidades, Roadmap, Open Source, Creador.

### A.2 Que comunica actualmente

**Mensaje principal:** "Contabilidad automatizada con inteligencia artificial" -- es la primera frase del typewriter.

**Posicionamiento:** Software contable gratuito, open source, chileno, con IA conversacional que crea asientos contables.

**Propuesta de valor:** "Zeru se diseno desde el inicio con agentes de inteligencia artificial en el centro. Contabiliza documentos, crea asientos y razona en conversacion, como un contador de verdad."

**Tags de social proof:** Contabilidad chilena (SII), Multi-empresa, IA con razonamiento visible, Tus propias credenciales.

### A.3 Que NO comunica (problemas criticos)

1. **Inteligencia Organizacional no existe en el landing.** El feature mas diferenciador y poderoso de Zeru -- transcripcion de entrevistas, extraccion de conocimiento, Knowledge Graph, diagnosticos automaticos, diagramas AS-IS, plan de mejoras con RICE -- no aparece en ninguna parte.

2. **Gestion de Personas ausente.** Directorio, organigrama interactivo, departamentos jerarquicos, sugerencias de IA sobre la estructura organizacional -- nada de esto se menciona.

3. **LinkedIn/Marketing ausente.** La generacion de posts con IA y publicacion directa no aparece.

4. **El hero habla SOLO de contabilidad.** Las 7 frases del typewriter son variaciones de "contabilidad con IA". Eso era correcto cuando Zeru era solo un software contable, pero hoy limita severamente la percepcion del producto.

5. **El mockup del chat muestra solo un asiento contable.** El demo animado del hero simula la creacion de un asiento de constitucion. No muestra el flujo de entrevistas, ni Knowledge Graph, ni organigramas.

6. **El roadmap esta desactualizado.** Muchas features listadas como "planificado" ya existen (ej: la inteligencia organizacional misma).

7. **No hay seccion de pricing.** El costo de ~$0.65 por entrevista procesada es un dato comercial poderoso que no aparece.

8. **No hay social proof.** Ni testimoniales, ni logos, ni metricas de impacto. Solo la bio del creador.

9. **La seccion "Developer" ocupa demasiado espacio.** Es mas un CV personal que contenido de conversion.

### A.4 Problemas de SEO

- **Title tag:** "Zeru -- Gestion empresarial con agentes de IA, gratuito y open source" -- Demasiado largo (67 chars), no menciona inteligencia organizacional.
- **Meta description:** Habla solo de contabilidad y open source. No menciona diagnostico organizacional.
- **Keywords actuales:** 100% contabilidad/Chile/SII. Ninguna keyword de inteligencia organizacional, diagnostico empresarial, o gestion de personas.
- **H1:** Es el typewriter animado (contabilidad). Solo hay un H1 real: la primera frase que aparece.
- **H2s:** "Contabilidad inteligente desde el primer dia", "Lo que viene", "Abierto, transparente, sin letra chica", "Software construido por alguien que vivio el problema" -- todos genericos.
- **Sin schema markup:** No hay structured data (Organization, SoftwareApplication, FAQPage).
- **Sin Open Graph image:** No hay og:image optimizada para compartir en redes.

### A.5 Problemas de conversion

- **CTA unico:** Solo "Comenzar gratis" y "Ver funcionalidades". No hay "Agendar demo" ni "Ver caso de uso".
- **No hay above-the-fold clarity** sobre QUE hace Zeru para QUIEN. Un CEO que llega no entiende que puede diagnosticar su empresa.
- **El roadmap genera incertidumbre.** Mostrar 9 features como "planificado" sin fecha concreta puede asustar al comprador.
- **No hay urgencia ni escasez.** No hay razon para actuar hoy.
- **La seccion Open Source puede confundir al B2B.** Un CEO no quiere configurar API keys de OpenAI ni buckets S3 -- quiere resultados.

---

## B. Analisis Competitivo

### B.1 Competidores directos en inteligencia organizacional

| Plataforma | Posicionamiento | Fortalezas | Debilidades |
|-----------|----------------|-----------|------------|
| **ChartHop** | "The HR Platform Built for AI" - Conecta datos de personas con inteligencia de negocio | Deep analytics, integraciones HRIS, scenario modeling, enterprise-grade | Precio alto, orientado a HR, no hace diagnostico desde entrevistas |
| **Orgvue** | "Organizational design & workforce planning" - Modela la fuerza laboral del futuro | Scenario modeling avanzado, workforce planning, visualizaciones | Enterprise-only, sin IA conversacional, sin transcripcion |
| **Functionly** | "Interactive Org Design Software" - Mapea y planifica la estructura organizacional | Colaboracion real-time, escenarios, accesible para startups | Solo organigramas, no hace diagnostico automatizado |
| **eKlevo** | "Software de resolucion de conflictos organizacionales" - Diagnostico de conflictos con IA | Nicho especifico, IA para conflictos | Solo conflictos, no abarca la organizacion completa |

### B.2 Oportunidad unica de Zeru

**NINGUNO de los competidores hace esto:**
- Transcribir entrevistas con identificacion de hablantes
- Extraer conocimiento organizacional automaticamente con IA (5 pasadas)
- Construir un Knowledge Graph desde conversaciones reales
- Diagnosticar cuellos de botella, SPOFs y contradicciones automaticamente
- Generar diagramas de procesos AS-IS sin intervencion humana
- Proponer un plan de mejoras priorizado con RICE
- Todo por ~$0.65 USD por entrevista

**Esto es un oceano azul.** ChartHop y Orgvue trabajan con datos estructurados (HRIS, nomina). Zeru trabaja con la materia prima mas rica y menos explotada: **las conversaciones reales de las personas**.

### B.3 Mejores practicas de landing pages SaaS B2B 2026

De la investigacion competitiva:

1. **Un CTA primario por seccion** -- sin excepciones. Conversion mediana de SaaS: 3.8%, top: 11.6%.
2. **Multi-stakeholder content** -- CEO quiere ROI, gerente de operaciones quiere diagnostico, consultor quiere herramienta.
3. **Personalizacion con IA** -- contenido dinamico segun el visitante (futuro).
4. **Feature-Benefit Transformation** -- no decir "transcripcion con Deepgram", decir "Sube una entrevista de 45 minutos y en 3 minutos tienes un diagnostico completo".
5. **PAS framework** -- Problem (dolor) -> Agitation (consecuencia) -> Solution (Zeru).
6. **Social proof numerico** -- metricas concretas > testimoniales vagos.
7. **Pricing transparente** -- el precio es un diferenciador, no un secreto.

---

## C. Propuesta de Nueva Estructura

### Vista general del nuevo landing

```
1. Nav (fijo)
2. Hero - Above the fold
3. Problema - El dolor real
4. Solucion - Como Zeru lo resuelve
5. Como funciona - 4 pasos del flujo de inteligencia organizacional
6. Features detallados - Grid por modulo
7. Diferenciadores - Lo que nadie mas hace
8. Caso de uso - Ejemplo real paso a paso
9. Pricing - Transparencia total
10. Social proof - Testimoniales + metricas (placeholder)
11. CTA final - Repeticion del hero
12. Footer
```

### Detalle de cada seccion

#### 1. Nav
- Logo Zeru
- Links: Que hace | Como funciona | Pricing | Iniciar sesion
- CTA: "Diagnostica tu empresa" (boton teal)
- Hamburger mobile con los mismos items

#### 2. Hero (Above the fold)
- **Badge:** "Inteligencia Organizacional con IA"
- **Headline (H1):** "Entiende tu empresa en dias, no en meses"
- **Sub-headline:** "Sube entrevistas con tu equipo. Zeru las transcribe, extrae conocimiento y diagnostica cuellos de botella, dependencias y oportunidades de mejora -- automaticamente."
- **CTA primario:** "Diagnostica tu empresa gratis"
- **CTA secundario:** "Ver como funciona" (scroll a seccion 5)
- **Visual:** Mockup animado del flujo: audio waveform -> transcripcion -> Knowledge Graph -> diagrama de proceso. O un screenshot real del dashboard de un proyecto de inteligencia organizacional.
- **Social proof tags:** "~$0.65 por entrevista" | "Diagnostico en minutos" | "5 analisis automaticos con IA"

#### 3. Problema
- Encabezado visual con estadistica
- 3 tarjetas de dolor con icono, titulo y descripcion
- Cierre con pregunta retorica

#### 4. Solucion
- Badge: "La solucion"
- Headline (H2)
- 3 pilares de solucion con icono, titulo, descripcion corta
- Imagen/mockup del dashboard

#### 5. Como funciona
- Badge: "4 pasos simples"
- Headline (H2)
- 4 pasos en layout vertical o timeline:
  1. Sube la entrevista
  2. Transcripcion automatica
  3. Extraccion de conocimiento
  4. Diagnostico y plan de mejoras
- Cada paso con icono, titulo, descripcion y screenshot/mockup

#### 6. Features detallados
- Badge: "Todo lo que necesitas"
- Headline (H2)
- **Modulo principal:** Inteligencia Organizacional (destacado, full-width)
- **Grid 3x2 secundario:**
  - Gestion de Personas (directorio, organigrama)
  - Asistente IA (chat, documentos, skills)
  - Contabilidad (plan de cuentas, libro diario, balance)
  - Marketing LinkedIn (generacion de posts, publicacion)
  - Multi-empresa (tenants aislados)
  - Extensible (API, skills custom)

#### 7. Diferenciadores
- Layout de 2 columnas: texto izquierda, visual derecha
- 3-4 diferenciadores con icono y copy corto
- Visual: comparativa antes/despues o screenshot del Knowledge Graph

#### 8. Caso de uso (opcional - puede ser V2)
- Narrativa: "Una empresa con 50 personas queria..."
- Resultados concretos: "En 3 dias, con 12 entrevistas..."

#### 9. Pricing
- Badge: "Transparencia total"
- Headline (H2)
- Tabla simple:
  - Plataforma: Gratis
  - Costo IA: ~$0.65 por entrevista (pagas directo a OpenAI)
  - Sin contratos, sin limites artificiales
- CTA: "Comenzar gratis"

#### 10. Social proof
- (Placeholders hasta tener testimoniales reales)
- Metricas de la plataforma: entrevistas procesadas, organizaciones activas
- Quote del creador sobre por que construyo Zeru

#### 11. CTA final
- Fondo con gradiente teal
- Headline: "Tu empresa tiene respuestas. Zeru las encuentra."
- CTA: "Diagnostica tu empresa gratis"
- Sub-texto: "Sin tarjeta de credito. Configura en 5 minutos."

#### 12. Footer
- 3 columnas: Producto | Recursos | Legal
- Links a docs, GitHub, LinkedIn
- "Hecho en Chile"

---

## D. Copywriting Completo

A continuacion, el texto exacto de cada seccion. Listo para implementar.

---

### D.1 Navegacion

```
Logo: Zeru
Links: Que hace | Como funciona | Pricing
Auth: Iniciar sesion | [Diagnostica tu empresa] (boton)
```

---

### D.2 Hero (Above the Fold)

**Badge:**
Inteligencia Organizacional con IA

**Headline (H1):**
Entiende tu empresa en dias, no en meses

**Sub-headline:**
Sube entrevistas con tu equipo y Zeru las transcribe, extrae el conocimiento clave y diagnostica cuellos de botella, dependencias criticas y oportunidades de mejora. Todo automatico, todo con IA.

**CTA primario:**
Diagnostica tu empresa gratis

**CTA secundario:**
Ver como funciona

**Tags debajo del CTA:**

- ~$0.65 USD por entrevista procesada
- Diagnostico automatico en minutos
- 5 analisis con GPT-5.4 por entrevista
- Knowledge Graph organizacional

---

### D.3 Seccion: El Problema

**Badge:**
El problema real

**Headline (H2):**
Las empresas toman decisiones criticas sin entender como funcionan por dentro

**Texto introductorio:**
Los consultores cobran miles de dolares por un diagnostico que toma semanas. Las encuestas de clima miden percepcion, no realidad operativa. Y los gerentes generales toman decisiones basadas en intuicion, no en datos.

**Tarjeta 1 - El diagnostico artesanal:**
Titulo: Diagnosticos que cuestan una fortuna y llegan tarde
Descripcion: Un estudio organizacional clasico toma entre 4 y 12 semanas, cuesta entre $5.000 y $50.000 USD, y cuando llega, la empresa ya cambio. Los cuellos de botella siguen ahi, pero ahora con un bonito informe en PDF.

**Tarjeta 2 - El conocimiento que se pierde:**
Titulo: Tu equipo sabe como funciona la empresa. Tu no.
Descripcion: Cada persona en tu organizacion tiene un mapa mental de como funcionan las cosas: quien depende de quien, donde se traban los procesos, que funciona y que no. Ese conocimiento vive en sus cabezas y se va cuando ellos se van.

**Tarjeta 3 - Las decisiones a ciegas:**
Titulo: Reorganizaciones basadas en organigramas, no en realidad
Descripcion: El organigrama muestra la estructura formal. Pero las decisiones reales, las dependencias criticas y los cuellos de botella viven en otra parte: en las conversaciones, en los procesos informales, en lo que la gente dice pero nadie documenta.

**Cierre:**
Y si pudieras convertir las conversaciones con tu equipo en un diagnostico completo, automatico, en dias y no en meses?

---

### D.4 Seccion: La Solucion

**Badge:**
La solucion

**Headline (H2):**
Zeru convierte entrevistas en inteligencia organizacional

**Texto:**
Graba una conversacion con alguien de tu equipo. Zeru hace el resto: transcribe, identifica hablantes, extrae conocimiento, detecta patrones y entrega un diagnostico con plan de mejoras priorizado. Lo que antes tomaba semanas de consultoria, ahora toma minutos de procesamiento.

**Pilar 1:**
Icono: Microfono/Audio
Titulo: Transcripcion con IA de ultima generacion
Descripcion: Deepgram Nova-3 transcribe tus entrevistas con identificacion automatica de hablantes. Sube el audio y obtiene un texto limpio, segmentado y listo para analisis.

**Pilar 2:**
Icono: Cerebro/Red neuronal
Titulo: 5 pasadas de analisis con GPT-5.4
Descripcion: Cada entrevista pasa por 5 analisis diferentes: extraccion de hechos, identificacion de problemas, mapeo de dependencias, deteccion de contradicciones y oportunidades de mejora.

**Pilar 3:**
Icono: Grafo/Diagrama
Titulo: Knowledge Graph y diagnostico automatico
Descripcion: Toda la informacion se estructura en un grafo de conocimiento con busqueda semantica. Zeru detecta cuellos de botella, SPOFs (puntos unicos de falla) y genera diagramas de procesos AS-IS automaticamente.

---

### D.5 Seccion: Como Funciona

**Badge:**
4 pasos simples

**Headline (H2):**
De una entrevista a un diagnostico completo

**Paso 1:**
Numero: 01
Titulo: Entrevista a tu equipo
Descripcion: Graba una conversacion de 30-60 minutos con cualquier persona de tu organizacion. Puede ser presencial, por Zoom o por telefono. Cualquier formato de audio funciona.
Visual: Icono de microfono + waveform

**Paso 2:**
Numero: 02
Titulo: Sube el audio a Zeru
Descripcion: Arrastra el archivo a la plataforma. En menos de 3 minutos, Zeru transcribe la entrevista completa con identificacion automatica de quien habla.
Visual: Interfaz de upload + progreso

**Paso 3:**
Numero: 03
Titulo: La IA extrae el conocimiento
Descripcion: GPT-5.4 analiza la transcripcion en 5 pasadas independientes: hechos clave, problemas detectados, dependencias entre areas, contradicciones con otras entrevistas y oportunidades de mejora.
Visual: Cards de resultados de analisis

**Paso 4:**
Numero: 04
Titulo: Recibe tu diagnostico
Descripcion: Zeru construye un Knowledge Graph organizacional, genera diagramas de procesos AS-IS en formato Mermaid y entrega un plan de mejoras priorizado con RICE (Reach, Impact, Confidence, Effort). Todo listo para tomar decisiones.
Visual: Dashboard con Knowledge Graph + diagrama de proceso

**Dato destacado (call-out box):**
Costo promedio por entrevista procesada: ~$0.65 USD. Un diagnostico completo de una empresa de 50 personas con 12 entrevistas cuesta menos de $8 USD en procesamiento IA.

---

### D.6 Seccion: Features Detallados

**Badge:**
Todo lo que necesitas

**Headline (H2):**
Una plataforma completa para entender y gestionar tu organizacion

**Texto introductorio:**
Zeru no es solo diagnostico. Es una plataforma integral que conecta la inteligencia organizacional con la gestion diaria de tu empresa.

---

**Feature principal (full-width, destacado):**

Titulo: Inteligencia Organizacional
Descripcion: Transforma entrevistas en conocimiento accionable. Transcripcion automatica, extraccion con IA, Knowledge Graph, diagnostico de cuellos de botella y plan de mejoras priorizado.
Tags: Transcripcion | Knowledge Graph | Diagnostico | Plan RICE | Diagramas AS-IS
Visual: Screenshot del dashboard de proyecto

---

**Grid de features secundarios (3 columnas x 2 filas):**

**Feature: Gestion de Personas**
Icono: Usuarios
Titulo: Gestion de Personas
Descripcion: Directorio con perfiles completos, organigrama interactivo con React Flow y departamentos jerarquicos. La IA sugiere cambios en la estructura basandose en lo que las entrevistas revelan.
Tag: Activo

**Feature: Asistente IA**
Icono: Chat
Titulo: Asistente IA Conversacional
Descripcion: Chat con GPT-5.4 que entiende el contexto de tu empresa. Sube PDFs, imagenes o Excel y la IA los procesa. Memoria contextual y skills extensibles para automatizar tareas repetitivas.
Tag: Activo

**Feature: Contabilidad Chilena**
Icono: Calculadora
Titulo: Contabilidad Chilena
Descripcion: Plan de cuentas SII, libro diario, balance general y libro mayor. Periodos fiscales y estructura lista para operar desde el dia uno.
Tag: Activo

**Feature: Marketing LinkedIn**
Icono: Megafono
Titulo: Marketing en LinkedIn
Descripcion: Genera posts profesionales con IA, gestiona tu contenido y publica directamente desde Zeru. Ahorra horas de redaccion manteniendo tu presencia activa.
Tag: Activo

**Feature: Multi-empresa**
Icono: Edificios
Titulo: Multi-empresa
Descripcion: Gestiona multiples organizaciones desde una sola cuenta. Cada empresa tiene datos, usuarios y configuracion completamente aislados.
Tag: Activo

**Feature: Extensible**
Icono: Puzzle
Titulo: Extensible con Skills
Descripcion: Agrega nuevas capacidades al asistente IA con skills personalizados. API abierta para integrar con tus herramientas existentes.
Tag: Activo

---

### D.7 Seccion: Diferenciadores

**Badge:**
Por que Zeru

**Headline (H2):**
Lo que ninguna otra plataforma hace

**Diferenciador 1:**
Titulo: Diagnostico desde conversaciones, no desde formularios
Descripcion: Las encuestas de clima miden percepcion. Las entrevistas capturan realidad. Zeru es la unica plataforma que construye inteligencia organizacional a partir de lo que tu equipo realmente dice.

**Diferenciador 2:**
Titulo: De audio a plan de mejoras en minutos
Descripcion: Lo que un consultor tarda semanas en producir, Zeru lo genera automaticamente: transcripcion, analisis, diagnostico y plan priorizado con RICE. Por una fraccion del costo.

**Diferenciador 3:**
Titulo: Knowledge Graph que conecta toda tu organizacion
Descripcion: Cada entrevista alimenta un grafo de conocimiento con busqueda semantica. Mientras mas entrevistas procesas, mas rica y precisa se vuelve la imagen de tu organizacion.

**Diferenciador 4:**
Titulo: $0.65 por entrevista, no $5.000 por consultoria
Descripcion: El costo de procesar una entrevista de 45 minutos con IA es de aproximadamente 65 centavos de dolar. Un diagnostico organizacional completo cuesta menos que un almuerzo de negocios.

---

### D.8 Seccion: Pricing

**Badge:**
Transparencia total

**Headline (H2):**
Sabes exactamente cuanto pagas antes de empezar

**Texto:**
Zeru es gratuito. Solo pagas el costo real de la IA que usas, directamente al proveedor. Sin markup, sin suscripciones ocultas, sin sorpresas.

**Tabla de costos:**

| Concepto | Costo |
|---------|-------|
| Plataforma Zeru | Gratis |
| Procesamiento de entrevista (~45 min) | ~$0.65 USD |
| Chat con asistente IA (por sesion) | Variable segun uso |
| Almacenamiento de archivos | Tu propio S3 (tu costo AWS) |

**Nota al pie:**
Los costos de IA dependen del proveedor (OpenAI) y varian segun la longitud de las entrevistas y el uso del asistente. Usas tu propia API key -- pagas directamente, sin intermediarios.

**CTA:**
Comenzar gratis -- sin tarjeta de credito

---

### D.9 Seccion: Social Proof

**Badge:**
En buenas manos

**Headline (H2):**
Construido por alguien que vivio el problema

**Quote del creador:**
"Llevo 10 anos operando empresas en Chile -- retail, salud, educacion. Conozco el dolor de tomar decisiones sin datos, de depender de consultores externos para entender tu propia organizacion. Construi Zeru para que cualquier gerente pueda diagnosticar su empresa con la misma profundidad que un consultor senior, pero en una fraccion del tiempo y costo."
-- Camilo Espinoza, Creador de Zeru

**Metricas (placeholders para llenar con datos reales):**
- [X] entrevistas procesadas
- [X] organizaciones activas
- [X] diagnosticos generados

**Nota:** Esta seccion se debe enriquecer con testimoniales reales de primeros usuarios cuando esten disponibles. Priorizar CEOs y gerentes generales que hayan usado el modulo de inteligencia organizacional.

---

### D.10 Seccion: CTA Final

**Headline (H2):**
Tu empresa tiene las respuestas. Zeru las encuentra.

**Texto:**
Cada persona en tu equipo tiene una pieza del rompecabezas. Zeru las junta automaticamente y te muestra la imagen completa: donde estan los cuellos de botella, quien es irremplazable, que procesos se pueden mejorar y por donde empezar.

**CTA primario:**
Diagnostica tu empresa gratis

**Sub-texto:**
Sin tarjeta de credito. Configura en 5 minutos. Primera entrevista procesada en menos de 3 minutos.

---

### D.11 Footer

**Columna 1 - Producto:**
- Inteligencia Organizacional
- Gestion de Personas
- Asistente IA
- Contabilidad
- Marketing LinkedIn

**Columna 2 - Recursos:**
- Documentacion
- API
- GitHub

**Columna 3 - Empresa:**
- Sobre nosotros
- Contacto
- LinkedIn

**Barra inferior:**
(c) 2026 Zeru. Software libre.
Hecho en Chile por Camilo Espinoza.
NestJS | Next.js | OpenAI | Deepgram | Prisma

---

## E. SEO

### E.1 Title Tag
```
Zeru - Inteligencia Organizacional con IA | Diagnostica tu empresa en dias
```
(64 caracteres -- dentro del limite de 60-70)

### E.2 Meta Description
```
Sube entrevistas con tu equipo y Zeru las transcribe, analiza y diagnostica automaticamente. Knowledge Graph, deteccion de cuellos de botella y plan de mejoras con IA. Desde $0.65 por entrevista.
```
(196 caracteres -- dentro del limite de 150-160... ajustar a:)

```
Sube entrevistas con tu equipo y Zeru las transcribe, analiza y diagnostica automaticamente. Knowledge Graph y plan de mejoras con IA. ~$0.65/entrevista.
```
(155 caracteres)

### E.3 Jerarquia de Headings

```
H1: Entiende tu empresa en dias, no en meses

  H2: Las empresas toman decisiones criticas sin entender como funcionan por dentro
    H3: Diagnosticos que cuestan una fortuna y llegan tarde
    H3: Tu equipo sabe como funciona la empresa. Tu no.
    H3: Reorganizaciones basadas en organigramas, no en realidad

  H2: Zeru convierte entrevistas en inteligencia organizacional
    H3: Transcripcion con IA de ultima generacion
    H3: 5 pasadas de analisis con GPT-5.4
    H3: Knowledge Graph y diagnostico automatico

  H2: De una entrevista a un diagnostico completo
    H3: Entrevista a tu equipo
    H3: Sube el audio a Zeru
    H3: La IA extrae el conocimiento
    H3: Recibe tu diagnostico

  H2: Una plataforma completa para entender y gestionar tu organizacion
    H3: Inteligencia Organizacional
    H3: Gestion de Personas
    H3: Asistente IA Conversacional
    H3: Contabilidad Chilena
    H3: Marketing en LinkedIn
    H3: Multi-empresa
    H3: Extensible con Skills

  H2: Lo que ninguna otra plataforma hace
    H3: Diagnostico desde conversaciones, no desde formularios
    H3: De audio a plan de mejoras en minutos
    H3: Knowledge Graph que conecta toda tu organizacion
    H3: $0.65 por entrevista, no $5.000 por consultoria

  H2: Sabes exactamente cuanto pagas antes de empezar

  H2: Construido por alguien que vivio el problema

  H2: Tu empresa tiene las respuestas. Zeru las encuentra.
```

### E.4 Keywords Objetivo

**Primarias (high intent):**
1. inteligencia organizacional con IA
2. diagnostico organizacional automatizado
3. software diagnostico empresarial
4. analisis organizacional con inteligencia artificial

**Secundarias (medium intent):**
5. transcripcion entrevistas organizacionales
6. knowledge graph empresarial
7. cuellos de botella organizacionales
8. organigrama inteligente con IA
9. plataforma gestion empresarial Chile

**Long-tail:**
10. como diagnosticar mi empresa con IA
11. alternativa a consultoria organizacional
12. software para entender procesos internos de empresa

### E.5 Schema Markup Sugerido

**1. Organization (homepage)**
```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Zeru",
  "url": "https://zeruapp.com",
  "logo": "https://zeruapp.com/logo.png",
  "description": "Plataforma de inteligencia organizacional con IA. Diagnostica tu empresa a partir de entrevistas.",
  "founder": {
    "@type": "Person",
    "name": "Camilo Espinoza",
    "url": "https://www.linkedin.com/in/camilo-espinoza-c/"
  },
  "foundingDate": "2025",
  "sameAs": [
    "https://github.com/CamiloEspinoza",
    "https://www.linkedin.com/company/zeruapp"
  ]
}
```

**2. SoftwareApplication**
```json
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "Zeru",
  "url": "https://zeruapp.com",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web",
  "description": "Plataforma de inteligencia organizacional que convierte entrevistas en diagnosticos automaticos con IA.",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD",
    "description": "Plataforma gratuita. Costos de IA desde ~$0.65 por entrevista."
  },
  "featureList": [
    "Transcripcion automatica de entrevistas",
    "Extraccion de conocimiento con IA",
    "Knowledge Graph organizacional",
    "Diagnostico de cuellos de botella",
    "Diagramas de procesos AS-IS",
    "Plan de mejoras con RICE",
    "Gestion de personas y organigrama",
    "Contabilidad chilena",
    "Asistente IA conversacional"
  ]
}
```

**3. FAQPage (si se agrega seccion de preguntas frecuentes)**
```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Cuanto cuesta usar Zeru?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "La plataforma es gratuita. Solo pagas el costo de la IA (~$0.65 USD por entrevista de 45 minutos) directamente a OpenAI con tu propia API key."
      }
    },
    {
      "@type": "Question",
      "name": "Que es inteligencia organizacional?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Es el proceso de extraer conocimiento de tu organizacion a partir de entrevistas con tu equipo. Zeru transcribe, analiza y diagnostica automaticamente usando IA."
      }
    }
  ]
}
```

### E.6 Open Graph optimizado

```html
<meta property="og:title" content="Zeru - Inteligencia Organizacional con IA" />
<meta property="og:description" content="Diagnostica tu empresa en dias, no en meses. Sube entrevistas, Zeru hace el resto." />
<meta property="og:image" content="https://zeruapp.com/og-image.png" />
<meta property="og:type" content="website" />
<meta property="og:url" content="https://zeruapp.com" />
<meta property="og:locale" content="es_CL" />
<meta property="og:site_name" content="Zeru" />
```

**Nota:** Se debe crear una imagen OG de 1200x630px que muestre el dashboard de inteligencia organizacional con el headline superpuesto.

---

## F. Componentes Tecnicos Necesarios

### F.1 Lista de componentes React a construir

Todos dentro de `apps/web/app/(marketing)/components/`:

| Componente | Tipo | Descripcion |
|-----------|------|------------|
| `marketing-nav.tsx` | **Refactorizar** | Actualizar links de navegacion. Cambiar CTA a "Diagnostica tu empresa". Actualizar anchor links. |
| `hero-section.tsx` | **Reescribir** | Nuevo headline estatico (no typewriter). Nuevo sub-headline. Nuevo visual (mockup del flujo OrgIntel). Nuevos tags. |
| `problem-section.tsx` | **Nuevo** | 3 tarjetas de dolor con framework PAS. Headline + texto introductorio + cierre con pregunta retorica. |
| `solution-section.tsx` | **Nuevo** | 3 pilares de solucion (transcripcion, analisis, diagnostico). Imagen/mockup del dashboard. |
| `how-it-works-section.tsx` | **Nuevo** | 4 pasos del flujo de inteligencia organizacional. Layout tipo timeline vertical. Call-out box con costo. |
| `features-grid-section.tsx` | **Reescribir** | Feature principal full-width (OrgIntel) + grid 3x2 con features secundarios. Reemplaza el grid actual de 6 features contables. |
| `differentiators-section.tsx` | **Nuevo** | 4 diferenciadores con layout 2 columnas (texto + visual). |
| `pricing-section.tsx` | **Nuevo** | Tabla de costos transparente. CTA "Comenzar gratis". |
| `social-proof-section.tsx` | **Nuevo** | Quote del creador + metricas placeholder. Reemplaza la seccion "Developer" actual. |
| `cta-section.tsx` | **Nuevo** | CTA final con gradiente. Headline + copy + boton + sub-texto. |
| `marketing-footer.tsx` | **Refactorizar** | Actualizar columnas para reflejar nuevos modulos. Simplificar. |

### F.2 Componentes a eliminar

| Componente | Razon |
|-----------|-------|
| `hero-typewriter.tsx` | Reemplazar por headline estatico. El typewriter es elegante pero no comunica el nuevo posicionamiento. |
| `hero-chat.tsx` | Reemplazar por mockup del flujo de inteligencia organizacional. El chat contable ya no es el hero feature. |
| `hero-cta.tsx` | Integrar directamente en el nuevo `hero-section.tsx`. |
| `roadmap-section.tsx` | Eliminar. El roadmap genera mas incertidumbre que confianza. Cuando haya features nuevos, se comunican como features activos. |
| `opensource-section.tsx` | Eliminar como seccion independiente. El modelo de costos se integra en `pricing-section.tsx`. La mencion a open source puede ir en el footer o como tag. |
| `developer-section.tsx` | Reemplazar por `social-proof-section.tsx` mas compacta. La bio del creador queda como quote + link, no como CV completo. |

### F.3 Archivos de metadata a actualizar

| Archivo | Cambio |
|---------|--------|
| `apps/web/app/(marketing)/layout.tsx` | Actualizar title, description, keywords, openGraph, twitter. Agregar schema markup JSON-LD. |
| `apps/web/app/(marketing)/page.tsx` | Actualizar imports para nuevos componentes. Nuevo orden de secciones. |
| `apps/web/app/layout.tsx` | Actualizar description general. |

### F.4 Assets necesarios

| Asset | Descripcion |
|-------|------------|
| `og-image.png` | Imagen 1200x630 para Open Graph con dashboard + headline |
| Screenshots del dashboard | Capturas de: proyecto OrgIntel, Knowledge Graph, transcripcion, organigrama |
| Iconos de features | Iconos para cada feature del grid (pueden ser Lucide icons) |

### F.5 Orden de implementacion sugerido

1. **Fase 1 (prioridad critica):** Hero + Problema + Solucion + Como Funciona + CTA Final + Nav + Footer actualizados
2. **Fase 2 (prioridad alta):** Features Grid + Diferenciadores + Pricing
3. **Fase 3 (prioridad media):** Social Proof (cuando haya testimoniales) + Schema Markup + OG Image
4. **Fase 4 (optimizacion continua):** A/B testing de headlines, CTAs, layout

---

## Resumen Ejecutivo

El landing actual de Zeru comunica que es un software contable chileno con IA. Eso era correcto hace unos meses, pero hoy la plataforma tiene un diferenciador radicalmente mas poderoso: la capacidad de diagnosticar una organizacion completa a partir de entrevistas con IA, algo que ningun competidor directo ofrece.

**El cambio central es:**

| Antes | Despues |
|-------|---------|
| "Contabilidad automatizada con IA" | "Inteligencia organizacional: entiende tu empresa en dias, no en meses" |
| Hero: chat contable | Hero: flujo de entrevista a diagnostico |
| Features: 6 items contables | Features: OrgIntel destacado + 6 modulos |
| Audiencia: pyme que necesita contabilidad gratis | Audiencia: CEO que quiere diagnosticar + consultor que necesita herramienta |
| Sin pricing | Pricing transparente ($0.65/entrevista) |
| Sin social proof | Quote + metricas + testimoniales (futuro) |
| Roadmap + Open Source + Bio del creador | Problema + Solucion + Como funciona + Diferenciadores |

**La propuesta completa mantiene** el diseno visual dark (bg `#0a0a0a`, color teal, tipografia Bricolage Grotesque) pero reescribe completamente la narrativa, el copywriting, la estructura de secciones y la jerarquia SEO para posicionar a Zeru como la plataforma de inteligencia organizacional con IA mas accesible y poderosa del mercado hispanohablante.
