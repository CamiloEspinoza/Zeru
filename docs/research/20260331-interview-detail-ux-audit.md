# Auditoría UX/UI — Detalle de Entrevista

**Fecha:** 2026-03-31
**Alcance:** Página de detalle de entrevista (`/org-intelligence/projects/[id]/interviews/[interviewId]`) y sus ~16 componentes asociados.
**Método:** Revisión exhaustiva de código fuente + captura de pantalla.

---

## Resumen Ejecutivo

| Categoría | Crítico | Alto | Medio | Bajo | Total |
|-----------|---------|------|-------|------|-------|
| Bugs funcionales | 1 | 2 | 2 | 1 | 6 |
| Arquitectura de UI | 0 | 3 | 2 | 1 | 6 |
| Usabilidad / Flujo | 0 | 3 | 4 | 2 | 9 |
| Diseño visual | 0 | 1 | 3 | 2 | 6 |
| **Total** | **1** | **9** | **11** | **6** | **27** |

---

## CATEGORÍA 1: Bugs Funcionales

---

### BUG-001 — Preguntas generadas desaparecen al recargar la página

- **Severidad:** CRÍTICO
- **Archivos:** `page.tsx:190-193`, `interview-questions.service.ts:150-157`

**Descripción:**

Las preguntas generadas con IA SÍ se guardan en la base de datos, pero el frontend no puede leerlas de vuelta correctamente debido a un desajuste en la forma de los datos.

**Backend guarda:**
- `generatedIntro` = `parsed.introText` (campo String separado)
- `generatedQuestions` = `parsed.sections` (campo JSON — solo el **array de secciones**, no el objeto completo)

**Frontend al cargar intenta leer:**
```typescript
if (res.generatedQuestions) {
    setGeneratedIntroText(res.generatedQuestions.introText ?? "");  // ← undefined (es un array, no tiene .introText)
    setGeneratedSections(res.generatedQuestions.sections ?? []);    // ← undefined (es un array, no tiene .sections)
}
```

El campo `generatedQuestions` en la DB es `[{theme, questions}, ...]` pero el frontend espera `{introText, sections: [...]}`. Además, el campo `generatedIntro` que SÍ existe en la DB como campo separado nunca se lee durante la carga.

**Resultado:** Después de generar preguntas con IA (operación que cuesta tokens de OpenAI), al recargar la página el usuario pierde todo. Las preguntas están en la DB pero la UI no las muestra.

**Solución:**
```typescript
// Opción A — Arreglar el frontend para leer la estructura real:
if (res.generatedQuestions) {
    setGeneratedIntroText(res.generatedIntro ?? "");
    setGeneratedSections(res.generatedQuestions as Section[]);
}

// Opción B — Arreglar el backend para guardar la estructura completa:
data: {
    generatedQuestions: { introText: parsed.introText, sections: parsed.sections },
    questionsGeneratedAt: new Date(),
}
// Y eliminar el campo generatedIntro por separado
```

---

### BUG-002 — Dos componentes de carga de audio se muestran simultáneamente

- **Severidad:** ALTO
- **Archivos:** `page.tsx:744-811`

**Descripción:**

Cuando `processingStatus === "PENDING"` y no hay audio (`audioS3Key` es null), se muestran DOS interfaces de carga de audio al mismo tiempo:

1. **`InterviewAudioStep`** (línea 744): Grid con dos cards — "Grabar audio" y "Subir archivo". Se muestra cuando `hasAudio === false`.
2. **Card legacy "Subir Audio"** (línea 751): Drag & drop con validación de participantes. Se muestra cuando `showUpload === true` (PENDING + sin audio).

Ambas condiciones se cumplen simultáneamente en el estado inicial de una entrevista nueva. El usuario ve 3 formas de subir audio en la misma página.

**Solución:** Eliminar la card legacy de "Subir Audio" (líneas 751-811). El componente `InterviewAudioStep` ya cubre ambos casos (grabación + upload).

---

