# Investigacion Organigramas para SaaS -- Perspectiva 2 (Gestion, IA, Datos, Performance)

> Investigador independiente. Enfoque en organigramas como herramienta de gestion, integracion con IA, modelado de datos avanzado, rendimiento a escala y anti-patterns.

---

## 1. Organigramas como herramienta de gestion, no solo visualizacion

### 1.1 Como usan los organigramas las grandes tech

**Google -- Estructura Matricial**
Google opera con una estructura matricial donde los empleados pertenecen simultaneamente a divisiones de producto (Search, Ads, Cloud, YouTube) y a departamentos funcionales (Engineering, Marketing, Design). Esto genera lineas de reporte duales: un gerente funcional (linea solida) y un gerente de producto/proyecto (linea punteada). El organigrama de Google no es un arbol -- es un grafo dirigido con multiples padres por nodo.

**Netflix -- Jerarquia plana con autonomia**
Netflix tiene solo 8 niveles de gestion desde los co-CEOs hasta los contribuidores individuales. Su filosofia "context, not control" significa que el organigrama define quien provee contexto, no quien da ordenes. Los equipos tienen alta autonomia; el organigrama es mas un mapa de flujo de informacion que una cadena de mando.

**Spotify -- El modelo de Squads/Tribes/Chapters/Guilds**
El "Spotify Model" (Kniberg & Ivarsson, 2012) es la referencia mas citada en estructura organizacional agil:
- **Squads**: Equipos de 6-12 personas, autonomos como mini-startups, con una mision a largo plazo
- **Tribes**: Agrupan multiples squads (max ~100 personas, basado en el numero de Dunbar)
- **Chapters**: Grupos por habilidad que cruzan squads y tribes (ej: todos los testers)
- **Guilds**: Comunidades de practica opcionales y cross-organizacionales

**Implicacion critica**: El organigrama de Spotify NO es un arbol. Es una estructura multidimensional donde un desarrollador pertenece simultaneamente a un Squad, un Chapter, potencialmente un Guild, y reporta tanto a un Product Owner como a un Chapter Lead.

**Advertencia importante**: Jeremiah Lee, ex-empleado de Spotify, revelo que el modelo "solo fue aspiracional y nunca se implemento completamente". Esto destaca la brecha entre el organigrama teorico y el real -- un problema que nuestra herramienta debe abordar.

### 1.2 Organigramas dinamicos vs estaticos

| Caracteristica | Estatico | Dinamico |
|---|---|---|
| Actualizacion | Manual, periodica | Automatica, en tiempo real |
| Fuente de datos | Dibujo manual | Sincronizado con HRIS/directorio |
| Precision | Se degrada rapidamente | Siempre actualizado |
| Uso tipico | Presentaciones, compliance | Gestion diaria, onboarding |
| Escenarios what-if | No soportado | Modelado de futuros estados |

El mercado esta migrando agresivamente hacia organigramas dinamicos. Plataformas como Nakisa permiten modelar escenarios hipoteticos ("que pasa si fusionamos estos 2 departamentos?") con analisis financiero integrado (impacto en costos salariales, headcount, etc.).

### 1.3 Estructuras matriciales y lineas de reporte dual

En una organizacion matricial:
- **Linea solida**: Reporte administrativo (quien aprueba vacaciones, hace evaluaciones)
- **Linea punteada (dotted line)**: Reporte funcional (quien asigna trabajo del proyecto)
- **Dual solida**: Dos gerentes con autoridad compartida (raro pero existe)

**El error mas comun**: No definir el alcance exacto de cada relacion de reporte ni los mecanismos de resolucion de conflictos. Si una persona tiene 2 jefes, debe estar claro quien decide que.

---

## 2. Herramientas emergentes 2025-2026

### 2.1 Panorama del mercado

El mercado de software de organigramas esta valorado en **$1.8 mil millones (2026)** con proyeccion a **$5.6 mil millones para 2036** (CAGR 10.5%).

### 2.2 Herramientas por categoria

