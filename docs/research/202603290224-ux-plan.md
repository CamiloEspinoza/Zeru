# Plan UX/UI - Plataforma de Inteligencia Organizacional

## Estado: EN DESARROLLO

---

## UX-1: Flujo de Proyectos y Entrevistas (Experto en Interaccion)

### 1. Analisis de la UI Actual de Zeru

#### 1.1 Patrones de Layout Identificados

**Layout principal:** Sidebar collapsible (shadcn SidebarProvider) + area de contenido con header (breadcrumbs + sidebar trigger). El contenido vive dentro de un `div.flex.flex-1.flex-col.gap-4.p-6`. Todo envuelto en AuthProvider > TenantProvider > OnboardingGuard.

**Patron de navegacion:**
- Sidebar principal con items planos y colapsables (Collapsible de Radix)
- Dos modos de sidebar: "Aplicacion" y "Configuracion" (se alternan segun la ruta `/settings`)
- Breadcrumbs dinamicos basados en path segments con diccionario de labels (`LABELS`)
- Sub-navegacion via sidebar colapsable (ej: Contabilidad tiene 4 sub-items)
- Sidebar secundaria interna (ej: Assistant tiene ConversationsSidebar a la izquierda)

**Patron de paginas:**
- `space-y-6` como contenedor principal
- Titulo `text-2xl font-bold` + descripcion `text-muted-foreground`
- Cards con `ring-1 ring-foreground/10 bg-card rounded-lg`
- Listas como cards apiladas con `space-y-3` (ej: LinkedIn posts)
- Badges para estados con colores semanticos (amber para pendiente, green para publicado, red para error, blue para programado)
- Loading: spinner circular animado centrado
- Empty state: icono en circulo muted + texto descriptivo
- Paginacion: botones "Anterior/Siguiente" con contador central

**Componentes UI disponibles (shadcn):**
- Layout: Card, Sidebar, Sheet, Separator, Collapsible
- Formularios: Input, Textarea, Select, Combobox, Checkbox, Switch, Label, Field, InputGroup, InputOtp
- Feedback: Progress, Skeleton, Badge, Tooltip, AlertDialog
- Navegacion: Breadcrumb, DropdownMenu, Dialog
- Iconografia: @hugeicons/react (HugeiconsIcon)

**Sistema de diseno:**
- Tema teal/cyan como color primario (oklch ~0.60 0.10 185)
- Border radius: 0.45rem base
- Tipografia: font-sans (Geist) + font-mono (Geist Mono)
- Dark mode soportado via clase `.dark`
- Espaciado: 6 (p-6) como padding de pagina, gap-4 entre contenido y header

**Patrones de formularios y uploads:**
- No hay upload de archivos implementado actualmente en el frontend
- Formularios usan inputs basicos con labels
- API client centralizado en `@/lib/api-client`

#### 1.2 Huecos Criticos para Inteligencia Organizacional

Lo que NO existe hoy y se necesita:
- No hay concepto de "proyecto" como contenedor de trabajo
- No hay upload de archivos (drag & drop, progress)
- No hay step tracker / wizard multi-paso
- No hay pipeline de procesamiento con estados visibles
- No hay reproductor de audio
- No hay visualizacion de transcripciones
- No hay review queue (aprobar/editar/rechazar items)
- No hay tabs como navegacion interna de pagina
- No hay stepper/timeline de progreso
- No hay graficos ni visualizaciones de datos

---

### 2. Diseno de la Experiencia de Proyectos de Mejora Continua

#### 2.1 Navegacion: Donde vive "Proyectos" en Zeru

**Propuesta:** Agregar "Inteligencia Org." como item de primer nivel en la sidebar principal, entre "Calendario" y "Marketing".

```
Sidebar principal:
  Dashboard
  Asistente
  Documentos
  Contabilidad >
  Calendario
  Inteligencia Org. >       <-- NUEVO
    Proyectos
    Knowledge Base
  Marketing >
```

**Justificacion:** La inteligencia organizacional es una funcion de primer nivel, no un sub-item de otro modulo. Contiene al menos dos vistas principales: la lista de proyectos y la base de conocimiento consultable. Es comparable en importancia a Contabilidad.

**Breadcrumb labels nuevos:**
```
"org-intelligence": "Inteligencia Org."
"projects": "Proyectos"
"interviews": "Entrevistas"
"knowledge-base": "Base de Conocimiento"
"diagnosis": "Diagnostico"
"action-plan": "Plan de Accion"
```

#### 2.2 Lista de Proyectos (`/org-intelligence/projects`)

**Layout:** Grid de cards (no tabla). 2 columnas en desktop, 1 en mobile.

```
+------------------------------------------------------------------+
| Inteligencia Organizacional                                       |
| Proyectos de mejora continua                                     |
|                                                      [+ Nuevo]   |
+------------------------------------------------------------------+
|                                                                   |
| +-----------------------------+  +-----------------------------+  |
| | LEVANTAMIENTO CITOLAB 2026  |  | DIAGNOSTICO AREA LOGIST... |  |
| |                             |  |                             |  |
| | [En Entrevistas] ......60% |  | [Completado] ..........100% |  |
| | ===========================.|  | =============================|  |
| |                             |  |                             |  |
| | 8 de 12 entrevistas         |  | 5 de 5 entrevistas          |  |
| | Inicio: 15 ene 2026         |  | Inicio: 01 dic 2025         |  |
| | Ult. actividad: hace 2h     |  | Fin: 28 feb 2026            |  |
| |                             |  |                             |  |
| | [Config] [Entrev] [Anal]    |  | [Config] [Entrev] [Anal]    |  |
| |    *       *                |  |    *       *       *        |  |
| | [Diagn] [Plan]              |  | [Diagn] [Plan]              |  |
| |                             |  |    *       *                |  |
| +-----------------------------+  +-----------------------------+  |
|                                                                   |
```

**Cada card de proyecto muestra:**
- Nombre del proyecto (titulo, font-semibold, text-base)
- Badge de estado: "Configuracion" (gray), "En Entrevistas" (blue), "En Analisis" (amber), "Diagnostico" (purple), "Plan de Accion" (green), "Completado" (green solid)
- Barra de progreso (componente Progress existente)
- Conteo de entrevistas: "X de Y entrevistas"
- Fecha de inicio y ultima actividad
- Mini-stepper de etapas (5 circulos con lineas, los completados estan filled)

**Card vacia (zero state):**
```
+-----------------------------+
|   [icono clipboard + lupa]  |
|                             |
|  Crea tu primer proyecto    |
|  de mejora continua         |
|                             |
|     [Crear proyecto]        |
+-----------------------------+
```

#### 2.3 Creacion de Proyecto: Modal, no wizard

**Propuesta:** Dialog modal (componente Dialog existente) para crear un nuevo proyecto. NO un wizard multi-paso.

**Justificacion:** Para crear el proyecto solo se necesita informacion basica (nombre, descripcion, empresa). La configuracion detallada (entrevistas, participantes) se hace DENTRO del proyecto una vez creado. Un wizard impondria un flujo lineal cuando el usuario puede querer crear el proyecto rapido y configurarlo despues.

```
+------------------------------------------+
|  Nuevo Proyecto                     [X]  |
|                                          |
|  Nombre del proyecto *                   |
|  [Levantamiento Citolab 2026         ]   |
|                                          |
|  Descripcion                             |
|  [Diagnostico organizacional completo ]  |
|  [de Citolab para identificar...     ]   |
|                                          |
|  Empresa / Organizacion *                |
|  [Citolab                     v]         |
|                                          |
|  Fecha estimada de inicio                |
|  [2026-01-15                         ]   |
|                                          |
|           [Cancelar]  [Crear proyecto]   |
+------------------------------------------+
```

**Campos:**
- Nombre (obligatorio, text input)
- Descripcion (opcional, textarea)
- Empresa/Organizacion (obligatorio, combobox con autocompletado)
- Fecha estimada de inicio (opcional, date picker)

**Despues de crear:** Redireccion a la pagina del proyecto en la etapa de Configuracion.

#### 2.4 Dashboard del Proyecto (`/org-intelligence/projects/[id]`)

**Layout:** Header fijo con info del proyecto + tabs de etapas como navegacion principal.

```
+------------------------------------------------------------------+
| <- Proyectos / Levantamiento Citolab 2026                        |
+------------------------------------------------------------------+
| LEVANTAMIENTO CITOLAB 2026                    [En Entrevistas]   |
| Citolab | Iniciado 15 ene 2026                                   |
|                                                                   |
| [Config.] [Entrevistas] [Analisis] [Diagnostico] [Plan Accion]  |
|              ~active~                                             |
+------------------------------------------------------------------+
|                                                                   |
|  (Contenido de la tab activa)                                    |
|                                                                   |
+------------------------------------------------------------------+
```

**Header del proyecto (sticky):**
- Breadcrumb: Inteligencia Org. > Proyectos > [Nombre del proyecto]
- Nombre del proyecto (h1, text-xl font-semibold)
- Badge de estado actual (mismos colores que en la lista)
- Empresa y fecha de inicio
- Tabs de las 5 etapas como navegacion principal

**Navegacion por tabs (NO sidebar interna):**

Justificacion: Las etapas son secuenciales y mutuamente exclusivas en cuanto a foco. Tabs horizontales permiten ver todas las etapas de un vistazo y navegar libremente entre ellas. Una sidebar interna como la del Assistant seria excesiva para 5 items fijos. Breadcrumbs solos no muestran el contexto de "en que etapa estoy".

Las tabs NO bloquean navegacion. Un usuario puede ver el Diagnostico aunque este en fase de Entrevistas (veria contenido parcial o placeholder "Aun no hay datos suficientes para generar el diagnostico").

---

### 3. Contenido de Cada Tab del Proyecto

#### 3.1 Tab: Configuracion

Informacion general del proyecto y su contexto organizacional.

```
+------------------------------------------------------------------+
| INFORMACION DEL PROYECTO                                          |
+------------------------------------------------------------------+
| Nombre:        [Levantamiento Citolab 2026              ]        |
| Descripcion:   [Diagnostico organizacional completo...  ]        |
| Empresa:       [Citolab                                 ]        |
| Sector:        [Laboratorio de analisis                 ]        |
| Tamano:        [50-100 colaboradores                  v ]        |
|                                                                   |
| AREAS ORGANIZACIONALES                    [+ Agregar area]       |
| +------------------+------------------+------------------+       |
| | Gerencia General | Logistica        | Calidad          |       |
| | 2 entrevistas    | 3 entrevistas    | 2 entrevistas    |       |
| +------------------+------------------+------------------+       |
| | Comercial        | Administracion   |                  |       |
| | 2 entrevistas    | 3 entrevistas    |                  |       |
| +------------------+------------------+------------------+       |
|                                                                   |
| CONTEXTO PARA LA IA                                              |
| [Textarea para contexto adicional que la IA deberia conocer     ]|
| [sobre la organizacion antes de procesar entrevistas...         ]|
|                                                                   |
|                                          [Guardar cambios]       |
+------------------------------------------------------------------+
```

**Proposito:** Dar contexto al pipeline de IA. Las areas configuradas aqui se usan para (a) asignar entrevistados a areas, (b) filtrar en el knowledge graph, (c) generar resumenes por area.

#### 3.2 Tab: Entrevistas (la mas compleja)

**Vista principal:** Lista de entrevistas con estado de cada una.

```
+------------------------------------------------------------------+
| ENTREVISTAS                            [+ Nueva entrevista]      |
| 8 de 12 planificadas                                            |
+------------------------------------------------------------------+
|                                                                   |
| +--------------------------------------------------------------+ |
| | [=] Juan Martinez - Jefe de Logistica                        | |
| |     Area: Logistica | 28 mar 2026, 75 min                   | |
| |     [Completado] Transcrito, 47 entidades extraidas          | |
| |                                                   [Ver ->]   | |
| +--------------------------------------------------------------+ |
|                                                                   |
| +--------------------------------------------------------------+ |
| | [~] Maria Lopez - Gerente de Calidad                         | |
| |     Area: Calidad | 27 mar 2026, 62 min                     | |
| |     [Procesando] Extrayendo entidades... (Pasada 3 de 5)     | |
| |     [============================............]  75%          | |
| |                                                   [Ver ->]   | |
| +--------------------------------------------------------------+ |
|                                                                   |
| +--------------------------------------------------------------+ |
| | [^] Pedro Gonzalez - Director Comercial                      | |
| |     Area: Comercial | Pendiente de audio                     | |
| |     [Pendiente]                                              | |
| |                                          [Subir audio]       | |
| +--------------------------------------------------------------+ |
|                                                                   |
| +--------------------------------------------------------------+ |
| | [o] Sofia Reyes - Jefa de Administracion                     | |
| |     Area: Administracion | Programada 02 abr 2026            | |
| |     [Programada]                                             | |
| +--------------------------------------------------------------+ |
|                                                                   |
```

**Estados de una entrevista:**
1. **Programada** (gris) - Tiene fecha pero no se ha realizado
2. **Pendiente de audio** (amber) - Realizada pero sin audio subido
3. **Subiendo** (blue) - Upload en progreso
4. **Transcribiendo** (blue pulsante) - STT en proceso
5. **Extrayendo** (blue con progreso) - Pipeline de extraccion (muestra pasada X de 5)
6. **En revision** (purple) - Procesado, esperando validacion humana
7. **Completado** (green) - Todo validado
8. **Error** (red) - Fallo en algun paso

#### 3.3 Crear/Configurar Entrevista

**Propuesta:** Modal para crear, pagina completa para ver/editar.

**Modal de creacion:**
```
+------------------------------------------+
|  Nueva Entrevista                   [X]  |
|                                          |
|  Entrevistado/a *                        |
|  [Pedro Gonzalez                     ]   |
|                                          |
|  Cargo / Rol *                           |
|  [Director Comercial                 ]   |
|                                          |
|  Area *                                  |
|  [Comercial                        v ]   |
|  (lista de areas configuradas)           |
|                                          |
|  Fecha de la entrevista                  |
|  [2026-04-02                         ]   |
|                                          |
|  Notas / Contexto                        |
|  [Enfocarse en proceso de ventas y   ]   |
|  [coordinacion con logistica         ]   |
|                                          |
|        [Cancelar]  [Crear entrevista]    |
+------------------------------------------+
```

#### 3.4 Pagina de Detalle de Entrevista (`/org-intelligence/projects/[id]/interviews/[iid]`)

Esta es la pagina mas rica en interaccion. Contiene varias secciones que se revelan progresivamente conforme avanza el procesamiento.

**Layout:** Pagina completa con secciones verticales. NO tabs (porque el contenido se consume en secuencia y conviene ver todo junto al hacer scroll).

