# Auditoria UX/UI Completa de la Plataforma Zeru

**Fecha:** 28 de marzo de 2026
**Auditor:** Auditor UX/UI Senior
**Comparativa:** Linear, Notion, Stripe, Figma

---

## 1. Mapa de la Plataforma

### Modulos principales y rutas

| Modulo | Ruta | Tipo | Descripcion |
|---|---|---|---|
| **Dashboard** | `/dashboard` | Pagina | Landing principal con IncomeStatement y onboarding banner |
| **Asistente IA** | `/assistant/new` | Redirect | Redirige a nuevo chat |
| | `/assistant/[id]` | Pagina | Chat con IA (pagina principal de interaccion) |
| **Documentos** | `/documents` | Pagina | Listado de documentos clasificados por IA |
| **Contabilidad** | `/accounting` | Hub | Tarjetas de navegacion a subsecciones |
| | `/accounting/chart-of-accounts` | Pagina | Plan de cuentas (tabla) |
| | `/accounting/journal` | Pagina | Listado de asientos contables |
| | `/accounting/journal/new` | Pagina | Formulario nuevo asiento |
| | `/accounting/journal/[id]` | Pagina | Detalle de asiento |
| | `/accounting/periods` | Pagina | Periodos fiscales |
| | `/accounting/reports` | Hub | Tarjetas de navegacion a reportes |
| | `/accounting/reports/balance` | Pagina | Balance de comprobacion |
| | `/accounting/reports/general-ledger` | Pagina | Libro mayor |
| **Calendario** | `/calendar` | Pagina | Calendario de posts LinkedIn |
| **Personas** | `/personas` | Redirect | Redirige a directorio |
| | `/personas/directorio` | Pagina | Directorio de personas (cards) |
| | `/personas/organigrama` | Pagina | Organigrama interactivo (ReactFlow) |
| **Inteligencia Org.** | `/org-intelligence` | Redirect | Redirige a proyectos |
| | `/org-intelligence/projects` | Pagina | Listado de proyectos (cards) |
| | `/org-intelligence/projects/[id]` | Pagina | Detalle de proyecto con tabs |
| | `/org-intelligence/projects/[id]/interviews/[interviewId]` | Pagina | Detalle de entrevista |
| | `/org-intelligence/knowledge-base` | Pagina | Explorador de entidades, busqueda semantica, procesos |
| | `/org-intelligence/persons` | Redirect | Redirige a `/personas/directorio` |
| **Marketing** | `/linkedin` | Redirect | Redirige a `/assistant/new` |
| | `/linkedin/[id]` | Redirect | Redirige a `/assistant/[id]` |
| | `/linkedin/posts` | Pagina | Listado de posts con acciones bulk |
| **Settings** | `/settings` | Pagina | Pagina vacia con texto indicativo |
| | `/settings/organization` | Pagina | Datos de la organizacion |
| | `/settings/users` | Pagina | Lista de usuarios |
| | `/settings/appearance` | Pagina | Selector de tema (claro/oscuro/sistema) |
| | `/settings/ai` | Pagina | Config OpenAI (formulario) |
| | `/settings/ai/memory` | Pagina | Memorias del asistente |
| | `/settings/ai/skills` | Pagina | Skills del agente (GitHub) |
| | `/settings/ai/gemini` | Pagina | Config Google Gemini |
| | `/settings/linkedin` | Pagina | Conexion LinkedIn y config del agente |
| | `/settings/storage` | Pagina | AWS S3 + SES |
| | `/settings/email` | Redirect | Redirige a `/settings/storage` |
| | `/settings/accounting-process` | Pagina | Pasos del proceso contable mensual |
| | `/settings/api-keys` | Pagina | Gestion de API keys |

**Total: 41 archivos page.tsx, ~30 paginas unicas (el resto son redirects)**

---

## 2. Evaluacion por Modulo

### 2.1 Dashboard (`/dashboard`)

**Descripcion visual:** Pagina con un banner de onboarding condicional (si falta config), titulo "Dashboard" con subtitulo "Bienvenido a Zeru", y un componente IncomeStatement que ocupa el ancho completo.

**Puntos fuertes:**
- Onboarding banner es util para guiar la configuracion inicial
- Layout limpio y simple

**Problemas encontrados:**

| # | Problema | Severidad |
|---|---|---|
| 1 | Dashboard extremadamente vacio - solo muestra un IncomeStatement sin metricas, KPIs, accesos rapidos ni resumen de actividad | ALTO |
| 2 | Titulo "Dashboard" y subtitulo "Bienvenido a Zeru" son genericos y no aportan informacion | MEDIO |
| 3 | No hay acceso rapido a acciones frecuentes (nuevo asiento, nueva conversacion, etc.) | ALTO |
| 4 | No hay metricas de uso del asistente IA (conversaciones, tokens, costos) | MEDIO |
| 5 | No hay resumen de actividad reciente (ultimos asientos, ultimos documentos) | MEDIO |

