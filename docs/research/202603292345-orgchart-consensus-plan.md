# Documento de Consenso: Organigramas para Zeru

**Fecha:** 2026-03-29
**Estado:** Decisiones finales aprobadas
**Fuentes:** 4 documentos de investigacion (2 investigadores, 2 disenadores UX)
**Objetivo:** Servir de referencia unica para la implementacion

---

## 1. Tabla de Comparacion

| Tema | Inv. 1 | Inv. 2 | UX 1 | UX 2 | **Consenso** |
|------|--------|--------|------|------|-------------|
| **Modelo de datos** | Adjacency list (`managerId`) + modelo `Position` separado | Grafo dirigido: tablas `PositionRelationship` y `PositionAssignment` con tipos de relacion y confidence scores | `reportsToId` directo en PersonProfile, enum `PersonStatus` con VACANT | Solo menciona que falta `reportsTo`; delega modelo al equipo tecnico | **Adjacency list (`reportsToId` en PersonProfile) para MVP. Sin modelo Position separado por ahora** |
| **Tecnologia de renderizado** | React Flow (@xyflow/react) como motor principal + Mermaid para export estatico | React Flow + ELKjs para complejos; d3-org-chart para simples | React Flow con custom nodes detallados (expandido/compacto/vacante) | React Flow en desktop, lista jerarquica en movil | **React Flow en todas las vistas desktop/tablet. Lista drill-down en movil** |
| **Layout algorithm** | dagre (simple, rapido) | dagre para arboles simples, ELKjs para grafos complejos | dagre con `rankdir: 'TB'`, `ranksep: 80`, `nodesep: 40` | dagre o ELK sin preferencia fuerte | **dagre para MVP. ELKjs queda como upgrade futuro si se necesitan relaciones matriciales** |
| **Arbol vs Grafo** | Arbol estricto (adjacency list) | Grafo dirigido con multiples tipos de relacion (ADMINISTRATIVE, FUNCTIONAL, DOTTED) | Arbol estricto (una persona, un jefe) | No se pronuncia; muestra arbol en mockups | **Arbol estricto para MVP. Relaciones adicionales (dotted lines) en Fase 3** |
| **Position vs Person** | Propone modelo `Position` separado de `PersonProfile` | Propone `Position` + `PositionAssignment` + `PositionRelationship` | No separa; usa `PersonStatus.VACANT` como placeholder | No se pronuncia | **NO separar en MVP. Usar `PersonStatus.VACANT` en PersonProfile. Evaluar Position separado en futuro si hay demanda** |
| **Edicion humana** | API REST: PATCH para mover, POST para crear posiciones | Misma API pero con tabla de relaciones | Drag & drop con confirmacion, click derecho, panel lateral, 3 metodos para cada accion | Drill-down en movil, wizard guiado para onboarding | **Drag & drop + dialog confirmacion en desktop. Panel lateral para edicion rapida. Wizard de onboarding para primer uso** |
| **Integracion con IA** | IA usa mismos endpoints REST; tools como `move_person`, `create_position` | Pipeline NLP: extraccion de entidades + relaciones con confidence scores desde entrevistas | Campo `source` (MANUAL/AI_INFERRED/AI_CONFIRMED/CSV_IMPORT). IA crea con status pendiente, humano confirma | IA NUNCA modifica directamente. Siempre propone via cola de sugerencias. Diff visual del antes/despues | **IA propone, humano aprueba. Modelo `OrgSuggestion` para cola de revision. Campo `source` en PersonProfile** |
| **Mobile** | No lo cubre | No lo cubre | No lo cubre | Drill-down jerarquico, bottom sheet, breadcrumbs. Canvas NO funciona en <768px | **Drill-down jerarquico en movil. Canvas solo en >=1024px. Arbol indentado en tablet** |
| **Escalabilidad** | React Flow bueno para ~500 nodos. Virtualizacion para 1000+ | SVG <500, Canvas <10K, WebGL <100K. Lazy loading, LOD, clustering | Colapso por niveles: 1-50 todo expandido, 50-150 colapsar nivel 3+, 150-500 lazy loading | No lo cubre en detalle | **Colapso progresivo por niveles + lazy loading de subarboles. React Flow SVG suficiente hasta 500 personas** |
| **Navegacion/modulo** | No lo cubre (asume que ya existe) | No lo cubre | Personas como modulo principal de primer nivel con tabs Directorio/Organigrama | Personas como modulo top-level con Directorio + Organigrama + Sugerencias IA | **Personas como modulo principal en sidebar. Tabs: Directorio y Organigrama. Sugerencias IA como badge** |