**Organigramas puros (visualizacion)**
- **Organimi**: Cloud-based, drag-and-drop, bueno para startups. Limitado en analisis.
- **Lexchart**: Usa IA para generar organigramas desde descripciones textuales en segundos.
- **OrgChartHub**: Integrado directamente en HubSpot CRM.

**Organigramas + Directorio de personas**
- **Sift**: Agrega "Organizational Nodes" (departamentos, equipos) al organigrama. Integra con Azure AD, LDAP, Microsoft 365, Google Workspace, Workday, SuccessFactors. Destaca por su directorio de habilidades: no solo muestra quien reporta a quien, sino quien sabe que.
- **Pingboard**: Directorio de personas bonito, pero costoso con minimums de usuarios.

**Organigramas + Workforce Planning**
- **Functionly**: Va mas alla de la visualizacion. Mapea roles, responsabilidades y skills para identificar gaps y overlaps. Su feature de scenario planning permite modelar cambios antes de ejecutarlos.
- **Ingentis org.manager**: Enterprise-grade, usado por +2000 empresas. Conecta con SAP, Oracle, PeopleSoft, Workday. Ofrece visualizaciones avanzadas: sunburst charts, radial trees, network clusters.
- **Nakisa**: Suite completa de workforce planning con analisis 5C (Capacity, Cost, Capabilities, Composition, Configuration).
- **ChartHop**: People analytics con organigramas, ideal para HR teams.

**Organigramas + Procesos**
- **Trainual**: Combina organigrama con documentacion de procesos y capacitacion. No solo muestra quien hace que, sino como lo hace.

**Herramientas generalistas con org charts**
- **Miro**: IA genera organigramas desde descripciones en lenguaje natural.
- **ClickUp Brain**: Analiza dependencias de tareas y ownership para inferir lineas de reporte reales.

### 2.3 Gaps en el mercado actual

Basado en quejas frecuentes de usuarios en G2/Capterra:
1. **Performance**: Tiempos de carga lentos con organigramas grandes
2. **Customizacion limitada**: No soportan bien estructuras complejas o tecnicas
3. **Sin acceso offline**: Dependencia total de conexion
4. **Actualizacion manual costosa**: Integrar datos de multiples jurisdicciones es doloroso
5. **Escenarios de fusion**: No soportan bien merger de 2 censos de datos con restructuracion
6. **Zoom inestable**: Feature basico que muchos implementan mal

**Oportunidad para Zeru**: Ninguna herramienta del mercado construye el organigrama automaticamente desde entrevistas. Todas asumen que el usuario ya tiene los datos. Esto es exactamente el gap que podemos llenar.

---

## 3. Organigramas + IA: Construccion desde entrevistas

### 3.1 El pipeline de extraccion

Para construir un organigrama desde entrevistas, se necesita un pipeline de NLP/LLM:

```
Audio entrevista
    -> Transcripcion (Whisper/ElevenLabs)
    -> Segmentacion de turnos de habla
    -> Extraccion de entidades (NER): personas, roles, departamentos
    -> Extraccion de relaciones: "reporta a", "trabaja con", "supervisa"
    -> Construccion de grafo preliminar
    -> Resolucion de conflictos
    -> Organigrama validado
```

### 3.2 Senales en una entrevista que revelan jerarquia

**Senales directas (alta confianza)**:
- "Mi jefe es [nombre]" / "Reporto a [nombre]"
- "Tengo X personas a mi cargo"
- "Mi equipo esta compuesto por..."
- "[Nombre] es el gerente de [departamento]"

**Senales indirectas (confianza media)**:
- "Le pido autorizacion a [nombre] para..."
- "Cuando necesitamos presupuesto, hablamos con..."
- "[Nombre] evalua mi desempeno"
- "En las reuniones de equipo con [nombre]..."

**Senales contextuales (confianza baja)**:
- "Creo que [nombre] esta por encima de..."
- "Me parece que [departamento] depende de..."
- "Antes reportabamos a... pero ahora no estoy seguro"

### 3.3 Modelado de incertidumbre