### BUG-003 — Editar entrevista solo permite cambiar título, pero ejecuta lógica para fecha

- **Severidad:** ALTO
- **Archivos:** `edit-interview-dialog.tsx`, `page.tsx:457-486`

**Descripción:**

El `EditInterviewDialog` solo muestra un campo de título, pero `handleSaveEdit` en page.tsx prepara y envía también `interviewDate` al backend. El usuario no tiene forma de editar la fecha de la entrevista desde el diálogo — el campo existe en `editForm` pero nunca se renderiza en el dialog.

Además, la fecha se inicializa con `openEditDialog()` (línea 462) pero el dialog no la muestra.

**Solución:** Agregar campo de fecha al diálogo de edición, o simplificar el handler para que solo envíe el título.

---

### BUG-004 — Ediciones de preguntas no persisten al backend

- **Severidad:** MEDIO
- **Archivos:** `interview-questions-view.tsx:42-45`

**Descripción:**

Cuando el usuario edita o elimina una pregunta (inline editing), los cambios se propagan al estado local con `update(sections)` → `onQuestionsChange?.(s)` → `setGeneratedSections(sections)` en page.tsx. Pero **nunca se llama al endpoint `PATCH /interviews/:id/questions`** que existe en el backend.

Las ediciones se pierden al recargar. El endpoint de actualización existe (`updateQuestions` en el servicio, línea 178-200) pero el frontend no lo invoca.

**Solución:** Agregar un debounce o botón "Guardar cambios" que llame `PATCH /org-intelligence/interviews/${interviewId}/questions` con las secciones actualizadas.

---

### BUG-005 — `speakerMap` nunca se popula correctamente para colores

- **Severidad:** MEDIO
- **Archivos:** `page.tsx:683-691`

**Descripción:**

```typescript
const speakerMap = new Map<string, number>();
// ... speakerNameMap se popula, pero speakerMap queda vacío
```

`speakerMap` se declara vacío y se pasa a `getSpeakerColor()` en la transcripción sin audio (línea 882), donde se popula lazily. Pero como se re-crea en cada render (está dentro del return), los colores podrían ser inconsistentes si el orden de renderizado cambia. Debería calcularse una sola vez con `useMemo`.

---

### BUG-006 — "Volver al proyecto" usa window.location.href en vez de router

- **Severidad:** BAJO
- **Archivos:** `interview-header.tsx:72`

**Descripción:**

```typescript
onClick={() => (window.location.href = `/org-intelligence/projects/${projectId}`)}
```

Esto provoca un full page reload en lugar de una navegación SPA. El componente ya importa `Button` de shadcn pero no usa `Link` de Next.js ni `useRouter`. Contrasta con el botón "Volver al proyecto" en el estado de "entrevista no encontrada" (línea 662) que sí usa `router.push()`.

---

## CATEGORÍA 2: Arquitectura de UI

---

### ARCH-001 — "Conocimiento del proyecto" aparece dentro de "Guía de Preguntas"

- **Severidad:** ALTO
- **Archivos:** `interview-questions-view.tsx:49`, `page.tsx:728-741`

**Descripción:**

Visible en la captura de pantalla del usuario. La card "Guía de Preguntas" contiene:
1. Una card anidada "Conocimiento del proyecto" (con "0 departamentos, 0 roles, 0 procesos, 0 problemas")
2. Un botón "Generar Preguntas con IA"

El componente `InterviewKnowledgeSummary` se renderiza **dentro** de `InterviewQuestionsView` cuando no hay preguntas:
```typescript
{!has && <InterviewKnowledgeSummary projectId={projectId} />}
```

Esto viola la jerarquía visual: una card informativa del proyecto no pertenece dentro de la guía de preguntas. El usuario ve cards anidadas sin relación conceptual clara.

**Solución:** Mover `InterviewKnowledgeSummary` fuera de la card de preguntas — como sección propia antes de "Guía de Preguntas", o eliminarlo del flujo de detalle y dejarlo solo como contexto interno para la generación.

---