---

## 2. Debates y Resoluciones

### 2.1 Arbol estricto vs Grafo dirigido

**Inv. 1** propone adjacency list simple (`managerId`).
**Inv. 2** propone tabla de relaciones separada con tipos (ADMINISTRATIVE, FUNCTIONAL, DOTTED, MENTORSHIP).

**Resolucion: Arbol estricto (`reportsToId`) para MVP.**

Justificacion:
- Los clientes iniciales de Zeru (como Citolab) son organizaciones medianas con jerarquia tradicional, no matrices tipo Google/Spotify.
- Un campo `reportsToId` se implementa en horas. Un modelo de relaciones separado requiere semanas.
- Prisma soporta self-relations nativamente. Una tabla de relaciones agrega complejidad en queries, validacion de ciclos, y renderizado.
- Si un cliente necesita dotted lines en el futuro, se puede agregar una tabla `PersonRelationship` sin romper lo existente.
- El 80% del valor del organigrama viene del arbol administrativo simple.

**Accion concreta:** Agregar `reportsToId String?` como self-relation en `PersonProfile`.

### 2.2 Position separado de Person

**Inv. 1** y **Inv. 2** proponen separar Position de Person. **UX 1** y **UX 2** no lo mencionan.

**Resolucion: NO separar en MVP.**

Justificacion:
- La separacion Position/Person brilla cuando hay vacantes formales, rotacion frecuente de puestos, o planificacion de headcount.
- Para el caso de uso actual (construir organigrama desde entrevistas), el concepto de "posicion" no existe independiente de la persona.
- El enum `PersonStatus` con valor `VACANT` cubre el 90% del caso de vacantes sin modelo adicional.
- Si en el futuro se necesita workforce planning (inspirado en ChartHop), se crea `Position` como modelo separado.
- Agregar Position ahora triplicaria la superficie de API (CRUD de positions + asignaciones + relaciones) sin beneficio inmediato.

**Accion concreta:** Usar `PersonStatus.VACANT` para representar vacantes dentro de PersonProfile.

### 2.3 dagre vs ELKjs

**Inv. 1** recomienda dagre. **Inv. 2** dice dagre para simple, ELKjs para complejo.

**Resolucion: dagre para MVP.**

Justificacion:
- dagre es mas simple de configurar, tiene menor tamano de bundle, y produce resultados excelentes para arboles.
- ELKjs requiere configuracion compleja, corre asincrono (manejo de estado adicional), y su beneficio solo se ve en DAGs con relaciones matriciales.
- Como el MVP es un arbol estricto, dagre es la eleccion optima.
- React Flow tiene ejemplos oficiales con dagre que simplifican la implementacion.

**Accion concreta:** Instalar `@dagrejs/dagre` e implementar layout `rankdir: 'TB'`, `ranksep: 80`, `nodesep: 40`.

### 2.4 Mobile: priorizar o no

**UX 2** propone drill-down jerarquico. Los demas no cubren mobile.

**Resolucion: Implementar en Fase 2, no en MVP.**

Justificacion:
- Los consultores de Citolab trabajan principalmente desde desktop/laptop.
- El drill-down jerarquico es una vista separada con su propia logica de navegacion, breadcrumbs y animaciones.
- El valor inmediato esta en la vista desktop del organigrama.
- Sin embargo, la arquitectura debe prever esta vista: el endpoint de orgchart debe soportar "hijos de un nodo" para lazy loading, lo cual sirve tanto para mobile como para escalabilidad.

**Accion concreta:** Disenar el endpoint `/api/persons/orgchart` para soportar `?parentId=uuid` (subarboles). Implementar drill-down mobile en Fase 2.

### 2.5 IA modifica directamente vs propone cambios

**UX 2** es categorico: "La IA NUNCA modifica el organigrama directamente. Siempre propone."
**UX 1** propone campo `source` con estado AI_INFERRED que requiere confirmacion.
**Inv. 1** sugiere que IA use los mismos endpoints REST.
**Inv. 2** propone confidence scores en cada relacion.