Cada relacion extraida debe tener un **confidence score**:

```
Relacion {
  source: "Juan Perez",
  target: "Maria Lopez",
  type: "reports_to",
  confidence: 0.95,        // Alta: "mi jefa directa es Maria"
  source_interview: "entrevista_001",
  evidence: "minuto 12:34 - 'yo reporto directamente a Maria Lopez'",
  qualifier: "direct_statement"  // vs "inference" vs "hearsay"
}
```

**Niveles de certeza propuestos**:
- **0.9-1.0**: Declaracion directa del involucrado ("yo reporto a X")
- **0.7-0.89**: Declaracion de un tercero ("Juan reporta a X")
- **0.5-0.69**: Inferencia del sistema ("Juan menciona pedir autorizacion a X")
- **0.3-0.49**: Informacion ambigua ("creo que Juan reporta a X")
- **0.0-0.29**: Contradiccion con otra fuente

### 3.4 Resolucion de contradicciones

Cuando el entrevistado A dice "Juan reporta a Maria" pero el entrevistado B dice "Juan reporta a Pedro":

**Estrategia de resolucion**:
1. **Cercania al sujeto**: La declaracion de Juan sobre si mismo tiene mas peso que la de otros
2. **Recencia**: Informacion mas reciente tiene prioridad (reorganizaciones recientes)
3. **Consistencia**: Si 3 de 4 fuentes coinciden, la mayoria gana
4. **Tipo de reporte**: Puede que ambos tengan razon -- Juan reporta administrativamente a Maria y funcionalmente a Pedro (estructura matricial)
5. **Escalacion humana**: Si la confianza es baja (<0.5) para una relacion critica, marcarla para validacion manual

**Implementacion con LLM (structured extraction)**:

Se puede usar function calling / structured outputs de OpenAI para extraer relaciones en formato JSON:

```json
{
  "extracted_relationships": [
    {
      "person": "Juan Perez",
      "role": "Desarrollador Senior",
      "department": "Tecnologia",
      "reports_to": "Maria Lopez",
      "report_type": "administrative",
      "confidence": 0.92,
      "evidence_quote": "Mi jefa directa es Maria Lopez",
      "timestamp_seconds": 745
    },
    {
      "person": "Juan Perez",
      "secondary_report_to": "Pedro Garcia",
      "report_type": "functional",
      "confidence": 0.67,
      "evidence_quote": "Para temas del proyecto, coordino con Pedro",
      "timestamp_seconds": 890
    }
  ]
}
```

### 3.5 Construccion incremental del grafo

Con cada nueva entrevista, el organigrama se enriquece:
- Nuevos nodos se agregan con sus relaciones
- Relaciones existentes se refuerzan o debilitan segun nueva evidencia
- Conflictos se detectan automaticamente y se marcan para revision
- El confidence score global de cada relacion se recalcula como promedio ponderado

---

## 4. Modelo de datos -- perspectiva alternativa

### 4.1 El problema con `reportsTo` simple

Un campo `reportsTo` (parent_id) en la tabla de empleados modela un arbol estricto. Esto falla con:
- Estructuras matriciales (una persona, dos jefes)
- Roles interinos (alguien cubre temporalmente otro puesto)
- Vacantes (posiciones abiertas sin persona asignada)
- Equipos cross-funcionales (task forces, comites)
- Historial (quien reportaba a quien el mes pasado)

### 4.2 Modelo propuesto: Grafo de relaciones con metadata

En lugar de un campo `reportsTo` en la tabla de personas, usar una **tabla de relaciones separada**:

**Tabla `Position` (el puesto, no la persona)**:
```
- id
- title (ej: "Gerente de TI")
- department_id
- level (ej: C-Level, VP, Director, Manager, IC)
- is_vacant: boolean
- tenant_id
```

**Tabla `Person`**:
```
- id
- name
- email
- tenant_id
```

**Tabla `PositionAssignment` (persona en puesto)**:
```
- id
- person_id
- position_id
- start_date
- end_date (null = actual)
- assignment_type: PERMANENT | INTERIM | ACTING
- tenant_id
```

