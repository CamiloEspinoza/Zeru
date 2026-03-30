# Auditoria de Usabilidad — Modulo de Inteligencia Organizacional

**Fecha:** 2026-03-28
**Auditor:** Claude (revision exhaustiva de codigo)
**Alcance:** 35 archivos (7 paginas, 15 componentes, 11 servicios/controllers, 2 navegacion)

---

## 1. Resumen Ejecutivo

| Categoria | Critico | Alto | Medio | Bajo | Total |
|-----------|---------|------|-------|------|-------|
| Bugs funcionales | 3 | 5 | 4 | 2 | 14 |
| Usabilidad | 1 | 5 | 6 | 3 | 15 |
| Consistencia visual | 0 | 2 | 5 | 3 | 10 |
| Textos | 0 | 1 | 4 | 3 | 8 |
| Accesibilidad | 0 | 1 | 3 | 2 | 6 |
| Backend | 2 | 3 | 3 | 1 | 9 |
| **Total** | **6** | **17** | **25** | **14** | **62** |

---

## 2. Lista de Problemas

### CATEGORIA 1: Bugs Funcionales

---

#### P-001
- **Archivo:** `apps/api/src/modules/org-intelligence/controllers/entities.controller.ts`, linea 56
- **Categoria:** Bug funcional
- **Severidad:** CRITICO
- **Descripcion:** El endpoint `GET /org-intelligence/entities` retorna `{ items, total, page, perPage }` pero el frontend (knowledge-base/page.tsx, linea 221; project-analysis-tab.tsx, linea 88; project-diagnosis-tab.tsx, linea 92) espera `{ data, meta: { total, page, perPage } }`. Esto causa que `res.data` sea `undefined`, y las listas de entidades siempre aparezcan vacias en la Knowledge Base, el tab de Analisis y el tab de Diagnostico.
- **Solucion propuesta:** Cambiar el return del controller a `{ data: items, meta: { total, page: pageNum, perPage: perPageNum } }` para que coincida con la interfaz `EntitiesResponse` del frontend. Alternativamente, ajustar el frontend para usar `res.items`.

---

#### P-002
- **Archivo:** `apps/api/src/modules/org-intelligence/controllers/search.controller.ts`, lineas 12-43
- **Categoria:** Bug funcional
- **Severidad:** CRITICO
- **Descripcion:** Los endpoints de busqueda (`POST /search` y `POST /search/entities`) retornan directamente un array de resultados (sin wrapper `{ data: [...] }`), pero el frontend (knowledge-base/page.tsx, lineas 526-546) espera `{ data: [...] }` y accede a `entityRes.data` y `chunkRes.data`. Esto causa que la busqueda semantica nunca muestre resultados.
- **Solucion propuesta:** Envolver la respuesta del controller en `{ data: results }` o ajustar el frontend para manejar arrays directos.

---

#### P-003
- **Archivo:** `apps/api/src/modules/org-intelligence/services/interviews.service.ts`, linea 172
- **Categoria:** Bug funcional
- **Severidad:** CRITICO
- **Descripcion:** En `updateSpeakers`, la transaccion se ejecuta sobre `this.prisma` (PrismaService base) en lugar de `client` (el proxy tenant-aware). Esto significa que `tx.interviewSpeaker.deleteMany` y `tx.interviewSpeaker.createMany` se ejecutan SIN el filtro de tenant, lo que permite potencialmente acceder/modificar datos de otros tenants. Ademas, la linea 188 usa `client` (fuera del tx) para el findFirst final, mezclando contextos.
- **Solucion propuesta:** Usar `client.$transaction(...)` en lugar de `(this.prisma as unknown as PrismaClient).$transaction(...)`.

---

#### P-004
- **Archivo:** `apps/web/app/(dashboard)/org-intelligence/projects/[id]/interviews/[interviewId]/page.tsx`, lineas 870-871
- **Categoria:** Bug funcional
- **Severidad:** ALTO
- **Descripcion:** Los enlaces del `ProgressCelebration` apuntan a `/org-intelligence/projects/${id}?tab=analysis` y `?tab=diagnosis`, pero la pagina de detalle de proyecto usa `Tabs` con `defaultValue="interviews"` y no lee query params para setear el tab activo. El usuario clickea "Ir a Analisis" y aterriza en el tab de Entrevistas, no en Analisis.
- **Solucion propuesta:** Leer `searchParams.tab` en la pagina de detalle del proyecto y usarlo como `defaultValue` del componente `Tabs`. O usar `value` + `onValueChange` con state sincronizado al URL.

---

#### P-005
- **Archivo:** `apps/web/app/(dashboard)/org-intelligence/knowledge-base/page.tsx`, lineas 337-340
- **Categoria:** Bug funcional
- **Severidad:** ALTO
- **Descripcion:** El frontend define `_count?: { relations: number; reverseRelations: number }` para las entidades, pero el backend (entities.controller.ts, lineas 49-51) incluye `relationsFrom: { select: { id: true } }` y `relationsTo: { select: { id: true } }`, que retornan arrays de objetos, no counts. El acceso a `entity._count?.relations` siempre sera `undefined`.
- **Solucion propuesta:** En el controller de entidades, cambiar a `_count: { select: { relationsFrom: true, relationsTo: true } }` y ajustar el frontend para usar esos nombres. O incluir el `_count` correctamente.

---