**Resolucion: La IA propone, el humano aprueba. Sin excepciones en MVP.**

Justificacion:
- El organigrama es un dato sensible y de alta visibilidad. Un error de la IA es inaceptable.
- El flujo de propuesta/aprobacion genera confianza en el usuario.
- Los confidence scores de Inv. 2 son valiosos: se usan para ordenar las sugerencias y auto-aprobar en futuro (opt-in).
- Implementar auto-aprobacion de alta confianza como setting de tenant es un feature de Fase 3.

**Accion concreta:** Crear modelo `OrgSuggestion` con campos: tipo de accion, datos sugeridos, confidence, evidencia (cita + minuto de entrevista), status (PENDING/APPROVED/REJECTED). Campo `source` en PersonProfile.

---

## 3. Decisiones Arquitectonicas Finales

### 3.1 Modelo de Datos Prisma

Cambios al schema existente:

```prisma
// === MODIFICAR PersonProfile existente ===

model PersonProfile {
  id          String  @id @default(uuid())
  name        String
  role        String?
  department  String?
  email       String?
  phone       String?
  avatarS3Key String?
  notes       String?

  // ─── NUEVOS: Jerarquia organizacional ───
  reportsToId    String?
  reportsTo      PersonProfile?   @relation("ReportsTo", fields: [reportsToId], references: [id])
  directReports  PersonProfile[]  @relation("ReportsTo")

  // ─── NUEVOS: Metadata organizacional ───
  employeeCode   String?          // Codigo interno (RUT, numero, etc.)
  startDate      DateTime?        // Fecha de ingreso
  status         PersonStatus     @default(ACTIVE)
  source         PersonSource     @default(MANUAL)

  deletedAt DateTime?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  tenantId  String
  tenant    Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  // Relacion inversa para sugerencias
  orgSuggestions OrgSuggestion[]

  @@index([tenantId])
  @@index([tenantId, name])
  @@index([tenantId, reportsToId])
  @@index([tenantId, department])
  @@map("person_profiles")
}

enum PersonStatus {
  ACTIVE
  INACTIVE
  VACANT
}

enum PersonSource {
  MANUAL
  AI_INFERRED
  AI_CONFIRMED
  CSV_IMPORT
}

// === NUEVO: Sugerencias de IA ===

model OrgSuggestion {
  id              String              @id @default(uuid())
  type            OrgSuggestionType
  status          OrgSuggestionStatus @default(PENDING)
  confidence      Float               // 0.0 - 1.0
  data            Json                // Datos sugeridos (nombre, role, department, reportsToId, etc.)
  evidence        String?             // Cita textual de la entrevista
  evidenceTimeSec Int?                // Segundo de la entrevista donde se menciona
  resolvedBy      String?             // userId que aprobo/rechazo
  resolvedAt      DateTime?
  rejectReason    String?

  // Relacion con persona afectada (si ya existe)
  personId   String?
  person     PersonProfile? @relation(fields: [personId], references: [id], onDelete: SetNull)

  // Relacion con la entrevista origen
  interviewId String?

  tenantId  String
  tenant    Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([tenantId, status])
  @@index([tenantId, personId])
  @@map("org_suggestions")
}

enum OrgSuggestionType {
  CREATE_PERSON       // Crear persona nueva
  UPDATE_PERSON       // Actualizar role/department de persona existente
  SET_REPORTS_TO      // Establecer/cambiar relacion de reporte
  DELETE_PERSON       // Sugerir eliminacion
}

enum OrgSuggestionStatus {
  PENDING
  APPROVED
  APPROVED_MODIFIED   // Aprobado pero con cambios del usuario
  REJECTED
}
```

**Nota sobre Tenant:** Agregar `orgSuggestions OrgSuggestion[]` al modelo `Tenant` existente.

### 3.2 Tecnologia de Renderizado