### ARCH-002 — Página monolítica de 1187 líneas con 25+ variables de estado

- **Severidad:** ALTO
- **Archivos:** `page.tsx` completo

**Descripción:**

El componente `InterviewDetailPage` maneja directamente:
- Carga de datos (fetch + SSE)
- Upload de audio (XHR con progreso)
- Drag & drop
- CRUD de speakers (add/edit/delete con dialog)
- Edición de entrevista (título)
- Eliminación de entrevista
- Reprocesamiento
- Estado del pipeline
- Gestión de preguntas generadas
- Búsqueda en directorio de personas
- Carga de avatares
- Celebración post-procesamiento

25+ variables de `useState`, 8+ funciones handler, lógica de negocio en el componente.

**Impacto:** Difícil de mantener, propenso a bugs de estado, re-renders innecesarios.

**Solución:** Extraer hooks: `useInterviewData`, `useAudioUpload`, `useSpeakerManagement`, `useProcessingPipeline`. Cada uno con su estado y handlers encapsulados.

---

### ARCH-003 — Dialog de speakers embebido en page.tsx (130+ líneas de JSX inline)

- **Severidad:** ALTO
- **Archivos:** `page.tsx:960-1183`

**Descripción:**

El diálogo de agregar/editar speakers ocupa 223 líneas del page.tsx, con lógica de búsqueda en directorio, selección de persona, formulario manual, y dos modos (search vs. form). Este es el componente más complejo de la página y está inline.

Contrasta con `EditInterviewDialog` y `ReprocessDialog` que SÍ están extraídos a componentes propios.

**Solución:** Extraer a `SpeakerDialog` o `ManageSpeakerDialog`, similar a los otros diálogos.

---

### ARCH-004 — Componente `InterviewAudioStep` demasiado compacto, sacrifica legibilidad

- **Severidad:** MEDIO
- **Archivos:** `interview-audio-step.tsx`

**Descripción:**

El archivo comprime todo en pocas líneas con variables de 1-2 caracteres (`up`, `fd`, `t`, `tk`, `x`, `iId`, `b`, `n`, `f`). La función `xhrUpload` está hardcoded con localStorage. `doUpload` es un one-liner con try/catch comprimido.

Contrasta con el estilo más legible del resto del codebase.

---

### ARCH-005 — InterviewGuidePrint se renderiza siempre (oculto por CSS)

- **Severidad:** MEDIO
- **Archivos:** `page.tsx:909-916`, `interview-guide-print.tsx`

**Descripción:**

El componente de impresión de la guía se renderiza en el DOM siempre, oculto con `display: none` mediante clase `.print-container`. Se monta incluso cuando no hay preguntas generadas. Mejor renderizar condicionalmente.

---

### ARCH-006 — formatTimestamp duplicada

- **Severidad:** BAJO
- **Archivos:** `page.tsx:115-120`, `synced-segment.tsx:18-23`, `player-controls.tsx:18-23`

**Descripción:**

La función `formatMs`/`formatTimestamp` está implementada 3 veces con lógica idéntica. Debería estar en un utils compartido.

---

## CATEGORÍA 3: Usabilidad / Flujo

---

### UX-001 — No hay flujo guiado — todo se muestra a la vez

- **Severidad:** ALTO
- **Archivos:** `page.tsx:693-916`

**Descripción:**

La página muestra simultáneamente todas las secciones sin importar el estado de la entrevista:
1. Header
2. Participantes
3. Objetivo (solo lectura)
4. Guía de Preguntas
5. Audio upload/recording
6. Legacy audio upload (duplicado)
7. Pipeline status
8. Celebration banner
9. Transcripción

En una entrevista nueva (PENDING), el usuario ve participantes vacíos, objetivo vacío, guía de preguntas con "Conocimiento del proyecto: 0 todo", dos zonas de upload, y nada de pipeline ni transcripción. No hay indicación de qué hacer primero.

**Solución propuesta:** Implementar un flujo por pasos (stepper o progressive disclosure):
1. Configurar participantes
2. Definir objetivo
3. Generar/revisar guía de preguntas
4. Subir/grabar audio
5. Procesar
6. Revisar resultados