**Tabla `PositionRelationship` (las lineas del organigrama)**:
```
- id
- from_position_id  (el subordinado)
- to_position_id    (el superior)
- relationship_type: ADMINISTRATIVE | FUNCTIONAL | DOTTED | MENTORSHIP
- start_date
- end_date (null = actual)
- confidence_score  (0.0 - 1.0, para relaciones inferidas por IA)
- source: MANUAL | AI_EXTRACTED | HRIS_SYNC
- tenant_id
```

**Tabla `OrgRelationshipEvidence` (evidencia de la IA)**:
```
- id
- position_relationship_id
- interview_id
- quote
- timestamp_seconds
- qualifier: DIRECT_STATEMENT | THIRD_PARTY | INFERENCE | HEARSAY
- confidence_score
```

### 4.3 Ventajas de este modelo

1. **Soporta grafos, no solo arboles**: Una persona puede tener multiples relaciones de reporte
2. **Separa puesto de persona**: Permite modelar vacantes, interinos y rotaciones
3. **Historial temporal**: `start_date`/`end_date` dan trazabilidad completa
4. **Trazabilidad de IA**: Cada relacion inferida tiene su evidencia enlazada
5. **Tipos de relacion ricos**: No todo es "reporta a" -- hay mentoreo, funcional, etc.
6. **Multi-tenant nativo**: Aislamiento por `tenant_id`

### 4.4 Arbol estricto vs grafo dirigido

| Aspecto | Arbol (reportsTo) | Grafo dirigido (tabla relaciones) |
|---|---|---|
| Complejidad | Simple | Moderada |
| Matricial | No soporta | Si soporta |
| Vacantes | Hack con persona "TBD" | Nativo con is_vacant |
| Historial | Requiere tabla separada | Nativo con fechas |
| Queries "ancestors" | Recursion/CTE simple | Recursion mas compleja |
| Deteccion de ciclos | No necesario (es arbol) | Necesario (validacion) |
| Performance | O(1) para padre | O(relaciones) para padres |
| Renderizado | Trivial (arbol) | Requiere layout de grafo |

**Recomendacion**: Usar el modelo de grafo dirigido, pero mantener la restriccion de que las relaciones ADMINISTRATIVE formen un arbol (exactamente 1 padre administrativo por posicion, excepto el CEO). Las relaciones FUNCTIONAL y DOTTED pueden ser muchas-a-muchas.

### 4.5 Almacenamiento de jerarquias en PostgreSQL

Para queries eficientes sobre el organigrama, hay 4 estrategias principales:

**Adjacency List** (parent_id simple):
- Pro: Simple, inserts/deletes faciles, eficiente en espacio
- Contra: Queries de ancestros requieren recursion (WITH RECURSIVE)
- Mejor para: Arboles poco profundos, writes frecuentes

**Materialized Path** (PostgreSQL `ltree`):
- Pro: Queries potentes con operadores `@>`, `<@`, `~`
- Contra: Mover subarboles requiere actualizar todos los paths hijos
- Mejor para: Reads frecuentes, arboles moderadamente profundos

**Closure Table** (tabla separada con todos los pares ancestro-descendiente):
- Pro: Performance optima para queries de ancestros/descendientes
- Contra: Crece rapidamente en espacio (O(n*profundidad)), updates complejos
- Mejor para: Reads muy frecuentes, writes infrecuentes

**Nested Sets** (left/right values):
- Pro: Queries de descendientes sin recursion ni joins
- Contra: Inserts/updates requieren recalcular todo el arbol
- Mejor para: Arboles casi estaticos con muchos reads

**Recomendacion para Zeru**: Usar **Adjacency List** (por simplicidad con Prisma) complementado con **Materialized Path via ltree** para queries complejas. El organigrama cambia con relativa poca frecuencia comparado con la cantidad de veces que se consulta, pero no es tan estatico como para justificar Closure Tables.

---

## 5. Performance y escala

### 5.1 Desafios de renderizar organigramas grandes