**Propuestas:**
- Agregar tarjetas con KPIs: saldo total, ingresos/egresos del mes, documentos procesados, conversaciones activas
- Acciones rapidas: "Nueva conversacion", "Nuevo asiento", "Ver reportes"
- Widget de actividad reciente
- Widget de estado del proceso contable mensual

---

### 2.2 Asistente IA (`/assistant/[id]`)

**Descripcion visual:** Chat full-feature con area de mensajes, input con soporte de archivos e imagenes, bloques de pensamiento, ejecucion de herramientas, tarjetas de revision de asientos contables, previsualizacion de posts LinkedIn, medidor de tokens, y markdown rendering.

**Puntos fuertes:**
- Componente muy completo y funcional
- Soporte de multiples tipos de archivo (PDF, CSV, Excel, imagenes)
- Bloques de thinking colapsables
- Previsualizacion de herramientas ejecutadas
- Token meter integrado
- Markdown con GFM
- Separacion clara entre mensajes del usuario y del asistente

**Problemas encontrados:**

| # | Problema | Severidad |
|---|---|---|
| 1 | Archivo de 15,000+ tokens, componente monolitico que deberia dividirse | MEDIO |
| 2 | El sidebar de conversaciones no es visible (no se ve en el page.tsx como se lista el historial) | MEDIO |
| 3 | No se ve un mecanismo para renombrar conversaciones desde el chat | BAJO |

**Propuestas:**
- Refactorizar en sub-componentes (MessageList, InputArea, FileUpload, etc.)
- Asegurar que el historial de conversaciones sea facilmente accesible

---

### 2.3 Documentos (`/documents`)

**Descripcion visual:** Tabla con filtros (categoria, tag, rango de fechas), columnas para nombre, categoria (badges con colores), tags, asientos vinculados, fecha y tamano. Paginacion al final. Empty state con icono y texto educativo.

**Puntos fuertes:**
- Filtros bien implementados con boton "Limpiar filtros"
- Badges de categoria con colores bien diferenciados (incluyendo dark mode)
- Link a conversacion desde cada documento
- Vinculacion con asientos contables
- Empty state diferenciado (con filtros vs. sin documentos)
- Paginacion funcional

**Problemas encontrados:**

| # | Problema | Severidad |
|---|---|---|
| 1 | Tabla HTML manual en vez de usar un componente de shadcn/ui DataTable | MEDIO |
| 2 | No hay posibilidad de subir documentos directamente desde esta pagina | MEDIO |
| 3 | `handleDelete` usa `confirm()` nativo del navegador en vez de un Dialog de shadcn | MEDIO |
| 4 | Iconos SVG inline, deberian usar una libreria de iconos (como hugeicons que se usa en otros lados) | BAJO |
| 5 | No hay ordenamiento de columnas (sort by fecha, tamano, etc.) | BAJO |

**Propuestas:**
- Reemplazar `confirm()` por `AlertDialog` de shadcn (como en API Keys)
- Agregar boton de "Subir documento" en el header
- Migrar a DataTable con ordenamiento

---

### 2.4 Contabilidad

#### Hub (`/accounting`)

**Descripcion visual:** 4 tarjetas (Card) en grid que enlazan a Plan de Cuentas, Asientos, Periodos y Reportes.

**Puntos fuertes:**
- Patron de hub con cards claro y simple
- Hover state en las cards

**Problemas:**

| # | Problema | Severidad |
|---|---|---|
| 1 | Las cards no tienen icono, se ven planas comparadas con el standard (Linear, Stripe) | BAJO |
| 2 | No hay metricas rapidas (total de cuentas, asientos del periodo, etc.) | MEDIO |

#### Plan de Cuentas (`/accounting/chart-of-accounts`)

**Puntos fuertes:**
- Tabla limpia con badges para tipo y estado
- Boton "Nueva Cuenta"

**Problemas:**

| # | Problema | Severidad |
|---|---|---|
| 1 | Boton "Nueva Cuenta" lleva a `/accounting/chart-of-accounts/new` que NO EXISTE como ruta | ALTO |
| 2 | No hay busqueda/filtro de cuentas | MEDIO |
| 3 | Las cuentas se muestran planas sin jerarquia visual (indentacion por nivel) | MEDIO |
| 4 | Loading state es solo texto "Cargando..." sin skeleton | MEDIO |

#### Asientos (`/accounting/journal`)

**Puntos fuertes:**
- Filtros por estado con paginacion en URL (deep-linkable)
- Exportacion a Excel
- Badge de estado bien implementado
- Paginacion con conteo "Mostrando X-Y de Z"

**Problemas:**