---

### UX-002 — Objetivo de la entrevista es solo lectura

- **Severidad:** ALTO
- **Archivos:** `page.tsx:715-725`

**Descripción:**

```tsx
<p className="text-sm text-muted-foreground">
    {interview.objective ?? "Sin objetivo definido."}
</p>
```

El objetivo se muestra como texto plano sin posibilidad de editarlo. Si el usuario no definió un objetivo al crear la entrevista, no puede agregarlo después. Pero el objetivo es **crucial** para la generación de preguntas con IA (la línea 91 del servicio lo usa en el prompt).

**Solución:** Hacer el campo editable inline o incluirlo en el `EditInterviewDialog`.

---

### UX-003 — Eliminar speaker no tiene confirmación

- **Severidad:** ALTO
- **Archivos:** `page.tsx:612-635`, `interview-participants-card.tsx:119-124`

**Descripción:**

El botón "Eliminar" en cada participante ejecuta `handleDeleteSpeaker(index)` directamente sin diálogo de confirmación. Contrasta con eliminar entrevista que SÍ tiene `DeleteDialog`.

**Solución:** Agregar `AlertDialog` de confirmación, similar al patrón de eliminación de entrevista.

---

### UX-004 — Prioridad de preguntas se muestra en inglés crudo

- **Severidad:** MEDIO
- **Archivos:** `interview-question-card.tsx:31-33`

**Descripción:**

Los badges de prioridad muestran "HIGH", "MEDIUM", "LOW" en inglés. El resto de la UI está en español.

**Solución:** Mapear a "Alta", "Media", "Baja".

---

### UX-005 — Botón de eliminar pregunta es una "x" de texto plano

- **Severidad:** MEDIO
- **Archivos:** `interview-question-card.tsx:36-39`

**Descripción:**

```tsx
<button ... aria-label="Eliminar pregunta">x</button>
```

Es un carácter "x" literal como botón. Sin ícono, sin confirmación, sin hover state significativo. Inconsistente con el estilo del resto de la app que usa HugeIcons.

---

### UX-006 — Reprocess dialog usa `<select>` nativo en vez de shadcn Select

- **Severidad:** MEDIO
- **Archivos:** `reprocess-dialog.tsx:42-58`

**Descripción:**

```tsx
<select className="w-full rounded-md border bg-background px-3 py-2 text-sm">
```

Select HTML nativo dentro de un Dialog que usa todos los componentes de shadcn. Inconsistente visualmente con el resto de la app.

---

### UX-007 — No hay feedback cuando se genera la guía de preguntas (sin skeleton/spinner en la UI principal)

- **Severidad:** MEDIO
- **Archivos:** `interview-generate-button.tsx`, `interview-questions-view.tsx`

**Descripción:**

Al presionar "Generar Preguntas con IA", el botón cambia a "Generando..." pero no hay skeleton o indicador en la zona donde aparecerán las preguntas. La generación puede tomar 10-15 segundos. El usuario solo ve el botón deshabilitado.

---

### UX-008 — Skeleton de carga es genérico y mínimo

- **Severidad:** BAJO
- **Archivos:** `page.tsx:646-656`

**Descripción:**

```tsx
<Skeleton className="h-6 w-1/3" />
<Skeleton className="h-4 w-1/4" />
<Skeleton className="h-40 w-full" />
```

3 skeletons que no reflejan la estructura real de la página (header + participantes + objective + preguntas + audio). Apps como Linear o Notion replican la estructura del contenido en sus skeletons.

---

### UX-009 — Warning de participantes solo en la card legacy (no en InterviewAudioStep)

- **Severidad:** BAJO
- **Archivos:** `page.tsx:760-764`

**Descripción:**

El aviso "Se recomienda configurar los participantes antes de subir el audio" solo aparece en la card legacy de upload, no en `InterviewAudioStep` que es el componente que realmente se usará.

---