```
+------------------------------------------------------------------+
| <- Entrevistas / Juan Martinez                                    |
+------------------------------------------------------------------+
| JUAN MARTINEZ                                                     |
| Jefe de Logistica | Area: Logistica                             |
| 28 mar 2026 | 75 min                                            |
| [Completado]                                                     |
+------------------------------------------------------------------+
|                                                                   |
| AUDIO Y TRANSCRIPCION                                            |
| +--------------------------------------------------------------+ |
| | [|<] [>] [>|]   00:00 / 01:15:32   [1x v]  [Descargar]      | |
| | [===============================...........................] | |
| +--------------------------------------------------------------+ |
|                                                                   |
| +--------------------------------------------------------------+ |
| | Entrevistador  00:00                                         | |
| | Buenos dias Juan, gracias por participar en esta              | |
| | entrevista. Vamos a hablar sobre como funciona el             | |
| | area de logistica...                                          | |
| |                                                               | |
| | Juan Martinez  00:45                                          | |
| | Claro, mira, nosotros en logistica basicamente nos            | |
| | encargamos de todo lo que es recepcion de muestras,           | |
| | distribucion interna y despacho de resultados...              | |
| |                                                               | |
| | Entrevistador  02:12                                          | |
| | Puedes describir el proceso de recepcion de muestras?         | |
| |                                                               | |
| | Juan Martinez  02:20   <-- RESALTADO (audio sincronizado)     | |
| | Si, cuando llega una muestra primero se registra en           | |
| | el sistema, que es un Excel...                                | |
| +--------------------------------------------------------------+ |
|                                                                   |
| ENTIDADES EXTRAIDAS                         [12 por revisar]    |
| +--------------------------------------------------------------+ |
| | Roles (5)                                                     | |
| |   [v] Jefe de Logistica         conf: 0.95  [Aprobar]       | |
| |   [v] Asistente de Logistica    conf: 0.90  [Aprobar]       | |
| |   [?] Coordinador de Muestras   conf: 0.55  [Editar][Rech]  | |
| |                                                               | |
| | Procesos (3)                                                  | |
| |   [v] Recepcion de Muestras     conf: 0.92  [Aprobar]       | |
| |   [v] Distribucion Interna      conf: 0.88  [Aprobar]       | |
| |   [v] Despacho de Resultados    conf: 0.85  [Aprobar]       | |
| |                                                               | |
| | Sistemas (2)                                                  | |
| |   [!] "Excel de registro"       conf: 0.70  [Editar][Rech]  | |
| |   [v] Sistema LIMS              conf: 0.95  [Aprobar]       | |
| |                                                               | |
| | Problemas (4)                                                 | |
| |   [!] Registro manual en Excel  sev: HIGH   [Editar][Rech]  | |
| |       "...es un Excel que a veces se pierde..."              | |
| |   [!] Demora en despacho        sev: MEDIUM [Editar][Rech]  | |
| |       "...a veces nos demoramos una semana..."               | |
| +--------------------------------------------------------------+ |
|                                                                   |
| DIAGRAMAS DE PROCESOS                                            |
| +--------------------------------------------------------------+ |
| | Recepcion de Muestras                          [Expandir]    | |
| |   (Mermaid flowchart renderizado como SVG)                    | |
| |   [Muestra llega] --> [Registro en Excel] --> [Asignacion]   | |
| |   --> [Analisis] --> [Resultado] --> [Despacho]               | |
| +--------------------------------------------------------------+ |
| +--------------------------------------------------------------+ |
| | Distribucion Interna                           [Expandir]    | |
| |   (Mermaid flowchart)                                         | |
| +--------------------------------------------------------------+ |
|                                                                   |
```

#### 3.5 Subida de Audio: Drag & Drop con Progress

**Interaccion:** Dentro de la pagina de detalle de entrevista, si no hay audio subido, la seccion de audio muestra una zona de drop.

```
+--------------------------------------------------------------+
| AUDIO                                                         |
|                                                               |
| +----------------------------------------------------------+ |
| |                                                          | |
| |     [icono de microfono/upload]                          | |
| |                                                          | |
| |     Arrastra el archivo de audio aqui                    | |
| |     o haz click para seleccionar                         | |
| |                                                          | |
| |     Formatos: MP3, WAV, M4A, OGG                        | |
| |     Maximo: 500 MB                                       | |
| |                                                          | |
| +----------------------------------------------------------+ |
|                                                               |
+--------------------------------------------------------------+
```

**Mientras sube:**
```
+--------------------------------------------------------------+
| AUDIO                                                         |
|                                                               |
| entrevista-juan-martinez.mp3                                  |
| 145 MB de 230 MB                                              |
| [=================================..................]  63%    |
| Subiendo... 2.3 MB/s | ~37s restantes                        |
|                                            [Cancelar]         |
+--------------------------------------------------------------+
```

**Despues de subir, pipeline en progreso:**
```
+--------------------------------------------------------------+
| PROCESAMIENTO                                                 |
|                                                               |
| (1) Subir audio              [=====] Completado              |
| (2) Transcribir              [=====] Completado   (2m 15s)   |
| (3) Identificar hablantes    [=====] Completado              |
| (4) Extraer entidades        [===..] En progreso  Pasada 3/5 |
| (5) Generar diagramas        [.....] Pendiente               |
| (6) Generar resumen          [.....] Pendiente               |
|                                                               |
| Tiempo estimado restante: ~1 min 30s                          |
+--------------------------------------------------------------+
```

El step tracker usa circulos conectados por lineas (patron vertical). Cada paso tiene tres estados visuales:
- Completado: circulo filled (primary), linea solida, texto normal con duracion
- En progreso: circulo con borde pulsante (animated ring), texto bold, sub-detalle (ej: "Pasada 3/5")
- Pendiente: circulo vacio (muted), linea punteada, texto muted

#### 3.6 Audio Sincronizado con Transcripcion

**Interaccion clave:** Click en cualquier segmento de transcripcion salta el reproductor de audio a ese timestamp. El segmento actual se resalta con un fondo sutil (`bg-primary/5` o `bg-accent/10`).

**Reproductor de audio (componente sticky dentro de la seccion):**
```
+--------------------------------------------------------------+
| [|<] [ > ] [>|]  12:45 / 01:15:32   [1x]  [Descargar]       |
| [===========|...........................................]     |
+--------------------------------------------------------------+
```

- Controles: retroceder 15s, play/pause, avanzar 15s
- Barra de progreso clickeable para saltar
- Selector de velocidad: 0.75x, 1x, 1.25x, 1.5x, 2x
- Boton de descarga del audio original

**Transcripcion:**
- Cada segmento de hablante es un bloque con:
  - Nombre del hablante (bold) + timestamp clickeable (text-muted-foreground, monospace)
  - Texto de lo que dijo (text-sm, leading-relaxed)
- El segmento activo (sincronizado con el audio) tiene `bg-primary/5` y un borde izquierdo `border-l-2 border-primary`
- Scroll automatico al segmento activo cuando el audio avanza (con smooth scrolling)
- Click en timestamp salta el audio a esa posicion

#### 3.7 Review Queue de Entidades Extraidas

**Diseno de interaccion:** Las entidades se agrupan por tipo (Roles, Procesos, Sistemas, Problemas, Dependencias). Cada grupo es un collapsible.

**Cada entidad muestra:**
```
+--------------------------------------------------------------+
| [icono tipo] Nombre de la entidad                             |
| Descripcion extraida por la IA                                |
| Confianza: [=======...] 0.72                                 |
| Fuente: "...cita textual de la entrevista..." [00:12:45]     |
|                                                               |
|           [Rechazar]  [Editar]  [Aprobar]                    |
+--------------------------------------------------------------+
```

**Indicador visual de confianza:**
- >= 0.8: punto verde, se muestra pero no requiere accion urgente
- 0.5 - 0.8: punto amber, marcado para revision
- < 0.5: punto rojo, requiere atencion obligatoria

**Acciones:**
- **Aprobar:** Confirma la entidad. El badge cambia a "Aprobado" (green). Se ingresa al Knowledge Graph como confirmada.
- **Editar:** Abre un dialog inline donde el usuario puede corregir nombre, descripcion, tipo, o las relaciones detectadas. Al guardar se actualiza la entidad y se re-aprueba.
- **Rechazar:** Marca la entidad como falso positivo. Se elimina del Knowledge Graph. Boton de "deshacer" disponible por 10 segundos.
- **Aprobar todo (alta confianza):** Boton superior que aprueba en bulk todas las entidades con confianza >= 0.8.

**Al hacer click en la cita textual `[00:12:45]`:** El reproductor de audio salta a esa posicion y el segmento correspondiente de la transcripcion se resalta. Esto permite al revisor verificar rapidamente lo que dijo el entrevistado.

---

### 4. Tab: Analisis (conecta con ux-knowledge y ux-diagrams)

```
+------------------------------------------------------------------+
| ANALISIS CRUZADO                                                  |
+------------------------------------------------------------------+
|                                                                   |
| Resumen del proyecto                                             |
| +--------------------------------------------------------------+ |
| | Se han procesado 8 entrevistas de 5 areas. Se identificaron  | |
| | 47 entidades, 23 procesos, 12 problemas y 8 dependencias    | |
| | criticas. 3 conflictos requieren resolucion.                 | |
| +--------------------------------------------------------------+ |
|                                                                   |
| CONFLICTOS DETECTADOS (3)                    [Resolver todos]   |
| +--------------------------------------------------------------+ |
| | [!] Duracion del proceso de despacho                         | |
| |     Juan Martinez (Logistica): "2 dias"                      | |
| |     Pedro Gonzalez (Comercial): "una semana"                 | |
| |     Tipo: FACTUAL | Requiere verificacion                    | |
| |                                           [Resolver ->]      | |
| +--------------------------------------------------------------+ |
| +--------------------------------------------------------------+ |
| | [!] Responsable de aprobacion de compras                     | |
| |     ...                                                      | |
| +--------------------------------------------------------------+ |
|                                                                   |
| ENTIDADES POR AREA                                               |
| (Vista de cards o tabla expandible por area con conteo de         |
|  roles, procesos, sistemas, problemas por area)                  |
|                                                                   |
| KNOWLEDGE GRAPH (preview)                                        |
| (Visualizacion Mermaid estatica del grafo simplificado           |
|  con link a "Explorar en Knowledge Base ->")                     |
|                                                                   |
+------------------------------------------------------------------+
```

**Mensaje para ux-knowledge:** La tab de Analisis es donde el usuario ve el primer resumen de lo que la IA encontro. Desde aqui, el link "Explorar en Knowledge Base" lleva a `/org-intelligence/knowledge-base?project=[id]`, que es tu territorio. Necesito que me digas como quieres que sea la transicion: el usuario llega con el proyecto pre-filtrado? O llega a una vista general y filtra manualmente?

**Mensaje para ux-diagrams:** Los diagramas de procesos se generan POR ENTREVISTA (en la tab de detalle de entrevista) pero TAMBIEN se muestran de forma consolidada aqui en Analisis. La pregunta es: en Analisis mostramos los diagramas ya reconciliados (fusionados de multiples entrevistas) o mostramos lado a lado los de cada entrevista para que el usuario compare? Propongo: diagrama reconciliado como principal, con opcion de "Ver versiones por entrevista" en un drawer lateral.

---

### 5. Tab: Diagnostico (conecta con ux-dashboard)

```
+------------------------------------------------------------------+
| DIAGNOSTICO                                                       |
+------------------------------------------------------------------+
|                                                                   |
| +--------------------------------------------------------------+ |
| | RESUMEN EJECUTIVO                          [Regenerar]       | |
| |                                                               | |
| | El levantamiento de Citolab revela una organizacion con      | |
| | conocimiento altamente concentrado en personas clave.         | |
| | Se identificaron 12 problemas, de los cuales 3 son criticos  | |
| | y afectan transversalmente a 4 areas...                      | |
| |                                            [Leer completo]   | |
| +--------------------------------------------------------------+ |
|                                                                   |
| HALLAZGOS PRINCIPALES                                            |
|                                                                   |
| Cuellos de Botella (3)                                           |
| +--------------------------------------------------------------+ |
| | [!] Jefe de Logistica - Punto unico de fallo                 | |
| |     Betweenness centrality: 0.82 | Presente en 15 procesos  | |
| |     Tipo: HECHO (conf. 0.92)                                | |
| |     Fuente: 4 entrevistas                                   | |
| +--------------------------------------------------------------+ |
|                                                                   |
| Contradicciones No Resueltas (1)                                 |
| +--------------------------------------------------------------+ |
| | [?] Duracion del proceso de despacho                         | |
| |     Rango: 2 dias a 1 semana                                | |
| |     Tipo: FACTUAL | Sin resolver                             | |
| +--------------------------------------------------------------+ |
|                                                                   |
| METRICAS DE COMPLEJIDAD                                          |
| +-------------------+-------------------+-------------------+    |
| | Procesos totales  | Handoffs prom.    | Sistemas usados   |    |
| |       23          |      4.2          |       8           |    |
| +-------------------+-------------------+-------------------+    |
|                                                                   |
+------------------------------------------------------------------+
```

**Mensaje para ux-dashboard:** El Diagnostico es el punto de inflexion donde el usuario pasa de "recopilar informacion" a "tomar decisiones". Desde aqui el flujo natural es: ver hallazgos -> entender impacto -> ir al Plan de Accion. Necesito que me digas como quieres manejar la transicion. Mi propuesta: cada hallazgo del diagnostico tiene un boton "Crear mejora" que pre-llena una iniciativa en el Plan de Accion con el contexto del problema.

---

### 6. Tab: Plan de Accion

```
+------------------------------------------------------------------+
| PLAN DE ACCION                                                    |
+------------------------------------------------------------------+
|                                                                   |
| Vista: [Tabla] [Matriz]                   [+ Nueva iniciativa]  |
|                                                                   |
| MATRIZ ESFUERZO-IMPACTO                                          |
| +--------------------------------------------------------------+ |
| |  Alto    | Quick Wins       | Estrategicos                   | |
| |  impacto | (3 iniciativas)  | (2 iniciativas)                | |
| |          |   * * *          |   * *                          | |
| |----------+------------------+--------------------------------| |
| |  Bajo    | Si hay tiempo    | Descartar                      | |
| |  impacto | (1 iniciativa)   | (0)                            | |
| |          |   *              |                                | |
| |          | Bajo esfuerzo    | Alto esfuerzo                  | |
| +--------------------------------------------------------------+ |
|                                                                   |
| INICIATIVAS PRIORIZADAS (RICE)                                   |
| +------+-----------------------------+------+--------+---------+ |
| | #    | Iniciativa                  | RICE | Estado | Plazo   | |
| +------+-----------------------------+------+--------+---------+ |
| | 1    | Digitalizar registro de     | 84   | [Prop.] | Corto  | |
| |      | muestras (reemplazar Excel) |      |        |        | |
| +------+-----------------------------+------+--------+---------+ |
| | 2    | Documentar proceso de       | 72   | [Prop.] | Corto  | |
| |      | despacho                    |      |        |        | |
| +------+-----------------------------+------+--------+---------+ |
| | 3    | Cross-training en area      | 65   | [Prop.] | Medio  | |
| |      | logistica (reducir SPOF)    |      |        |        | |
| +------+-----------------------------+------+--------+---------+ |
|                                                                   |
|                              [Exportar PDF]  [Exportar Excel]    |
+------------------------------------------------------------------+
```

**Cada iniciativa tiene un detalle expandible:**
- Problema que aborda (link al diagnostico)
- Descripcion de la mejora propuesta
- Scores RICE con justificacion de la IA (editables por el usuario)
- Areas/procesos impactados (links al knowledge graph)
- Plazo: Corto (<1 mes), Medio (1-3 meses), Largo (3+ meses)
- Estado: Propuesta -> Aprobada -> En ejecucion -> Completada
- Responsable sugerido

---

### 7. Resumen de Flujo Completo del Usuario

```
[Crear proyecto] --> [Configurar areas] --> [Crear entrevistas]
                                                    |
                                                    v
                                           [Realizar entrevista]
                                                    |
                                                    v
                                           [Subir audio]
                                                    |
                                                    v
                                           [Pipeline automatico]
                                           Transcribir -> Extraer
                                           -> Generar diagramas
                                                    |
                                                    v
                                           [Revisar entidades]
                                           Aprobar / Editar / Rechazar
                                                    |
                                                    v
                                    (repetir para cada entrevista)
                                                    |
                                                    v
                                           [Analisis cruzado]
                                           Conflictos, Knowledge Graph
                                                    |
                                                    v
                                           [Diagnostico]
                                           Hallazgos, SPOF, metricas
                                                    |
                                                    v
                                           [Plan de accion]
                                           Iniciativas RICE, roadmap
```

---

### 8. Componentes Nuevos Requeridos

Componentes shadcn/ui que habria que instalar o construir:

| Componente | Uso | Existe en shadcn? |
|---|---|---|
| Tabs | Navegacion de etapas del proyecto | SI (instalar) |
| Stepper / Timeline | Pipeline de procesamiento | NO (construir custom) |
| File Upload / Dropzone | Subir audio | NO (construir con react-dropzone) |
| Audio Player | Reproductor sincronizado | NO (construir con HTML5 Audio API) |
| Data Table | Lista de entrevistas, entidades | SI (instalar, Tanstack Table) |
| Tooltip + Popover | Detalles de confianza, citas | SI (ya existe Tooltip) |
| Toast / Sonner | Notificaciones de procesamiento | Instalar Sonner |
| Resizable Panels | Transcripcion + review side by side | SI (instalar) |

