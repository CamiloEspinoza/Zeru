# Landing Page Review - Zeru

**Fecha:** 2026-03-30
**Revisor:** Analisis profesional de landing SaaS
**Archivos revisados:** 15/15

---

## 1. Resumen ejecutivo

La landing de Zeru tiene un copywriting solido y una propuesta de valor clara (inteligencia organizacional con IA a partir de entrevistas), pero sufre de un problema critico de longitud y redundancia: **la misma informacion se repite en 4-5 secciones diferentes**, lo que diluye el impacto y agota al visitante antes de llegar al CTA final. La pagina actual tiene 12 secciones de contenido -- un landing SaaS efectivo no deberia pasar de 7-8. Las secciones "Upcoming Features", "Roadmap" y "Developer" compiten entre si por atencion y alejan al visitante del objetivo de conversion. El flujo narrativo Problema > Solucion > Como funciona es bueno, pero se rompe despues de Pricing con contenido que es mas "roadmap publico" que "argumento de venta".

---

## 2. Mapa de la pagina actual

| # | Seccion | Que dice |
|---|---------|----------|
| 1 | **Hero** | "Entiende tu empresa en dias, no en meses". Badge IA, subtitulo sobre entrevistas + transcripcion + diagnostico. CTA "Diagnostica tu empresa gratis". Social proof: $0.65/entrevista, 5 analisis GPT-5.4, Knowledge Graph. |
| 2 | **Problema** | Los diagnosticos tradicionales son caros, lentos y subjetivos. 3 cards: costo/tiempo, conocimiento en cabezas, organigramas vs realidad. Pregunta cierre: "Y si pudieras...?" |
| 3 | **Solucion** | Zeru convierte entrevistas en inteligencia organizacional. 3 pilares: Transcripcion Deepgram, 5 pasadas GPT-5.4, Knowledge Graph + diagnostico. |
| 4 | **Como funciona** | 4 pasos: Entrevista > Sube audio > IA extrae > Diagnostico. Callout de costo $0.65. |
| 5 | **Features** | Modulo principal (Inteligencia Organizacional) + 6 features secundarios: Personas, Asistente IA, Contabilidad, Marketing LinkedIn, Multi-empresa, Skills. |
| 6 | **Diferenciadores** | 4 puntos: conversaciones vs formularios, audio a plan en minutos, Knowledge Graph, $0.65 vs $5000. Comparacion visual Sin Zeru / Con Zeru. |
| 7 | **Pricing** | Tabla de costos: plataforma gratis, $0.65/entrevista, chat variable, S3 propio. CTA "Comenzar gratis". |
| 8 | **Upcoming Features** | 14 features futuros con sistema de votacion (localStorage). Formulario de sugerencias. |
| 9 | **Developer** | Bio de Camilo Espinoza: foto, trayectoria, cita, timeline (Citolab, Frest, Ulern). 4 cards de proyectos. |
| 10 | **Roadmap** | 12 items organizados en 3 columnas: Proximas semanas, Proximo mes, Planificado. |
| 11 | **CTA Final** | "Tu empresa tiene las respuestas. Zeru las encuentra." CTA "Diagnostica tu empresa gratis". |
| 12 | **Footer** | Logo, descripcion, columnas Producto/Recursos/Acceso, tech stack. |

---

## 3. Problemas encontrados

### L-001 | ALTO | Upcoming Features + Roadmap
**Descripcion:** Las secciones "Upcoming Features" (seccion 8) y "Roadmap" (seccion 10) muestran **exactamente la misma informacion** con distinta presentacion visual. Ambas listan los mismos features futuros: Gestion RRHH, Gestion Documental, Reportes/BI, Integraciones, API Publica, Inventario, DTE, Conciliacion bancaria, Ordenes de compra, CRM, Venta online, Control de gestion. La unica diferencia es que Upcoming tiene votacion y Roadmap tiene columnas por timeline.

**Solucion:** Fusionar en una sola seccion. Mantener el formato de Upcoming Features (con votacion, que es interactivo y genera engagement) y agregar una etiqueta de timeline a cada card (ej: "Proximas semanas", "Proximo mes"). Eliminar Roadmap como seccion independiente.

---

### L-002 | ALTO | Longitud excesiva de la pagina
**Descripcion:** 12 secciones de contenido es demasiado. Despues de Pricing (seccion 7), el visitante ya tomo su decision o se fue. Las secciones 8, 9 y 10 son contenido de "community building" que no contribuyen a conversion y alargan la pagina ~40% innecesariamente. Un CEO chileno que esta evaluando herramientas no va a scrollear hasta la seccion 11 para encontrar el CTA final.

