# Investigacion: Organigramas Interactivos para SaaS

**Fecha:** 2026-03-28
**Estado:** Investigacion completa
**Contexto:** Zeru ya cuenta con `@xyflow/react` v12.10.2 y `mermaid` v11.13.0 instalados. El modelo `PersonProfile` existe en Prisma pero aun no tiene campo de jerarquia (`reportsTo`, `managerId`).

---

## 1. Gold Standard de Organigramas en SaaS

### 1.1 BambooHR

**Enfoque:** Organigrama auto-generado desde datos de empleados.

- Genera el organigrama automaticamente a partir de la base de datos HR
- Permite filtrar, resaltar y colorear por departamento, nivel, etc.
- Export a PDF, PowerPoint, PNG, CSV y links compartibles
- Incluye fotos, cargos, departamentos, fecha de contratacion e incluso salario en los nodos
- Permite agregar formulas para calcular headcount, vacantes y salarios por rama
- Archiva organigramas historicos para ver cambios en el tiempo
- Se accede directamente desde el directorio de empleados y perfiles individuales

**Lo que hace bien:** Integracion seamless con datos HR; historial de organigramas; export multi-formato.

### 1.2 ChartHop

**Enfoque:** El lider en visualizacion de organigramas con analytics y scenario planning. Es el gold standard de la industria.

- **Organigramas interactivos** con visualizacion en tiempo real
- **Drag-and-drop scenario modeling:** Arrastrar personas/roles para simular reestructuraciones. Cada cambio muestra impacto en headcount y presupuesto en tiempo real
- **Scenarios (sandbox):** Crear vistas alternativas para planes de contratacion, M&A, compensacion, reorganizaciones. Todo en un entorno seguro sin afectar datos reales
- **Dashboards de presupuesto** en tiempo real que muestran como los cambios de fuerza laboral impactan el bottom line
- **Approval workflows** configurables entre HR, finanzas y liderazgo
- **Access controls** inteligentes para compartir escenarios con las personas correctas
- **Integracion con ATS** para conectar headcount aprobado directamente con reclutamiento
- **Analytics avanzados:** compensacion, diversidad e inclusion, performance management
- Vista de datos tabulares ademas del grafico

**Lo que hace bien:** Scenario planning con impacto financiero es su killer feature. Ningun otro tool lo hace tan bien.

### 1.3 Rippling

**Enfoque:** Plataforma integrada HR/IT/Finance con organigrama como vista complementaria.

- Organigrama como parte de un sistema unificado de HR, IT y Finance
- Vista organizacional estandar (menos sofisticada que ChartHop)
- Fuerza en automatizacion del ciclo de vida del empleado
- Payroll global integrado
- El organigrama se actualiza automaticamente con cambios en HR

**Lo que hace bien:** Integracion profunda con todo el stack empresarial. El organigrama refleja datos en tiempo real.

### 1.4 Deel

**Enfoque:** Plataforma de pagos y contratacion global.

- Organigramas basicos que requieren actualizacion manual via CSV
- Foco en contractors y equipos distribuidos en 120+ paises
- El organigrama no es su fortaleza -- es una feature secundaria

**Lo que hace bien:** Cobertura global. Pero el organigrama no es su punto fuerte.

### 1.5 Factorial

**Enfoque:** HR all-in-one con organigramas auto-generados.

- Genera organigramas automaticamente desde datos de empleados
- Actualizacion en tiempo real cuando se onboardean nuevos empleados
- Feature "auto-create" que reduce significativamente el mantenimiento manual
- Acceso directo a perfiles de empleados desde el organigrama
- Suite HR completa (time tracking, payroll, recruitment, etc.)

**Lo que hace bien:** Auto-generacion y actualizacion en tiempo real integrada con el flujo de onboarding.

### 1.6 Lucidchart

**Enfoque:** Herramienta de diagramas generica con capacidades de organigramas.

- Import de datos desde CSV, Excel, Google Sheets, BambooHR
- **Colaboracion en tiempo real:** co-authoring, chat in-editor, comentarios por shape, cursores colaborativos
- **Version control y revision history** integrados
- Drag-and-drop intuitivo con biblioteca de shapes personalizable
- Extensa libreria de templates
- Customization visual avanzada (estilos, formatos, colores)