#### P-006
- **Archivo:** `apps/web/components/org-intelligence/project-analysis-tab.tsx`, linea 63
- **Categoria:** Bug funcional
- **Severidad:** ALTO
- **Descripcion:** La funcion `SeverityBadge` intenta generar clases de background con `config.bgColor.replace("bg-", "bg-").replace("500", "100").replace("400", "100")`. El primer `.replace("bg-", "bg-")` no hace nada (reemplaza "bg-" por "bg-"). El resultado final es algo como `bg-red-100` pero el approach es fragil e incorrecto: para `bg-gray-400` produce `bg-gray-100` correctamente, pero para `bg-red-500` produce `bg-red-100`. Sin embargo, la logica es confusa y propensa a errores si se cambian los colores. Ademas, Tailwind no puede purgar clases generadas dinamicamente con `.replace()`.
- **Solucion propuesta:** Agregar una propiedad `badgeBgColor` explicita al `severityConfig` en lugar de computarla con string manipulation. Ejemplo: `{ label: "Critico", color: "text-red-700", bgColor: "bg-red-500", badgeBgColor: "bg-red-100" }`.

---

#### P-007
- **Archivo:** `apps/api/src/modules/org-intelligence/services/transcription.service.ts`, linea 85
- **Categoria:** Bug funcional
- **Severidad:** ALTO
- **Descripcion:** Al iniciar la transcripcion, el `processingStatus` se setea a `'PROCESSING'` (linea 85), pero el frontend pipeline stepper (interview detail page, linea 87) define los pasos como `["UPLOADED", "TRANSCRIBING", "EXTRACTING", "COMPLETED"]`. El estado `'PROCESSING'` no esta en el pipeline del frontend, asi que el stepper no mostraria ningún paso activo durante la transcripcion inicial.
- **Solucion propuesta:** Usar `processingStatus: 'TRANSCRIBING'` en lugar de `'PROCESSING'` en transcription.service.ts.

---

#### P-008
- **Archivo:** `apps/api/src/modules/org-intelligence/controllers/problems.controller.ts`, lineas 20-39
- **Categoria:** Bug funcional
- **Severidad:** MEDIO
- **Descripcion:** El endpoint `GET /problems` retorna directamente un array de problemas (sin paginacion), pero el frontend (project-analysis-tab.tsx, lineas 82-96) intenta manejar tanto `PaginatedResponse<Problem>` como `Problem[]`, usando `res.data ?? []`. Si la API retorna un array plano, `res.data` sera `undefined` (porque no hay propiedad `data` en un array). La logica de fallback `Array.isArray(problemsRes) ? problemsRes : (problemsRes as PaginatedResponse).data` deberia funcionar, pero solo si el `api.get<>` no envuelve la respuesta.
- **Solucion propuesta:** Estandarizar: o el backend retorna siempre `{ data: [...], meta: {...} }` o el frontend siempre espera arrays planos. No ambos.

---

#### P-009
- **Archivo:** `apps/web/app/(dashboard)/org-intelligence/projects/[id]/interviews/[interviewId]/page.tsx`, lineas 87-88
- **Categoria:** Bug funcional
- **Severidad:** MEDIO
- **Descripcion:** El pipeline stepper del frontend solo muestra 4 pasos: `UPLOADED`, `TRANSCRIBING`, `EXTRACTING`, `COMPLETED`. Pero el backend (status-badge.tsx) reconoce muchos mas estados: `POST_PROCESSING`, `RESOLVING_COREFERENCES`, `SUMMARIZING`, `CHUNKING`, `EMBEDDING`. Si el procesamiento esta en alguno de estos estados intermedios, el stepper no sabe como representarlo y no mostrara progreso.
- **Solucion propuesta:** Agrupar los estados backend en los 4 pasos del stepper. Por ejemplo: `POST_PROCESSING` -> "Transcribiendo", `RESOLVING_COREFERENCES`/`SUMMARIZING`/`CHUNKING`/`EMBEDDING` -> "Extrayendo".

---

#### P-010
- **Archivo:** `apps/web/app/(dashboard)/org-intelligence/projects/[id]/page.tsx`, linea 455
- **Categoria:** Bug funcional
- **Severidad:** MEDIO
- **Descripcion:** `project._count!.entities` usa non-null assertion (`!`) pero `_count` es opcional (`_count?`). Si el API no incluye `_count` en la respuesta, esto causara un runtime error en TypeScript strict mode.
- **Solucion propuesta:** Cambiar a `project._count?.entities ?? 0`.

---

#### P-011
- **Archivo:** `apps/web/app/(dashboard)/org-intelligence/projects/[id]/interviews/[interviewId]/page.tsx`, linea 520
- **Categoria:** Bug funcional
- **Severidad:** MEDIO
- **Descripcion:** `currentStepIndex` se calcula con `pipelineSteps.indexOf(currentStatus)`. Si `currentStatus` es un estado intermedio no listado en `pipelineSteps` (ej: `POST_PROCESSING`, `CHUNKING`), el resultado es `-1`, y toda la logica del stepper se rompe (ningun paso se marca como actual o completado).
- **Solucion propuesta:** Mapear estados intermedios a su paso mas cercano antes de calcular el indice.

---

#### P-012
- **Archivo:** `apps/api/src/modules/org-intelligence/services/transcription.service.ts`, linea 162
- **Categoria:** Bug funcional
- **Severidad:** BAJO
- **Descripcion:** Despues de una transcripcion exitosa, `processingStatus` se setea a `'TRANSCRIBED'`, un estado que no esta mapeado en el StatusBadge del frontend ni en el pipeline stepper. Se mostraria el valor raw "TRANSCRIBED" como texto del badge.
- **Solucion propuesta:** Usar un estado que el frontend reconozca, como `'EXTRACTING'` (si el pipeline continua) o agregar `'TRANSCRIBED'` al status badge config.

---