| # | Problema | Severidad |
|---|---|---|
| 1 | No hay busqueda por descripcion/glosa | MEDIO |
| 2 | No hay filtro por rango de fechas | MEDIO |
| 3 | Loading state es solo texto "Cargando..." | BAJO |

#### Nuevo Asiento (`/accounting/journal/new`)

**Puntos fuertes:**
- Formulario bien estructurado en cards
- Buscador de cuentas con autocomplete
- Validacion de balance (Debe = Haber)
- Indicador visual de diferencia cuando no cuadra

**Problemas:**

| # | Problema | Severidad |
|---|---|---|
| 1 | Variable `lineKeyCounter` declarada como `let` fuera del componente (module-level mutable state) | MEDIO |
| 2 | Autocomplete de cuentas es casero (no usa Combobox de shadcn) | BAJO |
| 3 | No hay boton "Cancelar" visible desde el inicio (solo en la parte superior) | BAJO |

#### Detalle de Asiento (`/accounting/journal/[id]`)

**Puntos fuertes:**
- Card de "Informacion de creacion" (quien, cuando, origen) es muy buena
- Link a conversacion de origen del asistente
- Acciones contextuales (Contabilizar, Anular) segun estado
- Documentos relacionados

**Problemas:**

| # | Problema | Severidad |
|---|---|---|
| 1 | Accion "Anular" no pide confirmacion (deberia usar AlertDialog) | ALTO |
| 2 | Accion "Contabilizar" tampoco pide confirmacion | MEDIO |

#### Periodos Fiscales (`/accounting/periods`)

**Problemas:**

| # | Problema | Severidad |
|---|---|---|
| 1 | Boton "Nuevo Periodo" no tiene `onClick` handler (no hace nada) | ALTO |
| 2 | Accion "Cerrar" no pide confirmacion (accion irreversible) | ALTO |
| 3 | No hay empty state educativo | BAJO |

#### Reportes - Balance (`/accounting/reports/balance`)

**Problemas:**

| # | Problema | Severidad |
|---|---|---|
| 1 | No hay columna de "Saldo" (solo Debe y Haber) | MEDIO |
| 2 | No hay totales en el footer de la tabla | MEDIO |
| 3 | No hay exportacion a Excel | BAJO |

#### Reportes - Libro Mayor (`/accounting/reports/general-ledger`)

**Puntos fuertes:**
- Selector de cuenta con arbol jerarquico colapsable (muy bien implementado)
- Filtro por rango de fechas
- Saldo acumulado por linea
- Exportacion a Excel

**Problemas:**

| # | Problema | Severidad |
|---|---|---|
| 1 | No se muestran totales al final de la tabla | BAJO |

---

### 2.5 Calendario (`/calendar`)

**Descripcion visual:** Calendario mensual con navegacion de meses, filtro por estado, leyenda de pilares de contenido, grid de dias con posts como chips coloreados, y modal de detalle al hacer click.

**Puntos fuertes:**
- Vista calendario bien implementada
- Leyenda de colores clara
- Modal de detalle funcional
- Nombres de meses y dias en espanol

**Problemas:**

| # | Problema | Severidad |
|---|---|---|
| 1 | El `<select>` HTML nativo no usa el componente Select de shadcn (inconsistencia) | MEDIO |
| 2 | El modal usa `div` con `fixed inset-0` en vez de Dialog de shadcn | MEDIO |
| 3 | Solo muestra posts de LinkedIn - el nombre "Calendario" sugiere algo mas amplio | BAJO |
| 4 | No hay forma de crear un post desde el calendario | MEDIO |
| 5 | `max-w-5xl mx-auto` limita el ancho innecesariamente en pantallas grandes | BAJO |

---

### 2.6 Personas

#### Directorio (`/personas/directorio`)

**Puntos fuertes:**
- Grid responsive de cards con avatar
- Busqueda con debounce
- CRUD completo con dialogs de shadcn
- Upload de avatar
- Menu contextual con DropdownMenu
- Empty state educativo con `EducationalEmptyState`
- Confirmacion de eliminacion con Dialog

**Problemas:**

| # | Problema | Severidad |
|---|---|---|
| 1 | Entidades HTML escapadas manualmente (`&oacute;`, `&aacute;`, etc.) en vez de usar caracteres UTF-8 directamente | MEDIO |
| 2 | No hay paginacion (carga todos los registros) | BAJO |
| 3 | Error handling usa `alert()` nativo | MEDIO |

#### Organigrama (`/personas/organigrama`)

**Puntos fuertes:**
- Visualizacion con ReactFlow + dagre auto-layout
- Busqueda que resalta/difumina nodos
- Estadisticas en el header
- Empty state educativo con link al directorio
- Banner de aviso cuando hay personas sin jerarquia

**Problemas:**