**Lo que hace bien:** Colaboracion en tiempo real y version control son superiores. Ideal para diagramas pero no es un HR tool.

### 1.7 Pingboard (ahora Workleap Pingboard)

**Enfoque:** Organigramas interactivos como directorio de empleados.

- **Perfiles enriquecidos:** fotos, contacto, rol, intereses personales
- **Actualizacion automatica** via integracion con HR/IT software
- **Analytics integrados:** tamano de equipos en el tiempo, ratio de direct reports, metricas de diversidad
- **Tracking de ausencias** (out-of-office) directamente en el organigrama
- **Reconocimiento:** cumpleanos y aniversarios laborales
- **Cultura organizacional:** herramientas de team building junto al organigrama

**Lo que hace bien:** El organigrama como herramienta de cultura y conexion entre personas, no solo estructura.

### 1.8 Resumen Comparativo

| Plataforma | Orgchart Auto | Drag & Drop | Scenario Planning | Export | Colaboracion RT | Analytics | Vacantes |
|---|---|---|---|---|---|---|---|
| **ChartHop** | Si | Si (sandbox) | Si (gold std) | Si | Si | Avanzado | Si |
| **BambooHR** | Si | No | No | Multi-formato | No | Basico | Si (formulas) |
| **Pingboard** | Si | Limitado | No | Si | No | Medio | No |
| **Factorial** | Si | No | No | Limitado | No | Basico | No |
| **Lucidchart** | Import | Si | No | Multi-formato | Si (gold std) | No | No |
| **Rippling** | Si | Limitado | No | Si | No | Medio | No |
| **Deel** | Manual (CSV) | No | No | Limitado | No | No | No |

**Conclusion:** ChartHop es el benchmark para organigramas SaaS. Lucidchart es el benchmark para colaboracion en tiempo real. Pingboard para cultura organizacional.

---

## 2. Tecnologias para Renderizar Organigramas Interactivos en React

### 2.1 React Flow (@xyflow/react) -- YA INSTALADO v12.10.2

**Descripcion:** Libreria de React para construir UIs basadas en nodos. Rebranding reciente de ReactFlow a XyFlow.

**Pros:**
- Ya esta instalado en Zeru -- zero costo de adopcion
- Nodos son componentes React completos (cualquier JSX, fotos, tooltips, formularios)
- Drag-and-drop nativo
- Zoom, pan, minimap, fit-to-view integrados
- Handles de conexion multiples (source/target)
- API extensible para edges custom
- Soporte para layout engines externos: **dagre** (simple, rapido, tree layout) y **elkjs** (configurable, avanzado, Java portado a JS)
- Ejemplos oficiales de tree layout, auto-layout, collaborative editing
- Gran comunidad (40K+ GitHub stars)
- TypeScript nativo
- Performance buena para grafos medianos (~500 nodos)

**Contras:**
- No es especificamente un org chart -- requiere construir la logica de organigrama encima
- El layout automatico requiere librerias externas (dagre o elkjs)
- Para organigramas muy grandes (1000+ nodos) puede requerir virtualizacion
- La version Pro (de pago) tiene features avanzados como grouping y layout helpers

**Layout engines compatibles:**
- **dagre:** Simple, rapido, ideal para arboles basicos. Config minima
- **elkjs:** Muy configurable pero complejo. Port de Java. Enorme numero de opciones de layout
- **d3-hierarchy:** Tambien integrable para layouts de arbol

**Veredicto: RECOMENDADO como base.** Ya lo tenemos, es flexible, y podemos construir un org chart de calidad encima.

### 2.2 d3-org-chart

**Descripcion:** Libreria D3 v7 especificamente disenada para organigramas. Creada por David Bumbeishvili.

**Pros:**
- Disenado especificamente para organigramas (no es generico)
- Expand/collapse de nodos con animaciones CSS3 suaves
- Zoom programatico, fit-to-screen, centrar en nodo
- **Export a PNG y SVG** integrado (genera base64 para PDF)
- Control de nivel de expansion inicial
- Custom d3.zoom para scroll dentro de nodos
- Integraciones oficiales para React, Angular, Vue
- 73K+ weekly downloads, 1.1K+ GitHub stars
- Personalizable (nombre, color de fondo en export)