#### P-013
- **Archivo:** `apps/web/app/(dashboard)/org-intelligence/knowledge-base/page.tsx`, linea 229
- **Categoria:** Bug funcional
- **Severidad:** BAJO
- **Descripcion:** El `fetchEntities` tiene `activeTypes` en su dependency array del `useCallback`, pero cuando hay mas de 1 tipo activo, el `typeParam` queda vacio (linea 218: `activeTypes.size === 1 ? ... : ""`). Esto significa que la API no filtra por tipo cuando se seleccionan multiples tipos, pero luego el frontend filtra client-side (linea 251). Esto puede causar confusion si hay muchas entidades: la paginacion server-side no coincide con el filtro client-side.
- **Solucion propuesta:** Enviar todos los tipos activos como parametro al API, o documentar claramente que el filtro multi-tipo es solo client-side.

---

#### P-014
- **Archivo:** `apps/web/components/org-intelligence/project-analysis-tab.tsx`, lineas 82-104
- **Categoria:** Bug funcional
- **Severidad:** MEDIO
- **Descripcion:** `fetchData` pide problemas a `/org-intelligence/problems?projectId=${projectId}` y entidades a `/org-intelligence/entities?projectId=${projectId}`. Los problemas retornan un array plano, las entidades retornan `{ items, total, page, perPage }`. El codigo intenta manejar ambos formatos con `Array.isArray(res) ? res : res.data`, pero `res.data` no existe en la respuesta de entities (es `res.items`). Las entidades siempre seran un array vacio en el analysis tab.
- **Solucion propuesta:** Mismo fix que P-001: alinear nombres de campo entre backend y frontend.

---

### CATEGORIA 2: Usabilidad

---

#### P-015
- **Archivo:** Multiples archivos (projects/page.tsx lineas 98-99, 121-122; projects/[id]/page.tsx lineas 181-182, 195-196, 255-256, etc.)
- **Categoria:** Usabilidad
- **Severidad:** CRITICO
- **Descripcion:** Todos los `catch` blocks en operaciones CRUD (crear, editar, eliminar proyectos, entrevistas, personas) estan vacios: `catch { // silently fail }`. El usuario hace click en "Crear" o "Eliminar", la operacion falla, el boton vuelve a su estado normal, y no recibe ningun feedback. No sabe si la operacion tuvo exito o fallo. Se contaron **mas de 25 catch blocks silenciosos** en todo el modulo.
- **Solucion propuesta:** Agregar `toast.error("No se pudo completar la accion")` o un mecanismo de notificacion al usuario en cada catch block. Minimo mostrar un mensaje generico; idealmente uno especifico por operacion.

---

#### P-016
- **Archivo:** `apps/web/app/(dashboard)/org-intelligence/projects/page.tsx`
- **Categoria:** Usabilidad
- **Severidad:** ALTO
- **Descripcion:** No hay paginacion en la lista de proyectos. Si el usuario tiene 50+ proyectos, todos se renderizan en una sola vista. La API probablemente soporta paginacion pero el frontend pide todo sin paginar.
- **Solucion propuesta:** Agregar paginacion con controles de pagina anterior/siguiente, similar a como se implemento en EntitiesTab.

---

#### P-017
- **Archivo:** `apps/web/app/(dashboard)/org-intelligence/projects/[id]/interviews/[interviewId]/page.tsx`
- **Categoria:** Usabilidad
- **Severidad:** ALTO
- **Descripcion:** El upload de audio no valida el tamano del archivo en el frontend (solo el backend valida a 500MB). Si el usuario intenta subir un archivo de 1GB, el upload empieza, progresa lentamente, y falla despues de mucho tiempo sin mensaje claro. Tampoco valida el tipo de archivo en el frontend; un .pdf se intentaria subir.
- **Solucion propuesta:** Validar tamano maximo (500MB) y tipos de archivo permitidos (mp3, wav, m4a, ogg, webm) ANTES de iniciar el upload. Mostrar un error claro si no pasa la validacion.

---

#### P-018
- **Archivo:** `apps/web/app/(dashboard)/org-intelligence/projects/[id]/interviews/[interviewId]/page.tsx`, lineas 560-567
- **Categoria:** Usabilidad
- **Severidad:** ALTO
- **Descripcion:** Cuando el procesamiento falla (`FAILED`), el boton "Reintentar procesamiento" llama directamente a `handleReprocess()` sin confirmacion. El reproceso es una operacion costosa (transcripcion + 5 pasadas de extraccion con IA). Deberia usar el dialogo de confirmacion como el boton de reprocesar que aparece en COMPLETED.
- **Solucion propuesta:** Reutilizar el dialog de confirmacion de reproceso para el estado FAILED.

---

#### P-019
- **Archivo:** `apps/web/app/(dashboard)/org-intelligence/projects/[id]/page.tsx`
- **Categoria:** Usabilidad
- **Severidad:** ALTO
- **Descripcion:** No hay boton de "refrescar" o polling para actualizar el estado de las entrevistas en el tab de Entrevistas del proyecto. Si el usuario deja esta pagina abierta mientras una entrevista se procesa, el estado nunca se actualiza. El polling solo existe en la pagina de detalle de la entrevista individual.
- **Solucion propuesta:** Agregar polling periodico o un boton "Actualizar" en el tab de Entrevistas.

---

#### P-020
- **Archivo:** `apps/web/app/(dashboard)/org-intelligence/knowledge-base/page.tsx`, linea 175
- **Categoria:** Usabilidad
- **Severidad:** ALTO
- **Descripcion:** Las tabs de Knowledge Base tienen como `defaultValue` "search" (busqueda) pero la primera tab visible es "Entidades". Esto causa que al abrir la pagina, la tab activa sea "Busqueda" (la segunda visualmente), lo cual puede confundir al usuario.
- **Solucion propuesta:** Cambiar `defaultValue` a "entities" o reordenar las tabs para que "search" sea la primera.

---

