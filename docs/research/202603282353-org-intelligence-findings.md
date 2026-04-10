# Hallazgos de Investigacion - Plataforma de Inteligencia Organizacional

## Estado: CONSENSO ALCANZADO

---

## Hipotesis 1: RAG & Knowledge Management (Investigador 1)

### 1. Analisis del Stack Actual de Zeru

Antes de recomendar, es fundamental entender lo que ya tenemos:

**Infraestructura existente:**
- PostgreSQL como base de datos principal (Prisma ORM)
- **pgvector ya habilitado**: El modelo `Memory` usa `Unsupported("vector(1536)")` para embeddings
- **OpenAI text-embedding-3-small** (1536 dimensiones) ya en uso en `memory.service.ts`
- Busqueda semantica por coseno ya implementada (`1 - (embedding <=> query::vector)`)
- Sistema de memoria con categorias (PREFERENCE, FACT, PROCEDURE, DECISION, CONTEXT)
- Background queue para generacion asincrona de embeddings
- OpenAI Responses API como provider principal (gpt-5.4)
- Gemini configurado para generacion de imagenes
- Sistema multi-tenant con aislamiento por `tenantId`
- S3 para almacenamiento de documentos
- MCP SDK integrado (`@modelcontextprotocol/sdk`)

**Brechas criticas para inteligencia organizacional:**
- No hay chunking — cada memoria es un texto atomico, no hay fragmentacion de documentos largos
- No hay busqueda hibrida (BM25 + vector) — solo vector search
- No hay re-ranking
- No hay knowledge graph — las relaciones entre entidades son implicitas
- No hay indexacion HNSW/IVFFlat explicitamente configurada para pgvector
- No hay evaluacion de calidad del RAG (RAGAS o similar)

---

### 2. Arquitecturas RAG: Cual Elegir para Conocimiento Organizacional

#### 2.1 Taxonomia de Arquitecturas

| Arquitectura | Descripcion | Complejidad | Idoneidad para nuestro caso |
|---|---|---|---|
| **Naive RAG** | Chunk -> embed -> retrieve -> generate | Baja | INSUFICIENTE. No maneja relaciones entre entidades organizacionales |
| **Advanced RAG** | Pre-retrieval (query rewriting) + post-retrieval (re-ranking, hybrid search) | Media | LINEA BASE SOLIDA. Mejora precision 35-49% segun Anthropic |
| **Modular RAG** | Componentes intercambiables (indexers, retrievers, generators, routers) | Media-Alta | IDEAL para evolucion incremental. Permite comenzar simple y escalar |
| **Graph RAG** | Knowledge graph + comunidades + resumen jerarquico | Alta | NECESARIO para relaciones organizacionales (roles-procesos-sistemas) |
| **Agentic RAG** | Agente AI orquesta multiples estrategias de retrieval | Alta | OBJETIVO A LARGO PLAZO. El agente decide como buscar segun la query |

#### 2.2 Recomendacion: Arquitectura Hibrida por Fases

**FASE 1 (MVP — 2-3 semanas):** Advanced RAG con Hybrid Search
- Implementar chunking semantico para transcripciones de entrevistas
- Agregar BM25 (full-text search de PostgreSQL `tsvector`) junto al vector search actual
- Reciprocal Rank Fusion (RRF) para combinar resultados
- Ya tenemos la base: pgvector + embeddings funcionando

**FASE 2 (mes 2):** Contextual Retrieval + Knowledge Graph Ligero
- Aplicar la tecnica de Anthropic: prepend contextual a cada chunk antes de embedding
- Construir knowledge graph en PostgreSQL (Apache AGE o tablas relacionales)
- Entity extraction de entrevistas para poblar el grafo
- Parent-document retrieval para mantener contexto

**FASE 3 (mes 3+):** Modular/Agentic RAG
- Query router: queries simples -> vector search, queries complejas -> graph traversal
- Multi-query retrieval: generar variantes de la query para ampliar recall
- Re-ranking con cross-encoder
- Evaluacion continua con RAGAS

**Justificacion:** El conocimiento organizacional tiene una naturaleza dual:
1. **Contenido semantico** (lo que se dijo en entrevistas, opiniones, descripciones) -> vector RAG
2. **Relaciones estructurales** (quien reporta a quien, que sistema usa que proceso, que area depende de otra) -> knowledge graph

Ninguna arquitectura sola resuelve ambos. La hibrida es inevitable.

---

### 3. Vector Database: pgvector como Eleccion Principal

#### 3.1 Analisis Comparativo

| Criterio | pgvector | Pinecone | Qdrant | Weaviate | ChromaDB |
|---|---|---|---|---|---|
| **Costo incremental** | $0 (ya tenemos PG) | $70-1500/mes | $30-300/mes | $25-300/mes | Open source |
| **Ops overhead** | Ninguno adicional | Managed | Self-host o managed | Self-host o managed | Ligero |
| **Performance (50M vectors)** | 471 QPS (pgvectorscale) | Alto | 41 QPS | Medio | No viable |
| **Transactional consistency** | ACID completo | Eventually consistent | Eventual | Eventual | In-memory |
| **Hybrid search nativo** | Si (tsvector + vector) | Si (sparse+dense) | Si (payload filters) | Si (BM25+vector) | No |
| **Filtering** | SQL nativo | Metadata filters | Pre-filter (superior) | GraphQL filters | Metadata |
| **Integracion con nuestro stack** | Ya integrado | Nueva dependencia | Nueva dependencia | Nueva dependencia | Nueva dependencia |

#### 3.2 Veredicto: pgvector con HNSW

**Recomendacion firme: quedarnos con pgvector.** Razones:
1. **Ya lo tenemos funcionando** — zero migration cost
2. **ACID transactional** — critico para multi-tenant (un tenant no ve datos de otro)
3. **Hybrid search nativo** — combinar `tsvector` (BM25) + `vector` (embeddings) en una sola query SQL
4. **Escala suficiente** — pgvectorscale reporta 471 QPS con 50M vectores; nuestro caso sera ordenes de magnitud menor
5. **Single database** — no agregar un segundo sistema de datos a mantener, monitorear, respaldar

**Accion inmediata:** Crear indice HNSW en la tabla `memories`:
```sql
CREATE INDEX idx_memories_embedding_hnsw ON memories
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 200);
```
HNSW es el default recomendado para 2025-2026: no requiere datos previos para construirse, soporta inserciones incrementales, y es 1.5x mas rapido que IVFFlat con recall equivalente.

**Cuando reconsiderar:** Si el volumen supera 10M vectores o si necesitamos latencia sub-5ms, evaluaria Qdrant self-hosted (su pre-filtering es superior para filtros complejos).

---

### 4. Estrategias de Chunking para Entrevistas Transcritas

Este es uno de los problemas mas criticos y especificos de nuestro caso. Las entrevistas organizacionales no son documentos convencionales.

#### 4.1 Caracteristicas de las Entrevistas

- **Multi-hablante**: Entrevistador + 1-N entrevistados
- **Flujo no lineal**: Los temas se entremezclan, se vuelve atras, se hacen tangentes
- **Informacion implicita**: Mucho conocimiento tacito, referencias cruzadas ("como te decia antes...")
- **Densidad variable**: Algunos segmentos son puro relleno, otros son oro puro
- **Identificacion de roles**: Lo que dice el Director de Operaciones vs el Analista Junior tiene peso distinto

#### 4.2 Estrategia Recomendada: Chunking Multi-Capa

**Capa 1 — Segmentacion por Hablante (Speaker-Turn Chunks)**
- Cada turno de hablante es la unidad atomica minima
- Metadata: `speaker_id`, `speaker_role`, `timestamp_start`, `timestamp_end`
- Ventaja: Preserva la atribucion ("esto lo dijo el Gerente de TI")

**Capa 2 — Agrupacion Semantica (Semantic Clustering)**
- Agrupar turnos consecutivos que tratan el mismo tema
- Usar similitud de embeddings entre turnos adyacentes: si la similitud cae debajo de un umbral (0.7), crear un nuevo chunk
- Cada chunk semantico contiene 3-8 turnos de hablante
- Metadata adicional: `topic_summary` (generado por LLM), `entities_mentioned`

**Capa 3 — Contextual Retrieval (tecnica de Anthropic)**
- Para cada chunk semantico, prepend un parrafo de contexto generado por LLM:
  "Este segmento proviene de una entrevista con [Nombre], [Cargo], realizada el [Fecha], dentro del proyecto [Proyecto]. El tema general de la entrevista hasta este punto es [resumen]. En este segmento se discute [topic]."
- Esto reduce el retrieval failure rate en 49% segun Anthropic

**Capa 4 — Parent-Document Retrieval**
- Almacenar la entrevista completa como "documento padre"
- Los chunks semanticos son "hijos" que apuntan al padre
- Al recuperar un chunk, poder expandir al contexto padre si el LLM lo necesita

#### 4.3 Tamano Optimo de Chunks

Para entrevistas, recomiendo chunks de 500-1000 tokens (aprox. 3-8 turnos de hablante agrupados tematicamente). Ni tan pequenos que pierdan contexto, ni tan grandes que diluyan la relevancia.

Los chunks atomicos (memorias individuales como las tenemos ahora) siguen siendo utiles para hechos extraidos y catalogados. La diferencia es que ahora ADEMAS indexaremos el texto crudo de la entrevista con chunking multi-capa.

---

### 5. Modelos de Embedding

#### 5.1 Analisis de Opciones

| Modelo | MTEB Score | Dimensiones | Context Window | Costo (1M docs) | Multilingual |
|---|---|---|---|---|---|
| **text-embedding-3-small** (actual) | 62.3% | 1536 | 8,191 tokens | $200 | Limitado |
| **text-embedding-3-large** | 64.6% | 3072 (o recortable) | 8,191 tokens | $1,300 | Mejor |
| **Cohere embed-v4** | 65.2% | 1024 | 128,000 tokens | ~$400 | 100+ idiomas |
| **BGE-M3** (open source) | 63.0% | 1024 | 8,192 tokens | $5-20 (self-hosted) | 1000+ idiomas |
| **Voyage-3-large** | ~64% | 1024 | 32,000 tokens | ~$600 | Bueno |

#### 5.2 Recomendacion: Mantener text-embedding-3-small con Plan de Migracion

**Corto plazo (FASE 1):** Quedarnos con `text-embedding-3-small`
- Ya esta integrado y funcionando
- 62.3% MTEB es aceptable para un MVP
- Costo razonable
- No interrumpir el desarrollo del MVP por una mejora marginal de embeddings

**Mediano plazo (FASE 2-3):** Migrar a Cohere embed-v4 o text-embedding-3-large
- Cohere embed-v4 es el lider actual (65.2% MTEB) con window de 128K tokens
- El window de 128K es revolucionario para entrevistas largas: podrias embedir entrevistas completas
- Excelente soporte multilingual (nuestros usuarios hablan espanol)
- Pero agrega una dependencia externa nueva (Cohere SDK)

**Alternativa si el costo es critico:** BGE-M3 self-hosted
- Open source (MIT license), 63% MTEB
- Soporta dense + sparse + ColBERT en un solo modelo
- Ideal si queremos hybrid search sin BM25 separado
- Requiere GPU para servir (~$30-50/mes en una T4)

**IMPORTANTE:** Cualquier cambio de modelo de embedding requiere re-embedir TODOS los vectores existentes. Disenar la tabla para almacenar `embedding_model` como metadata desde el inicio.

---

### 6. Estrategias de Retrieval

#### 6.1 Pipeline de Retrieval Recomendado (3 etapas)

```
Query del usuario
    |
    v
[Etapa 1: Query Expansion]
    - Multi-query: LLM genera 3-4 variantes de la query
    - Ej: "Como funciona el proceso de compras?"
      -> "proceso de adquisiciones", "workflow de procurement", "pasos para comprar materiales"
    |
    v
[Etapa 2: Hybrid Retrieval]
    - BM25 (tsvector de PostgreSQL): top-30 por keywords
    - Vector search (pgvector cosine): top-30 por semantica
    - Reciprocal Rank Fusion: combinar en top-20
    |
    v
[Etapa 3: Re-ranking]
    - Cross-encoder re-ranker (Cohere Rerank o modelo local)
    - Re-ordenar top-20 -> seleccionar top-5
    - Pasar top-5 como contexto al LLM
```

#### 6.2 Justificacion de Cada Etapa

**Multi-query retrieval:** Las preguntas sobre organizaciones usan vocabulario variado. "Proceso de compras" puede estar descrito como "procurement", "adquisiciones", "gestion de proveedores" en distintas entrevistas. Generar variantes aumenta recall significativamente.

**Hybrid search (BM25 + vector):** Evidencia consistente de mejora del 48% en calidad de retrieval (Pinecone benchmark). BM25 captura terminos exactos que los embeddings pueden perder (nombres de sistemas, codigos, acronimos organizacionales). Vector search captura sinonimos y parafraseos.

**Re-ranking:** Un cross-encoder re-ranker es el single biggest precision gain segun multiples benchmarks. La diferencia es que el cross-encoder procesa query+documento JUNTOS (atencion cruzada), mientras que bi-encoders los procesan por separado. Solo vale la pena sobre un set ya filtrado (top-20), no sobre toda la base.

#### 6.3 Implementacion Pragmatica en PostgreSQL

La hybrid search se puede implementar en una sola query SQL:
```sql
-- Pseudo-SQL para hybrid search con RRF
WITH vector_results AS (
  SELECT id, content, ROW_NUMBER() OVER (ORDER BY embedding <=> query_vector) as vrank
  FROM chunks WHERE tenant_id = ? AND embedding IS NOT NULL
  LIMIT 30
),
bm25_results AS (
  SELECT id, content, ROW_NUMBER() OVER (ORDER BY ts_rank(tsv, plainto_tsquery(?)) DESC) as brank
  FROM chunks WHERE tenant_id = ? AND tsv @@ plainto_tsquery(?)
  LIMIT 30
),
fused AS (
  SELECT COALESCE(v.id, b.id) as id, COALESCE(v.content, b.content) as content,
    COALESCE(1.0/(60+v.vrank), 0) + COALESCE(1.0/(60+b.brank), 0) as rrf_score
  FROM vector_results v FULL OUTER JOIN bm25_results b ON v.id = b.id
)
SELECT * FROM fused ORDER BY rrf_score DESC LIMIT 20;
```

Esto NO requiere Elasticsearch, Meilisearch, ni ningun sistema externo. PostgreSQL tiene `tsvector` + `ts_rank` para BM25-like search nativo.

---

### 7. Knowledge Graphs + RAG (GraphRAG)

#### 7.1 Por Que un Knowledge Graph es NECESARIO para Este Caso

Las organizaciones son inherentemente grafos:
- **Personas** -> tienen -> **Roles** -> pertenecen a -> **Areas/Departamentos**
- **Procesos** -> usan -> **Sistemas** -> dependen de -> **Otros Sistemas**
- **Problemas** -> afectan a -> **Procesos** -> son ejecutados por -> **Roles**
- **Areas** -> interactuan con -> **Areas** (dependencias laterales)

Un vector search plano NO puede responder preguntas como:
- "Cuales son todos los procesos que dependen del sistema ERP?"
- "Que areas se ven afectadas si cambiamos el proceso de facturacion?"
- "Quien es responsable de los procesos que presentan mas problemas?"