Un organigrama de 500+ personas con relaciones matriciales es un grafo complejo. Los desafios:
- SVG con 500+ nodos se vuelve lento (DOM overhead)
- Layout calculation puede tomar segundos
- Interaccion (pan, zoom, expand/collapse) debe ser fluida

### 5.2 Tecnologias de renderizado

| Tecnologia | Nodos soportados | FPS tipico | Interactividad |
|---|---|---|---|
| SVG (DOM) | <500 | 30+ bajo 500 | Excelente (eventos nativos) |
| Canvas 2D | <10,000 | 30+ bajo 5000 | Buena (hit testing manual) |
| WebGL | <100,000+ | 60 estable | Compleja (shaders custom) |
| Hibrido SVG+WebGL | <50,000 | 50+ | Buena |

**Benchmarks reales**: KeyLines demostro 60 FPS con 10,000 elementos usando WebGL. Canvas cae a 22 FPS con 50K puntos vs WebGL a 58 FPS. La inicializacion de Canvas es mas rapida (15ms vs 40ms para WebGL), pero WebGL gana en frames bajo interaccion (0.01ms vs 1.2ms por frame).

### 5.3 Estrategias de virtualizacion

**Viewport-based rendering**: Solo renderizar nodos visibles en el viewport actual. Al hacer pan/zoom, calcular que nodos entran/salen de vista.

**Lazy loading de subarboles**: Cargar solo los primeros 2-3 niveles. Cuando el usuario expande un nodo, cargar sus hijos bajo demanda.

**Level-of-detail (LOD)**: Al alejar el zoom, reemplazar nodos individuales con indicadores resumidos ("Departamento TI - 45 personas"). Al acercar, mostrar detalle.

**Clustering**: Agrupar nodos cercanos en un solo nodo representativo cuando hay mucha densidad.

**Pagination de nodos hermanos**: Si un manager tiene 50 reportes directos, mostrar los primeros 10 con "ver mas".

### 5.4 Algoritmos de layout

**Reingold-Tilford (1981) / Walker (1990) / Buchheim (2002)**:
- Disenados especificamente para arboles
- Buchheim logro O(n) en tiempo -- el mas eficiente
- Principios: codificar profundidad claramente, no cruzar aristas, subarboles isomorfos dibujados igual, layout compacto
- Usa "threads" para escanear contornos de subarboles eficientemente
- **Ideal para**: Organigramas jerarquicos puros (arbol estricto)

**Sugiyama (1981) -- Layered Graph Drawing**:
4 fases:
1. **Cycle Removal**: Eliminar ciclos con DFS
2. **Layer Assignment**: Asignar nodos a capas horizontales (topological sort)
3. **Vertex Ordering**: Minimizar cruces de aristas (heuristica de mediana, ~24 iteraciones)
4. **Coordinate Assignment**: Asignar posiciones finales, splines para conexiones

Complejidad: O(|V||E|log|E|) en el peor caso, mejorable a O((|V|+|E|)log|E|).
- **Ideal para**: Organigramas con relaciones matriciales (no son arboles puros)

**Comparacion de librerias JavaScript**:

| Libreria | Complejidad de uso | Configurabilidad | Tamano | Mejor para |
|---|---|---|---|---|
| dagre.js | Baja (drop-in) | Limitada | Pequeno | Arboles simples, prototipado |
| ELKjs | Alta | Muy alta | Grande | Grafos complejos, produccion |
| d3-hierarchy | Media | Media | Medio | Arboles con d3 |
| d3-flextree | Media | Media (nodos de tamano variable) | Medio | Arboles con nodos heterogeneos |

**dagre vs ELK**: Para arboles simples, los resultados son similares y dagre gana en simplicidad y tamano de bundle. Para DAGs complejos (org matriciales), ELK produce mejores layouts. ELK corre asincrono, lo cual es mejor para UX pero requiere manejo de estado.

### 5.5 Librerias recomendadas para React