#### P-021
- **Archivo:** `apps/web/app/(dashboard)/org-intelligence/persons/page.tsx`
- **Categoria:** Usabilidad
- **Severidad:** MEDIO
- **Descripcion:** No hay paginacion en la lista de personas. La API parece soportar paginacion (la respuesta incluye `meta.totalPages`), pero el frontend no implementa controles de paginacion.
- **Solucion propuesta:** Agregar paginacion similar a la de entidades.

---

#### P-022
- **Archivo:** `apps/web/app/(dashboard)/org-intelligence/persons/page.tsx`, linea 145
- **Categoria:** Usabilidad
- **Severidad:** MEDIO
- **Descripcion:** La carga de avatares se dispara en un `useEffect` sin control adecuado. Cada vez que cambia `persons` o `avatarUrls`, se re-evalua. Dado que `avatarUrls` cambia con cada avatar cargado, esto puede crear un loop de re-renders y llamadas API cuando hay muchas personas con avatar.
- **Solucion propuesta:** Cargar todos los avatares en un solo batch o usar un ref para trackear cuales ya se solicitaron, evitando que `avatarUrls` en el dependency array cause re-ejecuciones.

---

#### P-023
- **Archivo:** `apps/web/app/(dashboard)/org-intelligence/projects/[id]/interviews/[interviewId]/page.tsx`
- **Categoria:** Usabilidad
- **Severidad:** MEDIO
- **Descripcion:** El formulario de "Nueva Entrevista" (dialog en project detail page) incluye un campo "Contexto / Descripcion" que se guarda en `interviewForm.description`, pero al llamar `handleCreateInterview`, este campo NO se envia a la API. La informacion que el usuario escribe se pierde silenciosamente.
- **Solucion propuesta:** Incluir `description: interviewForm.description || undefined` en el body del POST a `/org-intelligence/interviews`.

---

#### P-024
- **Archivo:** `apps/web/app/(dashboard)/org-intelligence/projects/[id]/page.tsx`, lineas 262-275
- **Categoria:** Usabilidad
- **Severidad:** MEDIO
- **Descripcion:** La configuracion del proyecto en el tab "Configuracion" no permite borrar la descripcion (enviar una descripcion vacia). Si el usuario borra el texto del campo descripcion y guarda, se envia `undefined` en lugar de una cadena vacia, lo que deja el valor anterior intacto.
- **Solucion propuesta:** Enviar `description: editForm.description` (sin el `|| undefined`) para permitir valores vacios.

---

#### P-025
- **Archivo:** `apps/web/app/(dashboard)/org-intelligence/projects/[id]/interviews/[interviewId]/page.tsx`
- **Categoria:** Usabilidad
- **Severidad:** MEDIO
- **Descripcion:** No hay confirmacion al eliminar un speaker/participante. El boton "Eliminar" en cada participante ejecuta `handleDeleteSpeaker(index)` directamente, sin dialogo de confirmacion.
- **Solucion propuesta:** Agregar un dialogo de confirmacion o al menos un doble-click.

---

#### P-026
- **Archivo:** `apps/web/app/(dashboard)/org-intelligence/projects/[id]/page.tsx`
- **Categoria:** Usabilidad
- **Severidad:** MEDIO
- **Descripcion:** No hay feedback visual al cambiar el estado del proyecto (Select de estado en el header). `changingStatus` se usa para deshabilitar el select, pero no se muestra ningun indicador de carga ni confirmacion.
- **Solucion propuesta:** Agregar un toast o indicador visual de exito/error al cambiar el estado.

---

#### P-027
- **Archivo:** `apps/web/components/org-intelligence/project-improvements-tab.tsx`
- **Categoria:** Usabilidad
- **Severidad:** BAJO
- **Descripcion:** La tabla de mejoras no tiene accion al hacer click en una fila. No se puede ver el detalle de una mejora, ni cambiar su estado, ni editar nada. Es solo informativa.
- **Solucion propuesta:** Agregar dialogo de detalle al hacer click, o permitir cambiar el estado desde la tabla.

---

#### P-028
- **Archivo:** `apps/web/components/org-intelligence/project-diagnosis-tab.tsx`
- **Categoria:** Usabilidad
- **Severidad:** BAJO
- **Descripcion:** Las tarjetas de contradictions muestran el `status` raw como un Badge sin mapear. El frontend muestra `c.status` como Badge con `variant="outline"`, que mostrara valores como "UNRESOLVED" o "RESOLVED" en ingles.
- **Solucion propuesta:** Usar `StatusBadge` para el status de la contradiccion o crear un mapeo de labels.

---

#### P-029
- **Archivo:** `apps/web/components/org-intelligence/onboarding-checklist.tsx`
- **Categoria:** Usabilidad
- **Severidad:** BAJO
- **Descripcion:** El checklist de onboarding no tiene forma de tracking real. Los `completedSteps` se pasan como props pero no hay integracion con la API para saber que pasos realmente se han completado. El componente parece no usarse en ninguna pagina activa.
- **Solucion propuesta:** Conectar con la API o localStorage para trackear progreso real, o remover si no se usa.

---

### CATEGORIA 3: Consistencia Visual

---

#### P-030
- **Archivo:** `apps/web/app/(dashboard)/org-intelligence/projects/[id]/interviews/[interviewId]/page.tsx`, lineas 102-111
- **Categoria:** Consistencia visual
- **Severidad:** ALTO
- **Descripcion:** Los `speakerColors` solo tienen clases para light mode: `"bg-blue-100 text-blue-800"`, sin variantes `dark:`. En dark mode, el texto sera ilegible (texto oscuro sobre fondo oscuro). Esto afecta toda la seccion de transcripcion.
- **Solucion propuesta:** Agregar variantes dark: `"bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"`.

---