**Contras:**
- Basado en D3 con wrapper React -- no es React-nativo. DOM manipulation directa puede causar conflictos con React
- Aprendizaje de D3 necesario para customizaciones profundas
- Menos flexible que React Flow para UIs complejas dentro de nodos
- Mantener el wrapper actualizado con cambios en D3 puede ser fragil

**Veredicto:** Buena opcion si se necesita un organigrama out-of-the-box rapido, pero sacrifica flexibilidad para customizar nodos con componentes React complejos.

### 2.3 react-organizational-chart

**Descripcion:** Libreria React simple para arboles jerarquicos. Lightweight.

**Pros:**
- Nodos son componentes React (cualquier JSX)
- Integra bien con styled-components
- API minimalista: `Tree` + `TreeNode` con props de estilo (lineWidth, lineColor, lineBorderRadius, nodePadding)
- Facil de aprender e implementar
- CSS-first para customizacion visual

**Contras:**
- Sin zoom/pan integrado
- Sin drag-and-drop
- Sin export
- Sin expand/collapse
- Sin layout engine -- es puramente CSS-based
- Baja popularidad (5.2K weekly downloads, 41 GitHub stars)
- No escala bien para organigramas grandes

**Veredicto:** Solo sirve para prototipos rapidos o organigramas estaticos. Insuficiente para produccion.

### 2.4 OrgChart.js (dabeng/OrgChart)

**Descripcion:** Plugin jQuery/vanilla JS para organigramas. Tiene un port React (react-orgchart).

**Pros:**
- Disenado especificamente para organigramas
- 3K+ GitHub stars, comunidad establecida
- Export a imagen
- Expand/collapse

**Contras:**
- Originalmente jQuery -- el port React no es first-class
- API datada, no TypeScript nativo
- Menos mantenimiento activo
- 3.5K weekly downloads
- No se integra bien con el ecosistema React moderno

**Veredicto:** Legacy. No recomendado para nuevos proyectos React.

### 2.5 Mermaid -- YA INSTALADO v11.13.0

**Descripcion:** Herramienta de diagramas basados en texto. Genera SVG desde markup.

**Pros:**
- Ya esta instalado en Zeru
- Sintaxis de texto simple para definir estructura
- Export a SVG y PNG
- Ideal para documentacion, reportes, embeddings estaticos
- Soporte en Markdown (GitHub, wikis, docs)
- Util para que agentes IA generen organigramas via texto

**Contras:**
- **Estatico** -- sin interactividad (no drag-and-drop, no click events nativos)
- Sin zoom/pan nativo (requiere wrappers adicionales)
- Diagramas grandes se cortan o comprimen
- No es editable por el usuario en tiempo real
- No soporta fotos/avatares en nodos
- Limitado a lo que la sintaxis permite

**Veredicto:** Util como herramienta complementaria para export estatico, documentacion, o generacion por IA. No sirve como organigrama interactivo principal.

### 2.6 Comparativa Final de Tecnologias

| Criterio | React Flow | d3-org-chart | react-org-chart | OrgChart.js | Mermaid |
|---|---|---|---|---|---|
| **Ya instalado** | Si | No | No | No | Si |
| **React-nativo** | Si | Wrapper | Si | Port | No |
| **TypeScript** | Si | Parcial | No | No | Si |
| **Drag & Drop** | Si | Limitado | No | No | No |
| **Zoom/Pan** | Si | Si | No | Limitado | No* |
| **Custom nodes (JSX)** | Si | Limitado | Si | No | No |
| **Expand/Collapse** | Custom | Si | No | Si | No |
| **Export PNG/SVG** | Custom | Si | No | Si | Si |
| **Layout engines** | dagre/elkjs | D3 tree | CSS | Propio | Propio |
| **Comunidad** | 40K+ stars | 1.1K stars | 41 stars | 3K stars | 70K+ stars |
| **Escalabilidad** | Buena | Media | Baja | Baja | N/A |

**Recomendacion: React Flow (@xyflow/react) como motor principal + Mermaid como formato de export estatico.** Ambos ya instalados. React Flow para la experiencia interactiva; Mermaid para generar vistas rapidas por IA o para documentacion.

---

## 3. API Design para Organigramas