Estas requieren **traversal de relaciones**, no similitud semantica.

#### 7.2 Recomendacion: Knowledge Graph en PostgreSQL (NO Neo4j)

**Opcion A (recomendada): Tablas relacionales con modelo de grafo**

```
OrgEntity(id, type, name, description, tenant_id, metadata_json, embedding)
  type: PERSON | ROLE | DEPARTMENT | PROCESS | SYSTEM | PROBLEM | DEPENDENCY | KPI

OrgRelationship(id, source_entity_id, target_entity_id, type, weight, evidence_chunk_id, tenant_id)
  type: REPORTS_TO | BELONGS_TO | USES | DEPENDS_ON | AFFECTS | RESPONSIBLE_FOR | INTERACTS_WITH
```

Ventajas:
- Misma base de datos, mismas migraciones, mismo Prisma
- ACID transactional, multi-tenant nativo
- Los embeddings de entidades permiten busqueda semantica SOBRE el grafo
- Para grafos < 50,000 nodos (lo normal para una organizacion), PostgreSQL + recursive CTEs funcionan perfectamente
- `evidence_chunk_id` vincula cada relacion al chunk de entrevista que la sustenta (trazabilidad)

**Opcion B (alternativa): Apache AGE**
- Extension de PostgreSQL que agrega Cypher (lenguaje de Neo4j)
- Permite queries de grafo nativas SIN salir de PostgreSQL
- Mas ergonomico para traversals complejos
- Desventaja: menor madurez del ecosistema, potenciales conflictos con Prisma

**Opcion C (descartada para MVP): Neo4j separado**
- Agrega un segundo sistema de datos a mantener
- Requiere sincronizacion de datos entre PG y Neo4j
- Overkill para organizaciones de < 50,000 entidades
- Solo vale la pena si se requiere traversal de grafos masivos (millones de nodos)

#### 7.3 Microsoft GraphRAG: Adaptacion para Nuestro Caso

El GraphRAG original de Microsoft tiene un costo de indexacion prohibitivo (~$33K para datasets grandes). Sin embargo, conceptos clave son adaptables:

- **Entity extraction from chunks:** Usar el LLM para extraer entidades y relaciones de cada chunk de entrevista -> poblar nuestro OrgEntity/OrgRelationship
- **Community detection:** Agrupar entidades fuertemente conectadas (ej: un departamento con sus roles, procesos y sistemas) -> generar resumenes por comunidad
- **LazyGraphRAG (Microsoft, junio 2025):** Diferir la summarization a query-time (reduce costo de indexacion 99%) -> solo resumir las comunidades relevantes cuando se consultan

**Recomendacion pragmatica:** No usar Microsoft GraphRAG como framework (demasiado pesado). Tomar las ideas (entity extraction + community summaries + graph traversal) e implementarlas directamente sobre nuestras tablas PostgreSQL.

---

### 8. RAG vs Fine-tuning vs Prompt Engineering

#### 8.1 Aplicacion a Nuestro Caso Especifico

| Tecnica | Uso en nuestro caso | Justificacion |
|---|---|---|
| **Prompt Engineering** | Extraccion de entidades, generacion de diagnosticos, formateo de outputs | El LLM ya es bueno en esto; solo necesita instrucciones claras. Ya lo hacemos con el system prompt extenso de Zeru. |
| **RAG** | Consultas sobre conocimiento organizacional, buscar en entrevistas, contextualizar respuestas | CORE de la solucion. La informacion organizacional es dinamica, especifica por tenant, y demasiado grande para un prompt. |
| **Fine-tuning** | NO recomendado para MVP | Los modelos foundation ya entienden organizaciones. Fine-tuning es caro ($$$), lento (dias), y fragil (cada actualizacion del modelo base lo invalida). |

#### 8.2 Analisis Detallado

**Prompt Engineering (usar para):**
- Templates de extraccion de entidades de entrevistas
- Instrucciones de formato para diagnosticos
- Few-shot examples para clasificacion de problemas
- System prompts para el agente de inteligencia organizacional
- Costo: ~$0 (solo tokens de contexto)

**RAG (usar para):**
- Recuperar fragmentos relevantes de entrevistas pasadas
- Contextualizar respuestas con evidencia ("segun la entrevista con [X], ...")
- Buscar relaciones entre entidades en el knowledge graph
- Responder preguntas sobre la organizacion con datos reales
- Costo: embedding + retrieval (bajo) + contexto adicional en prompts (medio)

**Fine-tuning (NO usar porque):**
- Los datos organizacionales son per-tenant; no podemos mezclarlos para fine-tuning
- El volumen de datos por tenant es insuficiente para un fine-tuning efectivo
- OpenAI GPT-5.4 ya comprende estructuras organizacionales, procesos, y relaciones
- Cada actualizacion del modelo base invalida el fine-tuning
- El costo es 6x el inference normal
- **Excepcion futura:** Si necesitamos un modelo especializado en terminologia de industrias especificas (mineria, banca, salud), considerar fine-tuning SOLO para el embedding model (no el LLM generativo)

---

### 9. Evaluacion del RAG: Framework RAGAS

#### 9.1 Metricas Criticas para Nuestro Caso

| Metrica | Que mide | Por que importa para nosotros |
|---|---|---|
| **Faithfulness** | El LLM genera solo lo que esta en los chunks recuperados? | CRITICO. Un diagnostico organizacional inventado seria desastroso. |
| **Context Recall** | Se recuperaron todos los chunks relevantes? | Si el RAG omite una entrevista clave, el diagnostico sera incompleto. |
| **Context Precision** | Los chunks recuperados son realmente relevantes? | Chunks irrelevantes diluyen la atencion del LLM y desperdician tokens. |
| **Answer Relevancy** | La respuesta aborda la pregunta original? | El usuario pregunta "que problemas tiene el area de logistica?" y debe recibir exactamente eso. |

#### 9.2 Plan de Evaluacion

**Fase 1 — Golden Dataset Manual:**
- Crear 50-100 pares (pregunta, respuesta esperada, chunks relevantes) a partir de entrevistas de prueba
- Evaluar el pipeline RAG contra este dataset
- Objetivo minimo: Faithfulness > 0.85, Context Recall > 0.80

**Fase 2 — Evaluacion Automatizada con RAGAS:**
- Integrar RAGAS (Python SDK) como paso de CI/CD
- Cada cambio en el pipeline de chunking/retrieval se evalua automaticamente
- Dashboard de metricas en el tiempo

**Fase 3 — LLM-as-Judge + Feedback Humano:**
- El LLM evalua sus propias respuestas (panel de 3 evaluaciones independientes)
- Los consultores califican las respuestas del sistema (pulgar arriba/abajo)
- Feedback loop para mejorar prompts y retrieval

---

### 10. Modelo de Datos Propuesto para Knowledge Base Organizacional

Basado en todo el analisis anterior, el esquema central seria:

```
// Proyecto de diagnostico organizacional
OrgProject {
  id, name, description, status, tenantId
  startDate, endDate
}

// Entrevista dentro de un proyecto
Interview {
  id, projectId, tenantId
  audioS3Key, transcriptionText, transcriptionStatus
  interviewDate, duration
  speakers: InterviewSpeaker[]
}

// Hablante identificado en una entrevista
InterviewSpeaker {
  id, interviewId, speakerLabel, personEntityId?
  role, department
}

// Chunk semantico de una entrevista
InterviewChunk {
  id, interviewId, tenantId
  content, contextPrefix  // contextual retrieval
  speakerId, startTime, endTime
  topicSummary
  embedding vector(1536)
  tsv tsvector  // para BM25
  parentChunkId?  // para parent-document retrieval
}

// Entidad organizacional (nodo del knowledge graph)
OrgEntity {
  id, tenantId, projectId
  type: PERSON | ROLE | DEPARTMENT | PROCESS | SYSTEM | PROBLEM | KPI | RESOURCE
  name, description
  attributes: JSON
  embedding vector(1536)
  sourceChunkIds: string[]  // trazabilidad
}

// Relacion entre entidades (arista del knowledge graph)
OrgRelationship {
  id, tenantId
  sourceEntityId, targetEntityId
  type: REPORTS_TO | BELONGS_TO | EXECUTES | USES | DEPENDS_ON | PRODUCES | CONSUMES | AFFECTS | BLOCKS
  weight: float  // confianza de la relacion
  description
  sourceChunkId  // evidencia
}
```

---

### 11. Riesgos y Debilidades de Este Enfoque

Debo ser honesto sobre las limitaciones:

1. **Complejidad incremental:** Cada capa (hybrid search, knowledge graph, contextual retrieval, re-ranking) agrega complejidad. Riesgo de over-engineering antes de validar el caso de uso.

2. **Calidad del chunking depende de la calidad de la transcripcion:** Si la transcripcion tiene errores (speaker diarization imprecisa, words mal reconocidas), los chunks heredan esos errores. Basura entra, basura sale.

3. **Entity extraction no es perfecta:** El LLM puede extraer entidades incorrectas o perder relaciones sutiles. Se necesita revision humana, al menos inicialmente.

4. **pgvector NO es el mas rapido:** Para consultas de alta concurrencia (>1000 QPS), un vector DB dedicado seria superior. Pero nuestro caso (equipos de consultoria, no millones de usuarios) no requiere esa escala.

5. **Costo de embeddings crece con el volumen:** Cada entrevista transcrita genera muchos chunks, cada chunk requiere un embedding. Con text-embedding-3-small a $0.02/1M tokens, 100 entrevistas de 30 min generarian ~$2-5 en embeddings. Manejable, pero escala linealmente.

6. **GraphRAG sin community detection pierde poder:** Las community summaries son lo que permite responder preguntas "globales" ("cual es el mayor problema de la organizacion?"). Sin ellas, el graph es solo un indice de relaciones. Implementar community detection (Leiden algorithm) en PostgreSQL no es trivial.

7. **Lock-in a OpenAI:** Todo el pipeline usa OpenAI (embeddings + generation). Si OpenAI cambia precios o API, tenemos un single point of failure. Mitigacion: abstraer el provider de embeddings y tener BGE-M3 como fallback.

---

### 12. Respuesta al Investigador 3 (Process Mining & Modelado)

Estoy de acuerdo con la gran mayoria de las propuestas del Investigador 3. Mis comentarios criticos:

**Puntos de CONSENSO fuerte:**
- PostgreSQL relacional con Prisma para el knowledge graph (NO Neo4j). Coincidimos completamente. La justificacion de volumen (50-500 personas, 20-100 procesos) es exacta.
- Apache AGE como extension para queries de grafo avanzadas. Correcto como complemento, no como reemplazo.
- Ontologia simplificada inspirada en ArchiMate. Las 9 entidades y 11 relaciones tipadas cubren lo necesario.
- JSON intermedio para representacion de procesos (NO BPMN-XML directo). El dato del paper sobre reduccion de 43% en latencia y 75% en tokens es contundente.
- SCD Type 2 para versionado temporal. Esencial para consultas point-in-time.

**Puntos donde REFINO o COMPLEMENTO:**

1. **Sobre la tabla OrgEntity y embeddings:** El Investigador 3 pregunta que embeddir para las entidades. Mi recomendacion: embedir `name + description + JSON.stringify(metadata)`. Solo el nombre es demasiado corto para un embedding util. La descripcion y metadata dan contexto semantico. Pero NO embedir atributos numericos (duracion, frecuencia) — esos se buscan con SQL clasico, no con similitud vectorial.

2. **Sobre la duplicacion de datos entre RAG y Knowledge Graph:** Concuerdo con el Investigador 3 en que NO debemos duplicar. Las transcripciones viven como InterviewChunks (con embeddings para RAG). Las entidades extraidas viven como OrgEntity/OrgRelation (con referencias a los chunks de origen via `sourceChunkId`). El query router decide si ir al RAG (preguntas abiertas, "que se dijo sobre...") o al grafo (preguntas estructurales, "que procesos dependen de...") o ambos.

3. **Sobre Apache AGE vs CTEs recursivos:** El Investigador 3 dice que CTEs recursivos funcionan hasta 5-6 niveles. Estoy de acuerdo para queries predefinidas. Pero para queries *ad-hoc* del consultor ("muestrame todas las dependencias transitivas del sistema SAP"), Cypher es dramaticamente mas ergonomico que construir CTEs dinamicos. Recomiendo AGE como herramienta de consulta avanzada, no como storage.

4. **Sobre la deteccion de contradicciones con NLI:** El Investigador 3 propone DeBERTa + comparacion estructural + LLM. Considero que para el MVP, el LLM solo (con prompt engineering adecuado) puede detectar contradicciones sin necesidad de un modelo NLI separado. GPT-5.4 ya maneja NLI de forma nativa. Agregar DeBERTa es una optimizacion para FASE 3 si la precision del LLM resulta insuficiente. No vale la pena la complejidad inicial de servir un modelo adicional.

5. **Sobre RICE con scoring LLM:** Me parece solido, pero agrego que el scoring del LLM debe incluir las metricas de grafo como INPUTS explicitos (betweenness centrality del nodo afectado, numero de dependencias, etc.), no dejar que el LLM las "adivine". Los datos cuantitativos del grafo deben ser parte del prompt del scoring, no implicitos.

**Punto de DESACUERDO menor:**

La propuesta de Cytoscape.js para el grafo organizacional interactivo me parece acertada tecnicamente, pero debemos considerar que nuestro frontend es Next.js con un stack React relativamente convencional. Cytoscape.js tiene integracion React via `react-cytoscapejs`, pero la experiencia de desarrollo es inferior a React Flow. Sugiero evaluar ambos en un spike tecnico antes de comprometerse. Para el MVP, Mermaid.js embebido en el chat (como ya hacemos para contabilidad) podria ser suficiente.

---

### 13. Mensajes para los Otros Investigadores

#### Para Investigador 2 (NLP, Transcripcion & Extraccion):

La calidad del RAG depende directamente de la calidad de tu output. Necesito que tu pipeline produzca:

1. **Transcripcion con speaker diarization**: Cada segmento marcado con speaker_id, timestamp_start, timestamp_end. Sin esto, mi chunking multi-capa por hablante no funciona.

2. **Metadata de hablantes**: Al menos nombre y rol/cargo. Esto va directamente a InterviewSpeaker y es critico para el filtrado del RAG ("buscar solo lo que dijo la gerencia").

3. **Segmentos semanticos sugeridos**: Si tu pipeline de transcripcion puede detectar cambios de tema (por silences, cambios de tono, o transiciones textuales), eso mejora enormemente mi chunking semantico.

4. **Calidad de texto**: Los errores de transcripcion (homonyms, proper nouns mal escritos, acronimos no reconocidos) degradan tanto los embeddings como el BM25. Si podemos tener un paso de post-correccion (spell-check domain-specific, normalizacion de acronimos), el impacto en el RAG es significativo.

**Punto critico sobre la extraccion de entidades:** Concuerdo con el Investigador 3 en que necesito entidades tipadas y relaciones tipadas. Pero desde mi perspectiva de RAG, necesito ademas que cada entidad extraida mantenga la REFERENCIA EXACTA al chunk de origen (chunk_id + offset). Esto es lo que permite al RAG citar evidencia: "Segun [Nombre], [Cargo], en la entrevista del [fecha]: '[cita textual]'". Sin trazabilidad chunk -> entidad, perdemos la capacidad de fundamentar las respuestas.