#### P-031
- **Archivo:** `apps/web/components/org-intelligence/entity-type-badge.tsx`, lineas 1-70
- **Categoria:** Consistencia visual
- **Severidad:** ALTO
- **Descripcion:** El `EntityTypeBadge` no tiene variantes `dark:` para ninguno de sus colores. Todas las clases son tipo `bg-blue-100 text-blue-700`, que seran ilegibles en dark mode. Compare con `StatusBadge` que SI tiene dark mode (`dark:bg-blue-900 dark:text-blue-300`).
- **Solucion propuesta:** Agregar clases `dark:` a cada configuracion de `ENTITY_TYPE_CONFIG`.

---

#### P-032
- **Archivo:** `apps/web/components/org-intelligence/confidence-badge.tsx`, lineas 1-16
- **Categoria:** Consistencia visual
- **Severidad:** MEDIO
- **Descripcion:** `ConfidenceBadge` no tiene variantes `dark:`. Las clases `bg-green-100 text-green-700` seran ilegibles en dark mode. Mismo patron que P-031.
- **Solucion propuesta:** Agregar variantes dark como `dark:bg-green-900 dark:text-green-300`.

---

#### P-033
- **Archivo:** `apps/web/components/org-intelligence/mermaid-diagram.tsx`, linea 53
- **Categoria:** Consistencia visual
- **Severidad:** MEDIO
- **Descripcion:** El error de renderizado de Mermaid usa clases `border-red-200 bg-red-50 text-red-700` sin variantes `dark:`. Tambien, el tema de Mermaid esta hardcodeado como `"neutral"` (linea 23), que tiene fondo blanco y no se adapta al dark mode.
- **Solucion propuesta:** Detectar el tema actual (light/dark) y usar `theme: "dark"` cuando corresponda. Agregar clases `dark:` al error div.

---

#### P-034
- **Archivo:** `apps/web/app/(dashboard)/org-intelligence/knowledge-base/page.tsx`, lineas 678-679
- **Categoria:** Consistencia visual
- **Severidad:** MEDIO
- **Descripcion:** Los badges de speaker en resultados de busqueda (fragmentos de entrevista) usan clases hardcodeadas `bg-indigo-100 text-indigo-700` sin dark mode. Contraste insuficiente en dark mode.
- **Solucion propuesta:** Agregar `dark:bg-indigo-900 dark:text-indigo-300`.

---

#### P-035
- **Archivo:** `apps/web/components/org-intelligence/project-analysis-tab.tsx`, lineas 42-53
- **Categoria:** Consistencia visual
- **Severidad:** MEDIO
- **Descripcion:** `severityConfig` en analysis tab define su propio sistema de colores con `bgColor: "bg-red-500"` para las barras de severidad. Pero `SeverityBadge` (mismo archivo, linea 55) intenta derivar colores de background con string manipulation (ver P-006). Esto no usa el sistema unificado de `StatusBadge` que ya existe y tiene dark mode support.
- **Solucion propuesta:** Reutilizar `StatusBadge` con `type="severity"` en lugar de crear un `SeverityBadge` duplicado.

---

#### P-036
- **Archivo:** `apps/web/components/org-intelligence/project-improvements-tab.tsx`, lineas 219-243
- **Categoria:** Consistencia visual
- **Severidad:** MEDIO
- **Descripcion:** Las etiquetas de cuadrantes de la matriz esfuerzo-impacto usan clases sin dark mode: `bg-green-50 text-green-600`, `bg-gray-50 text-gray-500`, `bg-blue-50 text-blue-600`, `bg-red-50 text-red-500`. Invisibles en dark mode.
- **Solucion propuesta:** Agregar variantes dark a cada etiqueta de cuadrante.

---

#### P-037
- **Archivo:** `apps/web/app/(dashboard)/org-intelligence/projects/[id]/page.tsx`, linea 237
- **Categoria:** Consistencia visual
- **Severidad:** BAJO
- **Descripcion:** El CardTitle de los project cards usa `text-sm font-semibold`, pero en la pagina de detalle del proyecto el titulo usa `text-2xl font-bold`. En la lista de entrevistas dentro del proyecto, el titulo usa `text-sm` sin `font-semibold`. No hay una jerarquia tipografica consistente.
- **Solucion propuesta:** Definir escalas tipograficas estandar para h1, h2, h3 dentro del modulo.

---

#### P-038
- **Archivo:** Multiples componentes
- **Categoria:** Consistencia visual
- **Severidad:** BAJO
- **Descripcion:** Las tarjetas (Cards) tienen estilos inconsistentes de padding. Algunos usan `py-3` en CardContent (entidades), otros `py-4` (stats), otros `py-10` (empty states), otros `py-12` (empty states alternativos). No hay un sistema de spacing consistente.
- **Solucion propuesta:** Estandarizar: empty states = `py-12`, content normal = `py-4`, compact = `py-3`.

---

#### P-039
- **Archivo:** Multiples componentes
- **Categoria:** Consistencia visual
- **Severidad:** BAJO
- **Descripcion:** Los iconos vienen de tres fuentes diferentes: Hugeicons (HugeiconsIcon), SVGs inline (en empty states, onboarding, banners), y caracteres Unicode (emojis de advertencia en diagnosis tab: `&#9888;`). Esto crea una experiencia visual inconsistente.
- **Solucion propuesta:** Estandarizar en Hugeicons para todos los iconos del modulo.

---

### CATEGORIA 4: Textos

---

#### P-040
- **Archivo:** `apps/web/app/(dashboard)/org-intelligence/persons/page.tsx`, linea 283
- **Categoria:** Textos
- **Severidad:** ALTO
- **Descripcion:** "Directorio de personas de la organizacion" — falta tilde en "organizacion". Deberia ser "organizacion" (con tilde). Mismo archivo, linea 499: "Telefono" sin tilde, deberia ser "Telefono".
- **Solucion propuesta:** Corregir a "organizacion" y "Telefono" con tildes.

---