### 3.1 Modelado de Jerarquia: Opciones

#### Opcion A: Adjacency List (reportsTo / managerId) -- RECOMENDADA

```
PersonProfile {
  id          String
  name        String
  managerId   String?  // FK a PersonProfile.id (self-reference)
  positionId  String?  // FK a Position.id
  ...
}
```

**Pros:**
- Simple de entender e implementar
- Facil de modificar (cambiar un manager = update 1 campo)
- Funciona perfecto con Prisma (self-relation)
- Queries de hijos directos son O(1)
- Ideal cuando la estructura cambia frecuentemente (reorganizaciones)
- PostgreSQL soporta CTEs recursivos (`WITH RECURSIVE`) para queries de subarboles completos

**Contras:**
- Queries de ancestros o descendientes completos requieren recursion
- Performance degrada para arboles muy profundos (>15 niveles)

**Mejor para:** Organigramas empresariales tipicos (3-8 niveles, cambios frecuentes)

#### Opcion B: Materialized Path

```
PersonProfile {
  id    String
  path  String  // "/ceo/vp-eng/dir-platform/senior-dev"
  ...
}
```

**Pros:**
- Queries de ancestros y descendientes son simples (LIKE 'path%')
- Sin recursion necesaria
- Lectura rapida

**Contras:**
- Mover un nodo requiere actualizar todos los descendientes (costoso)
- Paths pueden ser largos y fragiles
- Integridad referencial mas dificil de garantizar
- No es natural en Prisma

**Mejor para:** Jerarquias que raramente cambian y se leen mucho (taxonomias, categorias)

#### Opcion C: Closure Table

```
OrgClosure {
  ancestorId    String
  descendantId  String
  depth         Int
}
```

**Pros:**
- Performance optima para queries de ancestros, descendientes y niveles
- Queries simples sin recursion
- Soporta bien multiples roots

**Contras:**
- Tabla de cierre crece cuadraticamente con la profundidad
- Insertar/mover nodos requiere actualizar muchas filas
- Mas complejo de implementar y mantener
- Overkill para organigramas tipicos

**Mejor para:** Jerarquias profundas con queries frecuentes por nivel

#### Opcion D: Nested Set (lft/rgt)

```
PersonProfile {
  id   String
  lft  Int
  rgt  Int
}
```

**Pros:**
- Queries de subarboles son muy rapidas (WHERE lft BETWEEN parent.lft AND parent.rgt)

**Contras:**
- Insertar o mover nodos requiere recalcular lft/rgt para muchos nodos
- Muy costoso para escrituras frecuentes
- Fragil ante errores de calculo
- No recomendado para datos que cambian frecuentemente

**Mejor para:** Catalogos de productos, taxonomias fijas. NO para organigramas editables.

#### Recomendacion: Adjacency List + CTE Recursivo

Para Zeru, la **Adjacency List** con `managerId` es la opcion correcta:
1. Los organigramas cambian frecuentemente (reorganizaciones, nuevas contrataciones, salidas)
2. Prisma soporta self-relations nativamente
3. PostgreSQL CTE recursivo cubre las queries de subtree
4. Es intuitivo para humanos Y para agentes IA (un solo campo a modificar)
5. Los organigramas empresariales raramente superan 8-10 niveles de profundidad

### 3.2 Modelo de Datos Propuesto

```
// Entidades principales

Position {
  id           String
  title        String       // "VP of Engineering"
  department   String?      // "Engineering"
  level        Int?         // 1=C-level, 2=VP, 3=Director, etc.
  isVacant     Boolean      // Para posiciones abiertas
  parentId     String?      // FK a Position.id (jerarquia de POSICIONES)
  tenantId     String
}

PersonProfile {
  id           String
  name         String
  email        String?
  phone        String?
  avatarS3Key  String?
  positionId   String?      // FK a Position.id (la persona OCUPA esta posicion)
  managerId    String?      // FK a PersonProfile.id (a QUIEN reporta)
  tenantId     String
}
```

**Nota importante:** Separar `Position` de `PersonProfile` permite:
- Modelar **vacantes** (Position sin PersonProfile asignado)
- Una persona puede cambiar de posicion sin perder historial
- Multiples personas en la misma posicion (ej: 3 "Senior Developers")
- Reorganizar posiciones independientemente de personas