- **React Flow + ELKjs**: Para organigramas complejos con relaciones matriciales. React Flow maneja el canvas interactivo, ELK calcula el layout.
- **d3-org-chart (bumbeishvili)**: Libreria dedicada a organigramas con soporte de D3 v7, animaciones, expand/collapse, export, multiples temas, paginacion. Integraciones para React, Vue, Angular.
- **@unicef/react-org-chart**: Soporta lazy loading nativo, bueno para organigramas grandes.

---

## 6. Anti-patterns en organigramas SaaS

### 6.1 Errores comunes de las herramientas

**1. Tratar el organigrama como un dibujo, no como un modelo de datos**
Muchas herramientas son glorified drawing tools. El organigrama deberia ser una VIEW derivada de datos estructurados, no un dibujo que alguien actualiza manualmente.

**2. Solo mostrar reporting lines**
Organimi identifica este como el error #1. Un organigrama puede y debe mostrar: skills, ubicacion, proyectos actuales, disponibilidad, informacion de contacto. Reducirlo a "quien reporta a quien" desperdicia su potencial.

**3. No tener owner del organigrama**
Si nadie es responsable de mantenerlo actualizado, se pudre. La herramienta debe tener mecanismos de actualizacion automatica (sync con HRIS) o notificaciones de staleness.

**4. One-size-fits-all layout**
Usar el mismo layout para un equipo de 5 personas y para una organizacion de 500 es un error. La herramienta debe adaptar el layout al tamano: arbol expandido para equipos pequenos, collapsed con drill-down para organizaciones grandes.

**5. Ignorar la temporalidad**
La mayoria de herramientas muestran un snapshot actual. No permiten ver "como era la organizacion hace 6 meses" ni "como sera despues de la reestructuracion propuesta". Esto limita su valor para planning.

**6. Zoom/pan mal implementado**
Mencionado repetidamente en reviews negativos. Es una funcionalidad basica que muchos implementan mal, resultando en experiencias frustrantes de navegacion.

**7. Asumir arbol estricto**
Modelar solo parent_id impide representar organizaciones matriciales, dotted lines, equipos cross-funcionales. Este es el anti-pattern de datos mas comun.

**8. No integrar con fuentes de datos existentes**
Obligar al usuario a ingresar datos manualmente cuando ya existen en un HRIS, Active Directory o Google Workspace. La integracion deberia ser la regla, no la excepcion.

**9. Contratar demasiado junior demasiado rapido**
Error de ORGANIZACION, no de software: David Sacks (Craft Ventures) destaca que los fundadores de SaaS a menudo contratan gente demasiado junior para ahorrar, creando capas de management innecesarias que complican el organigrama. A las 50 personas, se necesitan al menos 3 ingenieros de infraestructura -- algo que frecuentemente se omite.

**10. Flat structure sin estructura real**
En etapas tempranas, las startups usan estructuras planas sin reportes definidos ni division de responsabilidades. Esto funciona con 5 personas pero colapsa a las 15-20. La herramienta debe facilitar la transicion a estructura formal.

---

## 7. Recomendaciones para Zeru

### 7.1 Diferenciador principal
**Construccion de organigramas desde entrevistas con IA**. Ningun competidor hace esto. Todos asumen que el usuario ya tiene los datos estructurados. Zeru puede tomar entrevistas en audio, extraer la jerarquia automaticamente y presentar un organigrama con confidence scores.

### 7.2 Modelo de datos
Implementar el modelo de grafo dirigido con tabla de relaciones separada (seccion 4.2). Separar Position de Person. Soportar multiples tipos de relacion desde el dia 1.

### 7.3 Stack tecnico sugerido para renderizado
- **<100 personas**: SVG con d3-org-chart (simplicidad, interactividad nativa)
- **100-500 personas**: React Flow + dagre/d3-hierarchy con lazy loading
- **500+ personas**: React Flow + ELKjs con virtualizacion de viewport y WebGL para el renderizado