#### P-041
- **Archivo:** `apps/web/app/(dashboard)/org-intelligence/persons/page.tsx`, linea 550
- **Categoria:** Textos
- **Severidad:** MEDIO
- **Descripcion:** "Se eliminara el perfil" y "Esta accion no se puede deshacer" — faltan tildes en "eliminara" (eliminara) y "accion" (accion). Multiples palabras sin tilde en este dialogo.
- **Solucion propuesta:** Corregir tildes: "eliminara", "accion".

---

#### P-042
- **Archivo:** `apps/web/components/layouts/breadcrumbs.tsx`, linea 34
- **Categoria:** Textos
- **Severidad:** MEDIO
- **Descripcion:** "Knowledge Base" aparece en ingles tanto en los breadcrumbs como en el nav. Deberia ser "Base de Conocimiento" para mantener consistencia con el resto de la UI en espanol.
- **Solucion propuesta:** Cambiar a "Base de Conocimiento" en breadcrumbs y nav.

---

#### P-043
- **Archivo:** `apps/web/components/layouts/breadcrumbs.tsx`, linea 64
- **Categoria:** Textos
- **Severidad:** MEDIO
- **Descripcion:** Cuando un segmento de URL es un UUID (ej: el ID de un proyecto o entrevista), el breadcrumb muestra el UUID raw como label. Por ejemplo: "Proyectos > a1b2c3d4-e5f6-..." en vez de mostrar el nombre del proyecto.
- **Solucion propuesta:** Implementar resolucion de nombres para segmentos UUID, al menos para proyectos y entrevistas.

---

#### P-044
- **Archivo:** `apps/web/components/org-intelligence/glossary-term.tsx`, linea 26
- **Categoria:** Textos
- **Severidad:** MEDIO
- **Descripcion:** Varios terminos del glosario tienen tildes faltantes: "diarizacion" (deberia ser "diarizacion"), "extraccion" (deberia ser "extraccion"), "reconciliacion" (deberia ser "reconciliacion").
- **Solucion propuesta:** Corregir todas las tildes en las keys y definiciones del glosario.

---

#### P-045
- **Archivo:** `apps/api/src/modules/org-intelligence/controllers/interviews.controller.ts`, linea 89
- **Categoria:** Textos
- **Severidad:** BAJO
- **Descripcion:** Mensaje de error "No se recibio ningun archivo de audio" sin tilde en "recibio". Es un mensaje que puede llegar al frontend.
- **Solucion propuesta:** Corregir a "No se recibio ningun archivo de audio".

---

#### P-046
- **Archivo:** `apps/web/app/(dashboard)/org-intelligence/projects/[id]/interviews/[interviewId]/page.tsx`, linea 1011
- **Categoria:** Textos
- **Severidad:** BAJO
- **Descripcion:** "sobreescritos" deberia ser "sobrescritos" (sin doble e).
- **Solucion propuesta:** Corregir a "sobrescritos".

---

#### P-047
- **Archivo:** `apps/web/components/org-intelligence/project-improvements-tab.tsx`, linea 148
- **Categoria:** Textos
- **Severidad:** BAJO
- **Descripcion:** El banner educativo usa terminologia "metodo RICE" sin explicar que significa en el contexto visible (solo se explica en el tooltip mas abajo). El usuario promedio no sabe que es RICE.
- **Solucion propuesta:** Agregar una explicacion breve inline o hacer el texto del banner mas descriptivo.

---

### CATEGORIA 5: Accesibilidad

---

#### P-048
- **Archivo:** `apps/web/app/(dashboard)/org-intelligence/projects/[id]/interviews/[interviewId]/page.tsx`, lineas 712-724
- **Categoria:** Accesibilidad
- **Severidad:** ALTO
- **Descripcion:** La zona de drag-and-drop para subir audio no tiene roles ARIA (`role="button"`, `aria-label`), no es activable por teclado (no tiene `tabIndex`, `onKeyDown`), y no tiene un label accesible. Un usuario de screen reader no puede subir audio.
- **Solucion propuesta:** Agregar `role="button"`, `tabIndex={0}`, `aria-label="Subir archivo de audio"`, y `onKeyDown` para activar con Enter/Space.

---

#### P-049
- **Archivo:** `apps/web/app/(dashboard)/org-intelligence/knowledge-base/page.tsx`, lineas 281-292
- **Categoria:** Accesibilidad
- **Severidad:** MEDIO
- **Descripcion:** Los botones de filtro por tipo de entidad son `<button>` sin `aria-pressed` para indicar el estado activo/inactivo. Un screen reader no puede saber que filtros estan activos.
- **Solucion propuesta:** Agregar `aria-pressed={activeTypes.has(type)}` a cada boton de filtro.

---

#### P-050
- **Archivo:** `apps/web/app/(dashboard)/org-intelligence/knowledge-base/page.tsx`, lineas 593-601
- **Categoria:** Accesibilidad
- **Severidad:** MEDIO
- **Descripcion:** Los botones de ejemplos de busqueda son `<button>` genericos sin roles o labels descriptivos. No se comunica su proposito a tecnologias asistivas.
- **Solucion propuesta:** Agregar `aria-label="Buscar: ${example}"` a cada boton de ejemplo.

---

#### P-051
- **Archivo:** `apps/web/app/(dashboard)/org-intelligence/projects/[id]/interviews/[interviewId]/page.tsx`
- **Categoria:** Accesibilidad
- **Severidad:** MEDIO
- **Descripcion:** Las tarjetas de entrevistas y proyectos son `<Card>` con `onClick` y `cursor-pointer`, pero no tienen `role="link"` ni `tabIndex`. No son accesibles por teclado.
- **Solucion propuesta:** Envolver en `<Link>` en lugar de usar `onClick` con `router.push`, o agregar `role="link"`, `tabIndex={0}`, y manejar `onKeyDown`.