#### Para Investigador 3 (Process Mining & Modelado):

Te envio mi analisis detallado arriba en la seccion 12. Los puntos clave:
- FUERTE CONSENSO en PostgreSQL + Prisma + pgvector como stack unificado
- FUERTE CONSENSO en ontologia simplificada (ArchiMate lite)
- REFINAMIENTO propuesto para embedding de entidades (name + description + metadata)
- CUESTION para debate: NLI separado (DeBERTa) vs LLM nativo para deteccion de contradicciones en el MVP
- CUESTION para debate: Cytoscape.js vs React Flow vs Mermaid para el MVP

---

### 14. Resumen Ejecutivo de Recomendaciones

| Componente | Recomendacion | Confianza |
|---|---|---|
| Vector DB | pgvector (ya lo tenemos) + indice HNSW | ALTA |
| Embedding Model | text-embedding-3-small ahora, migrar a Cohere embed-v4 o text-embedding-3-large despues | ALTA |
| Chunking | Multi-capa: speaker-turn -> semantic clustering -> contextual prepend -> parent-doc | ALTA |
| Retrieval | Hybrid (BM25 tsvector + vector) con RRF, luego re-ranking | ALTA |
| Knowledge Graph | Tablas relacionales en PostgreSQL (OrgEntity + OrgRelationship) | MEDIA-ALTA |
| Arquitectura RAG | Advanced RAG -> Modular RAG -> Agentic RAG (evolutivo) | ALTA |
| Fine-tuning | No para MVP. Posiblemente para embedding model en el futuro | ALTA |
| Evaluacion | RAGAS (faithfulness, context recall, precision, relevancy) | ALTA |
| GraphRAG completo (Microsoft) | No como framework. Si tomar ideas (entity extraction, community summaries) | MEDIA |

**Principio rector:** EMPEZAR SIMPLE, ITERAR RAPIDO. No construir el sistema perfecto de una vez. Cada fase debe entregar valor antes de avanzar a la siguiente.

### 15. Fuentes y Referencias