| # | Problema | Severidad |
|---|---|---|
| 1 | Entidades HTML escapadas (`&oacute;`, `&aacute;`) | MEDIO |
| 2 | El boton "Ajustar vista" no funciona correctamente (usa ref que puede no estar inicializada) | BAJO |

---

### 2.7 Inteligencia Organizacional

#### Proyectos (`/org-intelligence/projects`)

**Puntos fuertes:**
- Grid de cards con info resumida (entrevistas, entidades, problemas)
- CRUD completo con dialogs
- Empty state educativo con accion secundaria
- HelpTooltip para guiar al usuario

**Problemas:**

| # | Problema | Severidad |
|---|---|---|
| 1 | Error handling usa `alert()` nativo (5 veces en el archivo) | MEDIO |
| 2 | No hay paginacion | BAJO |

#### Detalle de Proyecto (`/org-intelligence/projects/[id]`)

**Puntos fuertes:**
- Tabs para Entrevistas, Analisis, Diagnostico, Plan de Accion, Configuracion
- Cambio de estado del proyecto con Select
- HelpTooltip extenso que explica cada tab
- Multiple dialogs para CRUD de entrevistas
- Componentes especializados para cada tab (Analysis, Diagnosis, Improvements)

**Problemas:**

| # | Problema | Severidad |
|---|---|---|
| 1 | Archivo muy largo (~978 lineas), deberia refactorizarse | MEDIO |
| 2 | Error handling usa `alert()` nativo (7+ veces) | MEDIO |
| 3 | El HelpTooltip junto a los tabs tiene texto demasiado largo | BAJO |
| 4 | Boton de eliminar proyecto esta en el header sin confirmacion inmediata (aunque tiene AlertDialog) | BAJO |

#### Knowledge Base (`/org-intelligence/knowledge-base`)

**Puntos fuertes:**
- Tres sub-tabs: Entidades, Busqueda semantica, Procesos
- Filtros por tipo de entidad con chips toggle
- Filtro de confianza con Slider
- Busqueda semantica con ejemplos sugeridos
- Visualizacion de procesos con diagramas Mermaid
- Dialog de detalle de entidad

**Problemas:**

| # | Problema | Severidad |
|---|---|---|
| 1 | Pagina muy larga (~920 lineas) con tres tabs embebidas | MEDIO |
| 2 | No hay skeleton loading en la tab de Busqueda mientras no se ha buscado | BAJO |

---

### 2.8 Marketing / LinkedIn

#### Posts (`/linkedin/posts`)

**Puntos fuertes:**
- Lista de posts con badges de estado y pilares
- Acciones individuales (Publicar, Cancelar)
- Seleccion bulk con checkbox
- Barra de acciones bulk bien disenada con estilo LinkedIn
- Paginacion

**Problemas:**

| # | Problema | Severidad |
|---|---|---|
| 1 | `<select>` HTML nativo en vez de Select de shadcn (inconsistencia) | MEDIO |
| 2 | Botones custom (`button` con clases inline) en vez de Button de shadcn | MEDIO |
| 3 | No hay confirmacion antes de publicar (accion no reversible) | ALTO |
| 4 | No hay forma de editar un post desde esta vista | MEDIO |
| 5 | Spinner custom en vez del patron consistente de loading | BAJO |
| 6 | Header tiene `px-6 py-5` propio en vez de usar el padding del layout | BAJO |

#### Redirects de LinkedIn

El modulo `/linkedin` redirige a `/assistant/new` y `/linkedin/[id]` redirige a `/assistant/[id]`. Esto es confuso desde la perspectiva de navegacion: el sidebar muestra "Marketing > LinkedIn > Posts" pero el chat de creacion de contenido usa la ruta del asistente general.

---

### 2.9 Settings

#### General (`/settings`)

**Problema critico:** La pagina solo muestra un titulo y subtitulo. Deberia mostrar un resumen de la configuracion o redirigir a la primera subseccion.

#### Organizacion (`/settings/organization`)

**Puntos fuertes:**
- Formulario simple y claro
- Campo de Tenant ID con boton "Copiar"
- Mensaje de exito

**Problemas:**

| # | Problema | Severidad |
|---|---|---|
| 1 | No hay toast notification - el mensaje de exito es texto verde inline | MEDIO |
| 2 | No hay manejo de errores visible (catch vacio con comentario "Error handling could be improved with toast") | MEDIO |

#### Usuarios (`/settings/users`)

**Puntos fuertes:**
- Tabla con roles y badges
- Dialog para crear usuario

**Problemas:**

| # | Problema | Severidad |
|---|---|---|
| 1 | No hay acciones para editar/desactivar usuarios | MEDIO |
| 2 | No hay rol-based access visible | BAJO |

#### Apariencia (`/settings/appearance`)