**Solucion:** Reducir a 8 secciones maximas antes del CTA. Mover Developer a una pagina separada `/about`. Fusionar Upcoming + Roadmap en una sola seccion compacta. El orden ideal: Hero > Problema > Solucion > Como funciona > Features > Pricing > CTA > Footer.

---

### L-003 | ALTO | Solucion y Diferenciadores son redundantes
**Descripcion:** La seccion "Solucion" (seccion 3) y "Diferenciadores" (seccion 6) dicen lo mismo con diferentes palabras:
- Solucion dice: "Transcripcion con IA" / Diferenciadores dice: "Diagnostico desde conversaciones"
- Solucion dice: "5 pasadas de analisis con GPT-5.4" / Diferenciadores dice: "De audio a plan de mejoras en minutos"
- Solucion dice: "Knowledge Graph y diagnostico automatico" / Diferenciadores dice: "Knowledge Graph que conecta toda tu organizacion"
- El precio $0.65 se menciona en ambas

El visitante siente que relee la misma informacion.

**Solucion:** Fusionar. Mantener la seccion Solucion con los 3 pilares y agregarle el visual Before/After de Diferenciadores (que es lo unico valioso y diferente de esa seccion). Eliminar Diferenciadores como seccion separada.

---

### L-004 | ALTO | El precio $0.65 se repite 5 veces
**Descripcion:** El dato "$0.65 USD por entrevista" aparece en:
1. Hero - social proof tag
2. How It Works - callout box
3. Diferenciadores - titulo del 4to diferenciador + lista "Con Zeru"
4. Pricing - tabla de precios

La repeticion excesiva convierte un dato impactante en ruido. En la 4ta vez que el visitante lo lee, ya perdio su efecto.

**Solucion:** Mantener en 2 lugares maximo: Hero (como gancho inicial) y Pricing (como confirmacion). Eliminar de How It Works y Diferenciadores.

---

### L-005 | MEDIO | Knowledge Graph mencionado 6+ veces sin explicar que es
**Descripcion:** "Knowledge Graph" se menciona en: Hero, Solucion, How It Works (paso 4), Features (modulo principal), Diferenciadores (punto 3), y la comparacion Con Zeru. Pero nunca se explica de forma simple que es un Knowledge Graph para alguien que no es tecnico. Un gerente general chileno no sabe que es un "grafo de conocimiento con busqueda semantica".

**Solucion:** Explicar en la seccion Solucion con lenguaje simple (ej: "Un mapa visual que conecta toda la informacion de tu empresa: personas, areas, problemas y dependencias") y luego referenciarlo brevemente en las demas sin repetir la explicacion completa.

---

### L-006 | MEDIO | Seccion Developer interrumpe el flujo de conversion
**Descripcion:** La seccion "Sobre el creador" (seccion 9) esta entre Upcoming Features y Roadmap. Es contenido de branding personal, no argumento de venta. Incluye bio completa, timeline de carrera, cita motivacional, y 4 cards de proyectos (Frest, Ulern, Ucap, Zeru). Un visitante nuevo no necesita saber el historial de empleos del founder para decidir si prueba la herramienta. Ademas, links a Frest/Ulern/Ucap pueden generar fuga de trafico.

**Solucion:** Reducir a un componente minimo de social proof dentro del CTA o footer: foto + nombre + una linea ("10+ anos construyendo software para empresas en Chile") + link a LinkedIn. Mover el contenido completo a `/about`.

---

### L-007 | MEDIO | Mega menu tiene links a paginas que probablemente no existen
**Descripcion:** El mega menu de "Producto" tiene 10 links a paginas `/features/*`:
- `/features/inteligencia-organizacional`
- `/features/personas-organigrama`
- `/features/asistente-ia`
- `/features/contabilidad`
- `/features/marketing`
- `/features/gestion-rrhh`
- `/features/gestion-documental`
- `/features/integraciones`
- `/features/reportes-bi`
- `/features/api-publica`

Si estas paginas no existen, el visitante recibe un 404 al hacer click, lo cual destruye credibilidad inmediatamente.

**Solucion:** Verificar que cada pagina existe. Si no, usar anchor links a secciones de la landing (ej: `/#que-hace`) o deshabilitar los links de features "Proximamente".

---