| Componente | Tecnologia | Justificacion |
|------------|-----------|---------------|
| Canvas interactivo | `@xyflow/react` v12.10.2 (ya instalado) | Nodos React nativos, zoom/pan/minimap integrados, TypeScript, 40K+ stars |
| Layout automatico | `@dagrejs/dagre` (instalar) | Simple, rapido, ideal para arboles. Config: `rankdir: 'TB'`, `ranksep: 80`, `nodesep: 40` |
| Vista mobile | Lista jerarquica custom (React) | No depende de canvas. Drill-down con animaciones slide-left |
| Export estatico | `mermaid` v11.13.0 (ya instalado) | Para generar texto plano del organigrama que la IA pueda consumir/producir |
| Export imagen | `html-to-image` (instalar en Fase 3) | Capturar viewport React Flow como PNG/SVG |

### 3.3 Navegacion

**Estructura final del sidebar:**

```
Sidebar
  ├── Dashboard
  ├── Asistente
  ├── Documentos
  ├── Contabilidad
  │     ├── Plan de Cuentas
  │     ├── Asientos
  │     ├── Periodos Fiscales
  │     └── Reportes
  ├── Calendario
  ├── Personas                     ← NUEVO modulo principal
  │     ├── Directorio             /personas
  │     └── Organigrama            /personas/organigrama
  ├── Inteligencia Org.            ← Se mantiene SIN "Personas"
  │     ├── Proyectos
  │     └── Knowledge Base
  └── Marketing
        └── LinkedIn
```

**Rutas:**

| Ruta | Descripcion |
|------|-------------|
| `/personas` | Directorio de personas (tabla + grid toggle) |
| `/personas/organigrama` | Vista de organigrama interactivo |
| `/personas/:id` | Perfil detallado de persona |

**Razon:** "Personas" es un concepto universalmente entendido. Sacarlo de "Inteligencia Org." lo hace accesible desde el primer momento. El organigrama se convierte en feature de primera clase.

### 3.4 Vistas por Fase

| Vista | Fase | Descripcion |
|-------|------|-------------|
| Directorio tabla | MVP | Tabla ordenable/filtrable con columnas: avatar, nombre, cargo, departamento, reporta a, estado |
| Directorio grid cards | MVP | Vista actual mejorada (toggle entre tabla y cards) |
| Organigrama arbol top-down | MVP | Canvas React Flow con custom nodes, zoom/pan/minimap |
| Panel lateral de detalle | MVP | Al click en nodo: info completa + acciones rapidas |
| Drill-down mobile | Fase 2 | Lista jerarquica navegable con breadcrumbs |
| Tabla jerarquica (tree table) | Fase 2 | Tabla con indent que muestra jerarquia expandible |
| Sugerencias IA | Fase 2 | Banner + cola de revision de cambios propuestos por IA |
| Burbujas por departamento | Fase 3 | Circle-pack proporcional al headcount |
| Red de conexiones | Fase 3 | Force-directed graph con relaciones del knowledge graph |

### 3.5 API Endpoints

Ampliar el controlador `PersonProfilesController` existente:

**MVP:**

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/org-intelligence/persons` | Listar personas (ya existe, agregar filtros por department, status, reportsToId) |
| GET | `/api/org-intelligence/persons/:id` | Detalle de persona (ya existe, agregar directReports) |
| POST | `/api/org-intelligence/persons` | Crear persona (ya existe, agregar reportsToId, status, source) |
| PATCH | `/api/org-intelligence/persons/:id` | Actualizar persona (ya existe, agregar reportsToId) |
| DELETE | `/api/org-intelligence/persons/:id` | Eliminar persona (ya existe) |
| **GET** | **`/api/org-intelligence/persons/orgchart`** | **Arbol jerarquico completo en formato anidado** |
| **PATCH** | **`/api/org-intelligence/persons/:id/reports-to`** | **Cambiar jefe (con validacion anti-ciclos)** |
| **GET** | **`/api/org-intelligence/persons/departments`** | **Listar departamentos unicos** |

**Fase 2:**

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| POST | `/api/org-intelligence/persons/bulk` | Crear/actualizar multiples personas (para IA y CSV import) |
| GET | `/api/org-intelligence/persons/orgchart?format=text` | Organigrama como texto plano para contexto IA |
| GET | `/api/org-intelligence/persons/orgchart?parentId=uuid` | Subarbol de un nodo (para lazy loading y mobile) |
| GET | `/api/org-intelligence/org-suggestions` | Listar sugerencias pendientes de IA |
| PATCH | `/api/org-intelligence/org-suggestions/:id` | Aprobar/rechazar sugerencia |
| POST | `/api/org-intelligence/org-suggestions/:id/approve` | Aprobar y aplicar sugerencia |

**Endpoint /orgchart -- formato de respuesta:**

```json
{
  "roots": [
    {
      "id": "uuid",
      "name": "Maria Paz Soto",
      "role": "Gerente General",
      "department": "Direccion",
      "avatarUrl": "https://...",
      "status": "ACTIVE",
      "source": "MANUAL",
      "directReportsCount": 3,
      "directReports": [
        {
          "id": "uuid",
          "name": "Rodrigo Rojas",
          "role": "Dir. Operaciones",
          "department": "Operaciones",
          "status": "ACTIVE",
          "directReportsCount": 5,
          "directReports": []
        }
      ]
    }
  ],
  "unassigned": [
    {
      "id": "uuid",
      "name": "Sofia Mendez",
      "role": "Consultora",
      "status": "ACTIVE"
    }
  ],
  "stats": {
    "totalPersons": 45,
    "totalActive": 42,
    "totalVacant": 3,
    "totalUnassigned": 1,
    "departments": ["Direccion", "Operaciones", "Finanzas", "Tecnologia"],
    "maxDepth": 4
  }
}
```

**Notas del endpoint:**
- `roots`: personas sin `reportsToId` que tienen al menos un directReport, o personas sin `reportsToId` si son las unicas.
- `unassigned`: personas sin `reportsToId` que no son raiz (no tienen subordinados). Son personas "sueltas" que necesitan ser ubicadas en el organigrama.
- Por defecto, devolver arbol completo expandido (hasta 200 personas). Si hay mas, devolver solo 2 niveles y soportar `?parentId=` para lazy loading.
- La validacion anti-ciclos en PATCH /reports-to es critica: al cambiar `reportsToId`, verificar que el nuevo jefe no sea descendiente de la persona.

### 3.6 Integracion con IA

**Flujo de extraccion desde entrevistas:**

```
Entrevista transcrita
    |
    v
Pipeline de analisis (agente IA existente)
    |
    v
LLM extrae relaciones con structured output:
    {
      "person": "Rodrigo Rojas",
      "role": "Director de Operaciones",
      "department": "Operaciones",
      "reports_to": "Maria Paz Soto",
      "confidence": 0.92,
      "evidence_quote": "Yo le reporto directo a la Maria Paz",
      "timestamp_seconds": 263
    }
    |
    v
Agente busca en PersonProfile por nombre (fuzzy match)
    |
    ├─ Si existe → Crea OrgSuggestion tipo UPDATE_PERSON o SET_REPORTS_TO
    └─ Si no existe → Crea OrgSuggestion tipo CREATE_PERSON
    |
    v
Usuario ve banner "3 sugerencias nuevas de la IA"
    |
    v
Cola de revision: Aprobar / Editar / Rechazar cada una
    |
    v