**Puntos fuertes:**
- Selector de tema visual con 3 opciones (Claro, Oscuro, Sistema)
- Indicador visual del tema activo

**Sin problemas significativos.**

#### Asistente IA (`/settings/ai`)

Delega a `AiConfigForm`. Compacto y correcto.

#### Memoria (`/settings/ai/memory`)

**Puntos fuertes:**
- Tabs para memoria organizacional vs. personal
- Lista con badges de categoria e importancia
- Eliminacion con AlertDialog

**Problemas:**

| # | Problema | Severidad |
|---|---|---|
| 1 | Tabs implementadas con botones custom en vez del componente Tabs de shadcn | MEDIO |
| 2 | No hay forma de crear memorias manualmente | BAJO |

#### Skills (`/settings/ai/skills`)

**Puntos fuertes:**
- Skills recomendados con categorias (contabilidad/marketing)
- Formulario de instalacion con preview del URL parseado
- Cards de skills con Switch para activar/desactivar
- Sincronizar y eliminar con confirmacion
- Multiples formatos de entrada (URL, owner/repo, npx command)

**Sin problemas significativos. Es una de las paginas mejor implementadas.**

#### LinkedIn (`/settings/linkedin`)

**Puntos fuertes:**
- Card de conexion con estado visual
- Config del agente completa (auto-publish, visibilidad, idioma, pilares)

**Problemas:**

| # | Problema | Severidad |
|---|---|---|
| 1 | Toggle de auto-publish es un `button` casero en vez de Switch de shadcn | MEDIO |
| 2 | `<select>` nativos en vez de Select de shadcn (2 ocurrencias) | MEDIO |
| 3 | Boton "Guardar configuracion" es un `button` con clases inline en vez de Button de shadcn | MEDIO |
| 4 | Botones "Reconectar" y "Desconectar" son `button` nativos | MEDIO |

#### Almacenamiento y Email (`/settings/storage`)

Delega a `StorageConfigForm` y `EmailConfigForm`. Bien organizado con separacion visual.

#### Proceso Contable (`/settings/accounting-process`)

**Puntos fuertes:**
- Lista reordenable con flechas arriba/abajo
- Edicion inline
- Confirmacion de eliminacion con AlertDialog
- Boton para cargar plantilla predeterminada
- Usa HugeiconsIcon consistentemente

**Sin problemas significativos.**

#### API Keys (`/settings/api-keys`)

**Puntos fuertes:**
- Dialog de creacion con seleccion de scopes por grupo
- Aviso critico de que la key solo se muestra una vez
- Boton copiar para la key y el Tenant ID
- Revocacion con AlertDialog
- Seccion de uso de la API con ejemplo

**Sin problemas significativos.**

---

## 3. Evaluacion Transversal

### 3.1 Consistencia entre modulos

#### Headers de pagina

- **Patron dominante:** `<h1 className="text-2xl font-bold">` + `<p className="text-muted-foreground">` - Se usa en la mayoria.
- **Inconsistencias:**
  - Calendario usa `text-2xl font-semibold tracking-tight` (diferente peso)
  - LinkedIn Posts usa `text-xl font-semibold`
  - Settings LinkedIn usa `text-xl font-semibold`
  - Algunos usan `mt-1` en el subtitulo, otros `text-sm mt-1`, otros sin clase adicional

#### Listados

- **Tablas HTML manuales:** Documentos, Plan de Cuentas, Asientos, Periodos, Usuarios, Reportes. Ninguna usa `@tanstack/react-table` o DataTable de shadcn.
- **Cards:** Directorio de personas, Proyectos, LinkedIn Posts.
- **Inconsistencia:** Algunos listados usan Card (Plan de Cuentas, Asientos), otros no (Documentos).

#### Formularios

- **Patron:** Label + Input con `space-y-1.5` o `space-y-2` - Razonablemente consistente.
- **Inconsistencia:** Settings LinkedIn usa `<input>`, `<select>`, y `<button>` nativos en vez de componentes shadcn.

#### Modales/Dialogs

- **Patron dominante:** Dialog de shadcn con DialogHeader/DialogFooter - Usado en mayoria.
- **Excepciones:**
  - Calendario usa un `div` con `fixed inset-0` como modal
  - Documentos usa `confirm()` nativo para eliminar

#### Empty states

- **Buen patron:** `EducationalEmptyState` se usa en Org Intelligence y Personas - Tiene icono, titulo, descripcion, accion y tip.
- **Patron basico:** Texto centrado en muted-foreground - Usado en Documentos, Asientos, Balance.
- **Inconsistencia:** No todos los modulos usan el componente educativo.

#### Loading states