---

#### P-052
- **Archivo:** `apps/web/components/org-intelligence/educational-empty-state.tsx`, lineas 60-70
- **Categoria:** Accesibilidad
- **Severidad:** BAJO
- **Descripcion:** Los iconos SVG inline en empty states y tips no tienen `aria-hidden="true"`, lo que hace que screen readers intenten interpretarlos.
- **Solucion propuesta:** Agregar `aria-hidden="true"` a todos los SVGs decorativos.

---

#### P-053
- **Archivo:** `apps/web/app/(dashboard)/org-intelligence/persons/page.tsx`, linea 433-439
- **Categoria:** Accesibilidad
- **Severidad:** BAJO
- **Descripcion:** El `<input type="file">` oculto para avatar no tiene `aria-label`. Aunque esta visualmente oculto, deberia tener un label accesible.
- **Solucion propuesta:** Agregar `aria-label="Subir foto de perfil"`.

---

### CATEGORIA 6: Backend

---

#### P-054
- **Archivo:** `apps/api/src/modules/org-intelligence/services/interviews.service.ts`, linea 172
- **Categoria:** Backend
- **Severidad:** CRITICO
- **Descripcion:** (Duplicado de P-003 por impacto de seguridad) La transaccion de `updateSpeakers` se ejecuta sobre el PrismaClient base, no sobre el tenant-aware client. Esto significa que `deleteMany` y `createMany` operan sin filtro de tenant. Un atacante podria potencialmente manipular speakers de entrevistas de otro tenant si conoce el `interviewId`.
- **Solucion propuesta:** Usar `client.$transaction(...)` en lugar de `(this.prisma as unknown as PrismaClient).$transaction(...)`.

---

#### P-055
- **Archivo:** `apps/api/src/modules/org-intelligence/services/org-search.service.ts`, lineas 147-148
- **Categoria:** Backend
- **Severidad:** CRITICO
- **Descripcion:** Potencial SQL injection en `searchEntities`. Aunque hay una validacion de que `type` pertenezca a `VALID_ENTITY_TYPES` (linea 147), la interpolacion de string se hace con template literal: `AND e.type = '${type}'` (linea 148). Si la validacion del Set falla o se bypasea de alguna forma, esto es inyectable. Deberia usar parametros posicionales.
- **Solucion propuesta:** Pasar `type` como parametro posicional: `$5` en la query y pasarlo como argumento a `$queryRawUnsafe`.

---

#### P-056
- **Archivo:** `apps/api/src/modules/org-intelligence/controllers/search.controller.ts`, lineas 12-43
- **Categoria:** Backend
- **Severidad:** ALTO
- **Descripcion:** Los endpoints de busqueda no tienen validacion de input con Zod. Los parametros `projectId`, `query`, `limit` y `type` se toman directamente del body sin validar. Un `query` vacio, un `limit` de 10000, o un `projectId` invalido se procesarian sin restriccion. La busqueda semantica es costosa (genera embeddings con OpenAI).
- **Solucion propuesta:** Crear un schema Zod de validacion y aplicar `ZodValidationPipe`. Limitar `limit` a un maximo razonable (ej: 50).

---

#### P-057
- **Archivo:** `apps/api/src/modules/org-intelligence/controllers/entities.controller.ts`, lineas 21-56
- **Categoria:** Backend
- **Severidad:** ALTO
- **Descripcion:** El endpoint `GET /entities` no valida `projectId`. Si no se envia, la query buscara entidades con `projectId: undefined`, lo que en Prisma equivale a no filtrar por proyecto, retornando entidades de todos los proyectos del tenant. Tampoco valida que `page` y `perPage` sean numeros validos.
- **Solucion propuesta:** Validar que `projectId` sea requerido y UUID valido. Validar que `page` y `perPage` sean numeros positivos con limites razonables.

---

#### P-058
- **Archivo:** `apps/api/src/modules/org-intelligence/controllers/entities.controller.ts`, lineas 82-106
- **Categoria:** Backend
- **Severidad:** ALTO
- **Descripcion:** Los endpoints `POST :id/approve` y `POST :id/reject` no verifican que la entidad pertenezca al tenant del usuario. Solo validan por `id`. Un usuario podria aprobar/rechazar entidades de otro tenant si conoce el UUID.
- **Solucion propuesta:** Agregar un `findFirst` con filtro de `tenantId` antes del update, similar al patron usado en `InterviewsService.findOne`.

---

#### P-059
- **Archivo:** `apps/api/src/modules/org-intelligence/controllers/interviews.controller.ts`, linea 93
- **Categoria:** Backend
- **Severidad:** MEDIO
- **Descripcion:** El endpoint `POST :id/process` no tiene rate limiting. Un usuario malicioso o un bug en el frontend podria enviar multiples requests de procesamiento simultaneos, causando multiples transcripciones y extracciones en paralelo para la misma entrevista, con costos significativos en API calls de Deepgram y OpenAI.
- **Solucion propuesta:** Verificar que la entrevista no este ya en procesamiento antes de lanzar el pipeline. Idealmente agregar rate limiting a nivel de endpoint.

---

#### P-060
- **Archivo:** `apps/api/src/modules/org-intelligence/services/chunking.service.ts`, lineas 125-129
- **Categoria:** Backend
- **Severidad:** MEDIO
- **Descripcion:** La eliminacion de chunks existentes usa `$executeRawUnsafe` con parametros posicionales, lo cual es correcto. Sin embargo, se ejecuta en el contexto del PrismaService base, no del client tenant-aware. Si bien los parametros incluyen `tenantId`, es un patron inconsistente con el resto del servicio.
- **Solucion propuesta:** Usar el client tenant-aware o, si raw SQL es necesario, asegurarse de que el filtro de tenant sea siempre explicito.