Al aprobar: se crea/modifica PersonProfile con source=AI_CONFIRMED
```

**El agente IA NO llama directamente a POST/PATCH de PersonProfile.** Siempre crea OrgSuggestion que el usuario revisa.

---

## 4. Plan de Implementacion Priorizado

### Fase 1 -- MVP (esta semana)

**Objetivo:** Un organigrama funcional visible donde se pueden crear personas con jerarquia y verlas en un arbol interactivo.

**Backend:**

| # | Tarea | Detalle |
|---|-------|---------|
| 1 | Migracion Prisma | Agregar a PersonProfile: `reportsToId`, `directReports`, `employeeCode`, `startDate`, `status` (enum), `source` (enum), indices. Agregar modelo `OrgSuggestion` (vacio por ahora, listo para Fase 2) |
| 2 | Validacion anti-ciclos | Servicio que al setear `reportsToId` verifica que no se cree un ciclo (caminar el arbol hacia arriba desde el nuevo jefe hasta verificar que no llegamos a la persona) |
| 3 | Endpoint GET /orgchart | Query recursiva que construye el arbol anidado. Usar `findMany` con `include: { directReports: { include: { directReports: true } } }` para profundidad fija, o raw query CTE para profundidad variable |
| 4 | Endpoint PATCH /:id/reports-to | Actualizar `reportsToId` con validacion anti-ciclos |
| 5 | Endpoint GET /departments | `SELECT DISTINCT department FROM person_profiles WHERE tenant_id = ? AND department IS NOT NULL` |
| 6 | Ampliar POST/PATCH existentes | Aceptar campos nuevos: `reportsToId`, `employeeCode`, `startDate`, `status`, `source` |

**Frontend:**

| # | Tarea | Detalle |
|---|-------|---------|
| 7 | Mover Personas a modulo principal | Crear `/personas` en sidebar. Redirigir desde `/org-intelligence/persons` por backward compatibility. Layout con tabs Directorio/Organigrama |
| 8 | Directorio mejorado | Agregar columna "Reporta a" en la tabla/grid. Campo "Reporta a" (dropdown con busqueda) en dialog de crear/editar persona. Campo "Departamento" con autocompletado |
| 9 | Pagina de Organigrama | Componente React Flow con: custom node (avatar + nombre + cargo + departamento color + badge reportes), edges smoothstep, layout dagre top-down, zoom/pan/minimap, fit-to-view |
| 10 | Panel lateral | Al click en nodo: slide-over derecho con info completa, link a perfil, lista de reportes directos, botones editar/agregar subordinado |
| 11 | Busqueda en organigrama | Input de busqueda en header. Debounce 300ms, opacar nodos no matching, centrar en resultado unico, navegacion N/M para multiples |

**Instalaciones:**

```bash
pnpm add @dagrejs/dagre  # en apps/web
```

### Fase 2 -- Interactividad + IA (semana siguiente)

| # | Tarea | Detalle |
|---|-------|---------|
| 12 | Drag & drop para reorganizar | Arrastrar nodo sobre otro → dialog confirmacion → PATCH /reports-to. Indicador visual de destinos validos |
| 13 | Expand/collapse por nodo | Boton toggle en nodos manager. Badge "+N" al colapsar. Persistir estado en localStorage |
| 14 | Filtros por departamento | Dropdown multi-select en header del organigrama. Opacar nodos de otros departamentos pero mantener cadena jerarquica |
| 15 | Drill-down mobile | Vista lista jerarquica responsive para <768px. Breadcrumbs, animacion slide-left, bottom sheet para perfil |
| 16 | Cola de sugerencias IA | Backend: endpoints CRUD para OrgSuggestion. Frontend: banner en /personas con badge de conteo. Pagina de revision con aprobar/editar/rechazar |
| 17 | Pipeline de extraccion | Agregar paso al pipeline de analisis de entrevistas: LLM extrae personas + relaciones → crea OrgSuggestion. Structured output con JSON schema |
| 18 | Endpoint bulk | POST /persons/bulk para crear/actualizar multiples personas. Usado por CSV import y por IA |
| 19 | Import CSV | Dialog con drag & drop, preview, mapeo de columnas, validacion, feedback de resultados |
| 20 | Perfil detallado | Pagina `/personas/:id` con toda la info, reporta a, directReports, notas, participacion en entrevistas (link a OrgProject interviews) |

### Fase 3 -- Features Avanzados (futuro)

| # | Tarea | Detalle |
|---|-------|---------|
| 21 | Colores por departamento | Paleta automatica de 12 colores asignados ciclicamente. Aplicar en borde izquierdo del nodo, chip de depto, leyenda flotante |
| 22 | Export PNG/SVG/PDF | Instalar `html-to-image`. Boton "Exportar" con formato seleccionable. Para PDF: imagen insertada en jsPDF |
| 23 | Export texto para IA | GET /orgchart?format=text → arbol ASCII legible que se inyecta en system prompt del chat |
| 24 | Diff visual de sugerencias | Toggle "Ver con sugerencias IA": nodos nuevos con borde punteado azul, lineas sugeridas punteadas, nodos a modificar con borde amarillo |
| 25 | Changelog / historial | Modelo `OrgChartChange` (event sourcing ligero). Timeline UI con who/what/when/why |
| 26 | Posiciones vacantes visual | Nodo con borde punteado, opacidad 70%, icono silueta, label "VACANTE". Click derecho → "Llenar vacante" |
| 27 | Auto-deteccion de jerarquia | Heuristicas: "Gerente General" → raiz, "Director de X" + personas en depto X → relacion probable. Presentar como sugerencias editables |
| 28 | Capas de indicadores | Toggle de capas: cobertura de entrevistas (borde verde/gris/amarillo), SPOF (alerta roja), carga de reportes (heatmap azul→rojo) |
| 29 | Tabla jerarquica | Tree table con indent, expandible, sorteable, exportable a CSV |
| 30 | Vista burbujas | Circle-pack por departamento con headcount proporcional |
| 31 | Relaciones dotted line | Tabla `PersonRelationship` para relaciones funcionales/matriciales. Lineas punteadas en el organigrama |
| 32 | Modelo Position separado | Si hay demanda de workforce planning: Position, PositionAssignment, separar puesto de persona |
| 33 | Scenario planning | Sandbox mode: clonar organigrama, simular cambios sin afectar datos reales, calcular impacto en headcount |

---

## 5. Diseno del Nodo (Especificacion para Implementacion)

### Nodo expandido (zoom >= 70%)

```
┌──────────────────────────────┐
│  ┌────┐                      │
│  │foto│  Juan Perez          │
│  │    │  Gerente de Ops      │
│  └────┘  ●Operaciones        │
│          ─────────────────── │
│          3 reportes directos │
│  ○ collapse                  │
└──────────────────────────────┘
```

- 240px ancho x 100px alto
- Avatar circular 40x40px
- Nombre: font-semibold 14px, truncar > 20 chars
- Cargo: text-muted-foreground 12px
- Departamento: chip con color asignado 12px
- Badge de reportes directos (solo si > 0)
- Borde izquierdo 4px solid con color del departamento
- border-radius: 8px, sombra sutil

### Nodo compacto (zoom < 70%)

- 160px ancho x 56px alto
- Avatar 28x28px con iniciales
- Solo nombre abreviado + cargo abreviado
- Sin badge ni collapse

### Nodo vacante

- Borde punteado (dashed)
- Opacidad 70%
- Avatar con icono silueta "?"
- Label "VACANTE" en lugar de nombre

### Edges

- Tipo: `smoothstep`
- Color default: `#94A3B8` (slate-400)
- Grosor: 1.5px
- Hover: color del departamento + 2.5px