### 3.3 Editabilidad por Humanos y Agentes IA

#### Para Humanos (UI):
```
PATCH /api/org-chart/persons/:id/move
Body: { managerId: "new-manager-id" }

PATCH /api/org-chart/positions/:id
Body: { parentId: "new-parent-id", title: "Updated Title" }

POST /api/org-chart/positions
Body: { title: "New Role", department: "Engineering", parentId: "parent-id", isVacant: true }
```

#### Para Agentes IA (natural language -> tool calls):

Los agentes IA pueden modificar el organigrama via herramientas (tools/functions):

```
// Tool: move_person
{
  "personId": "uuid",
  "newManagerId": "uuid",
  "reason": "Reorganization of engineering team"
}

// Tool: create_position
{
  "title": "Staff Engineer",
  "department": "Engineering",
  "parentPositionId": "uuid",
  "isVacant": true
}

// Tool: assign_person_to_position
{
  "personId": "uuid",
  "positionId": "uuid"
}

// Tool: generate_org_chart_mermaid
// (usa Mermaid para generar vista rapida en texto)
```

**Principio clave:** El API es el mismo para humanos y agentes. El agente IA usa las mismas rutas REST o tools que wrappean esas rutas. La capa de "intencionalidad" (entender "mueve a Juan al equipo de Maria") se resuelve en el agente, no en el API.

### 3.4 Versionamiento del Organigrama

#### Estrategia: Event Sourcing Ligero (Append-Only Changelog)

```
OrgChartChange {
  id           String
  changeType   Enum     // MOVE_PERSON, CREATE_POSITION, DELETE_POSITION,
                        // ASSIGN_PERSON, UNASSIGN_PERSON, UPDATE_POSITION
  entityType   String   // "Person" | "Position"
  entityId     String
  before       Json     // Snapshot del estado anterior
  after        Json     // Snapshot del estado posterior
  reason       String?  // Motivo del cambio (obligatorio para IA)
  performedBy  String   // userId o "ai-agent:{agentId}"
  tenantId     String
  createdAt    DateTime
}
```

**Beneficios:**
- **Audit trail completo:** Quien cambio que, cuando y por que
- **Rollback:** Se puede reconstruir el estado anterior desde `before`
- **Snapshots periodicos:** Tomar snapshots del organigrama completo a intervalos (mensual, trimestral) para comparacion historica tipo BambooHR
- **Responsabilidad IA:** Si un agente IA hizo un cambio, queda registrado con el motivo
- **Compliance:** Historial inmutable para auditorias

**Alternativa considerada:** Temporal Tables de PostgreSQL. Pros: automatico a nivel DB. Contras: menos control sobre metadata (reason, performedBy), mas dificil de exponer via API.

**Recomendacion:** Changelog explicitio en capa aplicacion (no temporal tables), porque necesitamos metadata rica (reason, performedBy, tipo de actor) que las temporal tables no soportan nativamente.

---

## 4. Funcionalidades Clave de un Buen Organigrama SaaS

### 4.1 Funcionalidades Core (MVP)

| Funcionalidad | Prioridad | Tecnologia | Notas |
|---|---|---|---|
| **Vista de arbol top-down** | P0 | React Flow + dagre | Layout automatico vertical con dagre. Opcion horizontal tambien |
| **Zoom, pan, fit-to-screen** | P0 | React Flow (nativo) | `fitView`, `zoomIn`, `zoomOut`, minimap integrado |
| **Fotos/avatares** | P0 | React Flow custom nodes | Nodo personalizado con imagen circular + nombre + cargo |
| **Info en hover/click** | P0 | React Flow custom nodes + tooltip | Tooltip o panel lateral con departamento, email, telefono, fecha ingreso |
| **Busqueda de persona** | P0 | Input + React Flow `fitView` | Buscar por nombre -> centrar y resaltar nodo encontrado |
| **Expand/collapse por niveles** | P1 | React Flow custom logic | Boton en cada nodo manager para colapsar/expandir sus reportes. Badge con conteo de reportes ocultos |

### 4.2 Funcionalidades Avanzadas (Post-MVP)