---

#### P-061
- **Archivo:** `apps/api/src/modules/org-intelligence/services/org-diagnosis.service.ts`, lineas 43-91
- **Categoria:** Backend
- **Severidad:** MEDIO
- **Descripcion:** Las queries raw para SPOF y bottleneck detection no incluyen filtro por `tenantId` en las tablas de `org_relations` (solo en `org_entities`). Si un tenant tiene relaciones con IDs de entidades de otro tenant (improbable pero posible si hay un bug en coreference), podria exponer datos.
- **Solucion propuesta:** Agregar `AND r."tenantId" = $1` a las JOINs de `org_relations`.

---

#### P-062
- **Archivo:** `apps/api/src/modules/org-intelligence/controllers/diagnosis.controller.ts`, lineas 23-28
- **Categoria:** Backend
- **Severidad:** BAJO
- **Descripcion:** El endpoint `GET /diagnosis` no valida que `projectId` sea un UUID valido. Un string arbitrario se pasaria directamente a las queries.
- **Solucion propuesta:** Agregar validacion de UUID para `projectId`.

---

## 3. Quick Fixes — Top 10 (mayor impacto, menor esfuerzo)

| # | ID | Archivo | Descripcion | Impacto | Esfuerzo |
|---|------|---------|-------------|---------|----------|
| 1 | P-001 | entities.controller.ts:56 | Cambiar `{ items }` a `{ data }` en la respuesta | CRITICO — desbloquea toda la Knowledge Base | 1 linea |
| 2 | P-002 | search.controller.ts | Envolver response en `{ data: results }` | CRITICO — habilita busqueda semantica | 2 lineas |
| 3 | P-007 | transcription.service.ts:85 | Cambiar `PROCESSING` a `TRANSCRIBING` | ALTO — fix de estado inconsistente | 1 linea |
| 4 | P-012 | transcription.service.ts:162 | Cambiar `TRANSCRIBED` a estado reconocido por frontend | BAJO — fix de estado roto | 1 linea |
| 5 | P-031 | entity-type-badge.tsx | Agregar clases `dark:` a cada tipo | ALTO — fix dark mode | 9 lineas |
| 6 | P-032 | confidence-badge.tsx | Agregar clases `dark:` | MEDIO — fix dark mode | 3 lineas |
| 7 | P-030 | interview detail page:102-111 | Agregar clases `dark:` a speakerColors | ALTO — fix dark mode transcripcion | 8 lineas |
| 8 | P-010 | project detail page:455 | Cambiar `_count!` a `_count?` | MEDIO — previene crash | 2 lineas |
| 9 | P-040 | persons/page.tsx | Corregir tildes en "organizacion" y "Telefono" | ALTO — error de idioma visible | 2 lineas |
| 10 | P-055 | org-search.service.ts:148 | Parametrizar `type` en query SQL | CRITICO — fix SQL injection | 5 lineas |

---

## 4. Problemas Criticos — DEBEN arreglarse antes de un usuario real

### 4.1 Datos vacios por mismatch API (P-001, P-002, P-005, P-014)
**Impacto:** Toda la Knowledge Base (entidades, busqueda, procesos) y los tabs de Analisis/Diagnostico muestran contenido vacio, a pesar de que los datos existen en la base de datos. El usuario procesa una entrevista exitosamente pero no puede ver los resultados.

**Root cause:** El controller de entidades retorna `{ items }` pero el frontend espera `{ data }`. El search controller retorna arrays planos pero el frontend espera `{ data: [...] }`.

**Fix requerido:**
1. `entities.controller.ts`: Cambiar `return { items, total, ... }` a `return { data: items, meta: { total, page, perPage } }`
2. `search.controller.ts`: Envolver las respuestas en `{ data: results }`

---

### 4.2 Vulnerabilidad de tenant isolation (P-003/P-054)
**Impacto:** La transaccion de `updateSpeakers` opera sin filtro de tenant, potencialmente permitiendo modificar datos de otros tenants.

**Fix requerido:** Cambiar `(this.prisma as unknown as PrismaClient).$transaction(...)` a `client.$transaction(...)` en `interviews.service.ts`.

---

### 4.3 Potencial SQL injection (P-055)
**Impacto:** El parametro `type` en `searchEntities` se interpola directamente en SQL. Aunque hay validacion con un Set, la interpolacion directa es peligrosa.

**Fix requerido:** Usar parametro posicional en lugar de interpolacion de string.

---

### 4.4 Errores silenciosos (P-015)
**Impacto:** El usuario no recibe feedback cuando las operaciones fallan. Puede intentar crear un proyecto, que falla por red, y no enterarse. Puede intentar eliminar y creer que se elimino cuando no fue asi.

**Fix requerido:** Agregar toast notifications en los catch blocks de al menos las operaciones criticas (crear, eliminar, procesar).

---

### 4.5 Pipeline status desincronizado (P-007, P-009, P-011, P-012)
**Impacto:** El stepper de progreso de procesamiento muestra informacion incorrecta. El backend usa estados que el frontend no reconoce (`PROCESSING`, `TRANSCRIBED`, `POST_PROCESSING`, `CHUNKING`, etc.). El usuario no sabe en que estado esta su entrevista.

**Fix requerido:** Alinear los estados entre backend y frontend. Crear un mapping de estados backend a pasos del stepper frontend.

---

### 4.6 Falta de validacion en endpoints (P-056, P-057, P-058)
**Impacto:** Endpoints sin validacion de input, entidades que se pueden aprobar/rechazar sin verificar tenant ownership, y busquedas sin limites de costo.

**Fix requerido:** Agregar validacion Zod a search endpoints, verificar tenant en approve/reject, y limitar parametros de busqueda.

---

*Fin del reporte de auditoria.*