---

### 9. Puntos de Debate para los otros UX experts

#### Para ux-knowledge:

1. **Navegacion entrevista -> knowledge graph:** Cuando el usuario aprueba una entidad en la review queue de una entrevista, esa entidad aparece en el Knowledge Graph. Propongo que al aprobar, haya un link "Ver en Knowledge Base" que lleve directamente al nodo en el grafo. Esto requiere deep linking al KG explorer con un nodo pre-seleccionado. Es viable?

2. **Filtrado por proyecto:** El Knowledge Base (`/org-intelligence/knowledge-base`) deberia poder filtrarse por proyecto. Un usuario con 3 proyectos necesita ver solo las entidades de uno a la vez. Propongo un selector de proyecto en la parte superior del KG explorer.

3. **Busqueda semantica desde entrevista:** En la transcripcion, el usuario deberia poder seleccionar texto y hacer "Buscar en Knowledge Base" para encontrar entidades relacionadas. Esto conectaria tu busqueda semantica con mi interfaz de transcripcion.

#### Para ux-diagrams:

1. **Diagramas por entrevista vs consolidados:** En la tab de detalle de entrevista muestro diagramas generados de ESA entrevista especifica. En la tab de Analisis muestro diagramas consolidados de multiples entrevistas. Necesito que definas como se ve la "vista comparativa" cuando dos entrevistas describen el mismo proceso de forma diferente.

2. **Edicion de diagramas:** Cuando el usuario ve un diagrama en la entrevista y quiere corregir algo, como es la interaccion? Propongo: click en un nodo del diagrama abre un panel de edicion lateral. Pero esto implica React Flow desde Fase 1, no Mermaid. Alternativa: solo "Reportar error" que agrega una nota al diagrama para correccion posterior.

3. **Diagrama como evidencia:** En el Diagnostico, los hallazgos deberian poder tener un diagrama embebido como evidencia visual ("Este es el proceso que presenta el cuello de botella"). Esto requiere que los diagramas sean referenciables por ID y embebibles en otras vistas.

#### Para ux-dashboard:

1. **Transicion diagnostico -> plan de accion:** Propongo que cada hallazgo del diagnostico tenga un boton "Crear iniciativa" que cree una entrada en el Plan de Accion pre-llenada con: el problema, las areas afectadas, y un score RICE sugerido por la IA. El usuario valida y ajusta. Es un buen flujo?

2. **Dashboard general vs dashboard de proyecto:** El dashboard principal de Zeru (`/dashboard`) deberia tener un widget/card que muestre el estado de los proyectos activos? Algo como "Proyectos activos: 1 | Entrevistas esta semana: 3 | Items por revisar: 12". Esto conectaria el dashboard general con el modulo de inteligencia organizacional.

3. **Exportacion del plan de accion:** El plan de accion es el entregable final que se presenta al directorio. Necesito definir el formato de exportacion: PDF con branding? Excel con datos? Ambos? El PDF deberia incluir los diagramas Mermaid renderizados como imagenes.

---

## UX-2: Knowledge Graph Explorer, Exploracion de Entidades y Busqueda Semantica

**Autor:** UX-2 (Experto en Visualizacion de Conocimiento y Knowledge Graph)
**Fecha:** 2026-03-28
**Base:** Hallazgos consensuados en `org-intelligence-findings.md` + analisis de UI actual de Zeru + propuestas de UX-1

---

### 1. Analisis de la UI Actual (Perspectiva Knowledge Graph)

#### 1.1 Inventario de componentes reutilizables para el grafo

Zeru usa Next.js con shadcn/ui y Tailwind CSS. Sistema visual sobre variables CSS oklch, tema teal/cyan como primario (`--primary: oklch(0.60 0.10 185)` light, `oklch(0.70 0.12 183)` dark). Radios sutiles (`0.45rem`).

**Componentes existentes reutilizables:**
- `TokenMeter`: Gauge con popover expandible — reutilizable para metricas de confianza.
- `ConversationsSidebar`: Lista con estados, badges, eliminacion inline — aplicable a listas de entidades.
- `PostPreviewCard`: Cards con badges de estado y acciones — aplicable a cards de entidades/problemas.
- `VersionHistoryPopover`: Historial de versiones en popover — directamente reutilizable para SCD Type 2.

**Oportunidades:** Sidebar collapsible + Inset permite layouts multi-panel. Card + Badge soportan tipos con colores. Combobox existe para autocompletado. Sistema oklch permite colores semanticos por tipo de entidad.

**Restricciones:** No hay visualizacion de grafos, ni tabla de datos avanzada, ni Command palette (Cmd+K), ni layout master-detail con paneles resizables.

#### 1.2 Componentes nuevos requeridos

| Componente | Uso | Libreria |
|---|---|---|
| Graph canvas | KG explorer | React Flow (`@xyflow/react`) MVP, Cytoscape.js Fase 3 |
| DataTable | Lista de entidades, problemas | shadcn `Table` + TanStack Table |
| Command palette | Busqueda semantica global (Cmd+K) | shadcn `Command` (cmdk) |
| Tabs | Detail panel, ficha de entidad | shadcn `Tabs` |
| Resizable panels | Layout grafo + detail panel | shadcn `ResizablePanelGroup` |
| Slider | Filtro de confianza | shadcn `Slider` |
| HoverCard | Preview rapido en hover de nodo | shadcn `HoverCard` |
| Sonner | Feedback de acciones | shadcn `Sonner` |
| ToggleGroup | Chips filtro por tipo entidad | shadcn `ToggleGroup` |
| ScrollArea | Scroll en paneles | shadcn `ScrollArea` |

---

### 2. Knowledge Graph Explorer — Diseno de Experiencia

#### 2.1 Modelo mental del usuario

El consultor organizacional quiere:
1. **VER** la organizacion como mapa — entender estructura.
2. **ENCONTRAR** patrones — dependencias, problemas.
3. **EXPLORAR** relaciones — seguir caminos.
4. **VALIDAR** hallazgos de IA.
5. **COMUNICAR** resultados al cliente.

El grafo NO es decorativo. Es **herramienta de analisis**. Cada interaccion debe producir insight.

#### 2.2 Layout: Three-Panel Explorer

```
+------------------------------------------------------------------+
| [Sidebar Zeru]  |  Knowledge Graph Explorer                      |
|                 |                                                 |
| Inteligencia    |  +-- Toolbar ----------------------------------+|
|   Org           |  | [Search...        ] [Filtros v] [Layout v] ||
|  > Proyectos    |  | [Dept] [Role] [Process] [System] [Problem] ||
|  > Entrevistas  |  +--------------------------------------------+|
|  > Knowledge    |                                                 |
|    Graph  <--   |  +-- Graph Canvas ---+  +-- Detail Panel ------+|
|  > Problemas    |  |                   |  | [x] Proceso: Compras |
|  > Mejoras      |  |   (nodos y        |  | Tipo: PROCESS        |
|                 |  |    aristas         |  | Confianza: 0.85      |
|  Contabilidad   |  |    interactivos)   |  | Fuente: Entrev. #3   |
|  Marketing      |  |                   |  |                      |
|                 |  |                   |  | -- Relaciones --     |
|                 |  |                   |  | > Contiene: 8 activ. |
|                 |  |                   |  | > Usa: SAP, Excel    |
|                 |  |                   |  | > Dueno: Jefe Logist.|
|                 |  |                   |  | -- Problemas --      |
|                 |  |                   |  | ! Demora 3 dias      |
|                 |  |                   |  | -- Evidencia --      |
|                 |  |                   |  | "Siempre nos atras..."|
|                 |  |                   |  | [> Ir al audio 12:34]|
|                 |  +-------------------+  +----------------------+|
|                 |  47 nodos | 83 aristas | Filtro: Logistica     |
+------------------------------------------------------------------+
```

**Comportamiento:**
- Detail panel se abre al seleccionar nodo (ResizablePanelGroup). Sin seleccion: canvas full width.
- Proporcion default: 65% grafo / 35% detail. Resizable.
- Mobile: detail panel como Sheet desde abajo (bottom sheet).
- Panel colapsable con toggle.

#### 2.3 Toolbar y filtros

**Busqueda (Command/Combobox):** Placeholder "Buscar entidades, procesos, problemas...". Autocompletado por tipo. Al seleccionar: zoom + center + abrir detail. Busqueda semantica por embeddings.

**Filtros por tipo (toggle chips):** Fila de chips con icono+nombre+conteo por tipo. Colores fijos. Toggle visibilidad. Multiple seleccion.

**Paleta de colores por tipo de entidad (consistente en TODO el modulo):**

| Tipo | Color light | Color dark | Icono Hugeicons |
|---|---|---|---|
| Organization | slate-500 | slate-400 | `Building06Icon` |
| Department | blue-500 | blue-400 | `UserMultipleIcon` |
| Role | indigo-500 | indigo-400 | `UserIcon` |
| Process | emerald-500 | emerald-400 | `ArrowTurnDownIcon` |
| Activity | teal-500 | teal-400 | `CheckListIcon` |
| System | amber-500 | amber-400 | `HardDriveIcon` |
| Document | orange-500 | orange-400 | `File02Icon` |
| Problem | red-500 | red-400 | `Alert02Icon` |
| Improvement | green-500 | green-400 | `LightBulb02Icon` |

**Filtro de confianza (Slider):** Rango 0-1. Default 0. Al subir: nodos con confidence menor se atenuan (opacity 0.2). Indicador: rojo (0-0.4 hipotesis), amarillo (0.4-0.8 inferencia), verde (0.8-1.0 hecho).

**Selector de layout (Dropdown):**
- **Force-directed** (default): exploracion libre.
- **Jerarquico top-down**: estructura org.
- **Agrupado por departamento**: nodos clustered.
- **Radial**: centrado en nodo seleccionado.

**Filtro por departamento:** Dropdown multi-select. Al filtrar, nodos inter-departamento aparecen atenuados (no se pierden conexiones cross-area).

**Selector de proyecto:** En toolbar, consistente con UX-1. Query param `?project=[id]`.

#### 2.4 Graph Canvas — Interacciones

**Nodos:**
- Rectangulo redondeado con icono tipo + nombre.
- Tamano proporcional al grado (mas conexiones = mas grande).
- Borde: 2px color del tipo. Fondo: blanco/card con tinte sutil.
- Badge confianza: dot sup-der (verde >0.8, amarillo 0.4-0.8, rojo <0.4).
- Badge problemas: icono alerta roja con conteo inf-der.

**Aristas:**
- Linea con flecha. Grosor proporcional a confianza (1-3px).
- Color: gris-400 default, color tipo al hover/select.
- Label: tipo relacion, visible solo zoom >= 80%.
- Solida (conf >0.7) o punteada (conf <0.7).

**Interacciones:**

| Accion | Input | Comportamiento |
|---|---|---|
| Zoom | Scroll/Pinch | Semantico: zoom bajo = clusters; zoom alto = labels/badges |
| Pan | Drag espacio vacio | Mueve viewport |
| Select nodo | Click | Detail panel. Nodo resaltado + glow. Vecinos highlighted. Resto atenuado |
| Select arista | Click arista | Detail con tipo, confianza, evidencia |
| Multi-select | Shift+click / drag rect | Resumen subgrafo |
| Hover | Mouse over 300ms | HoverCard: tipo, nombre, # relaciones, confianza |
| Doble-click | Double click | Navega ficha entidad |
| Right-click | Context menu | "Ver ficha", "Expandir", "Ocultar", "Vincular con...", "Marcar revisado" |
| Drag nodo | Drag directo | Reposicionar (se fija) |
| Fit-to-screen | Toolbar / `F` | Ajusta zoom/pan |
| Reset layout | Toolbar / `R` | Recalcula layout |

**Shortest path:** Con dos nodos seleccionados (Shift+click): "Mostrar camino" resalta el path, atenua resto. Path como lista en detail. Util: "como se conecta finanzas con despacho?"

**Expansion on-demand:** Carga inicial: departamentos + procesos principales (~20-30 nodos). Click nodo: carga vecinos con fade-in. "Expandir todo" con warning si >200 nodos. Right-click > "Colapsar".

#### 2.5 Detail Panel

Se adapta al tipo de entidad. Estructura con tabs:

```
+-- Detail Panel -----------------------------------------------+
| [x cerrar]                                                    |
| [Icono+color] NOMBRE DE LA ENTIDAD                           |
| [Badge tipo] [Badge confianza] [Badge version]                |
|                                                               |
| [Info] [Relaciones] [Problemas] [Evidencia] [Historial]      |
+---------------------------------------------------------------+
```

**Tab Info:** Descripcion + atributos en tabla key-value. Botones: Editar, Ver ficha completa, Vincular.

**Tab Relaciones:** Agrupada por tipo (CONTAINS, USES, DEPENDS_ON...). Cada relacion: icono destino + nombre clickeable (anima grafo) + confianza. "+ Agregar relacion".

**Tab Problemas:** Lista con severidad (badge CRITICAL/HIGH/MEDIUM/LOW). Clickeable. Sin problemas: check verde.

**Tab Evidencia:** Chunks de entrevista. Cita con entidad en bold, hablante+cargo, timestamp `[> 12:34]` (deep link audio), confianza.

**Tab Historial (SCD Type 2):** Timeline vertical de versiones. Fecha, diff, fuente. Version vigente resaltada. "Ver diff", "Restaurar".

**Adaptacion por tipo:**
- PROCESS: tab "Flujo" con mini-Mermaid de actividades.
- ROLE: "Procesos que ejecuta" prominente.
- PROBLEM: "Entidades afectadas" + "Mejoras propuestas".
- SYSTEM: "Procesos que lo usan" prominente.

---

### 3. Exploracion de Entidades — Vista Tabular

#### 3.1 Tabla de entidades

Vista operativa que complementa al grafo exploratorio.

```
+------------------------------------------------------------------+
| Inteligencia Org. > Entidades                     [+ Nueva]      |
|                                                                   |
| [Buscar...      ] [Tipo: Todos v] [Dept: Todos v]               |
| [Confianza >= 0  ------o------] [Estado: Activo v]               |
|                                                                   |
| | Nombre             | Tipo      | Dept.    | Conf.| Fuente | >  |
| |------------------------------------------------------------|    |
| | [emerald] Proc. Compras  | PROCESS  | Logist. | 0.92| #3  | >  |
| | [amber]  SAP WMS         | SYSTEM   | TI      | 0.88| #1  | >  |
| | [indigo] Juan Martinez   | ROLE     | Logist. | 0.95| #3  | >  |
| | [red]    Demora aprobac. | PROBLEM  | Finanz. | 0.70| #5  | >  |
|                                                                   |
| 47 de 128 entidades                    [< 1 2 3 ... 7 >]        |
+------------------------------------------------------------------+
```

- Sortable. Filtros: busqueda, tipo (multi-select colores), departamento, confianza (slider), estado.
- Click fila: ficha entidad. ">": preview en Sheet.
- Bulk actions: checkbox + barra flotante.
- Switch `[Lista] [Grafo]` comparte filtros.
- Dots de color por tipo. Badges confianza. Icono alerta si tiene problemas.

#### 3.2 Ficha de entidad (`/org-intelligence/entities/[id]`)

```
+------------------------------------------------------------------+
| < Volver                                                          |
| [emerald] Proceso de Compras                                     |
| PROCESS | Logistica | Conf: 0.92 (HECHO) | Version 3            |
| [Editar] [Ver en grafo] [Eliminar]                                |
|                                                                   |
| [Descripcion] [Relaciones] [Problemas] [Evidencia] [Historial]  |
|                                                                   |
| Tab Relaciones:                                                   |
| CONTAINS (8): Solicitud compra (0.95), Aprobacion (0.90)...     |
| USES (3): SAP WMS (0.88), Excel (0.95), Email (0.70)            |
| OWNS (1): Jefe de Logistica (0.95)                               |
| DEPENDS_ON (2): P. Presupuesto (0.82), P. Aprobacion (0.70)     |
| [+ Agregar relacion]                                              |
|                                                                   |
| Mini-grafo local (ego graph ~300px):                              |
| [Jefe Log]--OWNS-->[P.Compras]--USES-->[SAP][Excel]             |
|                        |--DEPENDS_ON-->[P.Presupuesto]            |
+------------------------------------------------------------------+
```