### L-008 | MEDIO | Tildes faltantes en multiples secciones
**Descripcion:** Hay texto con tildes faltantes de forma inconsistente:
- Nav: "Iniciar sesion" (falta: sesion -> sesion) -- en realidad falta "Iniciar **sesion**" -> "Iniciar **sesion**" -- la tilde ya falta en "sesion"
- Nav "Proximamente" sin tilde -> "Proximamente" -> deberia ser "Proximamente"
- Roadmap: "Proximas semanas", "Proximo mes" sin tildes
- Roadmap: "Gestion de RRHH", "Gestion Documental", "desempeno", "aprobacion", "electronica" sin tildes
- Roadmap: "Ordenes de compra", "Conciliacion bancaria", "Documentos electronicos" sin tildes
- Roadmap: "Zeru esta creciendo rapido" sin tildes
- Roadmap: "Roadmap publico" sin tilde
- Nav upcomingItems: "Gestion de RRHH", "Gestion Documental", "aprobacion", "electronica", "Publica" sin tildes

Esto afecta la percepcion profesional del producto.

**Solucion:** Hacer un barrido completo de tildes en todos los archivos. Las cadenas en el nav, roadmap y upcoming tienen caracteres ASCII planos donde deberian tener caracteres acentuados.

---

### L-009 | MEDIO | Votacion de features usa solo localStorage
**Descripcion:** El sistema de votacion de Upcoming Features guarda votos en `localStorage`. Esto significa que: (a) los votos se pierden al cambiar de navegador/dispositivo, (b) cada persona solo ve sus propios votos, no los de la comunidad, (c) los datos no llegan al equipo de producto. El formulario de sugerencias intenta hacer POST a `/api/public/feature-requests` con fallback a localStorage.

**Solucion:** Si la votacion es un feature real, debe persistir en backend. Si es decorativo, eliminar el badge de conteo de votos porque es enganoso (muestra "1" cuando solo el usuario actual voto). Como minimo, enviar los votos al mismo endpoint del backend.

---

### L-010 | MEDIO | Hero mockup es estatico y generico
**Descripcion:** El lado derecho del hero muestra un mockup de dashboard construido con divs y colores. Es un placeholder que no transmite la calidad real del producto. Los nodos del Knowledge Graph son circulos con texto estilo "CEO", "CTO", "Ops" que no se ven como un producto real. Un competidor con un screenshot real del producto se vera mas creible.

**Solucion:** Reemplazar con un screenshot real del dashboard de Zeru (captura del Knowledge Graph real, o de la vista de entrevistas procesadas). Si el producto no esta suficientemente pulido visualmente, usar un video corto (15-30s) o GIF animado del flujo de subir entrevista > ver resultados.

---

### L-011 | BAJO | El nav solo tiene 2 items (Producto, Precios)
**Descripcion:** La navegacion desktop tiene solo "Producto" (mega menu) y "Precios". No hay link a "Como funciona" ni a "Roadmap" ni a seccion de creador. Esto es inusual para una landing con 12 secciones -- el visitante no tiene forma de saltar a secciones intermedias.

**Solucion:** Agregar al menos "Como funciona" como tercer link de nav (apuntando a `#como-funciona`). Si se mantiene el roadmap, agregar tambien "Roadmap".

---

### L-012 | BAJO | Features Section muestra Contabilidad y Marketing LinkedIn como features principales
**Descripcion:** La seccion Features lista 6 modulos "activos" incluyendo Contabilidad Chilena y Marketing LinkedIn. Para un visitante que llega buscando "inteligencia organizacional", ver contabilidad y marketing de LinkedIn en el mismo nivel genera confusion sobre que es realmente Zeru. Parece una herramienta que intenta hacer todo sin ser excelente en nada.

**Solucion:** Dividir el mensaje. El hero y las primeras 4 secciones deben focalizarse 100% en inteligencia organizacional. Los features adicionales (contabilidad, LinkedIn, etc.) deberian presentarse como "tambien incluye" o "Plataforma integral" en un bloque separado y visualmente secundario, no al mismo nivel que el feature principal.

---

### L-013 | BAJO | Seccion "Como funciona" usa id="como-funciona" pero Hero linkea a "#como-funciona"
**Descripcion:** El anchor link del Hero apunta a `#como-funciona` y la seccion HowItWorks tiene `id="como-funciona"`. Esto funciona correctamente. Sin embargo, la seccion Features tiene `id="que-hace"` y la seccion Pricing tiene `id="pricing"`. El mega menu no usa ningun anchor link (todos apuntan a `/features/*`). El nav link "Precios" apunta a `/#pricing` que es correcto.