- **Patron 1:** Skeleton (Directorio, Organigrama, Proyectos, Knowledge Base) - Bueno
- **Patron 2:** Spinner CSS custom (Documentos, Calendario, LinkedIn Posts) - OK pero inconsistente
- **Patron 3:** Texto "Cargando..." sin visual (Plan de Cuentas, Asientos, Periodos, Balance) - Malo
- **Recomendacion:** Unificar con Skeleton de shadcn para todos los loading states

#### Error handling

- **`alert()` nativo:** Directorio de personas, Proyectos, Detalle de proyecto (7+ ocurrencias)
- **Error inline (texto rojo):** Asientos, Periodos, Reportes
- **Sin manejo visible:** Organizacion (catch vacio)
- **Recomendacion:** Implementar Toasts de shadcn para todas las notificaciones

### 3.2 Navegacion global

#### Sidebar

- **Estructura:** Bien organizada con colapsables para modulos con sub-paginas
- **Settings:** Sidebar cambia completamente al entrar en Settings, con "Volver a la app" - Buen patron
- **Problema:** Memoria, Skills y Gemini comparten el mismo icono `AiChat02Icon` en Settings
- **Problema:** "Marketing > LinkedIn" tiene un sub-colapsable innecesariamente profundo (3 niveles)

#### Breadcrumbs

- **Implementacion:** Automatica basada en segmentos de URL con mapa de labels
- **Problema:** Los IDs dinamicos (UUIDs) se muestran como texto crudo en los breadcrumbs cuando no hay label mapeado
- **Problema:** Faltan labels para: `new`, `dashboard`, `skills`, `gemini`, `linkedin` (en settings), `storage`, `api-keys`, `accounting-process`, `posts`, `calendar`

#### Wayfinding

- **Volver atras:** Presente en Detalle de asiento y Detalle de proyecto. Ausente en la mayoria de las paginas de detalle.
- **URLs predecibles:** Si, todas las rutas siguen convenciones RESTful logicas.

### 3.3 Sistema de diseno

#### Componentes UI

- **shadcn/ui:** Se usa extensivamente (Button, Card, Badge, Dialog, Select, Input, Label, Tabs, etc.)
- **Inconsistencias notables:**
  - Settings LinkedIn: 4+ elementos HTML nativos donde deberian usarse componentes shadcn
  - Calendario: `<select>` nativo, modal casero
  - LinkedIn Posts: `<select>` nativo, botones con clases inline
  - Documentos: iconos SVG inline

#### Iconografia

- **HugeiconsIcon:** Se usa en Sidebar, Personas, Organigrama, Proyectos, Proceso Contable
- **SVG inline:** Se usa en Documentos, Calendario, LinkedIn, Skills, Onboarding Banner
- **Inconsistencia:** Deberia unificarse en HugeiconsIcon en toda la aplicacion

#### Tipografia

- Titulos de pagina: `text-2xl font-bold` (mayoria) - OK
- Subtitulos: `text-muted-foreground` con variaciones de `text-sm` - Aceptable
- Cuerpo: `text-sm` - Consistente

#### Colores

- Uso correcto del sistema de colores CSS variables de shadcn
- Badges con colores semanticos bien diferenciados
- LinkedIn usa su color de marca (`#0A66C2`) correctamente

### 3.4 Dark mode

- **CSS variables:** Correctamente definidas en `globals.css` con `:root` y `.dark`
- **Componentes shadcn:** Soportan dark mode automaticamente
- **Clases condicionales `dark:`:** Se usan correctamente en badges personalizados (Documentos, Calendar, LinkedIn Posts)
- **Riesgo potencial:** Settings LinkedIn usa clases inline sin verificar dark mode en todos los elementos (`bg-[#0A66C2]` con texto blanco funciona en ambos modos)
- **Evaluacion general:** Dark mode esta bien soportado gracias al sistema de CSS variables

### 3.5 Contenido y copywriting

#### Idioma

- **Mayoria en espanol:** Si, la interfaz esta predominantemente en espanol
- **Excepciones en ingles:**
  - "Knowledge Base" en el sidebar y la pagina (deberia ser "Base de Conocimiento" en el sidebar - parcialmente resuelto en la pagina)
  - "Behind the Scenes" en los pilares de contenido del calendario
  - `BULK_ELIGIBLE`, nombres de variables y status internos (aceptable)
  - Breadcrumb labels faltan para varias rutas

#### Tildes

- **Problema:** En Directorio y Organigrama se usan entidades HTML (`&oacute;`, `&aacute;`, `&eacute;`) en vez de caracteres UTF-8 directos. Es innecesario en JSX moderno y dificulta la lectura del codigo.

#### Textos

- **Placeholders:** Utiles y contextuales ("Ej: Gerente de Operaciones", "correo@empresa.cl")
- **Empty states:** Los educativos son excelentes ("Registra a las personas...", tips). Los basicos son demasiado minimalistas.
- **Errores:** Los que usan `alert()` no son accionables. Los inline son mejores pero podrian ser mas descriptivos.