**Mini-grafo local:** Entidad central + vecinos directos. Interactivo (click vecino -> su ficha). Read-only. React Flow simplificado. Max ~20 nodos.

**Tab Historial (SCD Type 2):**
```
[vigente] v3 — 22 Mar 2026
|  Duracion: "5 dias" -> "3 dias". Fuente: Entrevista #7
v2 — 18 Mar 2026
|  +Relacion: DEPENDS_ON -> P. Presupuesto. Fuente: Entrevista #5
v1 — 15 Mar 2026
   Creacion inicial. Fuente: Entrevista #3
```
Expandible con diff verde/rojo. Comparar versiones side-by-side. Restaurar crea nueva version.

#### 3.3 Crear/editar entidades

**Formulario (Dialog):** Tipo (select iconos color), Nombre, Descripcion, Departamento, Atributos key-value, Confianza (slider, default 1.0 manual), Estado (ACTIVE/PROPOSED/DEPRECATED). Al guardar: opcion "Vincular con..."

**Edicion:** Pre-populated. Guardar crea nueva version (SCD Type 2). Nota visible sobre versionado.

**Vinculacion:** Desde grafo (drag nodo a nodo -> tipo relacion). Desde ficha (Combobox + tipo). Validacion ontologia (solo tipos validos segun entidades origen/destino).

---

### 4. Busqueda Semantica Avanzada

#### 4.1 Arquitectura

Combina transparentemente: embeddings chunks (RAG) + embeddings entidades (KG) + BM25 (terminos exactos) + traversal grafo (preguntas estructurales). El usuario no distingue fuentes.

#### 4.2 Command Palette (Cmd+K)

**Sin query (estado inicial):**
```
[search] Buscar en la organizacion...                         [ESC]

Recientes:
  "proceso de compras" — hace 2h
  "problemas de logistica" — ayer

Preguntas sugeridas:
  ? Cuales son los procesos mas problematicos?
  ? Que areas dependen del sistema SAP?
  ? Quien es responsable del proceso de despacho?
```

**Con query (autocompletado):**
```
[search] logist|                                              [ESC]

Entidades:
  [blue] Dpto. Logistica (DEPARTMENT)
  [indigo] Jefe de Logistica (ROLE)
  [emerald] Proceso de Despacho (PROCESS)

Fragmentos:
  "...en logistica siempre tenemos el problema..." Ent. #3
  "...la jefatura de logistica se encarga de..." Ent. #5

[Enter] Buscar "logist" en todo el conocimiento
```

#### 4.3 Pagina de resultados (`/org-intelligence/search?q=...`)

Panel izq con filtros (tipo resultado, tipo entidad, entrevista, area, confianza). Panel der con resultados agrupados: entidades primero (con ficha, "ver en grafo"), luego fragmentos (cita resaltada, atribucion, timestamps, botones Play/Ver entrevista/Grafo, barra de relevancia).

#### 4.4 Preguntas sugeridas

Generadas por LLM al completar procesamiento. Tres categorias:
1. **Estructurales** (grafo): "Que depende de [sistema]?", "Que areas tienen mas procesos?"
2. **Diagnosticas** (analisis): "Problemas mas criticos?", "SPOFs?"
3. **Exploratorias** (RAG): "Que se dijo sobre [tema]?", "Contradicciones sobre [proceso]?"

4-6 en search palette vacio y overview. Se regeneran con nuevas entrevistas.

---

### 5. Navegacion y Deep Linking

**URLs del modulo:**

| Ruta | Contenido |
|---|---|
| `/org-intelligence/knowledge-graph` | KG Explorer (canvas) |
| `/org-intelligence/entities` | Tabla entidades |
| `/org-intelligence/entities/[id]` | Ficha entidad |
| `/org-intelligence/problems` | Lista problemas |
| `/org-intelligence/search` | Resultados busqueda |
| `/org-intelligence/conflicts` | Dashboard contradicciones |

**Deep linking:**
- Al grafo con nodo pre-seleccionado: `?selected=[entityId]&zoom=fit`
- A entrevista con timestamp: `?t=754&highlight=[chunkId]`
- Con proyecto filtrado: `?project=[projectId]`

**Flujos cruzados:**
```
Entrevista -> "ver entidades" -> Entidad -> "ver en grafo" -> KG Explorer
-> "ver problemas" -> Problema -> "ver mejoras" -> Mejora -> "ver evidencia"
-> Entrevista @ timestamp
```

---

### 6. Debate con Otros Expertos UX

#### 6.1 Para UX-1 (ux-projects): Conexion con entrevistas

1. **Entrevista -> Grafo:** Boton "Ver en Knowledge Base" en review queue usa deep link `/org-intelligence/knowledge-graph?selected=[entityId]&zoom=fit`.
2. **Grafo -> Entrevista:** Tab "Evidencia" genera links `/org-intelligence/interviews/[iid]?t=754&highlight=[chunkId]`.
3. **Filtrado por proyecto:** SI. KG Explorer tiene selector. Desde tab Analisis llegan con `?project=[id]`.
4. **Busqueda desde transcripcion:** Seleccion texto -> "Buscar en KB" -> `/org-intelligence/search?q=[texto]`.
5. **Reproductor audio:** Necesito soporte deep linking `?t=` (segundos) + scroll al segmento.

#### 6.2 Para UX-3 (ux-diagrams): Del grafo a diagramas

1. **Desde grafo:** Nodo PROCESS seleccionado -> "Ver diagrama" en detail panel -> abre tu editor.
2. **Mini-flowchart:** Tab "Flujo" con Mermaid read-only. "Ver completo" -> tu editor.
3. **Bidireccionalidad:** Cambios en tu editor -> misma API -> reflejados en KG.
4. **Pregunta:** Tu editor sera drag-and-drop (React Flow) o visualizador? Si React Flow, compartimos libreria.

#### 6.3 Para UX-4 (ux-dashboard): Grafo alimenta dashboard

1. **Metricas:** Entidades por tipo (donut), confianza (histograma), problemas por severidad/area (heatmap), SPOFs (metric card), complejidad (CFC, handoffs).
2. **Widgets -> Grafo:** "Procesos problematicos" -> grafo filtrado. "Roles sobrecargados" -> nodos por centrality.
3. **Dashboard modular:** Widgets configurables en `/dashboard`. Para intelig. org: "Proyectos activos", "Items por revisar", "Problemas criticos top-3".

---

### 7. Principios de Diseno

1. **Trazabilidad siempre visible.** Sin fuente = sin credibilidad.
2. **Confianza como dimension visual primaria.** Hechos (verde >0.8), Inferencias (amarillo 0.4-0.8), Hipotesis (rojo <0.4). En todas las vistas.
3. **Navegacion cruzada fluida.** Todo conectado. SPA navigation. Deep linking.
4. **Progressive disclosure.** Carga on-demand. Zoom semantico. Tabs colapsables.
5. **Consistencia cromatica.** 9 tipos = 9 colores fijos en toda la app.
6. **Desktop-first, mobile-conscious.** Graph explorer es desktop. Mobile: lista + busqueda.
7. **Edicion no destructiva.** SCD Type 2 en todo. Nunca se pierde info.
8. **Grafo para explorar, tabla para gestionar.** Roles distintos, filtros compartidos.

---

### 8. Fases de Implementacion UX

**FASE 1 — MVP (2-3 semanas):**
- Tabla de entidades con filtros (tipo, busqueda, confianza).
- Ficha de entidad: Descripcion, Relaciones, Evidencia.
- Command palette (Cmd+K) con autocompletado de entidades.
- Mermaid embebido en asistente (patron existente).
- Crear/editar entidades (Dialog).

**FASE 2 — Graph Explorer + Busqueda (mes 2):**
- KG canvas interactivo (React Flow) + detail panel.
- Filtros: tipo, departamento, confianza (slider), layout (4 opciones).
- Expansion on-demand + zoom semantico.
- Busqueda semantica completa (entidades + chunks + pagina resultados).
- Mini-grafo local en ficha. Historial SCD Type 2.
- Vinculacion desde grafo (drag) y ficha (formulario).
- Deep linking bidireccional.

**FASE 3 — Analisis Avanzado (mes 3+):**
- Shortest path. SPOFs visuales (centrality). Layouts radial/agrupado.
- Dashboard contradicciones. Preguntas sugeridas dinamicas (LLM).
- Metricas grafo en dashboard. Export PNG/SVG/PDF.
- Evaluar Cytoscape.js para metricas avanzadas.
- Multi-select + resumen subgrafo. Bulk actions tabla.

---

## UX-3: Visualizacion de Procesos, Editor Interactivo y Analisis Visual

**Autor:** UX-3 (Experto en Diagramas de Procesos y Analisis)
**Fecha:** 2026-03-28
**Base:** Hallazgos consensuados en `org-intelligence-findings.md` + analisis de UI actual de Zeru

---

### 1. Analisis de la UI Actual (Perspectiva de Diagramas)

#### Estado actual de visualizacion en Zeru

**Mermaid.js:** NO existe uso actual en el frontend. El chat del asistente (`apps/web/app/(dashboard)/assistant/[id]/page.tsx`) renderiza markdown con `react-markdown` + `remark-gfm`, pero los bloques de codigo se renderizan como `<pre>` generico. No hay plugin `rehype-mermaid` ni componente custom de rendering. Esto es el gap mas urgente a cerrar para el MVP.

**Librerias de grafos/diagramas:** No hay React Flow, Cytoscape.js ni D3 instalados. Terreno virgen. El `package.json` de web solo tiene shadcn/ui, Hugeicons, react-markdown y remark-gfm como dependencias relevantes de UI.

**Patrones de UI reutilizables para nuestro modulo:**
- **Sheet (panel lateral):** Componente shadcn existente, ideal para detalle de nodo sin perder el diagrama de fondo
- **Card + Badge:** Pattern extenso en contabilidad y LinkedIn. Usable directamente para tarjetas de proceso con badges de severidad/estado
- **Combobox:** Con busqueda integrada, perfecto para selectores de responsable, sistema, area en el editor
- **Progress:** Barra de progreso existente, adaptable para indicadores de complejidad y confianza
- **Collapsible:** Para secciones contraibles de metricas y detalles
- **Skeleton:** Loader durante la generacion de diagramas (que puede tomar segundos por el rendering Mermaid)
- **Dialog + AlertDialog:** Para confirmaciones de edicion y exportacion
- **SaveIndicator:** Componente existente en `save-indicator.tsx`, reutilizable para auto-guardado del editor

---

### 2. Catalogo de Procesos

#### Layout: Grid de tarjetas con barra de filtros

Pagina a ancho completo dentro del area de contenido del dashboard. Sigue el patron existente de paginas Zeru (h1 + description + contenido).

```
+------------------------------------------------------------------+
|  Procesos AS-IS                             [+ Nuevo proceso]    |
|  Procesos mapeados a partir de entrevistas                       |
+------------------------------------------------------------------+
|  Buscar...  | Area: [Todos v] | Complejidad: [Todas v]          |
|             | Estado: [Todos v] | Con problemas: [Todos v]       |
|                                           [Grid | Tabla] toggle  |
+------------------------------------------------------------------+
|                                                                  |
|  +---------------------------+  +---------------------------+    |
|  | Gestion de Compras        |  | Despacho de Productos     |    |
|  |                           |  |                           |    |
|  | Logistica                 |  | Logistica                 |    |
|  | 8 actividades  3 handoffs |  | 12 actividades  5 handoffs|    |
|  | SAP, Excel                |  | SAP, WMS                  |    |
|  |                           |  |                           |    |
|  | [!] 2 problemas           |  | [!!] 4 problemas          |    |
|  | [?] 1 conflicto           |  |                           |    |
|  |                           |  |                           |    |
|  | Complejidad ====---  Med  |  | Complejidad ======- Alta  |    |
|  | Confianza   =====-- 0.72  |  | Confianza   ===---- 0.48  |    |
|  +---------------------------+  +---------------------------+    |
|                                                                  |
+------------------------------------------------------------------+
```

**Barra de filtros:** Usa Combobox existente de Zeru para cada dimension. Los filtros son acumulativos (AND):
- **Area/Departamento:** lista dinamica desde OrgEntity(type=DEPARTMENT)
- **Complejidad:** Baja / Media / Alta / Critica (derivada de NOA + CFC + handoffs)
- **Estado:** Borrador / Validado / En disputa
- **Problemas:** Sin problemas / Con problemas / Solo criticos
- **Busqueda texto libre:** sobre nombre y descripcion del proceso

**Card de proceso:**
- Titulo: nombre del proceso
- Badge de area: con color asignado al departamento
- Metricas en linea: actividades, handoffs, lista de sistemas
- Indicador de problemas: Badge rojo/naranja con count, click navega al tab Problemas
- Indicador de conflictos: Badge especial (icono diferente) si hay contradicciones sin resolver
- Barra de complejidad: Progress component existente con color semantico (verde < 0.3, amarillo 0.3-0.7, rojo > 0.7)
- Barra de confianza: mismo pattern, indica respaldo por evidencia

**Vista tabla alternativa:** Toggle entre grid y tabla. La tabla muestra las mismas dimensiones como columnas ordenables. Para usuarios que necesitan comparar multiples procesos de un vistazo.

---

### 3. Vista de Proceso Individual

Vista central del modulo. Layout con header + tabs + contenido + panel lateral contextual.

```
+------------------------------------------------------------------+
|  <- Procesos                                                     |
|                                                                  |
|  Gestion de Compras                                              |
|  Logistica  |  Owner: Jefe de Compras  |  8 actividades          |
|  Confianza: 0.72  |  3 entrevistas de fuente                    |
|                                                                  |
|  [Diagrama]  [Detalle]  [Problemas]  [Versiones]                 |
+==================================================================+
|                                            |                     |
|   Contenido del tab activo                 | Panel lateral       |
|   (diagrama, tabla, problemas, etc.)       | Sheet (contextual)  |
|                                            | Se abre al click    |
|                                            | en nodo o fila      |
|                                            |                     |
+------------------------------------------------------------------+
```

**Header:** Breadcrumb (Inteligencia Org > Proyecto X > Procesos > Nombre). Titulo h1 con nombre. Metadata en badges horizontales: area, owner, actividades, confianza, fuentes. Tabs para sub-vistas.

**Panel lateral contextual:** Se abre con el componente Sheet de shadcn/ui. Aparece al hacer click en cualquier nodo del diagrama o fila de la tabla. Contiene el detalle completo de una actividad, rol, sistema o problema sin salir de la pagina.

---

### 3.1 Tab "Diagrama" — Dos Modos

El tab tiene dos modos que el usuario alterna con un toggle:

#### Modo A: Preview Mermaid (default, lectura rapida)

Diagrama Mermaid renderizado como SVG, generado automaticamente desde el JSON intermedio del proceso.

```
+------------------------------------------------------------------+
|  [Vista Mermaid (activo)]  [Editor interactivo]         [Export] |
|  Tipo: [Flowchart v]   Colorear por: [Responsable v]            |
+------------------------------------------------------------------+
|                                                                  |
|     +--------+     +----------+     +----------+                 |
|     |Solicitar| --> |Cotizar   | --> | Aprobar? |                |
|     |compra   |     |proveedor |     |          |                |
|     +--------+     +----------+     +----------+                |
|                         [!]           /      \                   |
|                                      Si       No                 |
|                                      |         |                 |
|                               +----------+ +----------+         |
|                               |Emitir OC | |Rechazar  |         |
|                               +----------+ +----------+         |
|                                      |                           |
|                               +----------+                       |
|                               |Recibir   |                       |
|                               |material  |                       |
|                               +----------+                       |
|                                                                  |
|  Leyenda: [!] Problema detectado   -- por responsable --        |
|  Verde=Solicitante  Azul=Compras  Naranja=Gerencia  Gris=Bodega |
+------------------------------------------------------------------+
```