**Solucion:** No es un bug, pero el mega menu deberia tener fallbacks a anchors si las paginas de features no existen.

---

### L-014 | BAJO | Footer seccion "Recursos" tiene solo 2 items
**Descripcion:** La columna "Recursos" del footer tiene solo "Documentacion" (apunta a `/documents`) y "GitHub". Esto se ve vacio y poco profesional comparado con footers de SaaS maduros.

**Solucion:** Agregar items como: Blog (si existe), Changelog, API Docs, Guia de inicio rapido. Si no existen, es mejor eliminar la columna y redistribuir.

---

### L-015 | BAJO | Heading hierarchy - posible H2 excesivo en Developer
**Descripcion:** La seccion Developer tiene un `h2` ("Software construido por alguien que vivio el problema") que compite en jerarquia visual con los h2 de secciones core. Esto puede confundir a crawlers sobre la importancia relativa del contenido.

**Solucion:** Si se mantiene la seccion, reducir a `h3`. Mejor aun: mover a `/about`.

---

### L-016 | MEDIO | No hay ningun h1 visible en la pagina que no sea el Hero
**Descripcion:** Solo hay un `h1` (en el Hero: "Entiende tu empresa en dias, no en meses"). Esto es correcto para SEO -- un solo h1 por pagina. Todos los demas headings son h2 o h3. La jerarquia esta bien implementada.

**Solucion:** Ninguna -- esto esta correcto. Mantener.

---

### L-017 | MEDIO | Metadata SEO menciona "GPT-5.4" pero no es un keyword de busqueda
**Descripcion:** El nombre de modelo "GPT-5.4" aparece en la descripcion meta y multiples secciones. Sin embargo, los modelos de IA cambian rapido. Si OpenAI lanza GPT-6 la proxima semana, todo el landing se ve desactualizado.

**Solucion:** En la metadata SEO y los headers principales, usar lenguaje generico ("IA de ultima generacion", "modelos de lenguaje avanzados"). Reservar los nombres especificos (GPT-5.4, Deepgram Nova-3) para secciones tecnicas como "Como funciona" donde agregan credibilidad.

---

### L-018 | BAJO | Espaciados consistentes pero seccion Developer rompe el patron
**Descripcion:** Todas las secciones usan `py-28 px-6` excepto:
- El divider de Developer usa un `w-px h-24 bg-gradient-to-b` (vertical) en vez del `h-px w-[60%] bg-gradient-to-r` (horizontal) que usan todas las demas secciones.

Esto crea una ruptura visual sutil.

**Solucion:** Usar el mismo patron de divider horizontal para mantener consistencia.

---

### L-019 | MEDIO | CTA text inconsistente
**Descripcion:** Los CTAs primarios varian entre:
- Hero: "Diagnostica tu empresa gratis"
- Pricing: "Comenzar gratis -- sin tarjeta de credito"
- CTA Final: "Diagnostica tu empresa gratis"
- Nav: "Comenzar gratis"

No es un problema grave pero la inconsistencia puede crear microfriction cognitiva.

**Solucion:** Estandarizar en un CTA primario consistente. Recomendacion: **"Diagnostica tu empresa gratis"** en todos los botones principales (es mas especifico y orientado a resultado). "Comenzar gratis" es generico y no dice que va a pasar al hacer click.

---

### L-020 | BAJO | Footer usa `<a>` mezclado con `<Link>` de Next.js
**Descripcion:** El footer mezcla `<a>` tags nativos para links internos (columna Producto) con `<Link>` de Next.js para otros links internos (columna Acceso). Esto no causa bugs visibles pero es inconsistente: los `<a>` tags causan full page reload en lugar de client-side navigation.

**Solucion:** Usar `<Link>` de Next.js para todas las rutas internas y `<a>` solo para links externos.

---

## 4. Informacion duplicada

| Contenido | Hero | Problema | Solucion | Como funciona | Features | Diferenciadores | Pricing | CTA | Mantener en |
|-----------|------|----------|----------|---------------|----------|-----------------|---------|-----|-------------|
| Precio ~$0.65/entrevista | X | | | X | | X (x2) | X | | Hero + Pricing |
| Knowledge Graph | X | | X | X | X | X | | | Solucion + Features |
| Transcripcion automatica | | | X | X | X | | | | Como funciona |
| 5 pasadas de analisis GPT | X | | X | X | | | | | Como funciona |
| Diagnostico automatico | X | | X | X | X | X | | X | Hero + Como funciona |
| Cuellos de botella / SPOFs | X | X | X | | X | | | X | Problema + Solucion |
| Plan de mejoras priorizado (RICE) | | | | X | X | X | | | Como funciona + Features |
| Comparacion consultor $5000+ | | X | X | | | X | | | Problema + Diferenciadores |
| Diagramas AS-IS | | | X | X | X | | | | Como funciona |
| Features futuros (RRHH, DTE, etc.) | | | | | | | | | Upcoming (unica vez) |
| Lista de features futuros | | | | | | | | | **Duplicada en: Nav mega menu, Upcoming Features, Roadmap** |