---

## 4. Top 20 Problemas Mas Importantes

| # | Modulo | Archivo | Problema | Severidad | Propuesta | Esfuerzo |
|---|---|---|---|---|---|---|
| 1 | Dashboard | `dashboard/page.tsx` | Dashboard casi vacio - no aporta valor. Un CEO que entra no ve nada util | ALTO | Agregar KPIs, actividad reciente, acciones rapidas, estado del proceso contable | Largo |
| 2 | Contabilidad | `periods/page.tsx` | Boton "Nuevo Periodo" no funciona (sin onClick) | ALTO | Implementar creacion de periodo con Dialog | Medio |
| 3 | Contabilidad | `periods/page.tsx` | "Cerrar" periodo no pide confirmacion (irreversible) | ALTO | Agregar AlertDialog de confirmacion | Rapido |
| 4 | Contabilidad | `journal/[id]/page.tsx` | "Anular" asiento no pide confirmacion | ALTO | Agregar AlertDialog de confirmacion | Rapido |
| 5 | LinkedIn | `posts/page.tsx` | "Publicar" no pide confirmacion (irreversible) | ALTO | Agregar AlertDialog antes de publicar | Rapido |
| 6 | Contabilidad | `chart-of-accounts/page.tsx` | Boton "Nueva Cuenta" lleva a ruta que no existe | ALTO | Crear la pagina o implementar con Dialog | Medio |
| 7 | Global | Multiples archivos | `alert()` nativo usado en 12+ lugares en vez de Toast/Dialog | MEDIO | Reemplazar por Sonner (toast) de shadcn en todas las paginas | Medio |
| 8 | Global | Multiples archivos | Loading states inconsistentes: texto "Cargando..." vs. Skeleton vs. spinner custom | MEDIO | Unificar con Skeleton de shadcn para todos los loading states | Medio |
| 9 | Settings | `settings/linkedin/page.tsx` | 6+ elementos HTML nativos (select, button, toggle) donde deberian usarse componentes shadcn | MEDIO | Migrar a Select, Button, Switch de shadcn | Rapido |
| 10 | Calendario | `calendar/page.tsx` | Select HTML nativo + modal casero (div fixed) en vez de componentes shadcn | MEDIO | Migrar a Select de shadcn y Dialog | Rapido |
| 11 | LinkedIn | `posts/page.tsx` | Select HTML nativo + botones con clases inline | MEDIO | Migrar a Select y Button de shadcn | Rapido |
| 12 | Documentos | `documents/page.tsx` | `confirm()` nativo para eliminar en vez de AlertDialog | MEDIO | Reemplazar por AlertDialog de shadcn | Rapido |
| 13 | Breadcrumbs | `breadcrumbs.tsx` | IDs dinamicos (UUIDs) aparecen raw en breadcrumbs + faltan 10+ labels | MEDIO | Agregar labels faltantes y truncar/ocultar UUIDs | Rapido |
| 14 | Personas | `directorio/page.tsx` | Entidades HTML escapadas (&oacute;, etc.) en vez de UTF-8 directo | MEDIO | Reemplazar por caracteres Unicode directos | Rapido |
| 15 | Global | Multiples archivos | Mezcla de HugeiconsIcon y SVG inline para iconografia | MEDIO | Unificar en HugeiconsIcon o lucide-react en toda la app | Medio |
| 16 | Contabilidad | `chart-of-accounts/page.tsx` | Loading state solo texto "Cargando..." sin skeleton | MEDIO | Implementar skeleton loading | Rapido |
| 17 | Settings | `settings/page.tsx` | Pagina Settings root esta practicamente vacia | MEDIO | Agregar resumen de config o redirigir a primera subseccion | Rapido |
| 18 | Contabilidad | `journal/[id]/page.tsx` | "Contabilizar" asiento no pide confirmacion | MEDIO | Agregar AlertDialog | Rapido |
| 19 | Org Intel | `projects/[id]/page.tsx` | Archivo de 978 lineas - dificil de mantener | MEDIO | Extraer tabs en componentes separados | Medio |
| 20 | Settings | `ai/memory/page.tsx` | Tabs implementadas con botones custom en vez de Tabs de shadcn | MEDIO | Migrar a componente Tabs de shadcn | Rapido |

---

## 5. Recomendaciones Estrategicas

### 5.1 Patrones a Unificar

1. **Loading states:** Crear un componente `PageSkeleton` reutilizable con variantes (table, cards, form). Usar `Skeleton` de shadcn en todas las paginas. Eliminar "Cargando..." en texto plano y spinners custom.

2. **Error handling:** Implementar `Sonner` (toasts) de shadcn como sistema global de notificaciones. Eliminar todos los `alert()`. Crear un hook `useToast` global.