| Funcionalidad | Prioridad | Tecnologia | Notas |
|---|---|---|---|
| **Drag & drop para reorganizar** | P1 | React Flow drag handlers | Arrastrar un nodo sobre otro para reasignar manager. Confirmar con modal |
| **Filtros por departamento/nivel** | P1 | UI filters + React Flow | Sidebar con checkboxes. Ocultar nodos que no matchean |
| **Vacantes / posiciones abiertas** | P1 | Modelo Position.isVacant | Nodos con estilo diferenciado (borde punteado, icono de "+"). Click para crear requisicion |
| **Export PNG** | P2 | `html-to-image` + React Flow | Capturar el viewport completo como imagen |
| **Export SVG** | P2 | React Flow viewport to SVG | Generar SVG limpio del organigrama |
| **Export PDF** | P2 | `html-to-image` -> jsPDF | Primero capturar como imagen, luego insertar en PDF |
| **Vista colapsable por niveles** | P2 | Botones "Nivel 1", "Nivel 2", etc. | Expandir/colapsar todo el organigrama hasta cierto nivel |
| **Historial de cambios** | P2 | OrgChartChange + UI timeline | Timeline de cambios con diff visual |

### 4.3 Funcionalidades Premium (Futuro)

| Funcionalidad | Prioridad | Tecnologia | Notas |
|---|---|---|---|
| **Scenario planning** | P3 | Modelo de "scenarios" (sandbox) | Inspirado en ChartHop. Crear escenarios what-if sin afectar datos reales |
| **Impacto presupuestario** | P3 | Integracion con compensacion | Al mover personas, mostrar impacto en budget del departamento |
| **Headcount analytics** | P3 | Charts + queries agregados | Tamano de equipos, ratio manager/IC, crecimiento en el tiempo |
| **Metricas de diversidad** | P3 | Analytics sobre datos demograficos | Distribucion por genero, antiguedad, etc. (con datos opcionales) |
| **Colaboracion en tiempo real** | P3 | WebSockets + React Flow | Cursores colaborativos tipo Lucidchart. Complejo de implementar |
| **Aprobacion de cambios** | P3 | Workflow engine | Cambios en el organigrama requieren aprobacion de HR/liderazgo |
| **IA: sugerir reorganizaciones** | P3 | Agente IA + tools | "El equipo de soporte tiene 15 reportes directos. Sugerimos crear un team lead" |

### 4.4 Diseno del Nodo (UX)

Un nodo de organigrama efectivo debe mostrar:

**Vista compacta (default):**
- Avatar circular (foto o iniciales)
- Nombre completo
- Cargo
- Badge con conteo de reportes directos
- Indicador visual de departamento (color del borde)

**Vista expandida (hover o click):**
- Todo lo anterior +
- Departamento
- Email
- Telefono
- Fecha de ingreso
- Link a perfil completo

**Nodo de vacante:**
- Icono de persona con "+" o silueta
- Titulo del cargo
- Departamento
- Borde punteado
- CTA: "Crear requisicion" o "Asignar persona"

### 4.5 Interacciones Clave (UX)

1. **Zoom:** Mouse wheel + botones +/- + pinch en touch
2. **Pan:** Click + drag en area vacia
3. **Fit to view:** Boton que ajusta zoom para ver todo el organigrama
4. **Buscar:** Input de busqueda -> autocomplete -> centrar en nodo con animacion
5. **Filtrar:** Sidebar con filtros de departamento, nivel, tipo (empleado/vacante)
6. **Colapsar:** Click en nodo manager -> toggle sus hijos. Badge muestra N hijos ocultos
7. **Reorganizar:** Drag de nodo sobre otro -> modal de confirmacion -> update de managerId
8. **Detalle:** Click en nodo -> panel lateral con info completa + acciones

---

## 5. Plan de Implementacion Sugerido

### Fase 1: MVP (1-2 semanas)
1. Agregar `managerId` (self-relation) y modelo `Position` al schema Prisma
2. API REST: CRUD de posiciones + asignacion de personas + query del arbol completo
3. Componente React Flow con layout dagre, custom nodes (avatar + nombre + cargo)
4. Zoom, pan, fit-to-view, minimap
5. Busqueda basica con centrado en nodo