**Hallazgo critico:** La lista de features futuros aparece en **3 lugares distintos**: el mega menu del nav (columna "Proximamente"), la seccion Upcoming Features, y la seccion Roadmap. Son los mismos items con las mismas descripciones.

---

## 5. Navegacion -- analisis

### Mega menu vs contenido de la pagina

El mega menu de "Producto" tiene dos columnas:
- **Plataforma** (5 items): Links a `/features/*` para features activos
- **Proximamente** (5 items): Links a `/features/*` para features futuros

**Problemas:**
1. Las paginas `/features/*` probablemente no existen. Si es asi, son 10 links rotos en el elemento mas visible de la pagina.
2. La columna "Proximamente" del mega menu lista 5 features, pero la seccion Upcoming Features lista 14 features. Hay inconsistencia en cuales se muestran.
3. No hay link en el mega menu que apunte a una seccion de la landing (todo es `/features/*`). Si un visitante quiere ver "Inteligencia Organizacional" sin ir a otra pagina, no puede.

### Anchor links
- `/#pricing` (nav "Precios") -> apunta a `id="pricing"` -> **FUNCIONA**
- `#como-funciona` (hero CTA secundario) -> apunta a `id="como-funciona"` -> **FUNCIONA**
- `#que-hace` (features section id) -> **no hay link que apunte aqui**
- `#roadmap` (roadmap section id) -> **no hay link que apunte aqui**
- `#creador` (developer section id) -> **no hay link que apunte aqui**
- `#roadmap-features` (upcoming section id) -> **no hay link que apunte aqui**

### Links faltantes
- No hay link de nav a "Como funciona" (la seccion tiene id pero nadie apunta a ella excepto el hero)
- No hay link a "#roadmap" ni "#roadmap-features" desde el nav

### Links sobrantes
- Los 10 links del mega menu a `/features/*` son probablemente links muertos
- El footer columna "Producto" replica los mismos 5 links a `/features/*`

---

## 6. Orden de secciones recomendado

### Orden actual (12 secciones):
Hero > Problema > Solucion > Como funciona > Features > Diferenciadores > Pricing > Upcoming > Developer > Roadmap > CTA > Footer

### Orden recomendado (8 secciones):

| # | Seccion | Justificacion |
|---|---------|---------------|
| 1 | **Hero** | Mantener. Primera impresion, propuesta de valor clara. |
| 2 | **Problema** | Mantener. Crea urgencia emocional. |
| 3 | **Solucion + Diferenciadores (fusionados)** | Pilares de solucion + visual Before/After. Elimina redundancia. |
| 4 | **Como funciona** | Mantener. 4 pasos simples es efectivo. Sacar el callout de precio. |
| 5 | **Features** | Mantener. Modulo principal + features secundarios. |
| 6 | **Pricing** | Mantener. El visitante ya sabe que hace, ahora necesita saber cuanto cuesta. |
| 7 | **Upcoming Features (con timeline tags)** | Fusionar con Roadmap. Una sola seccion compacta con votacion + tags de timeline. Limitar a 8 items max (no 14). |
| 8 | **CTA Final** | Mantener. Cierre de venta con mini social proof del creador (1 linea). |
| -- | **Footer** | Mantener. Limpiar links rotos. |

**Eliminados:**
- **Diferenciadores** -> fusionado con Solucion
- **Developer** -> mover a `/about` o reducir a 1 linea en el CTA
- **Roadmap** -> fusionado con Upcoming Features

---

## 7. Secciones a eliminar o fusionar