---

## 6. Resumen de Decisiones Clave

| Decision | Eleccion | Justificacion |
|----------|----------|---------------|
| Modelo jerarquico | `reportsToId` en PersonProfile (adjacency list) | Simple, Prisma-nativo, suficiente para arboles 3-8 niveles |
| Position separado | NO en MVP | Complejidad innecesaria para caso actual |
| Vacantes | `PersonStatus.VACANT` en PersonProfile | Evita modelo adicional |
| Layout engine | dagre | Simple, pequeno, ideal para arboles estrictos |
| Canvas library | React Flow (ya instalado) | Nodos React, zoom/pan nativos, gran comunidad |
| IA y organigrama | Proponer via OrgSuggestion, nunca modificar directo | Confianza del usuario, auditabilidad |
| Mobile | Drill-down jerarquico, Fase 2 | Canvas no funciona en <768px |
| Departamentos | Campo texto con autocompletado (no entidad separada) | Simplicidad; modelo Department futuro si se necesita metadata |
| Navegacion | Personas como modulo principal en sidebar | Accesibilidad directa, concepto universalmente entendido |
| Soft delete de jefe | Advertencia + opcion de reasignar subordinados | Evita subordinados huerfanos |

---

## 7. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigacion |
|--------|-------------|---------|------------|
| Ciclos en el arbol (A reporta a B, B reporta a A) | Media | Alto (rompe renderizado) | Validacion anti-ciclos obligatoria en servicio al setear reportsToId |
| Performance con 200+ nodos | Baja (clientes iniciales son medianos) | Medio | Colapso por niveles, lazy loading, React Flow virtualizacion |
| IA infiere relaciones incorrectas | Alta (lenguaje natural es ambiguo) | Medio | Flujo de aprobacion obligatorio, confidence scores |
| Multiples raices no intencionales | Media | Bajo | Advertencia visual en orgchart: "N personas sin jefe asignado" con CTA para asignar |
| Migracion rompe datos existentes | Baja | Alto | Campos nuevos son todos nullable/default, no breaking change |

---

Este documento es la referencia unica para implementacion. Cualquier decision que no este aqui debe discutirse antes de codificar.