## CATEGORÍA 4: Diseño Visual

---

### VIS-001 — Jerarquía visual plana — todas las secciones tienen el mismo peso

- **Severidad:** ALTO
- **Archivos:** `page.tsx:693-916`

**Descripción:**

Todas las secciones son `Card` con el mismo estilo. No hay diferenciación visual entre:
- Información crítica (participantes, objetivo)
- Acciones principales (subir audio, procesar)
- Resultados (transcripción, pipeline)
- Acciones secundarias (generar preguntas, descargar PDF)

En Linear, los elementos de acción se destacan visualmente. En Notion, las secciones colapsables permiten foco.

**Solución:** Usar variantes de card (outlined vs. filled), collapsibles para secciones largas, y mayor contraste para CTAs principales.

---

### VIS-002 — Card "Objetivo" es un bloque desproporcionado para una línea de texto

- **Severidad:** MEDIO
- **Archivos:** `page.tsx:716-725`

**Descripción:**

Una Card completa con CardHeader + CardContent para mostrar "Sin objetivo definido." o una línea de texto. Ocupa espacio vertical significativo para poca información.

**Solución:** Integrar como sección del header o como campo inline editable.

---

### VIS-003 — InterviewAudioStep: cards sin título descriptivo

- **Severidad:** MEDIO
- **Archivos:** `interview-audio-step.tsx:43-53`

**Descripción:**

Las dos cards de audio dicen "Grabar audio" y "Subir archivo" como títulos de `text-sm`. No hay descripción, íconos representativos, ni guía de qué formatos se aceptan. Contrasta con la card legacy que sí describe formatos y tamaño máximo.

---

### VIS-004 — Pipeline stepper labels de 10px ilegibles

- **Severidad:** MEDIO
- **Archivos:** `pipeline-status-card.tsx:80-83`

**Descripción:**

```tsx
<span className="text-[10px]">{pipelineStepLabels[step]}</span>
```

Los labels del stepper de pipeline son de 10px. Con 9 pasos, el stepper se comprime y los labels son difíciles de leer, especialmente en pantallas pequeñas.

---

### VIS-005 — Player de transcripción usa `<input type="range">` nativo

- **Severidad:** BAJO
- **Archivos:** `player-controls.tsx:53-60`

**Descripción:**

El slider de posición del audio es un `<input type="range">` con `accent-primary`. Cada navegador lo renderiza diferente. No tiene track estilizado ni thumb personalizado.

---

### VIS-006 — Botones de play/pause usan caracteres Unicode en vez de íconos

- **Severidad:** BAJO
- **Archivos:** `player-controls.tsx:46-50`

**Descripción:**

```tsx
{playing ? <span className="text-xs font-bold">II</span> : <span className="text-xs">&#9654;</span>}
```

"II" como texto para pausa y ▶ como Unicode para play. El resto de la app usa HugeIcons.

---

## Resumen de Prioridades

### Arreglar inmediatamente (Crítico + Alto):
1. **BUG-001** — Preguntas no cargan al refrescar (datos se pierden para el usuario)
2. **BUG-002** — Dos UIs de upload de audio simultáneas
3. **BUG-003** — Dialog de edición incompleto (falta fecha)
4. **ARCH-001** — "Conocimiento del proyecto" dentro de "Guía de Preguntas"
5. **ARCH-002** — Extraer hooks del page.tsx monolítico
6. **ARCH-003** — Extraer dialog de speakers
7. **UX-001** — Implementar flujo guiado o progressive disclosure
8. **UX-002** — Hacer objetivo editable
9. **UX-003** — Confirmación al eliminar speaker
10. **VIS-001** — Mejorar jerarquía visual

### Siguiente iteración (Medio):
11-21. BUG-004, BUG-005, ARCH-004, ARCH-005, UX-004, UX-005, UX-006, UX-007, VIS-002, VIS-003, VIS-004

### Backlog (Bajo):
22-27. BUG-006, ARCH-006, UX-008, UX-009, VIS-005, VIS-006