**Interacciones:**
- **Hover** sobre nodo: tooltip con nombre, responsable, sistema, duracion estimada
- **Click** en nodo: abre panel lateral Sheet con detalle completo de la actividad
- **Click** en nodo con [!]: panel lateral muestra problema asociado con cita textual de entrevista y link al audio
- **Zoom**: scroll del mouse escala el SVG. Boton "Ajustar a pantalla"
- **Selector de tipo:** dropdown para cambiar entre flowchart, sequence diagram (handoffs), swimlane (con subgraphs)
- **Selector "Colorear por":** cambia el esquema de color de los nodos:
  - Responsable: cada rol tiene un color auto-asignado
  - Problemas: rojo = problemas criticos, naranja = altos, amarillo = medios, verde = sin problemas
  - Confianza: rojo = baja (< 0.4), amarillo = media (0.4-0.8), verde = alta (> 0.8)
  - Sistemas: cada sistema tiene un color, para ver fragmentacion tecnologica
- **Exportar:** dropdown con opciones PNG (captura a 2x), SVG, copiar codigo Mermaid

#### Modo B: Editor Interactivo React Flow (Fase 2)

```
+------------------------------------------------------------------+
|  [Vista Mermaid]  [Editor interactivo (activo)]    [Auto] [Save] |
+------------------------------------------------------------------+
|  +------+                                                        |
|  |Paleta|   +================================================+   |
|  |      |   |                                                |   |
|  | Tarea|   |     Canvas React Flow                          |   |
|  |Decis.|   |     Nodos drag & drop                          |   |
|  |Evento|   |     Conexiones con handles                     |   |
|  |SubPr.|   |     Minimap (esquina inferior derecha)         |   |
|  |      |   |     Controls (zoom +/- fit)                    |   |
|  |------|   |                                                |   |
|  |Props |   +================================================+   |
|  |del   |                                                        |
|  |nodo  |                                                        |
|  |selec.|                                                        |
|  +------+                                                        |
+------------------------------------------------------------------+
```

**Paleta de nodos (panel izquierdo, 200px):**
- Tarea (rectangulo con bordes redondeados): actividad estandar
- Decision (rombo): gateway XOR
- Evento inicio (circulo verde): marcador de inicio
- Evento fin (circulo rojo): marcador de fin
- Sub-proceso (rectangulo doble borde): referencia a otro proceso
- Arrastar desde paleta al canvas crea el nodo con nombre provisional "Nueva tarea", activando edicion inline inmediata

**Canvas React Flow (area central):**
- Background grid punteado para alineacion
- Nodos posicionables con drag
- Handles de conexion aparecen al hover en los 4 bordes de cada nodo
- Click en handle de salida + drag -> soltar en handle de entrada = conexion
- Click en handle + drag -> soltar en vacio = menu contextual para crear nodo nuevo ya conectado (atajo de creacion rapida)
- Tipos de arista: secuencia (solida), excepcion (punteada roja), informacion (punteada gris)
- Click en arista: selecciona para agregar label ("Si", "No", "Error"), cambiar tipo, o eliminar
- Seleccion multiple: Shift + drag area
- Delete: seleccionar + tecla Delete
- Minimap (componente nativo React Flow): esquina inferior derecha
- Controls (componente nativo React Flow): botones zoom +, -, fit-to-view

**Panel de propiedades (panel izquierdo, debajo de la paleta):**
Al seleccionar un nodo, formulario editable:
- Nombre (input text, edicion inline tambien disponible haciendo doble click en el nodo)
- Responsable (Combobox buscando OrgEntity type=ROLE, con opcion "Crear nuevo")
- Sistema (Combobox buscando OrgEntity type=SYSTEM)
- Documentos entrada/salida (multi-select OrgEntity type=DOCUMENT_TYPE)
- Duracion estimada (input numerico + select de unidad)
- Frecuencia (select: diaria, semanal, mensual, ad-hoc)
- Confianza (slider 0-1 con indicador semaforo: rojo/amarillo/verde)
- Fuente (link a entrevista con timestamp, no editable si vino de extraccion)
- Problemas asociados (lista con badges de severidad + boton "+ Reportar problema")
- Notas (textarea libre)

**Toolbar superior:**
- Undo/Redo (Ctrl+Z / Ctrl+Shift+Z) con stack de 50 acciones
- [Auto]: auto-layout con dagre/elk, re-organiza nodos automaticamente
- [Save]: auto-save cada 30s + save manual. Usa pattern de `save-indicator.tsx` existente
- Toggle swimlane: agrupa nodos en carriles por responsable
- Exportar: Mermaid code, BPMN-XML, PNG, SVG

**Marcado visual de problemas en nodos:**
- Borde naranja: problemas MEDIUM/LOW
- Borde rojo: problemas HIGH/CRITICAL
- Icono warning en esquina superior derecha
- Borde punteado: confianza < 0.4 (actividad hipotetica)
- Al asignar responsable, el color de fondo del nodo cambia (matching con la leyenda de colores del modo Mermaid)

---

### 3.2 Tab "Detalle" — Vista Tabular

Para usuarios que prefieren leer o para procesos con muchas actividades:

```
+------------------------------------------------------------------+
|  # | Actividad          | Responsable      | Sistema | Dur. | !  |
+------------------------------------------------------------------+
|  1 | Solicitar compra   | Solicitante      | Email   | 10m  |    |
|  2 | Cotizar proveedor  | Asist. Compras   | Excel   | 2d   | !! |
|  3 | Aprobar compra     | Jefe Compras     | SAP     | 1d   |    |
|    | -> Si: paso 4  |  -> No: paso 5b                            |
|  4 | Emitir OC          | Asist. Compras   | SAP     | 30m  |    |
|  5 | Recibir material   | Bodeguero        | WMS     | var  |    |
| 5b | Rechazar solicitud | Jefe Compras     | SAP     | 5m   |    |
+------------------------------------------------------------------+
```

- Click en fila -> abre Sheet con detalle completo (mismo contenido que panel de propiedades del editor)
- Columna ! muestra icono coloreado si hay problemas; click va al problema
- Ordenable por cualquier columna
- Filas de decision se muestran como sub-filas indentadas con las rutas posibles

---

### 3.3 Swimlane View

Carriles horizontales por departamento/rol. Disponible en ambos modos:

```
+------------------------------------------------------------------+
|  Swimlane: Gestion de Compras                                    |
+------------------------------------------------------------------+
|               |                                                  |
| Solicitante   | [Solicitar] ---------------------------------+   |
|               |                                              |   |
| Compras       |             [Cotizar] ---+    [Emitir OC]---+   |
|               |                         |                   |   |
| Gerencia      |             [Aprobar?]--+                   |   |
|               |                  \--> [Rechazar]            |   |
|               |                                             |   |
| Bodega        |                                     [Recibir]   |
+------------------------------------------------------------------+
```

**En modo Mermaid:** Generado con `subgraph` por cada responsable. El generador JSON-to-Mermaid agrupa actividades por rol y las distribuye en subgraphs.

**En modo React Flow (Fase 2):** Carriles como "group nodes" con fondo coloreado semitransparente. Las actividades viven dentro de su carril. Arrastrar un nodo a otro carril = cambiar responsable.

**Utilidad:** Los handoffs (flechas que cruzan carriles) se resaltan en naranja. Cada cruce de carril es un punto de friccion potencial. Un contador "Handoffs: 3" se muestra sobre el diagrama.

---

### 3.4 Comparacion de Versiones

Habilitada por el versionado SCD Type 2 del schema:

```
+------------------------------------------------------------------+
|  Comparar: Gestion de Compras                                    |
|  Version: [v1 - Ene 2026 v]    vs    [v2 - Mar 2026 v]          |
+------------------------------------------------------------------+
|         VERSION 1              |         VERSION 2               |
|  +---+   +---+   +---+        |  +---+   +---+   +---+         |
|  | 1 |-->| 2 |-->| 3 |        |  | 1 |-->|2b |-->| 3 |         |
|  +---+   +---+   +---+        |  +---+   +---+   +---+         |
|          +---+                 |          +---+   +---+         |
|          | 4 |                 |          | 4 |-->|NEW|         |
|          +---+                 |          +---+   +---+         |
+------------------------------------------------------------------+
|  Cambios detectados:                                             |
|  [+] "Validacion automatica" agregada                            |
|  [~] "Cotizar" modificada (sistema: Excel -> SAP)                |
|  [-] Ninguna eliminada                                           |
|  [=] 4 sin cambios                                               |
+------------------------------------------------------------------+
```

- **Side-by-side:** Dos diagramas con scroll y zoom sincronizados
- **Diff visual:** Nodos nuevos con fondo verde, eliminados con fondo rojo (tachado), modificados con fondo amarillo
- **Resumen textual:** Lista de cambios debajo de los diagramas
- **Caso de uso principal:** Comparar AS-IS (extraido de entrevistas) vs TO-BE (editado como mejora)

---

### 4. Experiencia de Analisis de Procesos

#### 4.1 Panel de Metricas por Proceso

En la vista de proceso individual, un panel colapsable o tab "Analisis":

```
+------------------------------------------------------------------+
|  Metricas: Gestion de Compras                                    |
+------------------------------------------------------------------+
|  +----------------+  +----------------+  +------------------+    |
|  | Actividades: 8 |  | Decisiones: 2  |  | Handoffs: 3      |   |
|  | (Mediano)      |  | CFC: 4         |  | (Alto)           |   |
|  +----------------+  +----------------+  +------------------+    |
|  +----------------+  +----------------+  +------------------+    |
|  | Sistemas: 3    |  | Sys Switches: 4|  | Densidad: 0.32   |   |
|  | SAP,Excel,WMS  |  | (Alto)         |  | (Baja)           |   |
|  +----------------+  +----------------+  +------------------+    |
+------------------------------------------------------------------+
|  Puntos Criticos Detectados                                      |
+------------------------------------------------------------------+
|  [CUELLO DE BOTELLA] "Aprobar compra" - Jefe de Compras          |
|    In-degree: 3 | Unico responsable | 3 entrevistas lo mencionan|
|                                                                  |
|  [SPOF] Asist. de Compras - participa en 5/8 actividades        |
|    Si falta, el 62% del proceso se detiene                       |
|                                                                  |
|  [FRAGMENTACION] 4 system switches entre 8 actividades           |
|    Excel -> SAP -> Excel -> WMS = re-entry manual de datos       |
+------------------------------------------------------------------+
```

**Metricas:** 6 cards en grilla 3x2. Cada card muestra valor numerico + interpretacion textual + color semantico (verde/amarillo/rojo via Progress existente).

**Puntos criticos:** Cards con icono tipado (cuello de botella, SPOF, fragmentacion), descripcion concisa, y datos de soporte. Click en un punto critico resalta el nodo correspondiente en el diagrama (scroll + highlight si no esta visible).

#### 4.2 Heatmap Overlay en Diagramas

En la vista de diagrama, un toggle "Colorear por" permite superponer informacion al diagrama sin cambiar de pagina:

- **Problemas:** rojo = criticos, naranja = altos, amarillo = medios, verde = sin problemas
- **Confianza:** rojo = baja (< 0.4), amarillo = media (0.4-0.8), verde = alta (> 0.8)
- **Carga:** rojo = muchas dependencias (in-degree alto), verde = pocas
- **Handoffs:** naranja en las flechas que cruzan responsables

Esto convierte el diagrama en un mapa de calor instantaneo. Los "puntos calientes" saltan a la vista sin necesidad de una pantalla separada.

#### 4.3 Vista de Dependencias entre Procesos

Pagina dedicada que muestra el grafo de dependencias inter-proceso:

```
+------------------------------------------------------------------+
|  Dependencias entre Procesos                                     |
+------------------------------------------------------------------+
|                                                                  |
|   [Compras] --triggers--> [Recepcion] --triggers--> [Almacen]   |
|       |                       |                                  |
|       +--depends_on-----> [Presupuesto]                          |
|                               |                                  |
|   [Produccion] --triggers--> [Despacho]                          |
|       |                                                          |
|       +--depends_on-----> [Compras]                              |
|                                                                  |
+------------------------------------------------------------------+
|  Proceso mas critico: "Compras" (4 procesos dependen de el)      |
|  Cascada: Si Compras falla -> Recepcion, Almacen, Produccion     |
+------------------------------------------------------------------+
```

**MVP:** Mermaid flowchart con procesos como nodos, conexiones tipadas.
**Fase 2:** React Flow interactivo. Click en un proceso resalta sus dependencias directas (solido) e indirectas (punteado). Nodos coloreados por betweenness centrality (mas rojo = mas critico si falla).

#### 4.4 Panel de Contradicciones

```
+------------------------------------------------------------------+
|  Contradicciones: Gestion de Compras                    3 items  |
+------------------------------------------------------------------+
|                                                                  |
|  [FACTUAL] Duracion del proceso                    [Sin resolver]|
|  +--------------------------------------------------------------+|
|  | Jefe de Logistica: "El proceso toma 2 dias"                  ||
|  |   Entrevista 15-ene-2026, min 23:15  [Escuchar audio]       ||
|  |   Confianza: 0.8                                             ||
|  | vs                                                            ||
|  | Jefe de Produccion: "Logistica se demora una semana"         ||
|  |   Entrevista 18-ene-2026, min 45:02  [Escuchar audio]       ||
|  |   Confianza: 0.6                                             ||
|  |                                                               ||
|  | Resolucion: [____________________]                            ||
|  | [Dato fuente 1] [Dato fuente 2] [Ambos validos] [Verificar]  ||
|  +--------------------------------------------------------------+|
|                                                                  |
|  [ALCANCE] Numero de pasos                           [Sin resolver|
|  +--------------------------------------------------------------+|
|  | Jefe Logistica: 5 pasos  |  Jefe Produccion: 8 pasos        ||
|  | Tipo: Complementario (no contradictorio)                      ||
|  | Accion sugerida: Fusionar ambas perspectivas                  ||
|  +--------------------------------------------------------------+|
+------------------------------------------------------------------+
```

- Cada contradiccion es un Card expandible con Collapsible
- Muestra fuentes enfrentadas con citas textuales + links al audio (timestamp)
- Tipos: FACTUAL (datos contradictorios), PERSPECTIVA (opiniones), ALCANCE (info complementaria)
- Acciones de resolucion: elegir una fuente, marcar ambas como validas, solicitar verificacion, fusionar
- La resolucion se registra con justificacion (audit trail)
- Badge de estado: sin resolver (rojo), en revision (amarillo), resuelto (verde)

---

### 5. Integracion con el Chat del Asistente AI

#### Rendering de Mermaid en el Chat

El chat actual renderiza markdown pero NO Mermaid. Se requiere:

1. **Detectar bloques ` ```mermaid ` en el markdown:** Componente custom para `react-markdown` que intercepta code blocks con language "mermaid"
2. **Renderizar como SVG interactivo:** Usar `mermaid.render()` en el cliente. El SVG resultante se muestra inline en el mensaje
3. **Acciones sobre el diagrama embebido:**
   - Boton "Ampliar": abre modal a pantalla completa con zoom
   - Boton "Abrir en editor": navega a la vista de proceso con el editor React Flow
   - Boton "Copiar codigo": copia el Mermaid raw al clipboard
   - Boton "Exportar PNG": descarga captura del SVG

#### Interacciones posibles desde el chat

- "Muestrame el proceso de compras" -> AI recupera JSON del proceso, genera Mermaid, muestra inline
- "Que procesos tienen mas problemas?" -> AI lista procesos + genera diagrama del mas critico
- "Compara compras antes y despues de la mejora" -> AI genera dos diagramas con highlighting
- "Que actividades dependen de SAP?" -> AI marca en el diagrama los nodos que usan SAP

Esto conecta naturalmente con la experiencia conversacional que ya existe en Zeru, extendiendo las capacidades del asistente al dominio de procesos organizacionales.

---

### 6. Respuestas al Debate de ux-projects (UX-1)

#### Pregunta 1: Diagramas por entrevista vs consolidados

**Propuesta:**

- **En el tab de detalle de entrevista** (tu contexto): mostrar el diagrama "crudo" extraido de ESA entrevista. Es un Mermaid read-only con label "Vista de entrevista: [nombre]". Este diagrama puede ser incompleto o parcial, eso esta bien.

- **En el tab de Analisis / Procesos consolidados** (mi contexto): mostrar el diagrama consolidado resultado de fusionar multiples entrevistas. Este es el "oficial".

- **Vista comparativa** cuando dos entrevistas describen el mismo proceso diferente: propongo un layout de 3 columnas:
  ```
  [Entrevista A]  |  [Consolidado]  |  [Entrevista B]
  (5 pasos)       |  (8 pasos)      |  (8 pasos)
  ```
  El diagrama consolidado (columna central) es el merge inteligente. Las columnas laterales muestran las fuentes originales. Los nodos que solo aparecen en una fuente se marcan con badge de la fuente. Los nodos que aparecen en ambas pero difieren tienen badge amarillo "En disputa".

#### Pregunta 2: Edicion de diagramas desde la entrevista

**Mi recomendacion:** En Fase 1, NO activar edicion desde la entrevista. Usar "Reportar error" como propones: un boton que agrega una anotacion al nodo del diagrama (texto libre + severidad). Estas anotaciones son visibles en el panel de "Review queue" que ya propones.

**Justificacion:** El diagrama de entrevista es un artefacto generado automaticamente. Editarlo in-situ confundiria el modelo mental ("esto es lo que dijo el entrevistado" vs "esto es lo que el consultor corrigio"). Las correcciones deben ir al diagrama consolidado en la vista de Procesos, no al de la entrevista individual.

En Fase 2 con React Flow, el editor estaria en la vista de proceso consolidado (`/org-intelligence/processes/[id]`), no en la vista de entrevista.

#### Pregunta 3: Diagrama como evidencia en el Diagnostico

**De acuerdo y propongo implementacion concreta:** Cada diagrama de proceso tiene un ID estable (el ID del OrgEntity type=PROCESS + version). Para embeder un diagrama en un hallazgo del diagnostico:

- El hallazgo referencia `processId` + opcionalmente `highlightNodes: [nodeId1, nodeId2]`
- El componente de rendering del hallazgo muestra un Mermaid mini-embebido (sin interactividad, solo visual) con los nodos destacados resaltados en color
- Click en el diagrama embebido abre la vista completa del proceso (deep link)

Esto es esencialmente un "thumbnail interactivo" del proceso con contexto visual del problema.

---

### 7. Mensajes para los Otros Expertos UX

#### Para ux-projects (UX-1):

1. **Sobre el tab "Procesos" en la vista de proyecto:** Propongo que ese tab use directamente el componente de catalogo de procesos (seccion 2) pero pre-filtrado por `projectId`. Asi el componente es reutilizable: en la ruta `/org-intelligence/processes` muestra todos, dentro del proyecto muestra solo los del proyecto. Comparten la misma UI.

2. **Sobre la review queue:** Las entidades que se aprueban en tu review queue se convierten en nodos editables del diagrama de proceso. Propongo que al aprobar un proceso extraido, haya un boton "Ver diagrama" que navega a la vista de proceso en tab Diagrama. El flujo: review -> aprobar -> ver diagrama -> corregir si necesario en editor.

3. **Sobre el minimap en header de proyecto:** SI, seria util. Propongo un Mermaid mini del grafo de dependencias entre procesos del proyecto (seccion 4.3 pero compacto). Genera contexto visual inmediato de "la foto general" del proyecto. Pero como es un nice-to-have, lo dejaria para Fase 2.

#### Para ux-knowledge (UX-2):

1. **Navegacion bidireccional diagrama <-> knowledge graph:** Cada nodo del diagrama de proceso es una OrgEntity. Propongo que en el panel lateral (Sheet) de cada nodo, haya un link "Ver en Knowledge Base" que navega al KG explorer centrado en esa entidad. Inversamente, en el KG explorer, al seleccionar un nodo type=PROCESS, un boton "Ver diagrama" navega a la vista de proceso.

2. **Consistencia de colores entre vistas:** Propongo un archivo compartido de constantes de estilo para grafos:
   - ROLE = azul (#3B82F6)
   - SYSTEM = morado (#8B5CF6)
   - DEPARTMENT = verde (#10B981)
   - PROCESS = indigo (#6366F1)
   - PROBLEM = rojo (#EF4444)
   - DOCUMENT = gris (#6B7280)
   Estos colores se usan tanto en mi diagrama de procesos como en tu KG explorer, para que el usuario no tenga que re-aprender la codificacion visual al cambiar de vista.

3. **Entidades compartidas:** Un ROLE como "Jefe de Compras" aparece en multiples procesos. En mi diagrama, al click en ese nodo, el panel lateral muestra "Participa en 5 procesos" con links a cada uno. En tu KG, ese mismo nodo muestra TODAS sus relaciones. Esto revela la carga real del rol, critico para detectar SPOF.

#### Para ux-dashboard (UX-4):

1. **Widget "Procesos criticos":** Propongo un componente que muestra los top-5 procesos con mas problemas. Cada uno como mini-card con: nombre, barra de complejidad, count de problemas por severidad (badges rojo/naranja/amarillo). Click navega a la vista de proceso. Este widget consume las metricas que calculo en seccion 4.1.

2. **Widget "Mapa de dependencias":** Un mini-diagrama Mermaid del grafo inter-proceso (seccion 4.3) embebido como SVG compacto. Los nodos se colorean por betweenness centrality. Es la "foto de 10,000 pies" de la organizacion.

3. **Metricas que exporto para el dashboard:**
   - Total de procesos mapeados
   - Promedio de handoffs por proceso
   - Total de problemas (desglose por severidad)
   - Contradicciones sin resolver
   - Procesos con SPOF identificados
   - Score de complejidad promedio

4. **Pregunta:** Propones un "score de salud organizacional" agregado? Si es asi, mis metricas de procesos (complejidad, handoffs, SPOF, problemas) serian inputs clave. Puedo exponerlas como datos estructurados que tu score consume y pondera.

---

### 8. Fases de Implementacion UX (Diagramas)

#### FASE 1 - MVP (semanas 1-3)

- Rendering de Mermaid en el chat del asistente (componente custom para react-markdown)
- Pagina catalogo de procesos con filtros basicos y grid de cards
- Vista de proceso individual: tab "Diagrama" en modo Mermaid-only (read-only)
- Tab "Detalle" con tabla de actividades
- Panel lateral Sheet al click en nodo/fila
- Exportar: Mermaid code, PNG
- Metricas basicas: actividades, handoffs, sistemas
- Indicadores de problemas en nodos (markers visuales)
- Seccion "Inteligencia Org" en sidebar con sub-items Proyectos y Procesos

#### FASE 2 - Editor y Analisis (mes 2)

- Editor React Flow con paleta, drag & drop, conexiones, panel de propiedades
- Marcado de puntos de dolor en nodos
- Auto-layout, undo/redo, auto-save
- Swimlane view (Mermaid subgraphs + React Flow group nodes)
- Heatmap overlay en diagramas (Colorear por: problemas, confianza, carga)
- Panel de metricas expandido (CFC, densidad, system switches)
- Deteccion automatica de SPOF y cuellos de botella
- Vista de dependencias entre procesos
- Panel de contradicciones con resolucion
- Comparacion de versiones side-by-side
- Exportar: BPMN-XML, SVG

#### FASE 3 - Madurez (mes 3+)

- Evaluacion Cytoscape.js vs React Flow para KG explorer (spike tecnico)
- Navegacion bidireccional diagrama <-> knowledge graph
- Diagrama embebido como evidencia en hallazgos del diagnostico
- Widgets de procesos criticos y mapa de dependencias para dashboard
- Comparacion AS-IS vs TO-BE
- Exportacion de informe PDF con diagramas renderizados

---

### 9. Decisiones de Diseno Criticas

| Decision | Eleccion | Justificacion |
|----------|----------|---------------|
| Mermaid como visualizacion default | Si | LLMs lo generan nativamente, SVG sin deps pesadas, funciona en chat Y vista dedicada |
| React Flow para editor (no Cytoscape) | Si | Mejor DX React, drag-and-drop de primera clase, ideal para flowcharts. Cytoscape solo para KG en Fase 3 |
| Panel lateral Sheet vs pagina nueva | Sheet | Mantener diagrama visible mientras se leen detalles. Pattern existente en Zeru |
| Cards + tabla como toggle | Si | Cards para overview visual, tabla para comparacion/ordenamiento eficiente |
| Heatmap como overlay (no pagina separada) | Si | Menos clicks, info superpuesta al diagrama con un toggle |
| Colores por responsable auto-asignados | Si | Permite ver swimlanes informales incluso en vista flowchart normal |
| Confianza visible en TODO momento | Si | Core del producto: diferenciar hechos de inferencias de hipotesis |
| Diagrama de entrevista no editable | Si (Fase 1-2) | Separar "lo que dijo el entrevistado" de "lo que el consultor corrigio" |

---

### 10. Riesgos UX y Mitigaciones

1. **Sobrecarga de informacion:** Procesos complejos con muchos nodos, metricas, problemas, fuentes. *Mitigacion:* progressive disclosure (tabs, collapsibles, estados contraidos por default). Solo mostrar lo esencial; el detalle se revela al interactuar.

2. **Mermaid limitado para procesos complejos:** No soporta BPMN nativo ni swimlanes reales. Procesos con >15 actividades se vuelven ilegibles. *Mitigacion:* Auto-deteccion de complejidad. Si el proceso tiene >12 actividades, sugerir automaticamente "Cambiar a editor interactivo" donde React Flow maneja layouts complejos con auto-layout dagre/elk.

3. **Score de confianza abstracto:** "0.72" no comunica nada a un consultor no-tecnico. *Mitigacion:* Semaforos visuales (rojo/amarillo/verde) + texto descriptivo contextual ("Bien respaldado: mencionado en 3 entrevistas" vs "Requiere verificacion: solo inferido por IA"). Nunca mostrar el numero solo.

4. **Curva de aprendizaje del editor React Flow:** Handles, drag & drop, conexiones no son intuitivos para todos. *Mitigacion:* Onboarding breve en primer uso (overlay con 3 pasos), tooltips en handles, modo "crear nodo conectado" con click en canvas vacio que simplifica el flujo para principiantes.

5. **Performance con grafos grandes:** Proceso con 50+ actividades puede ser lento. *Mitigacion:* React Flow maneja lazy rendering nativamente (solo renderiza nodos en viewport). Para Mermaid, si el SVG es muy grande, mostrar version simplificada (solo nombres de actividades, sin detalles) con boton "Ver completo" que abre en modal a pantalla completa.

---

## UX-4: Dashboard de Diagnostico, Validacion Human-in-the-Loop, Plan de Mejoras y KPIs

**Autor:** UX-4 (Experto en Dashboard de Diagnostico y Plan de Mejoras)
**Fecha:** 2026-03-28

---

### 0. Analisis Complementario de la UI Actual

Ademas de lo documentado por UX-1 y UX-3, destaco las siguientes brechas criticas para mis pantallas:

- **No existen stat cards / KPI cards** -- Los dashboards actuales (Income Statement, Accounting Process) usan tablas y progress bars, pero no hay tarjetas de resumen numerico (numero grande + etiqueta + tendencia).
- **No existen graficos (charts)** -- Ni lineas, ni barras, ni scatter plots. Se necesitara Recharts (shadcn/ui tiene wrapper oficial para charts).
- **No existe heatmap ni scorecards por area** -- La salud organizacional necesita una representacion visual nueva.
- **No existe queue de review con acciones** -- El patron mas cercano es AccountingProcessProgress (click para cambiar estado), pero necesitamos aprobar/editar/rechazar con evidencia.
- **No existe scatter plot interactivo** -- Para la matriz esfuerzo-impacto.
- **No existe timeline/roadmap** -- Para el plan de mejoras por horizonte.

**Componentes UI nuevos que propongo construir:**

| Componente | Descripcion | Base |
|---|---|---|
| StatCard | Numero grande + etiqueta + subtexto + progress mini | Card de shadcn |
| AreaScoreCard | Salud de un area: contadores, severity index, barra coloreada | Card de shadcn |
| ConfidenceBadge | Badge que cambia color segun rango (rojo <0.5, amarillo 0.5-0.8, verde >0.8) | Badge de shadcn |
| ValidationQueueItem | Card expandible: tipo, nombre, confianza, cita, audio, acciones aprobar/editar/rechazar | Card + Collapsible |
| AudioClipPlayer | Reproductor de segmento de audio con timestamps, controles basicos | HTML5 Audio API |
| RiceScoreDisplay | 4 barras horizontales editables (R, I, C, E) + score compuesto | Progress de shadcn |
| ImpactEffortMatrix | Scatter plot con 4 cuadrantes, puntos con tamano y color variable | Recharts ScatterChart |
| RoadmapTimeline | Lista agrupada por horizonte temporal con items ordenados por RICE | Divs con separadores |
| KpiLineChart | Grafico de linea temporal con linea de meta | Recharts LineChart |
| ProcessingStepTracker | Mini stepper horizontal (pasos 1-5 del pipeline) | Custom con CSS |

---

### 1. Dashboard de Diagnostico

#### 1.1 Ruta y Punto de Entrada

Siguiendo la propuesta de UX-1, el Dashboard de Diagnostico es la tab "Diagnostico" dentro del proyecto:

```
/org-intelligence/projects/[id]   (tabs: Config | Entrevistas | Analisis | Diagnostico | Plan de Accion)
                                                                          ^^^^^^^^^^^^
```

El Dashboard de Diagnostico es la vista principal de la tab "Diagnostico". Es donde el consultor (y despues la gerencia) ven el estado actual del diagnostico organizacional.

**Respuesta a ux-projects (punto 9.1):** Acepto la propuesta de tabs horizontales dentro del proyecto en vez de sidebar interna. Tiene sentido porque las etapas son secuenciales y las tabs muestran el progreso de un vistazo. Mi dashboard vive en la tab "Diagnostico" y el Plan de Mejoras en la tab "Plan de Accion".

Sin embargo, la tab "Diagnostico" necesita SUB-NAVEGACION interna porque contiene multiples vistas (dashboard, problemas, validacion, KPIs). Propongo sub-tabs o una barra de navegacion secundaria:

```
[Config.] [Entrevistas] [Analisis] [Diagnostico] [Plan de Accion]
                                      ~active~

Sub-navegacion dentro de Diagnostico:
[Resumen] [Problemas] [Validacion] [KPIs]
 ~active~