3. **Confirmacion de acciones destructivas:** Regla: toda accion que no se puede deshacer DEBE usar `AlertDialog`. Aplica a: eliminar, anular, cerrar periodo, publicar post, revocar API key.

4. **Headers de pagina:** Crear un componente `PageHeader` con props `title`, `subtitle`, `actions`. Estandarizar `text-2xl font-bold` para todos.

5. **Tablas:** Considerar adoptar `@tanstack/react-table` con un wrapper `DataTable` para tablas con filtros, ordenamiento y paginacion. Aplica a: Documentos, Plan de Cuentas, Asientos, Periodos, Usuarios.

6. **Empty states:** Extender `EducationalEmptyState` a todos los modulos. Actualmente solo lo usan Personas y Org Intelligence. Documentos, Asientos, Periodos y Dashboard lo necesitan.

### 5.2 Componentes a Crear como Design System

1. **`<PageHeader title subtitle actions />`** - Usado en 25+ paginas
2. **`<PageSkeleton variant="table|cards|form" />`** - Loading states unificados
3. **`<DataTable columns data filters pagination />`** - Wrapper para tablas complejas
4. **`<ConfirmAction title description onConfirm variant="destructive" />`** - AlertDialog simplificado
5. **`<StatusIndicator status />`** - Badge unificado para estados (Draft, Posted, Voided, Active, etc.)
6. **`<EmptyState icon title description action tip />`** - Ya existe parcialmente como `EducationalEmptyState`
7. **`<CopyField value label />`** - Se repite en Organizacion y API Keys

### 5.3 Modulos que Necesitan Mas Trabajo (Prioridad)

1. **Dashboard** - Necesita reconstruccion completa. Es la primera impresion del usuario y actualmente no comunica valor.
2. **Contabilidad - Periodos Fiscales** - Funcionalidad incompleta (boton roto).
3. **Contabilidad - Plan de Cuentas** - Ruta "Nueva Cuenta" inexistente, sin busqueda, sin jerarquia visual.
4. **Settings - LinkedIn** - Deuda tecnica alta por no usar componentes shadcn.
5. **Calendario** - Deuda tecnica + funcionalidad limitada (solo lectura de posts).

### 5.4 Prioridades de Mejora

#### Sprint 1: Quick Wins (1-2 dias)
- Agregar `AlertDialog` a todas las acciones destructivas sin confirmacion (7 archivos)
- Reemplazar `confirm()` y `alert()` por componentes shadcn (12+ ocurrencias)
- Agregar labels faltantes a breadcrumbs
- Reemplazar entidades HTML por UTF-8 en Directorio y Organigrama
- Corregir boton "Nuevo Periodo" (al menos un Dialog basico)

#### Sprint 2: Consistencia de Componentes (3-5 dias)
- Migrar selects HTML nativos a Select de shadcn (Calendario, LinkedIn Posts, Settings LinkedIn)
- Migrar botones inline a Button de shadcn (LinkedIn Posts, Settings LinkedIn)
- Migrar toggle casero a Switch de shadcn (Settings LinkedIn)
- Migrar modal casero a Dialog (Calendario)
- Unificar loading states con Skeleton

#### Sprint 3: Dashboard y UX Core (1-2 semanas)
- Reconstruir Dashboard con KPIs, actividad reciente, acciones rapidas
- Implementar sistema de Toast global con Sonner
- Crear componentes PageHeader y PageSkeleton reutilizables
- Implementar ruta/dialog para "Nueva Cuenta" en Plan de Cuentas

#### Sprint 4: Calidad de Modulos (2-3 semanas)
- Agregar busqueda a Plan de Cuentas
- Agregar filtro por fechas a Asientos
- Mejorar empty states con EducationalEmptyState en todos los modulos
- Refactorizar archivos grandes (assistant/[id], projects/[id], knowledge-base)
- Agregar funcionalidad de edicion a LinkedIn Posts

### 5.5 Observaciones de Arquitectura

1. **Calidad general alta:** La plataforma usa tecnologias modernas (Next.js, shadcn/ui, Tailwind, ReactFlow) y la mayoria de las paginas estan bien implementadas. Los problemas son mas de consistencia que de calidad base.

2. **Patron de datos:** Todas las paginas usan `useEffect` + `useState` + `api.get()` para fetching. Considerar adoptar React Query o SWR para cache, revalidacion y estados de carga mas robustos.

3. **Deuda tecnica concentrada:** Los problemas mas grandes estan en el Dashboard (vacio), Contabilidad Periodos (funcionalidad rota), y Settings LinkedIn (componentes nativos). El resto de la plataforma es funcional.

4. **Fortalezas especificas:** Org Intelligence (proyectos, entrevistas, knowledge base) y API Keys son las secciones mejor implementadas, con empty states educativos, confirmaciones, y uso consistente de shadcn.