- [RAG Design Patterns 2026 Guide](https://www.exploredatabase.com/2026/03/rag-design-patterns-explained-2026.html)
- [10 RAG Architectures in 2026](https://www.techment.com/blogs/rag-architectures-enterprise-use-cases-2026/)
- [Modular RAG: LEGO-like Reconfigurable Frameworks (arXiv)](https://arxiv.org/html/2407.21059v1)
- [The Ultimate RAG Blueprint 2025-2026](https://langwatch.ai/blog/the-ultimate-rag-blueprint-everything-you-need-to-know-about-rag-in-2025-2026)
- [pgvector vs Qdrant Comparison](https://www.tigerdata.com/blog/pgvector-vs-qdrant)
- [Vector Database Comparison 2026](https://4xxi.com/articles/vector-database-comparison/)
- [Best Vector Databases 2026 (Firecrawl)](https://www.firecrawl.dev/blog/best-vector-databases)
- [pgvector HNSW vs IVFFlat (AWS)](https://aws.amazon.com/blogs/database/optimize-generative-ai-applications-with-pgvector-indexing-a-deep-dive-into-ivfflat-and-hnsw-techniques/)
- [Building Production RAG with pgvector](https://markaicode.com/pgvector-rag-production/)
- [Document Chunking for RAG: 9 Strategies](https://langcopilot.com/posts/2025-10-11-document-chunking-for-rag-practical-guide)
- [Effective Chunking Strategies (Cohere)](https://docs.cohere.com/page/chunking-strategies)
- [Contextual Retrieval (Anthropic)](https://www.anthropic.com/news/contextual-retrieval)
- [Best Embedding Models 2026 (Openxcell)](https://www.openxcell.com/blog/best-embedding-models/)
- [Embedding Models Comparison 2026](https://reintech.io/blog/embedding-models-comparison-2026-openai-cohere-voyage-bge)
- [Embedding Benchmark 2026](https://zc277584121.github.io/rag/2026/03/20/embedding-models-benchmark-2026.html)
- [Hybrid Search RAG (Meilisearch)](https://www.meilisearch.com/blog/hybrid-search-rag)
- [Optimizing RAG with Hybrid Search & Reranking](https://superlinked.com/vectorhub/articles/optimizing-rag-with-hybrid-search-reranking)
- [Best Reranking Models 2026 (ZeroEntropy)](https://www.zeroentropy.dev/articles/ultimate-guide-to-choosing-the-best-reranking-model-in-2025)
- [GraphRAG Complete Guide 2026 (Calmops)](https://calmops.com/ai/graphrag-complete-guide-2026/)
- [Microsoft GraphRAG GitHub](https://github.com/microsoft/graphrag)
- [GraphRAG 2026 Practitioner's Guide](https://medium.com/graph-praxis/graph-rag-in-2026-a-practitioners-guide-to-what-actually-works-dca4962e7517)
- [Parent Document Retrieval for RAG](https://dzone.com/articles/parent-document-retrieval-useful-technique-in-rag)
- [Multi-Query Retriever RAG](https://dev.to/sreeni5018/multi-query-retriever-rag-how-to-dramatically-improve-your-ais-document-retrieval-accuracy-5892)
- [RAGAS: Automated RAG Evaluation (arXiv)](https://arxiv.org/abs/2309.15217)
- [RAGAS Available Metrics](https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/)
- [RAG vs Fine-tuning vs Prompt Engineering (IBM)](https://www.ibm.com/think/topics/rag-vs-fine-tuning-vs-prompt-engineering)
- [Apache AGE vs Neo4j](https://dev.to/pawnsapprentice/apache-age-vs-neo4j-battle-of-the-graph-databases-2m4)
- [Building Knowledge Graph with PostgreSQL](https://dev.to/micelclaw/4o-building-a-personal-knowledge-graph-with-just-postgresql-no-neo4j-needed-22b2)

## Hipotesis 2: NLP, Transcripcion & Extraccion Estructurada (Investigador 2)

### 1. Speech-to-Text con Speaker Diarization

#### Evaluacion comparativa de proveedores

| Criterio | OpenAI gpt-4o-transcribe-diarize | Deepgram Nova-3 | AssemblyAI Universal-2 | Whisper local + PyAnnote |
|----------|----------------------------------|-----------------|------------------------|--------------------------|
| Diarizacion nativa | SI (diarized_json) | SI (diarize=true, gratis) | SI ($0.02/hr extra) | SI (via WhisperX/PyAnnote) |
| Accuracy en espanol | ~92% (multilingue) | ~90% (54.7% mejora relativa en es) | ~89% (multilingue) | ~90% (Whisper large-v3) |
| Precio por minuto | $0.006/min | $0.0043/min (batch) / $0.0077/min (stream) | $0.27/hr = $0.0045/min (99 idiomas) | Gratis (pero costo GPU) |
| Costo entrevista 75 min | $0.45 | $0.32 (batch) | $0.34 | $0 (+ infra GPU) |
| Latencia | Segundos (API) | Segundos (API) | Segundos (API) | Minutos (local, depende GPU) |
| Max archivo | 25 MB | Sin limite practico | Sin limite practico | Sin limite (local) |
| Speaker reference clips | SI (hasta 4 speakers, 2-10s clips) | NO | NO | NO nativo |
| Confidence por speaker | NO | SI (speaker_confidence por palabra) | SI | Parcial |
| Integracion con stack | SDK openai ya en uso | SDK @deepgram/sdk | SDK assemblyai | Requiere Python sidecar |
| Chunking requerido | SI (chunking_strategy="auto", max 1400s por chunk) | NO (maneja archivos largos nativamente) | NO (maneja archivos largos nativamente) | Manual |

#### Problema critico: Speaker identity cross-chunk

El mayor defecto de OpenAI gpt-4o-transcribe-diarize es que la diarizacion es **intra-chunk solamente**. Para archivos >25 MB (o >1400 segundos), el audio debe dividirse en chunks, y los labels de speaker (A, B, C...) se **reinician en cada chunk** sin relacion entre ellos. El Speaker A del chunk 1 puede ser el Speaker B del chunk 2.

**Workarounds documentados:**
1. **known_speaker_references**: Extraer segmentos de audio del primer chunk (2-10s por speaker) y pasarlos como referencia en chunks subsecuentes. No hay implementacion publica confirmada como funcional (OpenAI community, feb 2026).
2. **Overlapping chunks**: Agregar overlap entre chunks y hacer matching de speakers en la zona de superposicion. Fragil y no documentado oficialmente.

**Deepgram no tiene este problema**: Procesa archivos largos nativamente sin chunking manual y con diarizacion consistente a traves de todo el audio.

#### RECOMENDACION: Estrategia dual

**Opcion principal: Deepgram Nova-3**
- Razon: Diarizacion nativa sin chunking manual, gratis como feature, speaker_confidence por palabra, Node.js SDK oficial, maneja archivos largos sin fragmentacion.
- Costo: El mas barato en batch ($0.0043/min = $0.32 por entrevista de 75 min).
- Limitacion: Menos accuracy que OpenAI en espanol para vocabulario tecnico.

**Fallback/complemento: OpenAI gpt-4o-transcribe-diarize**
- Razon: Ya tenemos el SDK de OpenAI integrado, integracion directa con el pipeline de extraccion posterior (todo OpenAI).
- Para audios <25 MB (~23 minutos a 128kbps MP3): funciona perfecto, un solo chunk, sin problemas cross-speaker.
- Para entrevistas largas: pre-dividir el audio en segmentos de ~20 minutos con overlap de 30 segundos.

**Descartamos Whisper local + PyAnnote** porque:
1. Requiere Python sidecar en un stack 100% Node.js/TypeScript.
2. Necesita GPU para latencia aceptable (costos de infra).
3. Mayor complejidad operacional sin ventaja clara de accuracy.
4. El proyecto ya usa OpenAI API Key de cada tenant -- reutilizar esa infra es mas coherente.

**Descartamos AssemblyAI** porque:
1. No aporta ventaja significativa sobre Deepgram en accuracy para espanol.
2. El speaker diarization cobra extra ($0.02/hr), mientras Deepgram lo incluye gratis.
3. No hay valor diferencial que justifique agregar un tercer proveedor de API.

#### Formato de salida de la transcripcion

Independiente del proveedor elegido, la transcripcion debe normalizarse a un formato interno unificado:

```typescript
interface TranscriptionSegment {
  speaker: string;           // "Speaker_A", "Speaker_B" o nombre si se identifica
  text: string;              // Texto del segmento
  startMs: number;           // Timestamp inicio en milisegundos
  endMs: number;             // Timestamp fin en milisegundos
  confidence: number;        // 0-1, confianza en la transcripcion
  speakerConfidence?: number; // 0-1, confianza en la atribucion del speaker
}

interface TranscriptionResult {
  segments: TranscriptionSegment[];
  fullText: string;           // Texto completo concatenado con marcadores de speaker
  durationMs: number;
  language: string;
  speakerCount: number;
  metadata: {
    provider: 'deepgram' | 'openai';
    model: string;
    processedAt: Date;
  };
}
```

Este formato unificado desacopla el proveedor de STT del pipeline de extraccion posterior.

---

### 2. Extraccion de Entidades Estructuradas

#### El problema fundamental

Una entrevista de 75 minutos con un gerente de operaciones genera ~10,000-15,000 palabras de transcripcion. De ese texto hay que extraer:
- Roles organizacionales (CEO, Jefe de Logistica, Asistente de compras...)
- Procesos de negocio (proceso de compras, proceso de despacho, cierre contable...)
- Actividades especificas dentro de cada proceso
- Sistemas/herramientas (SAP, Excel, WhatsApp, correo...)
- Dependencias entre procesos y areas
- Problemas e ineficiencias mencionados
- Documentos y formularios
- Metricas mencionadas (tiempos, frecuencias, volumenes)

#### OpenAI Structured Outputs: La herramienta central

OpenAI Structured Outputs con `response_format: { type: "json_schema" }` garantiza que la respuesta del modelo se adhiere **exactamente** al JSON Schema provisto. No hay riesgo de campos faltantes, enums invalidos o formato incorrecto. Logra 100% de fiabilidad en adherencia al schema en benchmarks.

**Integracion nativa con Zod (ya en nuestro stack):**

El SDK de OpenAI para JavaScript soporta `zodResponseFormat()` que convierte un schema Zod directamente a JSON Schema compatible con la API. Zeru ya usa Zod (dependency existente en package.json). El patron es:

```typescript
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';

const EntitySchema = z.object({
  roles: z.array(z.object({
    name: z.string().describe("Nombre del cargo/rol"),
    department: z.string().nullable().describe("Area a la que pertenece"),
    responsibilities: z.array(z.string()).describe("Responsabilidades mencionadas"),
    confidence: z.number().min(0).max(1).describe("Confianza: 1.0 si explicitamente dicho, 0.5 si inferido")
  })),
  processes: z.array(z.object({
    name: z.string().describe("Nombre del proceso de negocio"),
    owner: z.string().nullable().describe("Rol responsable del proceso"),
    activities: z.array(z.object({
      name: z.string(),
      executor: z.string().nullable(),
      systems: z.array(z.string()),
      order: z.number()
    })),
    frequency: z.string().nullable().describe("Diario, semanal, mensual, etc."),
    estimatedDuration: z.string().nullable()
  })),
  systems: z.array(z.object({
    name: z.string(),
    type: z.string().nullable().describe("ERP, CRM, hoja de calculo, etc."),
    usedBy: z.array(z.string()).describe("Roles que lo usan"),
    purpose: z.string().nullable()
  })),
  problems: z.array(z.object({
    description: z.string(),
    severity: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]),
    affectedProcesses: z.array(z.string()),
    affectedRoles: z.array(z.string()),
    evidence: z.string().describe("Cita textual de la entrevista"),
    confidence: z.number().min(0).max(1)
  })),
  dependencies: z.array(z.object({
    from: z.string().describe("Proceso o area de origen"),
    to: z.string().describe("Proceso o area destino"),
    type: z.enum(["INFORMATION", "APPROVAL", "MATERIAL", "TRIGGER"]),
    description: z.string().nullable()
  }))
});
```

**Modelos soportados:** gpt-4o, gpt-4o-mini, gpt-4.1, gpt-4.1-mini, gpt-4.1-nano (todos con 1M token context). Todos soportan structured outputs con strict mode.

#### Tecnicas de extraccion: Zero-shot vs Few-shot vs Chain-of-Thought

| Tecnica | Descripcion | Precision | Costo | Cuando usar |
|---------|-------------|-----------|-------|-------------|
| Zero-shot | Solo el schema + instrucciones | Media-Alta | Bajo | Extraccion de primera pasada, entidades claras |
| Few-shot (2-3 ejemplos) | Incluir 2-3 pares ejemplo de input/output | Alta | Medio (tokens extra por ejemplos) | Entidades ambiguas, formatos no obvios |
| Chain-of-Thought extraction | Pedir que razone paso a paso antes de extraer | Muy alta | Alto (mas tokens output) | Relaciones complejas, inferencias |

**Recomendacion:** Usar **few-shot con 2 ejemplos** para la pasada principal. Incluir un ejemplo de entrevista corta con output esperado calibra al modelo sin el overhead de chain-of-thought. Para la pasada de problemas/dependencias (mas subjetiva), usar chain-of-thought.

#### Pasada unica vs Multi-pasada

**Argumento a favor de MULTI-PASADA (recomendado):**

1. **Reduccion de complejidad cognitiva**: Un solo prompt que pida "extrae roles, procesos, actividades, sistemas, problemas, dependencias, metricas y documentos" es demasiado para un modelo. Los benchmarks muestran que la precision cae significativamente cuando se piden >5 tipos de entidad en un solo prompt.

2. **Schemas mas simples y enfocados**: Cada pasada tiene un schema Zod mas pequeno. Schemas mas simples = mayor adherencia y precision.

3. **Depuracion independiente**: Si la extraccion de procesos funciona pero la de problemas no, se puede iterar solo sobre ese paso.

4. **Optimizacion de costos por pasada**: Pasadas de extraccion simple (roles, sistemas) pueden usar gpt-4.1-nano ($0.10/$0.40 por 1M tokens). Pasadas complejas (problemas, dependencias) usan gpt-4.1 ($2/$8).

**Pipeline de extraccion multi-pasada recomendado:**

```
Pasada 1: Entidades basicas (Roles + Departamentos + Sistemas)
  Modelo: gpt-4.1-nano (barato, tarea simple)
  Input: Transcripcion completa
  Output: Lista de roles, departamentos, sistemas mencionados

Pasada 2: Procesos y Actividades
  Modelo: gpt-4.1-mini (complejidad media)
  Input: Transcripcion + output de Pasada 1 (contexto de roles/sistemas ya identificados)
  Output: Procesos con sus actividades ordenadas, linked a roles y sistemas

Pasada 3: Problemas e Ineficiencias
  Modelo: gpt-4.1 (requiere razonamiento)
  Input: Transcripcion + outputs de Pasadas 1-2
  Output: Problemas detectados con severidad, evidencia textual, entidades afectadas

Pasada 4: Dependencias y Relaciones inter-proceso
  Modelo: gpt-4.1 (requiere razonamiento)
  Input: Transcripcion + todos los outputs previos
  Output: Dependencias entre procesos, triggers, flujos de informacion

Pasada 5: Claims facticos y Metricas
  Modelo: gpt-4.1-mini
  Input: Transcripcion
  Output: Claims cuantitativos (duraciones, frecuencias, volumenes) con confianza
```

**Contraargumento del Investigador 3**: Propone que un solo prompt mega-complejo sera fragil. Estoy de acuerdo. El pipeline multi-pasada es mas robusto, depurable y optimizable por costo.

---

### 3. Pipeline de Procesamiento de Entrevistas Largas

#### Contexto: Tamanos tipicos

| Duracion entrevista | Palabras aprox. | Tokens aprox. (OpenAI) | Cabe en contexto? |
|--------------------|-----------------|-----------------------|-------------------|
| 30 minutos | 5,000-7,000 | 7,000-10,000 | SI (cualquier modelo) |
| 60 minutos | 10,000-15,000 | 14,000-21,000 | SI (cualquier modelo) |
| 75 minutos | 12,000-18,000 | 17,000-25,000 | SI (cualquier modelo) |
| 90 minutos | 15,000-22,000 | 21,000-30,000 | SI (cualquier modelo) |

**Conclusion clave: Una entrevista de 75 minutos NO requiere chunking para extraccion LLM.** Los modelos gpt-4.1 y gpt-4o tienen ventanas de contexto de 128K-1M tokens. Una entrevista de 75 min (~20K tokens) es apenas el 2-15% del contexto disponible. Podemos procesar la entrevista completa de una sola vez.

Esto simplifica ENORMEMENTE el pipeline: no hay necesidad de map-reduce, no hay problemas de contexto perdido entre chunks, no hay deduplicacion de entidades entre segmentos.

#### Cuando SI se necesita chunking

1. **Multiples entrevistas procesadas juntas** (ej: 10 entrevistas = ~200K tokens). En este caso, procesar cada entrevista individualmente y luego reconciliar es mejor que intentar meter todo en un contexto.

2. **Entrevistas excepcionalmente largas** (>120 minutos = ~35K tokens). Aun asi caben en contexto, pero la precision de extraccion degrada en textos muy largos por el "lost in the middle" effect. Solucion: dividir por temas/preguntas naturales de la entrevista.

#### Estructura del pipeline completo

```
[Audio MP3/WAV]
    |
    v
[1. Upload a S3 + Registro en DB]
    |
    v
[2. Transcripcion + Diarizacion]
    |  Provider: Deepgram Nova-3 (primario) u OpenAI (fallback)
    |  Output: TranscriptionResult (formato unificado)
    v
[3. Post-procesamiento de transcripcion]
    |  - Limpiar artefactos (um, eh, repeticiones)
    |  - Identificar speakers con nombres si es posible
    |  - Segmentar por preguntas/temas (heuristicamente o con LLM ligero)
    v
[4. Extraccion estructurada multi-pasada]
    |  Pasadas 1-5 como se describe arriba
    |  Cada pasada: prompt + transcripcion + contexto previo -> structured output
    v
[5. Resolucion de correferencias]
    |  Unificar "Juan", "el jefe de logistica", "el" -> Entidad unica
    v
[6. Validacion y scoring de confianza]
    |  Marcar cada entidad/relacion con confidence score
    |  Flaggear items que necesitan revision humana
    v
[7. Ingesta al Knowledge Graph]
    |  Crear/actualizar OrgEntity y OrgRelation en PostgreSQL
    |  Generar embeddings para busqueda semantica
    v
[8. Reconciliacion inter-entrevista]
    |  Detectar duplicados, contradicciones, complementos
    |  Merge con entidades existentes de otras entrevistas
    v
[9. Generacion de resumen y diagnostico]
    |  Resumenes multi-nivel
    |  Diagramas AS-IS preliminares
```

#### Procesamiento asincrono

Todo el pipeline (pasos 2-9) debe ejecutarse de forma asincrona:
- El usuario sube el audio y recibe confirmacion inmediata.
- Un job de background (BullMQ o similar, ya tenemos BackgroundQueueService) procesa cada paso secuencialmente.
- Notificacion al usuario cuando el procesamiento completa.
- Progreso visible en UI (step tracker).

Esto es consistente con el patron que ya usa Zeru para embeddings en el BackgroundQueueService.

---

### 4. Resolucion de Correferencias y Entity Linking

#### El problema en entrevistas

En una entrevista tipica, el entrevistado se refiere a la misma persona/proceso de multiples formas:

- **Correferencia pronominal**: "Juan se encarga de eso. **El** lo revisa cada dia."
- **Correferencia nominal**: "El jefe de logistica revisa los pedidos. **Juan** dice que toma mucho tiempo."
- **Correferencia parcial**: "El proceso de compras es largo. **Ese proceso** tiene 8 pasos."
- **Sinonimos funcionales**: "El ERP" / "SAP" / "El sistema" -> misma entidad.
- **Variaciones de nombre**: "Pedro Martinez" / "Don Pedro" / "Martinez" -> misma persona.

#### Enfoque recomendado: LLM-based coreference in-context

Los modelos NLI/coreference clasicos (como los de spaCy o Stanford CoreNLP) tienen problemas con espanol coloquial y vocabulario tecnico organizacional. **El enfoque mas efectivo para nuestro caso es usar el propio LLM durante la extraccion.**

**Estrategia en la pasada de extraccion:**

En el prompt de cada pasada de extraccion, incluir instrucciones explicitas:

```
Reglas de resolucion de correferencias:
1. Cuando el entrevistado use pronombres (el, ella, ellos, eso, ese proceso),
   resuelve a que entidad se refiere basandote en el contexto.
2. Si la misma persona es mencionada con diferentes nombres o titulos,
   usa el nombre mas completo como identificador canonico.
3. Si un sistema es referido por nombre comercial Y por termino generico
   ("SAP" y "el ERP"), usa el nombre comercial.
4. Cada entidad extraida debe tener un campo "aliases" con todas las formas
   en que fue mencionada en la entrevista.
```

**Agregar campo aliases al schema de extraccion:**

```typescript
const RoleSchema = z.object({
  canonicalName: z.string().describe("Nombre mas completo: 'Juan Martinez, Jefe de Logistica'"),
  aliases: z.array(z.string()).describe("Todas las formas en que se menciona: ['Juan', 'el jefe', 'Martinez', 'el de logistica']"),
  // ... otros campos
});
```

#### Entity linking inter-entrevista

Cuando multiples entrevistas mencionan las mismas entidades con diferentes nombres:

1. **Matching por embedding similarity**: Embeder el canonicalName + description de cada entidad y comparar con cosine similarity contra entidades existentes en el Knowledge Graph. Threshold sugerido: >0.85 = merge automatico, 0.7-0.85 = sugerir merge al usuario, <0.7 = entidad nueva.

2. **Matching por atributos estructurales**: Si la Entrevista A dice "Jefe de Logistica" y la Entrevista B dice "Gerente de Logistica en el area de supply chain", matching por departamento + tipo de rol.

3. **LLM-assisted deduplication**: En la pasada de reconciliacion, presentar al LLM pares de entidades candidatas a merge con su contexto de origen, y pedirle que determine si son la misma entidad.

**Implementacion practica:**

```
Para cada entidad extraida de la entrevista nueva:
  1. Buscar en el KG existente por similitud de embedding (top 5)
  2. Si hay match > 0.85: merge automatico (actualizar aliases, agregar info nueva)
  3. Si hay match 0.7-0.85: crear "merge suggestion" para revision humana
  4. Si no hay match: crear entidad nueva en el KG
```

---

### 5. Tecnicas de Resumen y Sintesis

#### Tipos de resumen necesarios

| Nivel | Descripcion | Tamano output | Modelo recomendado |
|-------|-------------|---------------|--------------------|
| Por pregunta | Resumen de cada respuesta individual de la entrevista | 2-3 oraciones | gpt-4.1-nano |
| Por tema | Agrupa respuestas relacionadas (ej: "todo sobre logistica") | 1 parrafo | gpt-4.1-mini |
| Por entrevista | Resumen ejecutivo de toda la entrevista | 1 pagina | gpt-4.1-mini |
| Por area | Sintesis de todas las entrevistas sobre un area | 1-2 paginas | gpt-4.1 |
| Ejecutivo | Diagnostico general de toda la organizacion | 2-3 paginas | gpt-4.1 |

#### Estrategia: Stuff chain (no map-reduce)

Dado que una entrevista individual cabe completa en el contexto del LLM (~20K tokens de ~128K-1M disponibles), **NO necesitamos map-reduce para resumenes de una sola entrevista**. Simplemente pasamos la transcripcion completa + instrucciones = "stuff" chain.

Map-reduce SI sera necesario para:
- **Resumen por area** (multiples entrevistas, potencialmente >100K tokens combinados)
- **Resumen ejecutivo** (todas las entrevistas del proyecto)

**Pipeline de resumen por area (map-reduce):**

```
Map:   Para cada entrevista del area, generar resumen de 1 pagina (en paralelo)
Reduce: Tomar todos los resumenes + entidades extraidas -> sintesis final del area
```

**Pipeline de resumen ejecutivo (hierarchical reduce):**

```
Nivel 1: Resumen por entrevista (stuff chain, en paralelo)
Nivel 2: Resumen por area (reduce sobre resumenes de Nivel 1)
Nivel 3: Resumen ejecutivo (reduce sobre resumenes de Nivel 2)
```

#### Refine chain para calidad superior

Para el diagnostico final (el entregable de mas valor), usar **refine chain** en lugar de map-reduce:

```
Paso 1: Generar diagnostico base con los datos del Area 1
Paso 2: Refinar diagnostico incorporando datos del Area 2 (sin perder info del Area 1)
Paso 3: Refinar con Area 3...
...
Paso N: Diagnostico final que ha ido acumulando y refinando informacion de todas las areas
```

La refine chain produce output de mayor coherencia que map-reduce porque mantiene contexto acumulativo. El trade-off es que es secuencial (no paralelizable) y cuesta mas tokens.

---

### 6. Validacion y Calidad

#### Estrategia de confidence scoring

Cada entidad y relacion extraida debe llevar un score de confianza basado en multiples senales:

**Senales de alta confianza (0.8-1.0):**
- El entrevistado lo afirma directamente con certeza: "Siempre hacemos X", "El proceso tiene 5 pasos"
- Corroborado por multiples entrevistas
- Respaldado por documentacion adjunta
- Datos cuantitativos especificos

**Senales de confianza media (0.5-0.8):**
- Mencionado por un solo entrevistado sin hedging
- Inferido de la conversacion pero no dicho explicitamente
- El entrevistado generaliza: "normalmente...", "casi siempre..."

**Senales de baja confianza (0.2-0.5):**
- El entrevistado expresa duda: "creo que...", "no estoy seguro pero..."
- Mencionado de pasada, sin detalle
- Contradicho por otra entrevista

**Senales de muy baja confianza (<0.2):**
- Inferido por el LLM sin base textual directa
- Hipotetico o especulativo

**Implementacion:** Incluir en el prompt de extraccion instrucciones explicitas para asignar confidence, con los criterios anteriores como referencia. El modelo es consistente en aplicar reglas de scoring cuando se le dan criterios claros.

#### Human-in-the-loop: Donde es critico

No todo necesita validacion humana. La clave es focalizar la revision en lo que importa:

1. **Validacion obligatoria (SIEMPRE):**
   - Problemas clasificados como CRITICAL o HIGH
   - Entidades con confidence < 0.5
   - Relaciones de dependencia inter-area
   - Metricas cuantitativas que se usaran en el diagnostico
   - Conflictos entre entrevistas (ya propuesto por Investigador 3)

2. **Validacion por muestreo (10-20%):**
   - Roles y departamentos extraidos (verificar que no se inventaron)
   - Actividades dentro de procesos (verificar orden correcto)
   - Sistemas identificados (verificar que existen)

3. **Sin validacion necesaria:**
   - Entidades de alta confianza corroboradas por multiples fuentes
   - Datos obvios (nombre de la empresa, sector, etc.)

**UI de validacion propuesta:**
- Vista de "review queue" con items ordenados por prioridad (baja confianza primero)
- Para cada item: texto extraido, cita textual de la entrevista (con link al timestamp del audio), score de confianza, boton de aprobar/editar/rechazar
- Feedback loop: las correcciones del usuario se almacenan para mejorar prompts futuros

#### Mejora continua de la extraccion

Los prompts de extraccion no son estaticos. Cada proyecto genera datos de validacion humana que se pueden usar para:
1. Agregar/mejorar few-shot examples basados en correcciones reales
2. Ajustar criterios de confidence scoring
3. Identificar tipos de entidad que el modelo consistentemente falla

Esto NO es fine-tuning del modelo (demasiado costoso y complejo para nuestro volumen). Es mejora iterativa de prompts y schemas.

---

### 7. Modelos de LLM: Seleccion por Tarea y Optimizacion de Costos

#### Modelo de LLM por etapa del pipeline

| Etapa | Modelo recomendado | Precio (input/output por 1M tokens) | Justificacion |
|-------|--------------------|--------------------------------------|---------------|
| Transcripcion (STT) | Deepgram Nova-3 | $0.0043/min | Diarizacion nativa, sin chunking |
| Extraccion Pasada 1 (entidades basicas) | gpt-4.1-nano | $0.10 / $0.40 | Tarea simple, alta velocidad |
| Extraccion Pasada 2 (procesos) | gpt-4.1-mini | $0.40 / $1.60 | Complejidad media |
| Extraccion Pasadas 3-4 (problemas, dependencias) | gpt-4.1 | $2.00 / $8.00 | Requiere razonamiento |
| Extraccion Pasada 5 (claims facticos) | gpt-4.1-mini | $0.40 / $1.60 | Extraccion estructurada, no razonamiento |
| Resumenes por pregunta | gpt-4.1-nano | $0.10 / $0.40 | Tarea simple |
| Resumenes por area y ejecutivo | gpt-4.1 | $2.00 / $8.00 | Sintesis compleja |
| Correferencias/deduplicacion | gpt-4.1-mini | $0.40 / $1.60 | Matching, no generacion compleja |
| Generacion de diagramas | gpt-4.1-mini | $0.40 / $1.60 | Generacion de JSON estructurado |

#### Estimacion de costo por entrevista completa (75 minutos)

```
Transcripcion (Deepgram):          $0.32
Extraccion Pasada 1 (nano):        ~$0.01 (20K in + 2K out)
Extraccion Pasada 2 (mini):        ~$0.02 (22K in + 5K out)
Extraccion Pasada 3 (4.1):         ~$0.12 (25K in + 5K out)
Extraccion Pasada 4 (4.1):         ~$0.12 (28K in + 3K out)
Extraccion Pasada 5 (mini):        ~$0.02 (20K in + 3K out)
Resumenes (nano+mini):             ~$0.03
Correferencias/dedup (mini):       ~$0.01
Embeddings (text-embedding-3-small): ~$0.005
                                    --------
TOTAL por entrevista:              ~$0.65 USD
```

Para un proyecto tipico de 10-15 entrevistas: **$6.50 - $9.75 USD total en APIs de IA.** Extremadamente accesible.

#### Optimizaciones adicionales de costo

1. **OpenAI Batch API**: 50% descuento si las extracciones no son urgentes (procesamiento en hasta 24h). Reduce el costo total a ~$0.40 por entrevista.

2. **Prompt caching**: Con gpt-4.1, los prefijos repetidos (system prompt + few-shot examples) se cachean automaticamente con 75% de descuento. Como todas las pasadas comparten prompts similares, el ahorro es significativo.

3. **Model routing inteligente**: Empezar con gpt-4.1-nano para todo, evaluar calidad, y subir de modelo solo donde sea necesario. Muchas veces nano es suficiente para extraccion con Structured Outputs porque el schema guia la generacion.

#### Por que NO usar Claude para extraccion

Aunque Claude (Anthropic) tiene excelente comprension de texto largo:
1. Zeru ya tiene infraestructura completa para OpenAI (API key por tenant, AiUsageLog, AiProviderConfig).
2. Claude no soporta Structured Outputs con JSON Schema constraint nativo. Usa XML/tool_use que es menos determinista.
3. Agregar un segundo proveedor de LLM duplica la complejidad de config, billing y logging.
4. Para nuestro caso (extraccion estructurada con schema definido), OpenAI Structured Outputs tiene ventaja tecnica clara.

---

### 8. Integracion con el Stack Existente de Zeru

#### Compatibilidad con la arquitectura actual

| Componente existente | Como se reutiliza |
|----------------------|-------------------|
| OpenAI SDK (`openai` v6.23.0) | STT + Structured Outputs + embeddings |
| Zod (v3) | Schemas de extraccion, validacion de responses |
| PrismaService | Almacenar transcripciones, entidades, relaciones |
| AiUsageLog | Trackear tokens/costos de cada pasada de extraccion |
| AiConfigService (API key por tenant) | Reutilizar API key del tenant para todo el pipeline |
| BackgroundQueueService | Procesamiento asincrono del pipeline |
| MemoryService (embeddings + pgvector) | Embeddings para entidades organizacionales |
| S3 (StorageConfig) | Almacenar audio original y transcripciones |
| EncryptionService | Encriptar API keys de proveedores adicionales (Deepgram) |

#### Nuevos componentes necesarios

1. **TranscriptionService**: Orquestar el STT con diarizacion (Deepgram o OpenAI fallback).
2. **ExtractionPipelineService**: Orquestar las N pasadas de extraccion con Structured Outputs.
3. **CoreferenceService**: Resolver correferencias y entity linking.
4. **InterviewProcessingJob**: Job asincrono que ejecuta todo el pipeline end-to-end.
5. **OrgKnowledgeService**: CRUD de OrgEntity/OrgRelation con reconciliacion.
6. **DeepgramConfig (Prisma model)**: API key de Deepgram por tenant (si se usa como proveedor STT).

Todos estos servicios siguen los patrones NestJS ya establecidos en Zeru (Injectable, modulos, etc.).

---

### 9. Trade-offs y Debilidades Honestas

1. **Dependencia total de OpenAI para extraccion**: Si OpenAI cae o cambia precios dramaticamente, todo el pipeline se detiene. Mitigacion: el formato intermedio (TranscriptionResult, schemas Zod) es provider-agnostic. Migrar a Claude o Gemini requiere cambiar el adaptador de API, no la logica de negocio.

2. **Structured Outputs tiene limitaciones de schema**: No soporta $ref recursivo, patternProperties, ni discriminated unions complejas. Los schemas deben ser "flat" o anidados de forma simple. Esto limita la complejidad de lo que se puede extraer en una sola pasada, pero es otra razon a favor del enfoque multi-pasada.

3. **La calidad de la extraccion depende de la calidad de la transcripcion**: Si la diarizacion falla (speakers mezclados), la extraccion atribuira mal las declaraciones. Garbage in, garbage out. Por eso la eleccion de STT es critica.

4. **Coreference resolution con LLM no es perfecta**: En textos largos, el modelo puede perder el hilo de a quien se refiere un pronombre. Los errores se propagan al Knowledge Graph. La validacion humana es el safety net.

5. **El pipeline multi-pasada introduce latencia**: 5 pasadas secuenciales por entrevista = ~2-5 minutos de procesamiento total (dependiendo de latencia del API). No es real-time, pero aceptable para procesamiento batch de entrevistas.

6. **Deepgram como dependencia adicional**: Agregar un segundo proveedor (ademas de OpenAI) implica otra API key por tenant, otro servicio de config, otra integracion. El beneficio (mejor diarizacion) justifica el costo, pero no es trivial.

7. **El enfoque multi-pasada puede producir inconsistencias**: La Pasada 3 podria mencionar un rol que la Pasada 1 no detecto. Se necesita un paso final de reconciliacion intra-extraccion (no solo inter-entrevista).

8. **No hay fine-tuning**: Confiamos 100% en prompt engineering + structured outputs. Para dominios muy especializados (ej: mineria, salud), los prompts genericos podrian necesitar customizacion significativa. Esto es manejable pero requiere esfuerzo por verticalizacion.

---

### 10. Fuentes y Referencias

- [OpenAI Structured Outputs Guide](https://developers.openai.com/api/docs/guides/structured-outputs/)
- [OpenAI Speech-to-Text Guide - Speaker Diarization](https://developers.openai.com/api/docs/guides/speech-to-text/)
- [GPT-4o Transcribe Diarize Model](https://developers.openai.com/api/docs/models/gpt-4o-transcribe-diarize)
- [OpenAI API Pricing](https://developers.openai.com/api/docs/pricing/)
- [Deepgram Speaker Diarization Docs](https://developers.deepgram.com/docs/diarization)
- [Deepgram Nova-3 Introduction](https://deepgram.com/learn/introducing-nova-3-speech-to-text-api)
- [Deepgram Next-Gen Diarization](https://deepgram.com/learn/nextgen-speaker-diarization-and-language-detection-models)
- [Deepgram Pricing](https://deepgram.com/pricing)
- [AssemblyAI Pricing](https://www.assemblyai.com/pricing)
- [AssemblyAI Speaker Diarization](https://www.assemblyai.com/features/speaker-diarization)
- [AssemblyAI 99 Languages](https://www.assemblyai.com/blog/99-languages)
- [Whisper + PyAnnote Diarization (WhisperX)](https://github.com/m-bain/whisperX)
- [OpenAI Community: Cross-Chunk Speaker Identity](https://community.openai.com/t/best-practices-for-maintaining-speaker-identity-across-chunks-with-gpt-4o-transcribe-diarize/1364126)
- [OpenAI Structured Outputs with Zod](https://www.timsanteford.com/posts/openai-structured-outputs-and-zod-and-zod-to-json-schema/)
- [Automating Information Extraction from Semi-Structured Interview Transcripts (ACM 2024)](https://arxiv.org/html/2403.04819v1)
- [Awesome LLM for Information Extraction Papers](https://github.com/quqxui/Awesome-LLM4IE-Papers)
- [LLM x MapReduce: Long-Sequence Processing (ACL 2025)](https://aclanthology.org/2025.acl-long.1341.pdf)
- [Google Cloud: Long Document Summarization Techniques](https://cloud.google.com/blog/products/ai-machine-learning/long-document-summarization-with-workflows-and-gemini-models)
- [NexusSum: Hierarchical LLM Agents for Long-Form Summarization](https://arxiv.org/html/2505.24575v1)
- [CorefInst: LLMs for Multilingual Coreference Resolution](https://arxiv.org/html/2509.17505v1)
- [LlmLink: Dual LLMs for Dynamic Entity Linking](https://aclanthology.org/2025.coling-main.751.pdf)
- [OpenAI Migrate to Responses API](https://developers.openai.com/api/docs/guides/migrate-to-responses/)
- [GPT-4.1 Nano Model](https://developers.openai.com/api/docs/models/gpt-4.1-nano)
- [GPT-5.4 Mini vs GPT-4o Mini Comparison (2026)](https://www.sitepoint.com/gpt-5-4-mini-vs-gpt-4o-mini-comparison-2026/)
- [Parseur: Human-in-the-Loop AI Guide](https://parseur.com/blog/human-in-the-loop-ai)
- [Insight7: Analyze Interview Transcripts with AI](https://insight7.io/how-to-analyze-interview-transcripts-with-ai-tools/)
- [Transcription & Diarization with GPT-4o (Blog)](https://ndurner.github.io/gpt-4o-diarize)
- [Deepgram JS SDK](https://github.com/deepgram/deepgram-js-sdk/)

---

### Mensajes para otros investigadores

#### Para Investigador 1 (RAG & Knowledge Management):

Mis hallazgos tienen implicaciones directas para tu arquitectura RAG:

1. **Las entrevistas transcritas son el corpus ideal para RAG.** El texto completo de cada entrevista (con marcadores de speaker y timestamps) debe indexarse como chunks en tu sistema vectorial. Sugiero chunks de ~1500-2000 tokens con overlap de 200 tokens, segmentados por cambio de pregunta/tema (no por tamano fijo arbitrario).

2. **Metadata critica para los chunks**: Cada chunk debe tener: `interviewId`, `speakerName`, `speakerRole`, `questionTopic`, `timestampStart`, `timestampEnd`, `projectId`, `tenantId`. Esto permite filtrado facetado en la busqueda (ej: "que dijo el jefe de logistica sobre despachos?").

3. **Embeddings duales**: Necesitamos embeddings tanto de los chunks de transcripcion (para busqueda semantica sobre el texto crudo) como de las entidades extraidas (para busqueda sobre el Knowledge Graph). Son complementarios: el RAG de texto responde "que se dijo sobre X?", el RAG de entidades responde "que sabemos estructuradamente sobre X?".

4. **Ya usamos text-embedding-3-small (1536 dims) y pgvector**. Esto funciona perfectamente para ambos tipos de embedding. No necesitamos otro modelo de embedding ni otra DB vectorial.

5. **Concordo con el Investigador 3 en el enfoque GraphRAG**: la consulta ideal combina busqueda vectorial + traversal de grafo. Pero quiero ser claro: el grafo se construye a partir de MIS extracciones, no al reves. El flujo es: Audio -> Transcripcion (yo) -> Chunks para RAG (tu) + Entidades para KG (Investigador 3), NO grafo primero.

**Pregunta para ti:** Para el RAG sobre transcripciones, estas considerando re-ranking? Un modelo de re-ranking (como Cohere Rerank o un cross-encoder) sobre los top-K resultados vectoriales mejoraria significativamente la precision, especialmente cuando las queries son sobre entidades especificas mencionadas coloquialmente.

#### Para Investigador 3 (Process Mining & Modelado):

Revisando tu propuesta en detalle, tengo tanto acuerdos como desacuerdos:

**ACUERDOS:**
1. Tu ontologia simplificada de ArchiMate es perfecta como target de extraccion. Voy a alinear mis schemas de extraccion Zod exactamente con tus OrgEntityType y OrgRelationType. Los 7 tipos de entidad y 11 tipos de relacion que propones son extricables por LLM con Structured Outputs.

2. El formato JSON intermedio para procesos (en vez de BPMN directo) es correcto. Mi pipeline generara JSONs estructurados que tu backend transforma a Mermaid/BPMN/Cytoscape.

3. La necesidad de `sourceInterviewId` y `confidence` en cada entidad/relacion es critica. Mi pipeline los asignara en cada pasada de extraccion.

**DESACUERDOS / MATICES:**

1. **Sobre tu propuesta de pipeline multi-paso vs mi multi-pasada:** Tu dices que necesitamos (1) NER para entidades, (2) Relation Extraction para conexiones, (3) Claim Extraction para hechos. Estoy parcialmente de acuerdo pero con matices importantes. Con OpenAI Structured Outputs, NO necesitamos un paso NER separado. El LLM extrae entidades + relaciones en la misma llamada si el schema lo define. La diferenciacion clave no es por *tipo de tecnica NLP* (NER vs RE vs Claim) sino por *nivel de complejidad cognitiva*: entidades faciles (Pasada 1, modelo barato) vs relaciones complejas (Pasada 4, modelo caro). Es una distincion de costo, no de arquitectura NLP.

2. **Sobre claims facticos:** Tu propones tuplas (sujeto, predicado, objeto, fuente, confianza). Esto es correcto pero necesita mas estructura. Propongo distinguir:
   - **Claims cuantitativos**: "El proceso X toma Y dias" -> numerico, comparable, contradiccion detectable automaticamente.
   - **Claims cualitativos**: "El proceso X es ineficiente" -> opinion, no comparable directamente.
   - **Claims relacionales**: "El area A depende del area B" -> modelable como OrgRelation.

3. **Sobre la deteccion de contradicciones:** Tu propones NLI (DeBERTa) para comparar claims. Pregunto: vale la pena agregar un modelo NLI separado (requiere Python sidecar o servicio adicional) cuando el LLM puede hacer la misma comparacion con un prompt de Structured Output? "Dados estos claims de diferentes fuentes, identifica contradicciones" es una tarea donde gpt-4.1 es excelente. El trade-off es costo (LLM es mas caro que un NLI dedicado) pero simplicidad operacional (no hay otro modelo que deployear).

**Propuesta de interfaz entre nuestros modulos:**

Mi pipeline produce un JSON por entrevista con este shape:
```
{
  entities: OrgEntity[],      // Alineados con tu OrgEntityType
  relations: OrgRelation[],   // Alineados con tu OrgRelationType
  claims: FactualClaim[],     // Tuplas con confidence
  problems: Problem[],        // Con severity y evidence
  summary: InterviewSummary   // Multi-nivel
}
```

Tu modulo de Knowledge Graph consume este JSON para crear/actualizar el grafo. El contrato de interfaz es el schema Zod compartido en `@zeru/shared`.

## Hipotesis 3: Process Mining & Modelado Organizacional (Investigador 3)

### 1. Process Mining desde Entrevistas (vs Event Logs)

#### El problema fundamental
El process mining clasico (ProM, Celonis, PM4Py) opera sobre **event logs** estructurados: cada fila es un evento con caso-ID, actividad, timestamp y recurso. Nuestro caso es radicalmente distinto: tenemos **narrativas orales** donde un entrevistado describe procesos de forma no lineal, incompleta y subjetiva. No hay timestamps reales, no hay caso-IDs, y el "proceso" existe solo en la mente del entrevistado.

#### Tecnicas adaptadas: Text-Based Process Discovery

**Estado del arte (2025-2026):**

1. **NLP-to-BPMN Pipeline (enfoque hibrido recomendado):**
   - Paper clave: "Improving BPMN Model Generation from Texts through a Prompt-Guided Fusion of NLP and LLM Approaches" (K-CAP 2025) demuestra que un enfoque hibrido NLP+LLM supera a ambos por separado.
   - Pipeline: Texto -> Extraccion de actividades (NER) -> Identificacion de actores (roles) -> Deteccion de flujo de control (secuencia, paralelismo, decisiones) -> Generacion de modelo.
   - El NLP clasico (dependency parsing, SRL) captura la estructura gramatical; el LLM aporta razonamiento semantico para resolver ambiguedades.

2. **LLM-Assisted Process Discovery:**
   - Paper: "Evaluating LLMs on Business Process Modeling" (Software and Systems Modeling, Springer 2025) establece un framework de evaluacion con benchmarks.
   - Paper: "BPMN Assistant" (Applied Sciences 2025 / arXiv 2509.24592) presenta un sistema end-to-end que usa LLMs para crear y editar BPMN desde lenguaje natural.
   - Herramienta: **Nala2BPMN** descompone la tarea en pasos intermedios para reducir errores.
   - Herramienta: **LLM4BPMNGen** transforma descripciones textuales directamente a BPMN XML.

3. **Limitaciones criticas de LLMs con BPMN-XML:**
   - Los LLMs luchan con BPMN-XML como formato de intercambio. La generacion directa de XML es propensa a errores, produciendo modelos invalidos incluso con loops de refinamiento.
   - **Solucion validada:** Usar **representacion JSON intermedia** (PME - Process Model Elements). Segun "What is the Best Process Model Representation?" (Polytechnique Montreal, 2025): JSON reduce latencia ~43% y tokens de salida >75% vs XML directo, con tasas de exito iguales o superiores.

#### Recomendacion para Zeru

**Pipeline de 3 fases:**

```
Fase 1: Extraccion estructurada (LLM)
  Transcripcion -> JSON estructurado {actividades, actores, secuencias, decisiones, excepciones}

Fase 2: Modelo intermedio (JSON normalizado)
  JSON extraido -> Normalizacion + reconciliacion -> Modelo de proceso canonico (JSON)

Fase 3: Renderizado multiple
  Modelo canonico -> Mermaid (visualizacion rapida)
                  -> BPMN XML (interoperabilidad)
                  -> Grafo interactivo (analisis)
```

**Por que NO generar BPMN directamente con LLM:** La tasa de error en XML generado es alta. Es mucho mas confiable extraer a JSON intermedio y luego transformar programaticamente a BPMN-XML con una libreria dedicada.

---

### 2. Knowledge Graphs para Organizaciones

#### Analisis de opciones de almacenamiento

| Criterio | Neo4j | PostgreSQL + Relaciones | PostgreSQL + Apache AGE |
|----------|-------|------------------------|------------------------|
| Traversal profundo (>5 hops) | Excelente | Pobre (CTEs recursivos lentos) | Bueno (Cypher nativo) |
| Transacciones ACID | Si | Si (nativo) | Si (hereda de PG) |
| Integracion con stack existente (Prisma) | Requiere driver separado | Nativa | Parcial (raw queries) |
| Complejidad operacional | Alta (DB separada, sync) | Baja (misma DB) | Media (extension) |
| Queries mixtos (relacional + grafo) | Requiere federation | Nativo | Nativo |
| Madurez del ecosistema | Muy alta | Muy alta | Media (Apache TLP 2022) |
| Multi-tenancy | Manual | Nativo (ya implementado) | Manual en queries |
| Costo de infraestructura | Alto (licencia Enterprise) | Cero adicional | Cero adicional |

#### Recomendacion: PostgreSQL con modelo relacional bien disenado + Apache AGE para consultas avanzadas

**Justificacion:**

1. **Ya tenemos PostgreSQL con pgvector, Prisma, y multi-tenancy funcionando.** Agregar Neo4j introduce sincronizacion de datos, otro servidor, otro lenguaje de queries, y duplicacion de la logica de tenancy. El costo operacional no se justifica para el volumen esperado.

2. **SQL/PGQ es el futuro estandar** (SQL:2023 ISO). PostgreSQL 18+ lo implementara nativamente. Apache AGE es el puente hacia esa realidad: permite Cypher queries sobre tablas relacionales existentes.

3. **La profundidad de nuestro grafo organizacional es limitada:** Area -> Rol -> Proceso -> Tarea -> Sistema rara vez excede 5-6 niveles. PostgreSQL con CTEs recursivos maneja esto eficientemente. Solo para analisis de red complejos (centralidad, caminos criticos) necesitariamos queries de grafo avanzados, donde AGE brilla.

4. **El modelo se gestiona con Prisma** (migraciones, type safety, queries simples) y las consultas de grafo avanzadas se hacen via raw SQL con AGE cuando se necesitan.

#### Ontologias organizacionales: ArchiMate simplificado

ArchiMate es el estandar de The Open Group para modelar arquitectura empresarial, alineado con TOGAF. Define capas (Business, Application, Technology) con relaciones tipadas. Sin embargo, ArchiMate completo es excesivamente complejo para nuestro caso.

**Recomendacion: Ontologia simplificada inspirada en ArchiMate:**

```
Entidades core:
- Organization (empresa/division)
- Department (area funcional)
- Role (cargo/responsabilidad)
- Process (proceso de negocio)
- Activity (tarea dentro de un proceso)
- System (herramienta/software)
- Document (documento/formulario)
- Problem (dolor/ineficiencia detectado)
- Improvement (mejora propuesta)

Relaciones tipadas:
- BELONGS_TO (Role -> Department, Department -> Organization)
- EXECUTES (Role -> Activity)
- OWNS (Role -> Process)
- CONTAINS (Process -> Activity)
- DEPENDS_ON (Process -> Process, Activity -> Activity)
- USES (Activity -> System, Activity -> Document)
- AFFECTS (Problem -> Process | Role | Department | System)
- ADDRESSES (Improvement -> Problem)
- PRECEDES / FOLLOWS (Activity -> Activity, temporal order)
- TRIGGERS (Activity -> Process, cross-process)
- INPUTS / OUTPUTS (Activity -> Document)
```

Esta ontologia captura el 90% de lo que ArchiMate modela a nivel de capa Business, sin la complejidad de las capas Application/Technology completas.

---

### 3. Generacion de Diagramas

#### Mermaid.js: Mapa de tipos de diagrama por caso de uso

| Caso de uso | Tipo Mermaid | Justificacion |
|-------------|-------------|---------------|
| Flujo de proceso general | `flowchart TD/LR` | Simple, LLMs lo generan bien, soporta subgraphs para swimlanes |
| Proceso con responsables (swimlane) | `flowchart` con `subgraph` | Mermaid no tiene swimlanes nativos, pero subgraphs simulan lanes por departamento/rol |
| Interaccion entre areas | `sequenceDiagram` | Ideal para mostrar handoffs y comunicacion entre actores |
| Estados de un proceso | `stateDiagram-v2` | Para workflows con estados definidos (ej: aprobacion de compras) |
| Jerarquia organizacional | `flowchart TD` | Arbol top-down de areas y roles |
| Timeline de proyecto | `gantt` | Para roadmaps de mejoras |

#### Limitacion critica de Mermaid: No soporta BPMN nativamente

Issue #660 y #2623 en el repo de Mermaid solicitan soporte BPMN, pero sigue sin implementarse. Mermaid no tiene gateways (XOR, AND, OR), eventos (start/end/intermediate), ni pools/lanes como ciudadanos de primera clase.

**Estrategia recomendada: Mermaid como capa de previsualizacion rapida + libreria BPMN dedicada para diagramas formales.**

#### Visualizaciones interactivas del grafo organizacional

**Recomendacion: Cytoscape.js sobre React Flow para el grafo organizacional.**

| Criterio | React Flow | Cytoscape.js |
|----------|-----------|-------------|
| Tipo de grafo | DAGs, flowcharts | Cualquier grafo (ciclico, dirigido, no dirigido) |
| Layout automatico | Limitado (dagre, elkjs) | Extenso (cola, dagre, cose, breadthfirst, etc.) |
| Escala | Cientos de nodos | Miles de nodos (WebGL) |
| Interactividad | Excelente (drag, zoom, edicion) | Excelente (eventos, seleccion, filtrado) |
| Analisis de grafo integrado | No | Si (centralidad, PageRank, shortest path) |
| React integration | Nativo | Via react-cytoscapejs |
| BPMN-like diagrams | Mejor (nodos custom) | Posible pero menos natural |

**Veredicto:**
- **Cytoscape.js** para el Knowledge Graph interactivo (explorar entidades, relaciones, filtrar por tipo, calcular metricas).
- **React Flow** para el editor de procesos (donde el usuario puede mover/editar nodos tipo flowchart).
- **Mermaid.js** para previsualizacion embebida en chat y exportacion rapida (ya que se renderiza como SVG estatico y los LLMs lo generan nativamente).

#### Enfoque de generacion: Estructura intermedia, NO Mermaid directo

Segun el paper "What is the Best Process Model Representation?" (2025):
- **Mermaid logra el score global mas alto** en evaluaciones de calidad de modelos generados por LLM.
- Pero **JSON tiene la parsabilidad mas alta** gracias a parsers estandarizados.
- **Recomendacion:** El LLM genera JSON estructurado (lista de actividades, flujos, gateways). El backend transforma ese JSON a: (a) Mermaid para preview instantaneo, (b) BPMN-XML para export formal, (c) nodos Cytoscape para visualizacion interactiva.

---

### 4. Modelado de Datos para la Organizacion

#### Evaluacion: Relacional (Prisma/PostgreSQL) vs Graph DB

**Veredicto: PostgreSQL relacional es suficiente, con extensiones puntuales.**

Argumentos:
1. El modelo organizacional tiene entidades con atributos ricos (nombre, descripcion, metricas, metadata) -- esto es inherentemente relacional.
2. Las relaciones son tipadas y predecibles (no es un grafo abierto tipo social network).
3. Prisma nos da type safety, migraciones, y un ORM maduro. Perder esto para usar Neo4j es un costo real.
4. Para analisis de grafo avanzados (centralidad, caminos criticos), usamos Apache AGE o raw SQL con CTEs.

#### Schema design propuesto (Prisma)

```prisma
// --- Entidades organizacionales core ---

model OrgEntity {
  id          String   @id @default(uuid())
  type        OrgEntityType  // DEPARTMENT, ROLE, PROCESS, ACTIVITY, SYSTEM, DOCUMENT
  name        String
  description String?
  metadata    Json?    // Atributos flexibles por tipo
  status      String   @default("ACTIVE") // ACTIVE, DEPRECATED, PROPOSED

  // Versionado temporal
  validFrom   DateTime @default(now())
  validTo     DateTime? // null = vigente
  version     Int      @default(1)

  // Multi-tenant
  tenantId    String
  projectId   String   // Proyecto de mejora continua

  // Embedding para busqueda semantica
  embedding   Unsupported("vector(1536)")?

  // Procedencia
  sourceInterviewId String?  // Entrevista de donde se extrajo
  confidence        Float    @default(0.5) // 0-1, confianza en la info

  relationsFrom  OrgRelation[] @relation("FromEntity")
  relationsTo    OrgRelation[] @relation("ToEntity")
  problems       ProblemLink[]

  @@index([tenantId, projectId, type])
  @@index([tenantId, type, status])
}

enum OrgEntityType {
  ORGANIZATION
  DEPARTMENT
  ROLE
  PROCESS
  ACTIVITY
  SYSTEM
  DOCUMENT_TYPE
}

model OrgRelation {
  id          String   @id @default(uuid())
  type        OrgRelationType
  metadata    Json?    // peso, frecuencia, etc.

  fromEntityId String
  fromEntity   OrgEntity @relation("FromEntity", fields: [fromEntityId], references: [id])

  toEntityId   String
  toEntity     OrgEntity @relation("ToEntity", fields: [toEntityId], references: [id])

  // Versionado y procedencia
  validFrom    DateTime @default(now())
  validTo      DateTime?
  confidence   Float    @default(0.5)
  sourceInterviewId String?

  tenantId     String
  projectId    String

  @@index([tenantId, projectId])
  @@index([fromEntityId])
  @@index([toEntityId])
  @@index([type])
}

enum OrgRelationType {
  BELONGS_TO
  EXECUTES
  OWNS
  CONTAINS
  DEPENDS_ON
  USES
  PRECEDES
  FOLLOWS
  TRIGGERS
  INPUTS
  OUTPUTS
}
```

#### Relaciones polimorficas: El caso de Problem

Un Problema puede afectar a un Proceso, un Area, un Rol o un Sistema. En lugar de polimorfismo clasico (que Prisma no soporta nativamente), usamos una **tabla de enlace** con referencia a OrgEntity:

```prisma
model Problem {
  id          String   @id @default(uuid())
  title       String
  description String
  severity    ProblemSeverity  // CRITICAL, HIGH, MEDIUM, LOW
  category    String?  // bottleneck, redundancy, manual_work, etc.
  evidence    Json?    // Citas textuales de entrevistas

  tenantId    String
  projectId   String

  // Entidades afectadas (polimorfico via OrgEntity)
  affectedEntities ProblemLink[]
  improvements     Improvement[]

  @@index([tenantId, projectId])
  @@index([severity])
}

model ProblemLink {
  id         String   @id @default(uuid())

  problemId  String
  problem    Problem  @relation(fields: [problemId], references: [id])

  entityId   String
  entity     OrgEntity @relation(fields: [entityId], references: [id])

  impactDescription String? // Como afecta especificamente

  @@unique([problemId, entityId])
}
```

**Esto resuelve el polimorfismo** porque OrgEntity ya tiene un campo `type` que indica si es PROCESS, ROLE, DEPARTMENT, etc. No necesitamos columnas nullable ni discriminadores complejos.

#### Versionado temporal

El campo `validFrom`/`validTo` en OrgEntity y OrgRelation implementa **SCD Type 2** (Slowly Changing Dimensions):
- Cuando la organizacion cambia, no se borra la entidad anterior: se cierra (validTo = now) y se crea una nueva version.
- Esto permite consultar el estado organizacional en cualquier punto del tiempo: "Como era el proceso de compras en enero 2026?"
- Complementado con **pgMemento** o triggers para audit trail completo.

#### Multi-tenancy

El modelo hereda el patron ya establecido en Zeru: `tenantId` en cada tabla con indices compuestos. Se agrega `projectId` porque una empresa puede tener multiples proyectos de mejora continua, cada uno con su snapshot organizacional.

---

### 5. Reconciliacion entre Entrevistas

#### El problema

Cuando el Jefe de Logistica dice "el proceso de despacho toma 2 dias" y el Jefe de Produccion dice "Logistica se demora una semana en despachar", tenemos una **contradiccion factica**. Cuando uno describe 5 pasos y el otro describe 8, tenemos **informacion complementaria** que debe fusionarse.

#### Tecnicas de deteccion de contradicciones

1. **Natural Language Inference (NLI):**
   - Usar modelos NLI (ej: DeBERTa fine-tuned en MNLI) para clasificar pares de claims como ENTAILMENT / CONTRADICTION / NEUTRAL.
   - Aplicar pairwise sobre claims extraidos de diferentes entrevistas que refieren a la misma entidad.
   - Paper relevante: "Contradiction to Consensus: Dual-Perspective, Multi-Source Retrieval-Based Claim Verification" (arXiv 2602.18693, 2026).

2. **Deteccion a nivel de Knowledge Graph:**
   - Cuando se insertan hechos extraidos de la entrevista B que contradicen hechos de la entrevista A, el sistema detecta conflictos:
     - Valores numericos inconsistentes (duracion, frecuencia, cantidad).
     - Relaciones contradictorias (A dice que Rol X hace Tarea Y; B dice que Rol Z hace Tarea Y).
     - Flujos de proceso divergentes (diferente orden de actividades).

3. **Enfoque multi-perspectiva con LLM:**
   - Paper: "(D)RAGged Into a Conflict: Detecting and Addressing Conflicting Sources in Retrieval-Augmented LLMs" (Google Research, 2025) propone tecnicas para detectar y resolver conflictos en fuentes RAG.
   - Aplicable directamente: las transcripciones son las "fuentes", y el LLM debe identificar y flag conflictos.

#### Estrategia de reconciliacion recomendada

```
Paso 1: Extraer claims facticos de cada entrevista
  "El proceso X tiene Y pasos"
  "El Rol A es responsable de la Tarea B"
  "El tiempo promedio es Z dias"

Paso 2: Agrupar claims por entidad referenciada
  Todas las claims sobre "Proceso de Despacho" de todas las entrevistas

Paso 3: Deteccion automatica de conflictos
  - NLI pairwise para claims textuales
  - Comparacion numerica para metricas
  - Comparacion de grafos para flujos de proceso

Paso 4: Clasificacion del conflicto
  - FACTUAL (datos duros contradictorios -> requiere verificacion)
  - PERSPECTIVA (opiniones diferentes sobre lo mismo -> ambas validas)
  - ALCANCE (uno ve mas/menos pasos -> fusionar)

Paso 5: Resolucion
  - FACTUAL: Marcar como "en disputa", solicitar verificacion documental
  - PERSPECTIVA: Registrar ambas perspectivas con atribucion
  - ALCANCE: Merge inteligente (union de pasos, preservando ambas visiones)

Paso 6: Dashboard de conflictos
  - UI que muestra conflictos detectados por entidad
  - El consultor decide la resolucion final
  - Se registra la decision y justificacion
```

#### Fusion de informacion complementaria

Cuando dos entrevistas describen partes diferentes del mismo proceso, el merge es mas sencillo:
- Alinear por actividades/roles compartidos (puntos de anclaje).
- Insertar las actividades no compartidas en el flujo, respetando las dependencias descritas.
- Marcar las secciones de cada fuente para trazabilidad.

---

### 6. Analisis y Diagnostico

#### Deteccion automatica de cuellos de botella

Sin event logs con timestamps, no podemos calcular tiempos de espera reales. Pero podemos detectar **cuellos de botella estructurales**:

1. **Betweenness Centrality** en el grafo de procesos: Nodos (actividades o roles) por los que pasan muchos flujos son potenciales bottlenecks. Si un rol aparece en 15 de 20 procesos, es un cuello de botella organizacional.

2. **In-Degree alto** en relaciones DEPENDS_ON: Si muchas actividades dependen de una sola, esa es critica.

3. **Fan-in/Fan-out analysis:** Actividades con muchas entradas (fan-in) son puntos de sincronizacion potencialmente lentos.

4. **Deteccion basada en narrativa:** Las entrevistas suelen mencionar explicitamente demoras ("siempre nos atrasamos en...", "tenemos que esperar a que..."). Extraer estos patrones con NLP.

#### Single Points of Failure (SPOF)

Usando analisis de grafos:
- **Betweenness Centrality** identifica nodos cuya remocion desconectaria partes del grafo. Un rol con alta betweenness que solo lo ocupa una persona es un SPOF.
- **Articulation points** (vertices de corte): Nodos cuya eliminacion desconecta el grafo.
- **Bridge edges**: Relaciones cuya eliminacion desconecta subgrafos.

#### Metricas de complejidad de procesos

| Metrica | Formula/Descripcion | Que indica |
|---------|---------------------|------------|
| CFC (Control-Flow Complexity) | Suma de caminos de decision | Complejidad de decisiones |
| NOA (Number of Activities) | Conteo de actividades | Tamano del proceso |
| Density | Relaciones / (Nodos * (Nodos-1)) | Que tan interconectado esta |
| Diameter | Camino mas largo en el grafo | Extension del proceso |
| Handoffs | Cambios de responsable entre actividades consecutivas | Fragmentacion de responsabilidad |
| System switches | Cambios de sistema entre actividades consecutivas | Fragmentacion tecnologica |

#### Diferenciacion de hechos, inferencias e hipotesis

Cada pieza de informacion en el modelo debe clasificarse:

- **HECHO** (confidence >= 0.8): Mencionado explicitamente por el entrevistado, corroborado por multiples fuentes o documentacion.
- **INFERENCIA** (confidence 0.4-0.8): Deducido por el sistema a partir de patrones (ej: "si A depende de B y B depende de C, entonces A indirectamente depende de C").
- **HIPOTESIS** (confidence < 0.4): Sugerido por el LLM como posible pero no confirmado (ej: "este patron sugiere que podria haber un cuello de botella").

El campo `confidence` en OrgEntity y OrgRelation soporta esta clasificacion. El UI debe distinguir visualmente estos niveles.

---

### 7. Priorizacion de Mejoras

#### Framework recomendado: RICE adaptado con scoring asistido por LLM

RICE (Reach, Impact, Confidence, Effort) es superior a ICE para nuestro caso porque:
- **Reach** (cuantas personas/procesos afecta) se puede calcular directamente del grafo organizacional.
- **Impact** se estima cualitativamente pero con estructura.
- **Confidence** refleja la calidad de la evidencia (cuantas entrevistas lo mencionan, consistencia).
- **Effort** se estima en base a la complejidad del cambio.

#### Cuantificacion de datos cualitativos

El problema: las entrevistas son cualitativas. Solucion:

1. **Proxies cuantitativos derivados del grafo:**
   - Reach = numero de roles/procesos afectados por el problema (calculable del grafo)
   - Frecuencia de mencion = cuantas entrevistas mencionan el problema
   - Severidad percibida = analisis de sentimiento de las menciones

2. **Scoring asistido por LLM:**
   - Paper/recurso: "Using AI to Score RICE Prioritization" (Ideaplan, 2025) muestra que LLMs pueden groundear scores en datos reales.
   - El LLM recibe: (a) descripcion del problema, (b) contexto organizacional del grafo, (c) citas textuales de entrevistas, (d) escala de scoring definida. Genera scores con justificacion.
   - **Critico:** Los scores del LLM son PROPUESTAS que el consultor valida/ajusta. No son decisiones automaticas.

3. **Matriz esfuerzo-impacto generada:**
   ```
   Cuadrante 1 (Quick Wins): Alto impacto, bajo esfuerzo -> Implementar inmediatamente
   Cuadrante 2 (Strategic): Alto impacto, alto esfuerzo -> Planificar proyecto
   Cuadrante 3 (Fill-ins): Bajo impacto, bajo esfuerzo -> Si hay tiempo
   Cuadrante 4 (Thankless): Bajo impacto, alto esfuerzo -> Descartar
   ```

---

### 8. Resumen de Recomendaciones Tecnicas para Zeru

| Componente | Recomendacion | Justificacion |
|------------|---------------|---------------|
| Almacenamiento del grafo | PostgreSQL relacional (Prisma) + Apache AGE para queries avanzados | Ya tenemos PG, Prisma, pgvector. Cero infraestructura adicional |
| Ontologia | ArchiMate simplificado (9 entidades, 11 relaciones tipadas) | Cubre 90% del modelado organizacional sin complejidad excesiva |
| Representacion de procesos | JSON intermedio (PME) -> Mermaid / BPMN-XML / Cytoscape | LLMs generan JSON confiablemente; transformacion programatica a formatos de visualizacion |
| Visualizacion estatica | Mermaid.js (embebido en chat) | LLMs lo generan nativamente, renderizado SVG, sin dependencias |
| Visualizacion interactiva (grafo) | Cytoscape.js | Metricas de grafo integradas, escala, layouts automaticos |
| Editor de procesos | React Flow | Mejor para edicion drag-and-drop de flowcharts |
| Deteccion de contradicciones | NLI (DeBERTa) + comparacion estructural en KG + LLM multi-perspectiva | Tres capas complementarias: semantica, estructural, razonamiento |
| Versionado organizacional | SCD Type 2 (validFrom/validTo) + audit trail | Consultas point-in-time sin borrar historia |
| Polimorfismo (Problem afecta X) | Tabla OrgEntity unificada con campo type + ProblemLink | Evita polimorfismo Prisma, resuelve con modelo EAV simplificado |
| Priorizacion | RICE adaptado + scoring LLM + proxies del grafo | Combina datos cualitativos con metricas cuantitativas del grafo |
| Multi-tenancy | tenantId + projectId en cada tabla | Multiples empresas, multiples proyectos por empresa |
| Analisis de red | Betweenness centrality, articulation points, in-degree | Detecta SPOF, cuellos de botella, roles sobrecargados |

### 9. Trade-offs y Debilidades Honestas

1. **PostgreSQL vs Neo4j para grafos:** Si en el futuro los grafos organizacionales crecen a miles de nodos con queries de caminos de 10+ hops, PostgreSQL sera insuficiente. Pero para organizaciones tipicas (50-500 personas, 20-100 procesos) es mas que adecuado.

2. **Mermaid no es BPMN:** Los diagramas Mermaid no son formalmente BPMN. Para clientes que necesiten BPMN estricto (ej: para importar en Bizagi, Camunda), necesitaremos generar BPMN-XML aparte. Mermaid es para preview rapido y visualizacion en la plataforma.

3. **NLI para contradicciones es imperfecto:** Los modelos NLI tienen precision ~85-90% en benchmarks academicos. En texto de entrevistas (informal, con jerga) sera menor. Se necesita validacion humana.

4. **Versionado SCD Type 2 complica queries:** Cada query sobre el estado actual necesita filtrar `WHERE validTo IS NULL`. Es un overhead constante. Alternativa: tabla de historia separada (pero pierde la elegancia de consultas temporales).

5. **Apache AGE es joven:** Aunque es Apache Top-Level Project desde 2022, su ecosistema es menos maduro que Neo4j. Si AGE no cumple, el fallback es CTEs recursivos puros o considerar Neo4j mas adelante.

6. **La priorizacion LLM-assisted tiene sesgo inherente:** El LLM puede sobreponderar problemas bien articulados y subponderar problemas sutiles. El consultor DEBE validar y ajustar los scores.

### 10. Fuentes y Referencias

- [Improving BPMN Model Generation from Texts - K-CAP 2025](https://dl.acm.org/doi/10.1145/3731443.3771362)
- [BPMN Assistant: LLM-Based Process Modeling](https://arxiv.org/html/2509.24592v1)
- [What is the Best Process Model Representation? - Comparative Analysis](https://arxiv.org/html/2507.11356v1)
- [Evaluating LLMs on Business Process Modeling - Springer 2025](https://link.springer.com/article/10.1007/s10270-025-01318-w)
- [Nala2BPMN: Automating BPMN Generation with LLMs](https://www.researchgate.net/publication/385976015_Nala2BPMN_Automating_BPMN_Model_Generation_with_Large_Language_Models)
- [LLM4BPMNGen Tool](https://ceur-ws.org/Vol-4099/ER25_PAD_Costa.pdf)
- [Building Knowledge Graph with PostgreSQL](https://dev.to/micelclaw/4o-building-a-personal-knowledge-graph-with-just-postgresql-no-neo4j-needed-22b2)
- [Apache AGE - PostgreSQL Graph Extension](https://age.apache.org/)
- [SQL/PGQ in PostgreSQL](https://www.enterprisedb.com/blog/representing-graphs-postgresql-sqlpgq)
- [Contradiction to Consensus: Multi-Source Claim Verification](https://arxiv.org/html/2602.18693)
- [(D)RAGged Into a Conflict - Google Research](https://research.google/pubs/dragged-into-a-conflict-detecting-and-addressing-conflicting-sources-in-retrieval-augmented-llms/)
- [Contradiction Detection in RAG Systems](https://arxiv.org/html/2504.00180v1)
- [Cytoscape.js - Graph Visualization](https://js.cytoscape.org/)
- [Organizational Network Analysis Guide - Polinode](https://www.polinode.com/guides/what-is-organizational-network-analysis-a-comprehensive-guide)
- [Process Bottleneck Identification with Knowledge Graphs](https://www.sciencedirect.com/science/article/abs/pii/S1474034622003202)
- [Using AI to Score RICE Prioritization](https://www.ideaplan.io/blog/using-ai-to-score-rice-prioritization)
- [pgMemento - Audit Trail for PostgreSQL](https://github.com/pgMemento/pgMemento)
- [Multi-temporal Versioning in Postgres - HASH](https://hash.dev/blog/multi-temporal-versioning)
- [Polymorphic Associations with NestJS and Prisma](https://wanago.io/2024/02/19/api-nestjs-postgresql-prisma-polymorphic-associations/)
- [MermaidSeqBench: LLM-to-Mermaid Evaluation](https://arxiv.org/html/2511.14967v1)
- [6 Trends Shaping Process Mining in 2026](https://www.processexcellencenetwork.com/process-mining/articles/6-trends-shaping-process-mining-in-2026)
- [ArchiMate Overview - The Open Group](https://www.opengroup.org/archimate-forum/archimate-overview)
- [Centrality Measures in Network Analysis](https://visiblenetworklabs.com/2021/04/16/understanding-network-centrality/)

---

### Mensajes para otros investigadores

#### Para Investigador 1 (RAG & Knowledge Management):

El Knowledge Graph organizacional que propongo (OrgEntity + OrgRelation en PostgreSQL) es **complementario** al RAG que investigues. Las entidades extraidas de entrevistas deben almacenarse tanto como nodos del grafo (para analisis estructural) como chunks vectorizados (para busqueda semantica). Recomiendo que exploremos un enfoque **GraphRAG**: cuando el usuario pregunta "que problemas tiene el area de logistica?", el sistema deberia hacer:
1. Busqueda semantica sobre las transcripciones (tu RAG clasico)
2. Query de grafo: `OrgEntity(type=DEPARTMENT, name~logistica) -> ProblemLink -> Problem`
3. Fusion de resultados

La clave es que NO dupliquemos datos. Las transcripciones viven en tu sistema RAG (chunks + embeddings). El grafo almacena las ENTIDADES EXTRAIDAS con referencias a las transcripciones de origen (sourceInterviewId). Esto evita sincronizacion.

Pregunta critica para ti: Para el Knowledge Graph necesitamos embeddings de entidades (no solo de chunks de texto). El mismo modelo text-embedding-3-small que ya usamos para Memory funciona, pero necesitamos definir QUE se embede: el nombre de la entidad? nombre + descripcion? nombre + contexto? Esto afecta la calidad del retrieval.

#### Para Investigador 2 (NLP, Transcripcion & Extraccion):

La calidad de todo mi modelado depende DIRECTAMENTE de la calidad de tu extraccion. Necesito que tu pipeline de NLP produzca:

1. **Entidades tipadas** con el schema de mi ontologia (DEPARTMENT, ROLE, PROCESS, ACTIVITY, SYSTEM, DOCUMENT_TYPE, PROBLEM).
2. **Relaciones tipadas** entre esas entidades (BELONGS_TO, EXECUTES, OWNS, CONTAINS, DEPENDS_ON, etc.).
3. **Claims facticos** extraidos como tuplas: (sujeto, predicado, objeto, fuente, confianza). Ej: ("Proceso de Despacho", "duracion_promedio", "3 dias", "entrevista_jefe_logistica", 0.7).
4. **Indicadores de incertidumbre**: Cuando el entrevistado dice "creo que..." vs "siempre hacemos..." la confianza debe ser diferente.

Tema de debate: Tu podrias proponer usar un LLM para hacer toda la extraccion en un solo prompt. Yo argumento que necesitamos un pipeline multi-paso: (1) NER para entidades, (2) Relation Extraction para conexiones, (3) Claim Extraction para hechos cuantificables. Un solo prompt mega-complejo sera fragil y dificil de depurar. Un pipeline modular permite mejorar cada paso independientemente.

---

## Debate y Refutaciones

### Punto 1: Knowledge Graph — Neo4j vs PostgreSQL
- **Inv. 1 (RAG):** PostgreSQL relacional con OrgEntity/OrgRelationship. No Neo4j.
- **Inv. 3 (Process):** PostgreSQL + Apache AGE para queries Cypher avanzados. No Neo4j.
- **Resultado:** CONSENSO UNANIME. PostgreSQL como unico sistema de datos. Apache AGE como extension opcional para queries avanzados de grafo. La profundidad del grafo organizacional (5-6 niveles max) no justifica Neo4j.

### Punto 2: Extraccion — Pasada unica vs Multi-pasada
- **Inv. 3 (Process):** Propone pipeline NER -> Relation Extraction -> Claim Extraction (separacion por tecnica NLP).
- **Inv. 2 (NLP):** Propone 5 pasadas por complejidad cognitiva con model routing (nano para simple, gpt-4.1 para razonamiento). No es necesario NER separado porque Structured Outputs extrae entidades + relaciones en una misma llamada.
- **Resultado:** CONSENSO con refinamiento del Inv. 2. Multi-pasada por complejidad cognitiva (no por tecnica NLP). Structured Outputs de OpenAI elimina la necesidad de NER clasico separado. Pasadas: (1) entidades basicas [nano], (2) procesos [mini], (3) problemas [gpt-4.1], (4) dependencias [gpt-4.1], (5) claims facticos [mini].

### Punto 3: Deteccion de contradicciones — NLI separado vs LLM nativo
- **Inv. 3 (Process):** Propone 3 capas: DeBERTa NLI + comparacion estructural en KG + LLM multi-perspectiva.
- **Inv. 1 (RAG):** Refuta que DeBERTa requiere Python sidecar, complejidad innecesaria para MVP. GPT-5.4 ya maneja NLI nativamente. Propone LLM-only para MVP, NLI para fase posterior si la precision es insuficiente.
- **Inv. 2 (NLP):** De acuerdo con Inv. 1. El stack es 100% Node.js/TypeScript. Agregar Python sidecar para un modelo NLI es over-engineering en MVP.
- **Resultado:** CONSENSO 2 vs 1. MVP usa LLM nativo para deteccion de contradicciones (comparacion estructural en KG + prompt a gpt-4.1). DeBERTa/NLI queda como optimizacion para Fase 3 si la precision del LLM no supera 85%.

### Punto 4: Visualizacion — Cytoscape.js vs React Flow vs Mermaid
- **Inv. 3 (Process):** Cytoscape.js para grafo interactivo, React Flow para editor de procesos, Mermaid para preview en chat.
- **Inv. 1 (RAG):** Cuestiona Cytoscape.js — la experiencia React es inferior. Sugiere evaluar en spike tecnico. Para MVP, Mermaid embebido es suficiente.
- **Resultado:** CONSENSO pragmatico. MVP: Mermaid.js embebido en chat (ya probado en Zeru para contabilidad). Fase 2: React Flow para editor de procesos interactivo. Fase 3: evaluar Cytoscape.js vs React Flow con spike tecnico para el knowledge graph explorer. No comprometerse con Cytoscape sin evaluacion.

### Punto 5: Transcripcion — OpenAI vs Deepgram
- **Inv. 2 (NLP):** Deepgram Nova-3 como principal (diarizacion nativa sin chunking, mas barato, mejor para audios largos). OpenAI como fallback para audios cortos (<25 MB).
- **Inv. 1 y 3:** Sin objecion. Deepgram resuelve el problema critico de cross-chunk speaker identity de OpenAI.
- **Resultado:** CONSENSO. Deepgram Nova-3 principal, OpenAI fallback. Formato de salida unificado TranscriptionResult para desacoplar proveedor.

### Punto 6: Chunking para RAG
- **Inv. 1 (RAG):** Multi-capa: speaker-turn -> semantic clustering -> contextual retrieval (Anthropic) -> parent-document.
- **Inv. 2 (NLP):** Propone chunks de ~1500-2000 tokens por cambio de pregunta/tema.
- **Resultado:** CONSENSO con integracion. Chunking multi-capa del Inv. 1, donde la capa de segmentacion tematica se alimenta de los marcadores de pregunta/tema que identifica el pipeline del Inv. 2. El Inv. 2 produce los segmentos, el Inv. 1 los embede y organiza.

### Punto 7: Embeddings de entidades del Knowledge Graph
- **Inv. 3 (Process):** Pregunta que embeddir para OrgEntity.
- **Inv. 1 (RAG):** Responde: `name + description + JSON.stringify(metadata)`. Solo nombre es demasiado corto. NO embeddir atributos numericos (buscar con SQL clasico).
- **Resultado:** CONSENSO. Embeddings de entidades = name + description + metadata textual. Busquedas numericas via SQL.

### Punto 8: Costo del pipeline
- **Inv. 2 (NLP):** Estima ~$0.65 USD por entrevista (transcripcion + 5 pasadas + resumenes + embeddings).
- **Todos:** Costo extremadamente accesible. 15 entrevistas = ~$9.75 USD.
- **Resultado:** CONSENSO. El costo no es un blocker. Batch API de OpenAI (50% descuento) disponible para procesamiento no urgente.

---

## Consenso del Equipo

### Decisiones unanimes

1. **PostgreSQL como unico sistema de datos** — relacional (Prisma) + pgvector (embeddings) + Apache AGE (queries de grafo avanzados cuando se necesiten). NO Neo4j.
2. **Ontologia ArchiMate simplificada** — 9 tipos de entidad, 11 tipos de relacion. Suficiente para modelar el 90% de una organizacion.
3. **JSON intermedio para procesos** — LLM extrae a JSON, backend transforma a Mermaid/BPMN-XML/grafo interactivo. NUNCA generar BPMN-XML directamente con LLM.
4. **Deepgram Nova-3 para transcripcion** — diarizacion nativa, sin chunking manual, mas barato. OpenAI como fallback.
5. **Multi-pasada por complejidad cognitiva** — 5 pasadas con model routing (nano -> mini -> gpt-4.1) para optimizar costo y precision.
6. **OpenAI Structured Outputs + Zod** — extraccion tipada con schema validation nativa. Ya integrado en el stack.
7. **RAG hibrido** — BM25 (tsvector) + vector search (pgvector) con Reciprocal Rank Fusion. Todo en PostgreSQL.
8. **Trazabilidad obligatoria** ��� cada entidad/relacion apunta al chunk de entrevista de origen (sourceChunkId).
9. **Confidence scoring en todo** — cada pieza de informacion lleva score 0-1 con criterios explicitos.
10. **Human-in-the-loop focalizado** — validacion obligatoria para items criticos/baja confianza, muestreo para el resto.

### Decisiones por mayoria (2 vs 1)

1. **Contradicciones: LLM nativo para MVP** (Inv. 1 + Inv. 2 vs Inv. 3). DeBERTa/NLI solo si la precision LLM < 85%.

### Decisiones diferidas (requieren spike tecnico)

1. **Cytoscape.js vs React Flow** para knowledge graph explorer (Fase 3).
2. **Apache AGE vs CTEs recursivos puros** — evaluar cuando haya datos reales.
3. **Cohere embed-v4 vs text-embedding-3-large** — migrar embedding model despues del MVP.

---

## Arquitectura Recomendada

### Stack tecnologico final

```
CAPA DE INGESTION
  Audio (MP3/WAV) -> S3 -> Deepgram Nova-3 (STT + diarizacion) -> TranscriptionResult
  Fallback: OpenAI gpt-4o-transcribe-diarize (audios < 25 MB)

CAPA DE EXTRACCION
  TranscriptionResult -> Pipeline multi-pasada (5 pasadas):
    P1: Entidades basicas (gpt-4.1-nano + Structured Outputs + Zod)
    P2: Procesos y actividades (gpt-4.1-mini)
    P3: Problemas e ineficiencias (gpt-4.1)
    P4: Dependencias inter-proceso (gpt-4.1)
    P5: Claims facticos y metricas (gpt-4.1-mini)
  -> ExtractionResult {entities, relations, claims, problems, summary}

CAPA DE KNOWLEDGE GRAPH
  ExtractionResult -> OrgEntity + OrgRelation (PostgreSQL/Prisma)
  Reconciliacion inter-entrevista: entity linking por embedding similarity + LLM dedup
  Deteccion de contradicciones: comparacion estructural + LLM multi-perspectiva
  Versionado: SCD Type 2 (validFrom/validTo)

CAPA RAG
  Transcripcion -> Chunking multi-capa (speaker-turn -> semantic -> contextual prepend)
  InterviewChunk con embedding (pgvector) + tsvector (BM25)
  Retrieval: multi-query expansion -> hybrid BM25+vector (RRF) -> re-ranking
  Evaluacion: RAGAS (faithfulness, context recall, precision)

CAPA DE ANALISIS
  Knowledge Graph -> Metricas de grafo (betweenness, articulation points, SPOF)
  Resumenes multi-nivel: por pregunta -> por entrevista -> por area -> ejecutivo
  Diagnostico: hechos vs inferencias vs hipotesis (confidence tiers)
  Priorizacion: RICE adaptado + scoring LLM + proxies cuantitativos del grafo

CAPA DE VISUALIZACION
  MVP: Mermaid.js embebido (flowchart, sequence, state diagrams)
  Fase 2: React Flow (editor interactivo de procesos)
  Fase 3: Cytoscape.js o React Flow (knowledge graph explorer)
  Export: BPMN-XML (generado programaticamente desde JSON intermedio)

CAPA DE DATOS (PostgreSQL unico)
  Prisma ORM (migraciones, type safety, multi-tenant)
  pgvector + HNSW (embeddings de chunks y entidades)
  tsvector (full-text search BM25)
  Apache AGE (queries Cypher avanzados, opcional)
```

### Modelo de datos central (Prisma)

```
OrgProject          -> Proyecto de mejora continua
Interview           -> Entrevista dentro de un proyecto
InterviewSpeaker    -> Hablante identificado
InterviewChunk      -> Chunk semantico con embedding + tsvector
OrgEntity           -> Nodo del knowledge graph (9 tipos)
OrgRelation         -> Arista del knowledge graph (11 tipos)
Problem             -> Problema/ineficiencia detectado
ProblemLink         -> Relacion polimorfica Problem <-> OrgEntity
Improvement         -> Mejora propuesta
FactualClaim        -> Claim extraido con confidence y evidence
ConflictRecord      -> Contradiccion entre entrevistas
```

### Fases de implementacion

**FASE 1 — MVP (2-3 semanas):**
- Schema Prisma completo (OrgProject, Interview, OrgEntity, OrgRelation, Problem, Improvement)
- Upload de audio a S3
- Transcripcion con Deepgram Nova-3
- Pipeline de extraccion multi-pasada (5 pasadas)
- Knowledge graph basico (CRUD de entidades y relaciones)
- Chunking y embeddings para RAG
- Visualizacion con Mermaid.js en chat
- UI basica: crear proyecto, configurar entrevista, subir audio, ver resultados

**FASE 2 — Analisis y RAG (mes 2):**
- Hybrid search (BM25 + vector) con RRF
- Reconciliacion inter-entrevista y entity linking
- Deteccion de contradicciones (LLM-based)
- Resumenes multi-nivel (por entrevista, area, ejecutivo)
- Diagnostico automatico (SPOF, cuellos de botella, metricas de complejidad)
- React Flow para editor de procesos
- Dashboard de conflictos y validacion humana
- Contextual retrieval (prepend de Anthropic)

**FASE 3 — Priorizacion y Madurez (mes 3+):**
- RICE scoring asistido por LLM
- Backlog priorizado de mejoras
- Roadmap de implementacion
- DeepDivePlan (segunda etapa de levantamiento)
- Re-ranking con cross-encoder
- Evaluacion RAGAS automatizada
- Knowledge graph explorer interactivo
- Migracion a embedding model superior (Cohere embed-v4 o text-embedding-3-large)
- Apache AGE para queries de grafo complejos

### Costo estimado por proyecto (15 entrevistas)

```
Transcripcion (Deepgram):    $4.80  (15 x $0.32)
Extraccion LLM:              $4.95  (15 x $0.33)
Embeddings:                  $0.08  (15 x $0.005)
Resumenes y diagnostico:     ~$2.00
                             ------
TOTAL:                       ~$12 USD
```

### Principio rector

**EMPEZAR SIMPLE, ITERAR RAPIDO, VALIDAR CON DATOS REALES.**

Cada fase debe entregar valor visible antes de avanzar a la siguiente. No construir el sistema perfecto de una vez. La complejidad se agrega cuando la evidencia lo justifica, no antes.