```

#### 1.2 Layout del Dashboard (sub-tab "Resumen")

**Zona A - Header del diagnostico:**
```
+-----------------------------------------------------------------------+
| Diagnostico Organizacional                                            |
| Ultima actualizacion: hace 2h | Entrevistas procesadas: 8 de 15     |
|                                                     [Exportar PDF]   |
+-----------------------------------------------------------------------+
```

**Zona B - Stats Cards (grid de 4 columnas, responsive a 2 en tablet, 1 en mobile):**
```
+------------------+------------------+------------------+------------------+
| ENTREVISTAS      | ENTIDADES        | PROBLEMAS        | OPORTUNIDADES    |
| 8 / 15           | 142              | 23               | 18               |
| [====>    ] 53%  | 47 roles         | 8 criticos       | 12 quick wins    |
|                  | 31 procesos      | 9 altos          | 4 estrategicos   |
|                  | 23 sistemas      | 6 medios         | 2 largo plazo    |
+------------------+------------------+------------------+------------------+
```

Cada StatCard:
- Numero grande: text-3xl font-bold
- Etiqueta: text-sm text-muted-foreground
- Sub-desglose: text-xs con items listados
- Progress bar mini en "Entrevistas"
- Colores semanticos: criticos en text-destructive, oportunidades en text-green-600

**Zona C - Salud organizacional por area (scorecards, NO heatmap):**

Propongo scorecards en vez de heatmap porque:
1. Citolab tiene ~6-8 areas, no 50. Un heatmap para 6 celdas es visualmente pobre.
2. Las scorecards son mas legibles y accionables (click navega al detalle).
3. No existe componente de heatmap en shadcn; las scorecards se construyen con Card existente.

```
+---------------------------+---------------------------+---------------------------+
| LOGISTICA          [!]    | ADMINISTRACION      [OK]  | CALIDAD             [!]   |
| Problemas: 7              | Problemas: 3              | Problemas: 5              |
|  Crit: 2 | Alt: 3 | Med:2|  Crit: 0 | Alt: 1 | Med:2|  Crit: 1 | Alt: 2 | Med:2|
| Procesos: 8 | Personas:12 | Procesos: 5 | Personas: 8 | Procesos: 6 | Personas:9 |
| Confianza prom.: 72%      | Confianza prom.: 89%      | Confianza prom.: 65%      |
| Sev. Index: 6.2           | Sev. Index: 2.1           | Sev. Index: 5.0           |
| [==rojo=====>     ]       | [===verde========>  ]     | [==naranja====>    ]      |
+---------------------------+---------------------------+---------------------------+
```

- Cada area = Card
- Header: nombre del area + badge de estado (icono: check verde, alerta amarillo, critico rojo)
- Body: contadores de problemas por severidad, procesos, personas
- Footer: confianza promedio + severity index como Progress coloreada
- Severity index = SUM(problemas * peso_severidad) / total_procesos. Pesos: CRITICAL=4, HIGH=3, MEDIUM=2, LOW=1
- Click en el area filtra la sub-tab "Problemas" por esa area

**Zona D - Top 5 Problemas detectados (tabla):**

```
+-----------------------------------------------------------------------+
| TOP PROBLEMAS DETECTADOS                            [Ver todos ->]    |
+-----------------------------------------------------------------------+
| #  | Problema                | Sev.  | Mencionado | Areas     | Conf. |
|----|-------------------------|-------|------------|-----------|-------|
| 1  | Proceso de despacho sin | CRIT  | 6/8 entrev.| LOG,CAL   | 0.92  |
|    | trazabilidad            |       |            | PROD      |       |
| 2  | Dependencia total de    | CRIT  | 5/8 entrev.| ADM,GER   | 0.88  |
|    | una persona en nomina   |       |            |           |       |
| 3  | Reingreso manual de     | HIGH  | 4/8 entrev.| ADM,LOG   | 0.85  |
|    | datos entre sistemas    |       |            | VEN       |       |
| 4  | Sin indicadores en      | HIGH  | 4/8 entrev.| GER,LOG   | 0.79  |
|    | produccion              |       |            | PROD      |       |
| 5  | Comunicacion informal   | HIGH  | 3/8 entrev.| TODAS     | 0.76  |
|    | via WhatsApp            |       |            |           |       |
+-----------------------------------------------------------------------+
```

- Ordenado por score compuesto: severidad_peso * frecuencia_mencion * confianza
- Severidad como Badge con colores: CRITICAL=destructive, HIGH=orange, MEDIUM=yellow, LOW=muted
- "Mencionado en" = cuantas entrevistas distintas reportan este problema
- Areas como badges compactos
- Confianza como numero con ConfidenceBadge
- Click en problema abre Sheet lateral con detalle completo (evidencia, citas, areas, mejoras propuestas)
- "Ver todos" navega a sub-tab "Problemas"

**Zona E - Cuellos de botella y SPOFs (dos columnas):**

```
+------------------------------------+------------------------------------+
| CUELLOS DE BOTELLA                 | SPOFs DETECTADOS                   |
| (Mayor betweenness centrality)     | (Dependencia critica en 1 persona) |
+------------------------------------+------------------------------------+
| 1. Jefe de Logistica               | 1. Maria Gonzalez                  |
|    Centralidad: 0.73               |    Nomina y remuneraciones         |
|    Aparece en 15/31 procesos       |    Unica persona que conoce el     |
|    [==========>   ]                |    proceso completo                |
|                                    |    Riesgo: CRITICO                 |
| 2. Proceso de Aprobacion           |    [!] Sin backup documentado      |
|    Centralidad: 0.61               |                                    |
|    12 procesos dependen de el      | 2. Pedro Fuentes                   |
|    [=========>    ]                |    Mantencion equipos especializad.|
|                                    |    Unico tecnico calificado        |
| 3. Sistema SAP                     |    Riesgo: ALTO                    |
|    Centralidad: 0.58               |    [!] Sin procedimiento escrito   |
|    Hub de 9 procesos               |                                    |
|    [========>     ]                |                                    |
+------------------------------------+------------------------------------+
```

- Cuellos de botella: top 5 por betweenness centrality del knowledge graph
- SPOFs: personas con alto riesgo de single point of failure
- Barras visuales de centralidad (0 a 1)
- Badges de riesgo
- Click en item abre Sheet con contexto del grafo

**Mensaje para ux-knowledge:** Necesito que el click en un cuello de botella o SPOF pueda abrir una vista embebida (Sheet/Drawer lateral) con una mini-representacion del knowledge graph centrada en ese nodo. En Fase 1: lista textual de conexiones. Fase 2: Mermaid embebido. Fase 3: React Flow mini. El link "Ver en Knowledge Graph" llevaria al explorador completo con el nodo pre-seleccionado (via parametro `?focus=entity_id`).

**Zona F - Confianza general y contradicciones (dos columnas):**

```
+------------------------------------+------------------------------------+
| NIVEL DE CONFIANZA                 | CONTRADICCIONES PENDIENTES         |
+------------------------------------+------------------------------------+
| Hallazgos totales: 287             | 12 contradicciones detectadas      |
|                                    |                                    |
| Alta (>0.8):  198 (69%)           | 4 FACTICAS                         |
|   [==============>    ]  verde    |   Datos duros contradictorios      |
| Media (0.5-0.8): 64 (22%)         |   (ej: duracion despacho 2d vs 5d) |
|   [======>            ]  amarillo | 5 PERSPECTIVA                      |
| Baja (<0.5):  25 (9%)             |   Opiniones diferentes             |
|   [==>                ]  rojo     | 3 ALCANCE                          |
|                                    |   Informacion complementaria       |
| Pendientes de validacion: 89       |                                    |
|   [====>     ] 31% completado     |                                    |
| [Ir a Validacion ->]              | [Resolver contradicciones ->]      |
+------------------------------------+------------------------------------+
```

- Distribucion de confianza con barras coloreadas
- Progreso de validacion humana
- Clasificacion de contradicciones segun el framework del findings doc (FACTUAL, PERSPECTIVA, ALCANCE)
- Links directos a las sub-tabs de Validacion y al resolvedor de contradicciones

**Zona G - Estado de procesamiento (solo si hay entrevistas en proceso):**

Si hay entrevistas aun procesandose, mostrar un banner compacto:

```
+-----------------------------------------------------------------------+
| PROCESAMIENTO EN CURSO                                                |
| Ent. 4 - Pedro F.: Extrayendo (Pasada 3/5) [============>      ] 60% |
| Ent. 5 - Ana L.:   Transcribiendo           [===>              ] 20% |
+-----------------------------------------------------------------------+
```

Reutiliza el patron de ProcessingStepTracker (StatusIcon + Progress).

---

### 2. Experiencia de Validacion Human-in-the-Loop

#### 2.1 Sub-tab "Validacion" dentro de Diagnostico

```
/org-intelligence/projects/[id] > tab Diagnostico > sub-tab Validacion
```

#### 2.2 Layout principal -- Queue de validacion

```
+-----------------------------------------------------------------------+
| VALIDACION DE HALLAZGOS                                               |
| 89 pendientes | 198 validados | 0 rechazados                         |
| [==============================>              ] 69% completado        |
| Tiempo estimado: ~45 min restantes                                    |
+-----------------------------------------------------------------------+
| FILTROS:                                                              |
| [Tipo: Todos v] [Confianza: Todos v] [Area: Todas v]                |
| [Entrevista: Todas v] [Estado: Pendientes v]                         |
| Ordenar: [Prioridad (baja confianza primero) v]                      |
+-----------------------------------------------------------------------+
|                                                                       |
| ACCIONES MASIVAS (items alta confianza):                             |
| [x] 45 items con confianza > 0.8 disponibles para aprobacion masiva |
| [Aprobar 45 items] [Revisar individualmente]                         |
+-----------------------------------------------------------------------+
```

**Ordenamiento por defecto:** Prioridad = baja confianza primero. El consultor dedica su tiempo donde mas se necesita. Los items de alta confianza se aprueban en bloque al final.

**Bulk actions:** Seleccion y aprobacion masiva de items de alta confianza. Esto es critico para eficiencia: no tiene sentido que el consultor revise 1 a 1 los 198 items que el LLM genero con 90%+ de confianza. Aprobacion masiva con posibilidad de revisar excepciones.

**Filtros disponibles:**
- Tipo de hallazgo: Entidad (Rol, Proceso, Sistema, etc.), Relacion, Problema, Claim factico
- Rango de confianza: Baja (<0.5), Media (0.5-0.8), Alta (>0.8)
- Area/departamento
- Entrevista de origen
- Estado: Pendiente, Aprobado, Editado, Rechazado

#### 2.3 Card de item a validar

Cada item es un Card expandible (por defecto colapsado mostrando resumen, click para expandir):

**Vista colapsada:**
```
+-----------------------------------------------------------------------+
| [?] ENTIDAD: Rol  |  "Jefe de Logistica y Distribucion"  | Conf: 0.45|
|     Logistica | Entrevista #4 - Pedro Fuentes             | [BAJA]   |
|                                   [Aprobar] [Editar] [Rechazar] [v]  |
+-----------------------------------------------------------------------+
```

**Vista expandida (click en [v] o en el card):**
```
+-----------------------------------------------------------------------+
| [?] ENTIDAD: Rol                                    Confianza: 0.45   |
|     "Jefe de Logistica y Distribucion"                       [BAJA]  |
+-----------------------------------------------------------------------+
|                                                                       |
| INFORMACION EXTRAIDA:                                                 |
|   Nombre: Jefe de Logistica y Distribucion                           |
|   Departamento: Logistica                                             |
|   Responsabilidades:                                                  |
|     - Coordinar despachos a sucursales                               |
|     - Gestionar inventario de productos terminados                   |
|     - Supervisar equipo de bodega (3 personas)                       |
|                                                                       |
| EVIDENCIA (cita textual):                                             |
| > "...y bueno, yo como jefe de logistica me encargo de todo lo       |
| > que es distribucion, los despachos a las sucursales, y tambien     |
| > veo el tema del inventario de producto terminado. Tengo tres       |
| > personas en bodega que dependen de mi..."                          |
|                                                                       |
|   Pedro Fuentes | Entrevista #4 | 14:32 - 15:08                     |
|   [> Reproducir audio 14:32-15:08]                                   |
|                                                                       |
| RAZON DE BAJA CONFIANZA:                                             |
| El titulo "Jefe de Logistica y Distribucion" fue inferido; el         |
| entrevistado dijo "jefe de logistica" sin mencionar "distribucion"    |
| explicitamente.                                                       |
|                                                                       |
| ACCIONES:                                                             |
| [Aprobar tal cual]  [Editar y Aprobar]  [Rechazar]                   |
|                                                                       |
| (Si "Editar y Aprobar"):                                             |
| Nombre: [Jefe de Logistica________________]                         |
| Departamento: [Logistica___________________]                         |
| Nota: [Corregido: titulo sin "Distribucion"_]                        |
|                                                    [Guardar edicion] |
+-----------------------------------------------------------------------+
```

**Elementos clave:**

1. **Header:** Icono de tipo + tipo como badge + nombre textual + confianza (ConfidenceBadge)
2. **Informacion extraida:** Campos estructurados del hallazgo segun tipo
3. **Evidencia:** Cita textual exacta (blockquote visual), atribucion (nombre, entrevista, timestamps), boton de audio
4. **Razon de confianza:** Explicacion del LLM de por que el score es ese valor
5. **Acciones:** Tres botones principales
   - Aprobar: confirma tal cual. Confidence -> 1.0
   - Editar y Aprobar: abre inputs editables, guarda version corregida
   - Rechazar: pide motivo obligatorio, marca como invalido

**Mensaje para ux-diagrams:** Cuando el item a validar es un Proceso o Actividad, necesito que debajo de "INFORMACION EXTRAIDA" aparezca un mini-diagrama Mermaid del proceso, con el nodo correspondiente resaltado (borde mas grueso o color diferente). Asi el consultor ve el contexto visual al validar.

#### 2.4 Reproductor de audio embebido (AudioClipPlayer)

```
+-----------------------------------------------------------------------+
| [>||] 14:32 ======[====]================== 15:08   Pedro Fuentes     |
|       [<< 5s]  [Velocidad: 1x v]  [>> 5s]         Entrevista #4     |
+-----------------------------------------------------------------------+
```

- Reproduce SOLO el segmento relevante (timestamp start a timestamp end)
- Controles: play/pause, retroceder 5s, adelantar 5s
- Selector de velocidad: 0.75x, 1x, 1.25x, 1.5x
- Muestra speaker name (de la diarizacion)
- Progress bar dentro del segmento
- Boton para "Ir a transcripcion completa" que abre la entrevista en la posicion correcta

#### 2.5 Barra de progreso de validacion

Sticky en la parte superior de la queue:

```
Progreso de validacion: 69% (198 / 287)
  Alta confianza (>0.8):  198 items | 180 aprobados, 18 pendientes
  Media (0.5-0.8):        64 items  | 17 aprobados, 5 editados, 42 pendientes
  Baja (<0.5):            25 items  | 1 aprobado, 2 rechazados, 22 pendientes
