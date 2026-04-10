# Zeru Landing — Mega Menu, Feature Pages y Arquitectura de Navegacion

**Fecha:** 2026-03-30
**Autor:** Camilo Espinoza + Claude
**Estado:** Propuesta de diseno

---

## Tabla de contenidos

1. [A. Mega Menu del Header](#a-mega-menu-del-header)
2. [B. Estructura de Feature Pages](#b-estructura-de-feature-pages)
3. [C. Seccion de Roadmap en el Landing Principal](#c-seccion-de-roadmap-en-el-landing-principal)
4. [D. Copywriting para el Mega Menu](#d-copywriting-para-el-mega-menu)
5. [E. Mobile Navigation](#e-mobile-navigation)

---

## A. Mega Menu del Header

### Investigacion de referencia

Se estudiaron los patrones de mega menu de las siguientes plataformas SaaS:

| Plataforma | Patron clave | Lo que funciona |
|---|---|---|
| **Notion** | Menu desplegable simple con iconos monocromos + descripcion de una linea. Sin columnas complejas. | Limpieza visual, jerarquia clara sin ruido. |
| **Linear** | Sin mega menu. Un solo dropdown "Product" con lista vertical de features. | Minimalismo extremo. Cada item es clicable y lleva a su pagina. |
| **Vercel** | Mega menu de 2-3 columnas. Columna izquierda con features principales, columna derecha con recursos/docs. Footer del menu con CTA. | Agrupacion inteligente: "Products" vs "Resources". Hover con preview. |
| **Stripe** | Mega menu de 3 columnas completas: Products, Solutions, Developers. Cada item con icono + titulo + descripcion. | El estandar de referencia en mega menus SaaS. Categorias claras, iconografia consistente. |
| **HubSpot** | Mega menu complejo con tabs laterales (Marketing, Sales, Service, etc). Al hacer hover en la categoria, cambia el contenido del panel derecho. | Bueno para productos con muchos modulos. Demasiado pesado para el tamano actual de Zeru. |
| **Monday.com** | Mega menu con grid de productos agrupados por categoria. Badge "New" para features recientes. | Badges de estado y agrupacion por caso de uso. |

### Decision de diseno

Para Zeru, la mejor referencia es un hibrido entre **Stripe** (estructura de columnas con iconos) y **Linear** (minimalismo, sin sobrecargar). Razon: Zeru tiene 5 features activas y 5 en roadmap — suficientes para justificar un mega menu, pero no tantas como para necesitar tabs.

### Estructura del header

```
Logo | Producto ▾ | Precios | Roadmap | Blog | [Iniciar sesion] [CTA primario]
```

**Justificacion de cada item:**

- **Producto ▾** — Abre el mega menu con todas las features (activas y proximas).
- **Precios** — Link directo a `/pricing` (pagina completa, no solo anchor).
- **Roadmap** — Link directo a `/roadmap` (pagina publica con mas detalle que la seccion del landing).
- **Blog** — Futuro, pero reservar el espacio ahora. Linkearia a `/blog`.
- **Iniciar sesion** — Link secundario (texto).
- **CTA primario** — "Comenzar gratis" (boton teal).

### Mega menu: diseno visual

El mega menu se activa con **hover en desktop** (con un delay de 150ms para evitar aperturas accidentales) y **tap en mobile**. Se cierra al mover el mouse fuera del area del menu o al hacer clic en cualquier item.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  PLATAFORMA                              PROXIMAMENTE                   │
│  Disponible hoy                          En el roadmap                  │
│                                                                         │
│  ┌─────────────────────────────────┐     ┌────────────────────────────┐ │
│  │  [icono] Inteligencia           │     │  [icono] Gestion de RRHH   │ │
│  │          Organizacional         │     │  Contratos, vacaciones     │ │
│  │  Diagnostica tu empresa con IA  │     │  y evaluaciones            │ │
│  └─────────────────────────────────┘     └────────────────────────────┘ │
│                                                                         │
│  ┌─────────────────────────────────┐     ┌────────────────────────────┐ │
│  │  [icono] Personas y             │     │  [icono] Gestion           │ │
│  │          Organigrama            │     │          Documental        │ │
│  │  Directorio y estructura        │     │  Flujos de aprobacion      │ │
│  │  organizacional                 │     │  y firma electronica       │ │
│  └─────────────────────────────────┘     └────────────────────────────┘ │
│                                                                         │
│  ┌─────────────────────────────────┐     ┌────────────────────────────┐ │
│  │  [icono] Asistente IA           │     │  [icono] Integraciones     │ │
│  │  Chat inteligente con memoria   │     │  SAP, Google Workspace,    │ │
│  │  y skills extensibles           │     │  Microsoft 365             │ │
│  └─────────────────────────────────┘     └────────────────────────────┘ │
│                                                                         │
│  ┌─────────────────────────────────┐     ┌────────────────────────────┐ │
│  │  [icono] Contabilidad           │     │  [icono] Reportes y BI     │ │
│  │  Plan de cuentas, balance y     │     │  Dashboards customizables  │ │
│  │  libro diario — normativa SII   │     │  y KPIs en tiempo real     │ │
│  └─────────────────────────────────┘     └────────────────────────────┘ │
│                                                                         │
│  ┌─────────────────────────────────┐     ┌────────────────────────────┐ │
│  │  [icono] Marketing              │     │  [icono] API Publica       │ │
│  │  Genera y publica posts en      │     │  Webhooks, SDK y           │ │
│  │  LinkedIn con IA                │     │  documentacion para devs   │ │
│  └─────────────────────────────────┘     └────────────────────────────┘ │
│                                                                         │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
│  [icono] Ver todas las funcionalidades →                                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Especificaciones tecnicas del mega menu

- **Ancho:** max-w-4xl (896px), centrado respecto al item "Producto" del nav.
- **Layout:** CSS Grid de 2 columnas. Columna izquierda (PLATAFORMA) ocupa ~58%, columna derecha (PROXIMAMENTE) ~42%.
- **Fondo:** `bg-[#0f0f0f]/98 backdrop-blur-xl`, con borde `border border-white/8` y `rounded-2xl`.
- **Sombra:** `shadow-2xl shadow-black/40` para dar profundidad.
- **Animacion de entrada:** `opacity-0 → opacity-100` + `translateY(-8px) → translateY(0)` en 200ms con `ease-out`.
- **Cada item:** hover cambia fondo a `bg-white/5`, con transicion de 150ms.
- **Columna "Proximamente":** items con opacidad ligeramente reducida (`opacity-70`) y un badge discreto "Proximamente" en teal-500/50 al lado del titulo.
- **Footer del menu:** Linea separadora sutil + link "Ver todas las funcionalidades" que lleva a `/features`.
- **Iconografia:** Usar Lucide icons (ya usadas en el proyecto) en tamano 20x20px, color teal-400 para activas, white/40 para proximamente.

### Interaccion

- **Desktop:** Hover sobre "Producto" abre el menu con delay de 150ms. El menu permanece abierto mientras el cursor este dentro del area del trigger + menu (usar "safe triangle" pattern como en Amazon/Stripe para evitar cierres accidentales al mover el mouse en diagonal).
- **Escape:** Cierra el menu.
- **Click en item:** Navega a la feature page y cierra el menu.
- **Click fuera:** Cierra el menu.

---

## B. Estructura de Feature Pages

### URL mapping

| Feature | Slug | Estado | URL |
|---|---|---|---|
| Inteligencia Organizacional | `inteligencia-organizacional` | Activa | `/features/inteligencia-organizacional` |
| Personas y Organigrama | `personas-organigrama` | Activa | `/features/personas-organigrama` |
| Asistente IA | `asistente-ia` | Activa | `/features/asistente-ia` |
| Contabilidad | `contabilidad` | Activa | `/features/contabilidad` |
| Marketing LinkedIn | `marketing` | Activa | `/features/marketing` |
| Gestion de RRHH | `gestion-rrhh` | Proximamente | `/features/gestion-rrhh` |
| Gestion Documental | `gestion-documental` | Proximamente | `/features/gestion-documental` |
| Integraciones | `integraciones` | Proximamente | `/features/integraciones` |
| Reportes y BI | `reportes-bi` | Proximamente | `/features/reportes-bi` |
| API Publica | `api` | Proximamente | `/features/api` |

Adicionalmente se crea una pagina indice:
- `/features` — Grid con todas las features, las activas con CTA y las proximas con formulario de interes.

### Estructura comun de cada feature page (activas)

Cada pagina de feature activa sigue esta estructura:

```
┌──────────────────────────────────────────────────────────┐
│  [Nav con mega menu]                                      │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  SECCION 1: HERO                                         │
│  ────────────────                                        │
│  Badge: "Plataforma" o nombre del modulo                 │
│  Headline: Frase principal de valor (H1)                 │
│  Descripcion: 2-3 lineas explicando que hace y para      │
│  quien (p)                                               │
│  CTA primario: "Comenzar gratis"                         │
│  CTA secundario: "Ver como funciona" (scroll a seccion 3)│
│                                                          │
│  [Screenshot / mockup interactivo del feature]           │
│  (placeholder hasta tener screenshots reales)            │
│                                                          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  SECCION 2: SUB-FEATURES                                 │
│  ────────────────────                                    │
│  Titulo: "Todo lo que incluye"                           │
│  Grid de 3 columnas (desktop) / 1 columna (mobile):     │
│                                                          │
│  [icono] Sub-feature 1        [icono] Sub-feature 2      │
│  Descripcion corta            Descripcion corta          │
│                                                          │
│  [icono] Sub-feature 3        [icono] Sub-feature 4      │
│  Descripcion corta            Descripcion corta          │
│                                                          │
│  [icono] Sub-feature 5        [icono] Sub-feature 6      │
│  Descripcion corta            Descripcion corta          │
│                                                          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  SECCION 3: COMO FUNCIONA                                │
│  ────────────────────                                    │
│  Titulo: "Como funciona"                                 │
│  Timeline vertical con 3-4 pasos:                        │
│                                                          │
│  01 → [titulo + descripcion + visual]                    │
│  02 → [titulo + descripcion + visual]                    │
│  03 → [titulo + descripcion + visual]                    │
│  (04 → opcional)                                         │
│                                                          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  SECCION 4: CTA FINAL                                    │
│  ──────────────                                          │
│  Headline: Frase de cierre orientada a accion            │
│  CTA: "Comenzar gratis — sin tarjeta de credito"         │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  [Footer]                                                 │
└──────────────────────────────────────────────────────────┘
```

### Estructura para feature pages de roadmap (proximamente)

Las paginas de features futuras tienen una estructura simplificada:

```
┌──────────────────────────────────────────────────────────┐
│  [Nav con mega menu]                                      │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  HERO (simplificado)                                     │
│  ──────────────────                                      │
│  Badge: "Proximamente" (amarillo/ambar)                  │
│  Headline: Nombre del feature                            │
│  Descripcion: Que va a hacer y por que importa           │
│  Fecha estimada: "Estimado Q2 2026" o similar            │
│                                                          │
│  CTA: "Notificarme cuando este listo"                    │
│  (Input email + boton de submit)                         │
│                                                          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  PREVIEW DE SUB-FEATURES                                 │
│  ─────────────────────                                   │
│  Titulo: "Lo que estamos construyendo"                   │
│  Grid con las sub-features planeadas                     │
│  (mismo formato que las activas pero con estilo muted)   │
│                                                          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  CTA FINAL                                               │
│  ─────────                                               │
│  "Mientras tanto, explora lo que ya puedes usar"         │
│  Grid compacto con links a features activas              │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  [Footer]                                                 │
└──────────────────────────────────────────────────────────┘
```

### Contenido detallado por feature page

---

#### 1. `/features/inteligencia-organizacional`

**Hero:**
- Headline: "Diagnostica tu empresa a partir de conversaciones reales"
- Descripcion: "Sube entrevistas con tu equipo y Zeru las transcribe, analiza y transforma en inteligencia organizacional. Detecta cuellos de botella, dependencias criticas y oportunidades de mejora en minutos, no en meses."
- Screenshot placeholder: Dashboard de inteligencia organizacional con Knowledge Graph.

**Sub-features (6):**
1. **Transcripcion automatica** — Deepgram Nova-3 transcribe audios de cualquier formato con identificacion de hablantes.
2. **5 analisis con GPT-5.4** — Hechos clave, problemas, dependencias, contradicciones y oportunidades de mejora.
3. **Knowledge Graph** — Grafo de conocimiento organizacional con busqueda semantica que se enriquece con cada entrevista.
4. **Diagnostico automatico** — Deteccion de cuellos de botella, SPOFs y procesos ineficientes.
5. **Diagramas AS-IS** — Generacion automatica de diagramas de procesos en formato Mermaid.
6. **Plan de mejoras RICE** — Plan priorizado por Reach, Impact, Confidence y Effort.

**Como funciona (4 pasos):**
1. Entrevista a alguien de tu equipo (30-60 min, cualquier formato).
2. Sube el audio a Zeru — se transcribe en menos de 3 minutos.
3. La IA ejecuta 5 analisis independientes sobre la transcripcion.
4. Recibe tu diagnostico con Knowledge Graph, diagramas y plan de mejoras.

**CTA final:** "Diagnostica tu empresa por ~$0.65 USD por entrevista"

---

#### 2. `/features/personas-organigrama`

**Hero:**
- Headline: "Tu equipo, visible y conectado"
- Descripcion: "Directorio de personas con perfiles completos, organigrama interactivo y jerarquia departamental. La IA sugiere optimizaciones en la estructura basandose en lo que revelan las entrevistas."
- Screenshot placeholder: Organigrama interactivo con React Flow.

**Sub-features (6):**
1. **Directorio de personas** — Perfiles con foto, cargo, departamento, datos de contacto y campos personalizables.
2. **Organigrama interactivo** — Visualizacion drag-and-drop con React Flow. Zoom, busqueda y filtros por departamento.
3. **Departamentos jerarquicos** — Estructura multinivel con herencia de permisos y roles.
4. **Perfiles enriquecidos con IA** — La IA extrae informacion relevante de las entrevistas y la vincula al perfil de cada persona.
5. **Busqueda de personas** — Encuentra a cualquier persona por nombre, cargo, departamento o habilidad.
6. **Exportacion** — Exporta el organigrama como imagen o PDF para presentaciones.

**Como funciona (3 pasos):**
1. Importa tu equipo manualmente o desde un archivo CSV.
2. Organiza departamentos y asigna las relaciones jerarquicas.
3. El organigrama se genera automaticamente y se enriquece con cada entrevista procesada.

**CTA final:** "Crea el organigrama de tu empresa en minutos"

---

#### 3. `/features/asistente-ia`

**Hero:**
- Headline: "Un asistente que entiende tu empresa"
- Descripcion: "Chat conversacional con GPT-5.4 que tiene contexto de tu organizacion. Sube documentos, haz preguntas complejas y automatiza tareas repetitivas con skills extensibles."
- Screenshot placeholder: Interfaz de chat con archivos adjuntos.

**Sub-features (6):**
1. **Chat con GPT-5.4** — Modelo de ultima generacion con ventana de contexto de 272K tokens.
2. **Memoria contextual** — El asistente recuerda conversaciones anteriores y las usa como contexto.
3. **Procesamiento de archivos** — Sube PDFs, imagenes, Excel o cualquier documento y la IA los procesa automaticamente.
4. **Skills extensibles** — Agrega nuevas capacidades al asistente instalando skills desde un marketplace o creando los tuyos.
5. **Compactacion automatica** — El contexto se comprime automaticamente al acercarse al limite para mantener costos controlados.
6. **Multi-conversacion** — Crea conversaciones separadas por tema, proyecto o equipo.

**Como funciona (3 pasos):**
1. Abre una nueva conversacion y escribe tu pregunta o sube un archivo.
2. La IA responde usando el contexto de tu empresa, entrevistas procesadas y documentos subidos.
3. Instala skills para automatizar tareas: generar reportes, analizar datos, redactar documentos.

**CTA final:** "Prueba el asistente IA — las primeras conversaciones son gratis"

---

#### 4. `/features/contabilidad`

**Hero:**
- Headline: "Contabilidad chilena lista para operar desde el dia uno"
- Descripcion: "Plan de cuentas SII, libro diario, balance general, libro mayor y periodos fiscales. Estructura contable completa con la normativa chilena ya configurada."
- Screenshot placeholder: Libro diario con asientos contables.

**Sub-features (6):**
1. **Plan de cuentas SII** — Estructura de cuentas preconfigurada siguiendo la normativa del Servicio de Impuestos Internos de Chile.
2. **Libro diario** — Registro de asientos contables con validacion de partida doble automatica.
3. **Balance general** — Estado de situacion financiera actualizado en tiempo real.
4. **Libro mayor** — Detalle de movimientos por cuenta con filtros por periodo y tipo.
5. **Periodos fiscales** — Gestion de apertura y cierre de periodos contables.
6. **Multi-empresa** — Cada organizacion tiene su propia contabilidad completamente aislada.

**Como funciona (3 pasos):**
1. Crea tu organizacion y el plan de cuentas SII se configura automaticamente.
2. Registra asientos contables en el libro diario — la partida doble se valida en tiempo real.
3. Consulta el balance, libro mayor y reportes fiscales cuando lo necesites.

**CTA final:** "Comienza a llevar tu contabilidad ahora — gratis"

---

#### 5. `/features/marketing`

**Hero:**
- Headline: "Tu presencia en LinkedIn, potenciada por IA"
- Descripcion: "Genera posts profesionales con inteligencia artificial, gestiona tu calendario de contenido y publica directamente en LinkedIn desde Zeru. Ahorra horas de redaccion manteniendo tu marca activa."
- Screenshot placeholder: Editor de post con preview de LinkedIn.

**Sub-features (6):**
1. **Generacion de posts con IA** — Describe el tema y la IA genera un post optimizado para LinkedIn con el tono que prefieras.
2. **Publicacion directa** — Publica en LinkedIn sin salir de Zeru. Conecta tu cuenta en un clic.
3. **Regeneracion inteligente** — No te convence el texto? Regenera con ajustes de tono, longitud o enfoque.
4. **Gestion de borradores** — Guarda, edita y organiza tus posts antes de publicar.
5. **Historial de publicaciones** — Revisa todo lo que has publicado con fecha y contenido.
6. **Calendario de contenido** — Planifica tus publicaciones con vista semanal o mensual (proximamente).

**Como funciona (3 pasos):**
1. Conecta tu cuenta de LinkedIn con un clic (OAuth).
2. Describe el tema del post y elige el tono — la IA genera el contenido.
3. Revisa, ajusta si quieres y publica directamente desde Zeru.

**CTA final:** "Empieza a publicar en LinkedIn con IA"

---

#### 6. `/features/gestion-rrhh` (Proximamente)

**Hero:**
- Badge: "Proximamente — Estimado Q3 2026"
- Headline: "Gestion de personas, de principio a fin"
- Descripcion: "Contratos, vacaciones, asistencia, evaluaciones de desempeno y onboarding. Todo integrado con la inteligencia organizacional de Zeru para que las decisiones de RRHH esten respaldadas por datos."

**Sub-features planeadas:**
1. Contratos laborales digitales
2. Gestion de vacaciones y permisos
3. Control de asistencia
4. Evaluaciones de desempeno
5. Onboarding automatizado
6. Reportes de RRHH

---

#### 7. `/features/gestion-documental` (Proximamente)

**Hero:**
- Badge: "Proximamente — Estimado Q3 2026"
- Headline: "Documentos con flujo, firma y control de versiones"
- Descripcion: "Flujos de aprobacion configurables, firma electronica integrada y versionado automatico. Cada documento tiene trazabilidad completa desde la creacion hasta la firma."

**Sub-features planeadas:**
1. Flujos de aprobacion multi-etapa
2. Firma electronica simple y avanzada
3. Versionado automatico con diff visual
4. Templates de documentos
5. Busqueda full-text en documentos
6. Integracion con contabilidad (facturas, contratos)

---

#### 8. `/features/integraciones` (Proximamente)

**Hero:**
- Badge: "Proximamente — Estimado Q4 2026"
- Headline: "Conecta Zeru con las herramientas que ya usas"
- Descripcion: "Integraciones bidireccionales con SAP, Odoo, Google Workspace y Microsoft 365. Sincroniza datos, automatiza procesos y centraliza la informacion en una sola plataforma."

**Sub-features planeadas:**
1. Google Workspace (Calendar, Drive, Gmail)
2. Microsoft 365 (Outlook, OneDrive, Teams)
3. SAP Business One
4. Odoo
5. Slack
6. Zapier / Make (integraciones low-code)

---

#### 9. `/features/reportes-bi` (Proximamente)

**Hero:**
- Badge: "Proximamente — Estimado Q4 2026"
- Headline: "Dashboards que se actualizan solos"
- Descripcion: "Crea dashboards personalizables con KPIs en tiempo real. Combina datos de contabilidad, RRHH, marketing y la inteligencia organizacional en una sola vista."

**Sub-features planeadas:**
1. Dashboards drag-and-drop
2. KPIs configurables por modulo
3. Alertas automaticas por umbral
4. Exportacion a PDF y Excel
5. Compartir dashboards por link
6. Datos en tiempo real sin recarga

---

#### 10. `/features/api` (Proximamente)

**Hero:**
- Badge: "Proximamente — Estimado 2027"
- Headline: "Construye sobre Zeru"
- Descripcion: "API REST documentada, webhooks en tiempo real y SDK para Node.js y Python. Integra los datos de Zeru en tus propios sistemas o construye aplicaciones personalizadas."

**Sub-features planeadas:**
1. API REST con documentacion OpenAPI
2. Webhooks configurables por evento
3. SDK para Node.js
4. SDK para Python
5. Rate limiting transparente
6. Sandbox para pruebas

---

## C. Seccion de Roadmap en el Landing Principal

### Diseno propuesto

Reemplazar la seccion de roadmap actual (que esta muy enfocada en contabilidad/ERP) por una seccion mas general que refleje el roadmap completo de la plataforma.

### Estructura visual

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  [Badge] Roadmap publico                                         │
│                                                                  │
│  Lo que viene                                                    │
│  Zeru esta creciendo rapido. Aqui puedes ver que estamos         │
│  construyendo y cuando estara listo.                             │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                                                             │ │
│  │  ● En desarrollo   ○ Q3 2026   ◇ Q4 2026   △ 2027         │ │
│  │                                                             │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  Grid 3 columnas:                                                │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐ │
│  │ ● EN DESARROLLO  │  │ ○ Q3 2026        │  │ ◇ Q4 2026+    │ │
│  │                  │  │                  │  │                │ │
│  │ Inventario       │  │ Gestion RRHH     │  │ Integraciones  │ │
│  │ Control de stock │  │ Contratos,       │  │ SAP, Google,   │ │
│  │ y movimientos    │  │ vacaciones y     │  │ Microsoft 365  │ │
│  │                  │  │ evaluaciones     │  │                │ │
│  │ Ordenes de       │  │                  │  │ Reportes y BI  │ │
│  │ compra           │  │ Gestion          │  │ Dashboards     │ │
│  │ Flujo completo   │  │ Documental       │  │ customizables  │ │
│  │ de compras       │  │ Flujos de        │  │ y KPIs         │ │
│  │                  │  │ aprobacion y     │  │                │ │
│  │ DTE              │  │ firma            │  │ API Publica    │ │
│  │ Facturas y       │  │ electronica      │  │ REST, webhooks │ │
│  │ boletas via SII  │  │                  │  │ y SDK          │ │
│  └──────────────────┘  └──────────────────┘  └────────────────┘ │
│                                                                  │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│                                                                  │
│  [Input: tu@email.com]  [Boton: Notificarme de novedades]        │
│                                                                  │
│  Al suscribirte recibes un email cuando lancemos nuevos          │
│  modulos. Sin spam. Puedes cancelar cuando quieras.              │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Especificaciones de diseno

**Grid de cards:**
- 3 columnas en desktop, 1 en mobile.
- Cada columna tiene un header con el estado y color correspondiente.
- Cards individuales dentro de cada columna con borde sutil, icono, titulo y descripcion de 1 linea.

**Colores por estado:**
- "En desarrollo" — teal-500 (dot animado con pulse).
- "Q3 2026" — blue-400.
- "Q4 2026+" — white/40 (muted).

**Email capture:**
- Input de email con placeholder "tu@email.com".
- Boton "Notificarme de novedades" en teal-500.
- Texto de confianza debajo: "Sin spam. Puedes cancelar cuando quieras."
- El email se guarda en una tabla simple de la base de datos (o se envia a un servicio como Resend/Mailchimp).

**Interaccion en las cards:**
- Hover: borde cambia a teal-500/20, fondo sutil teal.
- Click: navega a la feature page correspondiente (ej: `/features/gestion-rrhh`).

---

## D. Copywriting para el Mega Menu

### Columna: PLATAFORMA

Cada item tiene: **nombre** + **descripcion de una linea** (maximo 50 caracteres en la descripcion).

| # | Icono (Lucide) | Nombre | Descripcion |
|---|---|---|---|
| 1 | `Brain` | Inteligencia Organizacional | Diagnostica tu empresa con IA |
| 2 | `Users` | Personas y Organigrama | Directorio y estructura organizacional |
| 3 | `MessageSquare` | Asistente IA | Chat inteligente con memoria y skills |
| 4 | `Calculator` | Contabilidad | Plan de cuentas, balance — normativa SII |
| 5 | `Megaphone` | Marketing | Posts en LinkedIn generados con IA |

### Columna: PROXIMAMENTE

| # | Icono (Lucide) | Nombre | Descripcion |
|---|---|---|---|
| 6 | `ClipboardList` | Gestion de RRHH | Contratos, vacaciones y evaluaciones |
| 7 | `FileCheck` | Gestion Documental | Flujos de aprobacion y firma electronica |
| 8 | `Plug` | Integraciones | SAP, Google Workspace, Microsoft 365 |
| 9 | `BarChart3` | Reportes y BI | Dashboards y KPIs en tiempo real |
| 10 | `Code` | API Publica | REST, webhooks y SDK para developers |

### Texto de encabezados de columna

- **PLATAFORMA** — Subtitulo: "Disponible hoy"
- **PROXIMAMENTE** — Subtitulo: "En el roadmap"

### Footer del mega menu

- Texto: "Ver todas las funcionalidades" con flecha derecha.
- Link a: `/features`

### Texto del header nav

| Item | Texto visible | Tipo |
|---|---|---|
| Logo | Zeru | Link a `/` |
| Item 1 | Producto | Dropdown (mega menu) |
| Item 2 | Precios | Link a `/pricing` |
| Item 3 | Roadmap | Link a `/roadmap` |
| Item 4 | Blog | Link a `/blog` (disabled/coming soon) |
| CTA secundario | Iniciar sesion | Link a `/login` |
| CTA primario | Comenzar gratis | Link a `/register` |

---

## E. Mobile Navigation

### Principios de diseno mobile

1. **No usar mega menu en mobile.** En pantallas pequenas, los mega menus de hover no funcionan. En su lugar, usar un menu accordion/expandible.
2. **Hamburger menu** — El icono hamburguesa actual se mantiene (ya funciona bien).
3. **Full-screen overlay** — El menu mobile ocupa toda la pantalla (no un panel lateral parcial).

### Estructura del menu mobile

```
┌──────────────────────────────────────┐
│  Logo                         [X]    │  ← Header fijo con boton cerrar
├──────────────────────────────────────┤
│                                      │
│  Producto                      [v]   │  ← Tap para expandir/colapsar
│  ┌──────────────────────────────┐    │
│  │  PLATAFORMA                  │    │
│  │                              │    │
│  │  Inteligencia Organizacional │    │  ← Cada uno es un link
│  │  Diagnostica tu empresa      │    │
│  │  con IA                      │    │
│  │                              │    │
│  │  Personas y Organigrama      │    │
│  │  Directorio y estructura     │    │
│  │                              │    │
│  │  Asistente IA                │    │
│  │  Chat inteligente con        │    │
│  │  memoria                     │    │
│  │                              │    │
│  │  Contabilidad                │    │
│  │  Plan de cuentas y balance   │    │
│  │                              │    │
│  │  Marketing                   │    │
│  │  Posts LinkedIn con IA       │    │
│  │                              │    │
│  │  ──────────────────────────  │    │
│  │                              │    │
│  │  PROXIMAMENTE                │    │
│  │                              │    │
│  │  Gestion de RRHH             │    │
│  │  Gestion Documental          │    │
│  │  Integraciones               │    │
│  │  Reportes y BI               │    │
│  │  API Publica                 │    │
│  │                              │    │
│  └──────────────────────────────┘    │
│                                      │
│  Precios                             │  ← Link directo
│  Roadmap                             │  ← Link directo
│  Blog                                │  ← Link directo
│                                      │
│  ──────────────────────────────────  │
│                                      │
│  [Iniciar sesion]                    │  ← Boton secundario, ancho completo
│  [Comenzar gratis]                   │  ← Boton primario teal, ancho completo
│                                      │
└──────────────────────────────────────┘
```

### Especificaciones tecnicas mobile

**Overlay:**
- Fondo: `bg-[#0a0a0a]/98 backdrop-blur-xl`
- Ocupa `100dvh` (dynamic viewport height para evitar problemas con la barra del navegador mobile).
- Scroll interno si el contenido excede la pantalla.

**Accordion "Producto":**
- Al tocar "Producto", se expande mostrando la lista de features.
- Al volver a tocar, se colapsa.
- Animacion: altura de 0 a auto con transicion de 300ms.
- Icono chevron rota 180 grados al expandir.

**Items de feature dentro del accordion:**
- Solo nombre + descripcion de 1 linea (sin iconos para ahorrar espacio).
- Separador visual entre "Plataforma" y "Proximamente".
- Los items de "Proximamente" tienen texto mas muted (white/40 en vez de white/60).
- Touch target minimo de 44px de alto (accesibilidad).

**Otros items del nav (Precios, Roadmap, Blog):**
- Links directos sin expansion.
- Mismo estilo: texto blanco, padding generoso, separadores sutiles.

**CTAs:**
- Dos botones al final del menu, ancho completo.
- "Iniciar sesion" con borde (estilo outline).
- "Comenzar gratis" con fondo teal (estilo primario).

**Transicion de apertura del menu:**
- El menu entra desde la derecha con un slide de 300ms.
- El fondo se oscurece gradualmente.
- Body scroll se bloquea mientras el menu esta abierto (`overflow: hidden` en body).

**Breakpoint:**
- El mega menu desktop se muestra a partir de `md` (768px).
- Debajo de 768px se usa el menu mobile accordion.

---

## Apendice: Estructura de archivos propuesta

```
apps/web/app/(marketing)/
├── components/
│   ├── marketing-nav.tsx          ← Refactorizar para incluir mega menu
│   ├── mega-menu.tsx              ← Nuevo: componente del mega menu desktop
│   ├── mobile-nav.tsx             ← Nuevo: menu mobile con accordion
│   ├── feature-card.tsx           ← Nuevo: card reutilizable para features
│   └── ... (componentes existentes)
├── features/
│   ├── page.tsx                   ← /features — indice de todas las features
│   └── [slug]/
│       └── page.tsx               ← /features/[slug] — pagina individual
├── pricing/
│   └── page.tsx                   ← /pricing — pagina completa de precios
├── roadmap/
│   └── page.tsx                   ← /roadmap — pagina completa de roadmap
├── blog/
│   └── page.tsx                   ← /blog — listado de posts (futuro)
├── layout.tsx
└── page.tsx
```

### Datos centralizados

Crear un archivo de datos compartido para que el mega menu, las feature pages y el footer usen la misma fuente de verdad:

```
apps/web/lib/features-data.ts
```

Este archivo exportaria un array de objetos con:
- `slug`
- `name`
- `shortDescription` (para mega menu)
- `longDescription` (para feature page hero)
- `icon` (nombre del icono Lucide)
- `status` ("active" | "coming-soon")
- `estimatedDate` (para features del roadmap)
- `subFeatures` (array de sub-features con titulo y descripcion)
- `howItWorks` (array de pasos)
- `ctaText`

Esto permite generar las feature pages dinamicamente con `generateStaticParams()` y mantener todo sincronizado.

---

## Apendice: Prioridades de implementacion

| Prioridad | Tarea | Estimacion |
|---|---|---|
| 1 | Crear `features-data.ts` con todos los datos | 2h |
| 2 | Refactorizar `marketing-nav.tsx` con mega menu desktop | 4h |
| 3 | Crear componente `mobile-nav.tsx` con accordion | 3h |
| 4 | Crear pagina `/features` (indice) | 2h |
| 5 | Crear pagina `/features/[slug]` (dinamica) | 4h |
| 6 | Actualizar seccion roadmap del landing | 2h |
| 7 | Crear pagina `/pricing` standalone | 2h |
| 8 | Crear pagina `/roadmap` standalone | 2h |
| 9 | Actualizar footer con nuevos links | 1h |
| **Total** | | **~22h** |