### 7.4 Features prioritarios
1. Extraccion automatica desde entrevistas (core differentiator)
2. Confidence scores visibles en cada relacion
3. Validacion manual de relaciones inciertas
4. Soporte para dotted lines y relaciones matriciales
5. Historial temporal (time travel del organigrama)
6. Escenarios what-if para reestructuraciones
7. Export a formatos estandar (PDF, PNG, CSV)

### 7.5 Lo que NO hacer
- No construir un drawing tool -- construir un data tool con buena visualizacion
- No asumir arbol estricto en el modelo de datos
- No ignorar la temporalidad
- No obligar a ingresar datos manualmente si se pueden inferir
- No renderizar todo el grafo cuando se puede virtualizar

---

## Fuentes

- [Netflix Org Chart - Bullfincher](https://bullfincher.io/companies/netflix/org-chart)
- [Spotify Org Structure - Functionly](https://www.functionly.com/orginometry/real-org-charts/spotify-org-structure)
- [Google Org Chart - EdrawMind](https://edrawmind.wondershare.com/company-management/google-org-chart.html)
- [Lexchart - AI Powered Organization Charts](https://lexchart.com/)
- [ClickUp AI Organizational Chart Generator](https://clickup.com/p/features/ai/organizational-chart-generator)
- [Miro AI Org Chart](https://miro.com/ai/ai-organizational-chart/)
- [Matrix Organization Chart - TheOrgChart](https://theorgchart.com/resources/creating-a-matrix-organization-chart-with-orgchart/)
- [Dotted Line Org Chart - Plumsail](https://plumsail.com/blog/dotted-line-org-chart/)
- [Hierarchical Models in PostgreSQL - Ackee](https://www.ackee.agency/blog/hierarchical-models-in-postgresql)
- [Recursive Query vs Closure Table vs Graph Database](https://blog.getdatascale.com/recursive-query-vs-closure-table-vs-graph-database-a-complete-guide-from-my-pov-2a8dd794b733)
- [Sugiyama Method - Disy](https://blog.disy.net/sugiyama-method/)
- [Sugiyama Algorithm - GitHub](https://github.com/auroraptor/sugiyama-algorithm)
- [Efficient Sugiyama Implementation - Springer](https://link.springer.com/chapter/10.1007/978-3-540-31843-9_17)
- [d3-org-chart - GitHub](https://github.com/bumbeishvili/org-chart)
- [React Flow Layouting](https://reactflow.dev/learn/layouting/layouting)
- [ELKjs - GitHub](https://github.com/kieler/elkjs)
- [d3-flextree - GitHub](https://github.com/Klortho/d3-flextree)
- [Reingold-Tilford Algorithm - Towards Data Science](https://towardsdatascience.com/reingold-tilford-algorithm-explained-with-walkthrough-be5810e8ed93/)
- [SVG vs Canvas vs WebGL Performance 2025](https://www.svggenie.com/blog/svg-vs-canvas-vs-webgl-performance-2025)
- [WebGL Graph Visualization - KeyLines](https://cambridge-intelligence.com/visualizing-graphs-webgl/)
- [5 Common Mistakes with Org Charts - Organimi](https://www.organimi.com/5-common-mistakes-people-make-with-org-charts/)
- [The SaaS Org Chart - David Sacks](https://sacks.substack.com/p/the-saas-org-chart)
- [Dynamic Org Chart SaaS Opportunity](https://saasopportunities.com/opportunities/dynamic-org-chart-generator-for-scaling-teams-931)
- [Nakisa Workforce Planning](https://nakisa.com/products/strategic-workforce-planning-software/)
- [Functionly - Capterra](https://www.capterra.com/p/208681/Functionly/)
- [Ingentis org.manager](https://www.ingentis.com/en/platform/org-chart-software/)
- [Uncertain Knowledge Graphs Survey - arXiv](https://arxiv.org/html/2405.16929v2)
- [LLM Structured Outputs Guide - Agenta](https://agenta.ai/blog/the-guide-to-structured-outputs-and-function-calling-with-llms)
- [Structured Data Extraction with LLM Schemas - Simon Willison](https://simonwillison.net/2025/Feb/28/llm-schemas/)