```

---

### 3. Plan de Mejoras

#### 3.1 Ubicacion

Tab "Plan de Accion" dentro del proyecto (la ultima tab):

```
/org-intelligence/projects/[id] > tab Plan de Accion
```

#### 3.2 Tres vistas intercambiables (toggle group)

```
Vista: [Tabla] [Matriz] [Roadmap]                      [Exportar Plan v]
```

#### 3.3 Vista Tabla (default)

```
+-----------------------------------------------------------------------+
| PLAN DE MEJORAS                                    [+ Nueva mejora]   |
| 18 mejoras propuestas | RICE promedio: 42.3                          |
+-----------------------------------------------------------------------+
| [Horizonte: Todos v] [Tipo: Todos v] [Area: Todas v] [Estado: Todosv]|
| Ordenar: [RICE Score descendente v]                                   |
+-----------------------------------------------------------------------+
| #  | Mejora                    | Tipo       | RICE  | Horiz. | Est.  |
|----|---------------------------|------------|-------|--------|-------|
| 1  | Implementar trazabilidad  | PROCESO    | 78.4  | Quick  | Prop. |
|    | en despachos              |            |       | Win    |       |
|    | [LOG] [CAL] [PROD]        |            |       |        |       |
|----|---------------------------|------------|-------|--------|-------|
| 2  | Documentar proceso de     | DOC.       | 71.2  | Quick  | Prop. |
|    | remuneraciones (SPOF)     |            |       | Win    |       |
|    | [ADM] [RRHH]              |            |       |        |       |
|----|---------------------------|------------|-------|--------|-------|
| 3  | Integrar SAP con sistema  | TECNO.     | 65.8  | Mediano| Prop. |
|    | de facturacion            |            |       |        |       |
|    | [ADM] [VEN] [LOG]         |            |       |        |       |
+-----------------------------------------------------------------------+
```

- Tabla paginada con filtros inline (consistente con DocumentsPage)
- Badge de horizonte: Quick Win (green), Mediano (amber), Largo (blue)
- Badge de estado: Propuesta (outline), Validada (secondary), En Implementacion (default/primary), Completada (green), Descartada (muted)
- Badge de tipo: PROCESO, TECNOLOGIA, ORGANIZACIONAL, DOCUMENTACION, CAPACITACION
- Areas afectadas como mini badges
- Click en fila abre Sheet lateral con detalle

**Respuesta a ux-projects (punto 9.3 sobre transicion diagnostico -> plan de accion):** Si, acepto la propuesta de que cada hallazgo/problema en el diagnostico tenga un boton "Crear iniciativa de mejora" que pre-llene una entrada en el Plan de Accion con: el problema origen, las areas afectadas, el tipo inferido, y scores RICE sugeridos por la IA. El consultor revisa y ajusta antes de confirmar.

#### 3.4 Detalle de mejora (Sheet lateral)

```
+-------------------------------------------+
| MEJORA #1                           [X]   |
| Implementar trazabilidad en despachos     |
| Estado: [Propuesta v]                     |
+-------------------------------------------+
|                                           |
| PROBLEMA QUE RESUELVE:                    |
| "Proceso de despacho sin trazabilidad"    |
| Severidad: CRITICA | 6 entrevistas        |
| [Ver problema ->]                         |
|                                           |
| SCORING RICE:                             |
|                                           |
| Reach:      8.0  [=========>  ]  (edit.)  |
|   12 roles, 3 areas, 8 procesos afectados |
|                                           |
| Impact:     7.5  [========>   ]  (edit.)  |
|   Reduce perdidas, mejora satisfaccion    |
|                                           |
| Confidence: 9.2  [==========> ]  (edit.)  |
|   6/8 entrevistas lo mencionan            |
|                                           |
| Effort:     4.0  [====>      ]  (edit.)   |
|   Requiere integracion con software       |
|                                           |
| RICE = (8.0 x 7.5 x 9.2) / 4.0 = 138.0  |
|                                           |
| EVIDENCIA:                                |
| > "Los despachos se pierden porque nadie  |
| > sabe en que etapa estan..."             |
|   -- Jefe Logistica, Ent. #4             |
| > "El cliente llama a preguntar..."       |
|   -- Ger. Comercial, Ent. #7             |
| [+ 4 citas mas]                           |
|                                           |
| AREAS AFECTADAS:                          |
| [Logistica] [Calidad] [Produccion]        |
| [Comercial]                               |
|                                           |
| TIPO: Proceso + Tecnologia               |
| HORIZONTE: Quick Win (1-4 semanas)        |
| RESPONSABLE: [Jefe Logistica          v]  |
|                                           |
| DESCRIPCION DETALLADA:                    |
| Implementar sistema de tracking de        |
| despachos con codigos QR/barras en cada   |
| etapa del proceso de distribucion...      |
|                                           |
| [Editar] [Validar] [Descartar]            |
+-------------------------------------------+
```

**RICE visual (RiceScoreDisplay):**
- Cada dimension = Progress bar horizontal editable
- Al hacer click/drag en la barra, se puede ajustar el valor (0-10)
- Alternativa para MVP sin drag: input numerico al lado de cada barra
- Justificacion textual debajo de cada barra (generada por LLM)
- Score RICE compuesto se recalcula en real-time: (R x I x C) / E
- Los scores son PROPUESTAS del LLM; el consultor tiene la ultima palabra

**Mensaje para ux-diagrams:** En el detalle de una mejora, debajo de "PROBLEMA QUE RESUELVE", seria valioso mostrar un mini-diagrama del proceso afectado con indicacion visual de donde interviene la mejora. El nodo problematico en rojo y un overlay en verde representando la mejora.

#### 3.5 Vista Matriz Esfuerzo-Impacto (ImpactEffortMatrix)

```
+-----------------------------------------------------------------------+
|  MATRIZ ESFUERZO-IMPACTO                                             |
|                                                                       |
|  Impacto                                                             |
|  Alto |  QUICK WINS            |  ESTRATEGICOS                      |
|       |  * (1) Trazabilidad    |  * (3) Integracion SAP             |
|       |  * (2) Doc. nomina     |  * (7) Reestructura                |
|       |  * (4) Indicadores     |                                     |
|       |                        |                                     |
|  Bajo |  FILL-INS              |  EVITAR                            |
|       |  * (8) Manuales        |  * (12) Cambiar ERP               |
|       |  * (9) Templates       |                                     |
|       |________________________|___________________________          |
|         Bajo                    Alto                                  |
|                               Esfuerzo                               |
|                                                                       |
|  Leyenda:                                                            |
|  Tamano del punto = Reach | Color = Confianza (verde>rojo)          |
|  Hover = tooltip con detalle | Click = abrir detalle                |
+-----------------------------------------------------------------------+
```

- Implementacion: Recharts ScatterChart
- Eje X = Effort (mayor esfuerzo a la derecha)
- Eje Y = Impact
- Tamano burbuja = Reach
- Color = Confianza (gradiente verde -> amarillo -> rojo)
- 4 cuadrantes con backgrounds de color suave y etiquetas
- Tooltip on hover: nombre de la mejora + todos los scores RICE
- Click abre el Sheet de detalle

**Drag interactivo (Fase 2, no MVP):** El consultor podra arrastrar puntos para ajustar posicion (actualizando Impact y Effort). Recharts no lo soporta nativamente. Para MVP: solo visualizacion, ajustes via el Sheet de detalle.

#### 3.6 Vista Roadmap (RoadmapTimeline)

```
+-----------------------------------------------------------------------+
| ROADMAP DE MEJORAS                                                    |
+-----------------------------------------------------------------------+
|                                                                       |
| QUICK WINS (1-4 semanas)                               6 mejoras     |
| Impacto rapido con esfuerzo bajo                                     |
| |                                                                     |
| |--[1] Trazabilidad despachos            [LOG] [RICE: 78.4] [Prop.] |
| |--[2] Documentar nomina                 [ADM] [RICE: 71.2] [Prop.] |
| |--[4] Indicadores produccion            [PROD] [RICE: 58.3] [Prop.]|
| |--[5] Templates de reporte              [GER] [RICE: 52.1] [Prop.] |
| |--[8] Actualizar manuales               [CAL] [RICE: 34.5] [Prop.] |
| |--[9] Templates comunicacion            [ADM] [RICE: 31.2] [Prop.] |
|                                                                       |
| MEDIANO PLAZO (1-3 meses)                              8 mejoras     |
| Proyectos que requieren planificacion                                |
| |                                                                     |
| |--[3] Integracion SAP-Facturacion       [ADM] [RICE: 65.8] [Prop.] |
| |--[6] Capacitacion cruzada LOG          [LOG] [RICE: 55.0] [Prop.] |
| |--[10] Dashboard de gestion             [GER] [RICE: 48.7] [Prop.] |
| |--[11] Automatizar conciliacion         [ADM] [RICE: 45.3] [Prop.] |
| |  ...                                                                |
|                                                                       |
| LARGO PLAZO (3-6 meses)                                4 mejoras     |
| Transformaciones estructurales                                       |
| |                                                                     |
| |--[7] Reestructura area logistica       [LOG] [RICE: 62.1] [Prop.] |
| |--[12] Evaluar cambio ERP              [TI]  [RICE: 28.4] [Prop.] |
| |  ...                                                                |
+-----------------------------------------------------------------------+
```

- Agrupacion por horizonte temporal con header descriptivo
- Dentro de cada grupo: ordenado por RICE score descendente
- Cada item: numero + nombre + area badge + RICE score + estado badge
- Click abre Sheet de detalle
- Implementacion: divs con separadores y Cards compactos (no requiere libreria especial)

#### 3.7 Exportar Plan de Accion

Dropdown "Exportar Plan" con opciones:
- **PDF Ejecutivo:** Resumen ejecutivo + top 10 problemas + plan priorizado + roadmap + KPIs. Incluye diagramas Mermaid renderizados como SVG.
- **Excel Detallado:** Todas las mejoras con campos RICE, areas, evidencia, etc.

---

### 4. Dashboard de KPIs

#### 4.1 Sub-tab "KPIs" dentro de Diagnostico

```
/org-intelligence/projects/[id] > tab Diagnostico > sub-tab KPIs
```

#### 4.2 Layout -- KPIs agrupados por area

```
+-----------------------------------------------------------------------+
| KPIs PROPUESTOS                               [+ Nuevo KPI] [Export] |
| 24 propuestos | 8 validados | 0 en medicion                         |
+-----------------------------------------------------------------------+
| [Area: Todas v] [Estado: Todos v] [Frecuencia: Todas v]             |
+-----------------------------------------------------------------------+
|                                                                       |
| LOGISTICA (6 KPIs)                                     [Expandir]    |
+-----------------------------------------------------------------------+
| KPI                | Formula              | Frec. | Resp.   | Meta   |
|--------------------|----------------------|-------|---------|--------|
| Tiempo promedio    | Fecha despacho -     | Sem.  | Jefe    | < 2    |
| de despacho        | Fecha pedido (dias)  |       | Log.    | dias   |
|                    |                      |       |         |[Validar]|
|--------------------|----------------------|-------|---------|--------|
| Tasa de perdida    | Prod. perdidos /     | Mens. | Jefe    | < 0.5% |
| en despacho        | Total despachados    |       | Log.    |        |
|                    |                      |       |         |[Validar]|
+-----------------------------------------------------------------------+
|                                                                       |
| ADMINISTRACION (5 KPIs)                                [Expandir]    |
+-----------------------------------------------------------------------+
| ...                                                                   |
```

- Tabla agrupada por area (Collapsible por grupo)
- Columnas: Nombre, Formula/Definicion, Frecuencia, Responsable, Meta sugerida
- Boton "Validar" para cambiar estado de Propuesto a Validado
- Click en KPI abre Sheet con detalle completo

#### 4.3 Detalle de KPI (Sheet lateral)

```
+-------------------------------------------+
| KPI: Tiempo promedio de despacho    [X]   |
+-------------------------------------------+
| Estado:                                   |
| (Propuesto) -> [Validado] -> En Medicion  |
+-------------------------------------------+
|                                           |
| DEFINICION                                |
| Nombre: Tiempo promedio de despacho       |
| Formula: (Fecha entrega real - Fecha      |
|   pedido confirmado) / N despachos        |
| Unidad: Dias habiles                      |
| Frecuencia: Semanal                       |
| Responsable: Jefe de Logistica            |
| Fuente de datos: Sistema SAP              |
|                                           |
| META SUGERIDA                             |
| Valor objetivo: < 2 dias habiles          |
| Baseline estimado: 3-5 dias              |
| Justificacion: 4/8 entrevistados          |
|   mencionaron demoras.                    |
|                                           |
| EVIDENCIA                                 |
| > "Normalmente los despachos tardan       |
| > entre 3 y 5 dias..."                   |
|   -- Jefe Logistica, Ent. #4             |
|                                           |
| PROBLEMAS RELACIONADOS                    |
| [Despacho sin trazabilidad]               |
| [Comunicacion informal]                   |
|                                           |
| MEDICIONES (estado = En Medicion)         |
| +----------------------------------+     |
| | (Placeholder o grafico de linea) |     |
| | "Valida el KPI e inicia la       |     |
| |  medicion para ver datos aqui."  |     |
| +----------------------------------+     |
|                                           |
| [Editar] [Validar] [Iniciar Medicion]     |
| [Descartar]                               |
+-------------------------------------------+
```

#### 4.4 Estados del KPI

```
PROPUESTO -> VALIDADO -> EN_MEDICION -> (grafico con datos)
    |            |            |
    v            v            v
DESCARTADO  DESCARTADO    PAUSADO
```

#### 4.5 Grafico de KPI en el tiempo (KpiLineChart)

Cuando el KPI tiene datos de medicion:

```
| Tiempo promedio despacho (dias)
| Meta: 2.0
|
| 5 |  *
| 4 |     *   *
| 3 |              *   *
| 2 |---------------------------*-------  (meta punteada)
| 1 |
|   +-----+-----+-----+-----+-----+---
|   Sem 1 Sem 2 Sem 3 Sem 4 Sem 5 Sem 6
```

- Recharts LineChart con dos series: valor real (solida) + meta (punteada)
- Area coloreada: verde si cumple meta, rojo si no
- Invertir logica segun tipo de KPI ("menor es mejor" vs "mayor es mejor")
- Tooltip con valor exacto + fecha + variacion vs periodo anterior
- Para MVP: placeholder vacio con mensaje "Inicia medicion para ver datos"

---

### 5. Mensajes para los Otros Expertos UX

#### Para ux-projects (UX-1):

1. **Acepto tabs dentro del proyecto.** Mis contenidos viven en las dos ultimas tabs ("Diagnostico" y "Plan de Accion"). Propongo sub-tabs dentro de "Diagnostico": [Resumen] [Problemas] [Validacion] [KPIs]. Si prefieres evitar sub-tabs, puedo fusionar Problemas en Resumen.

2. **Transicion diagnostico -> plan:** Tu propuesta de "Crear iniciativa" en cada hallazgo es perfecta y la incorporo.

3. **Widget en dashboard general:** Propongo un card compacto en `/dashboard` con: "Proyectos activos: 1 | Pendientes validar: 89 | Entrevistas en proceso: 2".

4. **Exportacion:** PDF (ejecutivo, con diagramas) + Excel (operativo, con datos). Detalle en seccion 3.7.

#### Para ux-knowledge (UX-2):

1. **Deep links bidireccionales:** Cada entidad en mi dashboard debe ser clickeable -> navega al KG centrado en esa entidad. Necesito soporte de parametro `?focus=entity_id` en el KG explorer.

2. **Mini-grafo en Sheet lateral:** Para cuellos de botella y SPOFs, quiero mostrar el contexto del grafo en un Sheet. Fase 1: lista textual de conexiones. Fase 2+: Mermaid/React Flow mini.

3. **Metricas del grafo como API:** Betweenness, articulation points, etc. los consumo como datos. El KG explorer es para detalle; mi dashboard solo muestra highlights.

#### Para ux-diagrams (UX-3):

1. **Problema -> Diagrama:** En detalle de problema, mini-diagrama con nodo problematico resaltado en rojo. Necesito soporte de "highlight" de nodos via props.

2. **Mejora -> Diagrama:** En detalle de mejora, proceso afectado con overlay verde de la mejora.

3. **Validacion -> Diagrama:** Al validar una Actividad/Proceso, mostrar diagrama con nodo resaltado para contexto visual.

4. **Diagramas en exportacion PDF:** Necesito diagramas exportables como SVG/PNG para incluir en el PDF del plan de accion.

---

### 6. Resumen de Decisiones UX

| Decision | Eleccion | Justificacion |
|---|---|---|
| Salud por area | Scorecards (NO heatmap) | Mas legible para 6-8 areas, accionable, usa Card existente |
| RICE visual | Barras horizontales editables | Transparente, ajuste humano, consistente con Progress |
| Matriz esfuerzo-impacto | Scatter plot Recharts | Representacion estandar, 4 cuadrantes intuitivos |
| Roadmap | Timeline agrupada por horizonte | Mas simple que Gantt, suficiente para ~20 mejoras |
| Detalle mejora/KPI | Sheet lateral (drawer) | Mantiene contexto de la lista, no pierde el lugar |
| Queue de validacion | Cards expandibles + bulk actions | Eficiente para volumen, prioriza baja confianza |
| Audio en validacion | Player embebido con timestamps | Diferenciador de plataforma, verifica evidencia |
| Libreria de charts | Recharts (wrapper shadcn) | SSR-compatible, declarativo, integracion React |
| Sub-navegacion diagnostico | Sub-tabs dentro de tab | Resumen/Problemas/Validacion/KPIs son vistas distintas del mismo dominio |
| Drag scatter plot | Fase 2 (no MVP) | Recharts no soporta drag nativo, complejidad alta |
| Grafico KPI temporal | Placeholder MVP, datos Fase 3 | Mayoria de KPIs en "Propuesto", sin datos aun |

---

### 7. Prioridades de Implementacion (perspectiva UX)

**MVP (Fase 1):**
1. Dashboard diagnostico: StatCards + AreaScoreCards + tabla top problemas
2. Queue de validacion basica: cards expandibles con aprobar/editar/rechazar (sin audio)
3. Plan de mejoras: vista tabla con RICE scores (no editables aun)
4. KPIs: tabla agrupada por area con detalle en Sheet

**Fase 2:**
5. Audio clip player en validacion
6. RICE scores editables (sliders/inputs)
7. Scatter plot esfuerzo-impacto (solo visualizacion)
8. Roadmap timeline
9. Bulk actions en validacion
10. Deep links al knowledge graph
11. Cuellos de botella y SPOFs con datos reales del grafo

**Fase 3:**
12. Drag interactivo en scatter plot
13. KPI charts temporales con datos reales
14. Mini-grafos embebidos en context panels
15. Exportacion PDF del plan de accion
16. Dashboard comparativo entre proyectos
17. UI de resolucion de contradicciones