### Fase 2: Interactividad (1 semana)
1. Expand/collapse por nodo
2. Filtros por departamento
3. Drag & drop para reorganizar (con confirmacion)
4. Tabla de changelog (OrgChartChange)
5. Vacantes visibles en el arbol

### Fase 3: Export y Analytics (1 semana)
1. Export PNG/SVG/PDF
2. Vista por niveles (colapsar todo a nivel N)
3. Historial de cambios con timeline UI
4. Metricas basicas (headcount por departamento, direct reports)

### Fase 4: IA y Avanzado (futuro)
1. Tools del agente IA para modificar organigrama via lenguaje natural
2. Generacion de vista Mermaid por IA
3. Scenario planning (sandbox mode)
4. Sugerencias de reorganizacion por IA

---

## 6. Fuentes

- [BambooHR - Org Chart Features](https://help.bamboohr.com/hc/en-us/articles/216836007-View-the-Company-Directory-and-Org-Chart)
- [BambooHR Marketplace - OrgChart Integration](https://www.bamboohr.com/integrations/listings/orgchart)
- [ChartHop - Headcount Planning](https://www.charthop.com/modules/headcount-planning)
- [ChartHop - Org Planning Solutions](https://www.charthop.com/solutions/org-planning/)
- [ChartHop vs Rippling - GetApp](https://www.getapp.com/hr-employee-management-software/a/rippling/compare/charthop/)
- [Deel vs Rippling](https://www.deel.com/deel-vs-competitors/rippling/)
- [Factorial vs Pingboard - Capterra](https://www.capterra.com/compare/168685-212284/Factorial-HR-Software-vs-Pingboard)
- [Pingboard - Org Chart Software](https://pingboard.com/org-chart-software)
- [Lucidchart - Org Chart Software](https://www.lucidchart.com/pages/examples/orgchart_software)
- [Lucidchart - Product Features](https://www.lucidchart.com/pages/product)
- [Best Org Chart Tools 2026 - PeopleManagingPeople](https://peoplemanagingpeople.com/tools/best-org-chart-tools/)
- [Best Org Chart Software 2025 - Capterra](https://www.capterra.com/org-chart-software/)
- [React Flow - Official Site](https://reactflow.dev)
- [React Flow - Dagre Layout Example](https://reactflow.dev/examples/layout/dagre)
- [React Flow - ELKjs Layout Example](https://reactflow.dev/examples/layout/elkjs)
- [React Flow - Custom Nodes](https://reactflow.dev/learn/customization/custom-nodes)
- [d3-org-chart - npm](https://www.npmjs.com/package/d3-org-chart)
- [d3-org-chart - GitHub (bumbeishvili)](https://github.com/bumbeishvili/org-chart)
- [react-organizational-chart - npm](https://www.npmjs.com/package/react-organizational-chart)
- [react-organizational-chart - GitHub](https://github.com/daniel-hauser/react-organizational-chart)
- [OrgChart.js - GitHub (dabeng)](https://github.com/dabeng/OrgChart)
- [Mermaid - Official Site](https://mermaid.js.org/)
- [Hierarchical Models in PostgreSQL - Ackee](https://www.ackee.agency/blog/hierarchical-models-in-postgresql)
- [Closure Table vs Adjacency List - TechGrind](https://www.techgrind.io/explain/what-are-the-options-for-storing-hierarchical-data-in-a-relational-database)
- [Materialized Path - Bojan Zivanovic](https://bojanz.wordpress.com/2014/04/25/storing-hierarchical-data-materialized-path/)
- [Nested Set Model - ScienceDirect](https://www.sciencedirect.com/topics/computer-science/nested-set-model)
- [Audit Trail Database Design - Red Gate](https://www.red-gate.com/blog/database-design-for-audit-logging/)
- [4 Common Audit Trail Designs - Medium](https://medium.com/techtofreedom/4-common-designs-of-audit-trail-tracking-data-changes-in-databases-c894b7bb6d18)
- [npm trends: d3-org-chart vs orgchart vs react-orgchart](https://npmtrends.com/d3-org-chart-vs-orgchart-vs-react-orgchart)
- [AI Agents in the Org Chart - Inkeep](https://inkeep.com/blog/org-chart)
- [Lexchart - AI Powered Org Charts](https://lexchart.com/)