| Accion | Seccion | Detalle |
|--------|---------|---------|
| **FUSIONAR** | Solucion + Diferenciadores | Mantener los 3 pilares de Solucion. Agregar el visual Before/After de Diferenciadores como componente visual dentro de Solucion. Eliminar los 4 diferenciadores textuales (son redundantes). |
| **FUSIONAR** | Upcoming Features + Roadmap | Mantener la grilla de Upcoming con votacion. Agregar badge de status ("Proximas semanas", "Proximo mes", "Planificado") a cada card. Eliminar seccion Roadmap completa. Reducir de 14 a 8-10 items max. |
| **ELIMINAR** | Developer (como seccion full) | Mover contenido completo a `/about`. En el landing, reducir a un mini bloque de 2 lineas dentro del CTA o footer: foto + nombre + credencial + link. |
| **RECORTAR** | Upcoming Features | Reducir de 14 items a 8 max. Nadie lee 14 cards de features que no existen aun. Los ultimos (Atencion al Cliente, Marketing Outbound) son tan lejanos que no agregan valor al pitch. |

---

## 8. Quick fixes (10 cambios mas rapidos con mayor impacto)

### QF-1 | Corregir todas las tildes faltantes
**Archivos:** `marketing-nav.tsx`, `roadmap-section.tsx`, `upcoming-features-section.tsx`
**Impacto:** Profesionalismo inmediato. Un producto que escribe "Gestion" sin tilde no inspira confianza.
**Esfuerzo:** 15 minutos.

### QF-2 | Eliminar seccion Roadmap completa
**Archivo:** `page.tsx` -- remover `<RoadmapSection />`
**Impacto:** Elimina redundancia mas obvia de toda la pagina. La informacion ya esta en Upcoming Features.
**Esfuerzo:** 1 minuto (borrar 1 linea + archivo).

### QF-3 | Estandarizar CTA a "Diagnostica tu empresa gratis"
**Archivos:** `marketing-nav.tsx`, `pricing-section.tsx`
**Impacto:** Consistencia de mensaje. "Comenzar gratis" es generico; "Diagnostica tu empresa gratis" es especifico y orientado a resultado.
**Esfuerzo:** 5 minutos.

### QF-4 | Agregar "Como funciona" al nav
**Archivo:** `marketing-nav.tsx`
**Impacto:** Permite al visitante saltar a la seccion mas importante despues del hero sin tener que scrollear.
**Esfuerzo:** 5 minutos.

### QF-5 | Sacar el callout de $0.65 de "Como funciona"
**Archivo:** `how-it-works-section.tsx` -- eliminar el div `.rounded-2xl.border-teal-500/20` al final.
**Impacto:** Reduce repeticion del precio. El dato ya esta en Hero y Pricing.
**Esfuerzo:** 2 minutos.

### QF-6 | Cambiar links del mega menu a anchors (si /features/* no existen)
**Archivo:** `marketing-nav.tsx`
**Impacto:** Evitar 404s en el elemento mas visible de la pagina. Critico para credibilidad.
**Esfuerzo:** 10 minutos.

### QF-7 | Reducir Upcoming Features de 14 a 8 items
**Archivo:** `upcoming-features-section.tsx`
**Impacto:** Menos es mas. 14 cards en un grid de 4 columnas es abrumador. Mantener los 8 mas relevantes para el mercado objetivo (RRHH, Documental, Reportes, Integraciones, API, Inventario, DTE, Conciliacion).
**Esfuerzo:** 10 minutos.

### QF-8 | Mover Developer a /about y reducir a mini-bloque
**Archivo:** `page.tsx` -- remover `<DeveloperSection />`. Agregar 2 lineas de social proof al CTA.
**Impacto:** La pagina pierde ~25% de largo sin perder informacion critica para conversion.
**Esfuerzo:** 30 minutos.

### QF-9 | Usar Link de Next.js en footer para rutas internas
**Archivo:** `marketing-footer.tsx`
**Impacto:** Client-side navigation correcta, mejor UX, mejor performance.
**Esfuerzo:** 10 minutos.

### QF-10 | Eliminar nombres de modelo especificos de metadata SEO
**Archivo:** `layout.tsx`
**Impacto:** Evita que la metadata quede desactualizada cuando cambien los modelos. Los usuarios no buscan "GPT-5.4" en Google cuando buscan diagnostico organizacional.
**Esfuerzo:** 5 minutos.

---

## Nota final

La base del landing es solida. El copywriting del Hero, Problema y Como funciona es genuinamente bueno -- se nota que alguien que vivio el problema escribio los textos. El problema principal no es de calidad sino de **edicion**: hay demasiado contenido bueno compitiendo por atencion. La regla de oro de landings SaaS es "si puedes cortarlo sin perder informacion, cortalo". Aplicando las fusiones y eliminaciones propuestas, la pagina pasaria de ~12 scrolls a ~7, y la tasa de llegada al CTA final deberia mejorar significativamente.
