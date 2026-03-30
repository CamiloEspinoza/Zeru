# Backend Implementation Plan - Org Intelligence

## Estado: EN PROGRESO

---

## 1. Schema y Modelo de Datos (Backend-1)

### 1.1 Analisis del Schema Prisma Actual

#### Convenciones observadas en `apps/api/prisma/schema.prisma`

| Convencion | Ejemplo | Aplicar a org-intelligence |
|---|---|---|
| **IDs** | `String @id @default(uuid())` | SI, todos los modelos nuevos |
| **Multi-tenancy** | `tenantId String` con `@relation(onDelete: Cascade)` al Tenant | SI, todas las tablas |
| **Soft delete** | `deletedAt DateTime?` (presente en ~80% de los modelos) | SI, en modelos de dominio (OrgProject, Interview, OrgEntity, etc.) |
| **Timestamps** | `createdAt DateTime @default(now())` + `updatedAt DateTime @updatedAt` | SI, en todos |
| **Table mapping** | `@@map("snake_case_plural")` en todos los modelos | SI, ej: `@@map("org_projects")` |
| **Enum mapping** | `@@map("snake_case")` en enums | SI |
| **Indices** | `@@index([tenantId])` siempre presente; indices compuestos para queries frecuentes | SI |
| **Relaciones** | `onDelete: Cascade` para hijos directos; `onDelete: SetNull` para refs opcionales | SI |
| **Campos nullable** | `String?` para opcionales, documentados con `///` doc comments | SI |
| **JSON flexible** | `Json?` para datos semi-estructurados (ej: `metadata`, `content` en Message) | SI, para metadata extensible |
| **Unsupported types** | `Unsupported("vector(1536)")?` para pgvector (gestionado via raw SQL) | SI, embeddings y tsvector |
| **Boolean active** | `isActive Boolean @default(true)` en algunos modelos | Evaluar caso por caso |
| **No hay `@@map` en enum values** | Enum values en PascalCase o UPPER_CASE | UPPER_CASE para org-intelligence |

#### Modelos existentes que se relacionan con org-intelligence

1. **Tenant** - Raiz del multi-tenancy. Necesita relaciones: `orgProjects OrgProject[]`
2. **User** - Para `createdById` en OrgProject, "quien inicio el proyecto"
3. **AiUsageLog** - Para trackear tokens de cada pasada de extraccion (ya tiene `feature` string)
4. **Conversation** - Para vincular conversaciones de chat con proyectos de org intelligence
5. **Memory** - Patron de referencia para embeddings pgvector + `Unsupported("vector(1536)")`
6. **Document** - Podria reutilizarse para almacenar audios (S3 storage). Sin embargo, `Document` esta fuertemente ligado a conversaciones y contabilidad. **Decision: NO reutilizar Document para audios de entrevistas. Crear campo dedicado `audioS3Key` en Interview.**

#### Analisis critico del modelo Memory como referencia

El modelo `Memory` establece el precedente para pgvector:
- `embedding Unsupported("vector(1536)")?` - nullable, gestionado via raw SQL
- HNSW index creado en migration SQL manual (no via Prisma)
- Dimension fija 1536 (text-embedding-3-small)

**Implicacion para org-intelligence:** Los embeddings de `InterviewChunk` y `OrgEntity` seguiran exactamente el mismo patron. La columna `tsvector` para BM25 tambien sera `Unsupported("tsvector")` gestionada via raw SQL + trigger.

---

### 1.2 Propuesta de Schema Prisma Completo

#### ENUMS

```prisma
// ─── Org Intelligence Enums ─────────────────────────────

enum OrgProjectStatus {
  DRAFT
  ACTIVE
  COMPLETED
  ARCHIVED

  @@map("org_project_status")
}

enum TranscriptionStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED

  @@map("transcription_status")
}

enum TranscriptionProvider {
  DEEPGRAM
  OPENAI

  @@map("transcription_provider")
}

enum OrgEntityType {
  ORGANIZATION
  DEPARTMENT
  ROLE
  PROCESS
  ACTIVITY
  SYSTEM
  DOCUMENT_TYPE
  PROBLEM       // Investigador 3 usa 9 tipos; Problem como OrgEntity
  IMPROVEMENT   // Mejora propuesta (linked via graph)

  @@map("org_entity_type")
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

  @@map("org_relation_type")
}

enum ProblemSeverity {
  CRITICAL
  HIGH
  MEDIUM
  LOW

  @@map("problem_severity")
}

enum ConflictType {
  FACTUAL
  PERSPECTIVE
  SCOPE

  @@map("conflict_type")
}

enum ConflictResolution {
  PENDING
  RESOLVED_VERIFIED
  RESOLVED_BOTH_VALID
  RESOLVED_MERGED
  DISMISSED

  @@map("conflict_resolution")
}

enum ExtractionPassStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED

  @@map("extraction_pass_status")
}
```

**Decisiones de diseno sobre enums:**

1. **Enums vs Strings**: Se usa `enum` para campos con valores finitos y estables que se validan en tiempo de compilacion (OrgEntityType, OrgRelationType, ProblemSeverity). Se usa `String` para campos que podrian evolucionar sin migracion o que tienen demasiados valores posibles (ej: `category` en Problem, `embeddingModel` en InterviewChunk).

2. **PROBLEM e IMPROVEMENT en OrgEntityType**: El Investigador 3 propone que Problem se modele tanto como tabla dedicada (para campos ricos) como nodo del grafo (via OrgEntity). Esto es polimorfismo via OrgEntity: el Problem tiene su propia tabla con campos especificos, Y un OrgEntity correspondiente para participar en el grafo de relaciones. La tabla `ProblemLink` vincula ambos mundos.

3. **No hay enum para `extractionPassType`**: Las 5 pasadas se identifican por nombre string (`"entities_basic"`, `"processes"`, `"problems"`, `"dependencies"`, `"factual_claims"`) porque el numero y tipos de pasadas podrian cambiar sin requerir migracion.

---

#### MODELO: OrgProject

```prisma
/// Proyecto de mejora continua / diagnostico organizacional
model OrgProject {
  id          String           @id @default(uuid())
  name        String
  description String?
  status      OrgProjectStatus @default(DRAFT)
  startDate   DateTime?
  endDate     DateTime?
  /// Configuracion del proyecto (industria, foco, parametros)
  config      Json?
  deletedAt   DateTime?
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt

  tenantId String
  tenant   Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  /// Usuario que creo el proyecto
  createdById String?
  createdBy   User? @relation(fields: [createdById], references: [id], onDelete: SetNull)

  interviews      Interview[]
  orgEntities     OrgEntity[]
  orgRelations    OrgRelation[]
  problems        Problem[]
  improvements    Improvement[]
  factualClaims   FactualClaim[]
  conflictRecords ConflictRecord[]

  @@index([tenantId])
  @@index([tenantId, status])
  @@map("org_projects")
}
```

**Justificacion:**
- `config Json?`: Parametros flexibles del proyecto (industria target, areas a diagnosticar, idioma, etc.) que evolucionaran sin migraciones.
- `createdById` con `onDelete: SetNull`: Si el usuario se elimina, el proyecto no se pierde.
- Relaciones directas a todos los modelos hijos para facilitar cascade y queries.
- El indice `[tenantId, status]` soporta la query mas comun: "listar proyectos activos de mi tenant".

---

#### MODELO: Interview

```prisma
/// Entrevista dentro de un proyecto de diagnostico
model Interview {
  id                   String              @id @default(uuid())
  title                String?
  /// S3 key del archivo de audio original
  audioS3Key           String?
  /// Tipo MIME del audio (audio/mp3, audio/wav, etc.)
  audioMimeType        String?
  /// Duracion del audio en milisegundos
  audioDurationMs      Int?
  /// Texto completo de la transcripcion (con marcadores de speaker)
  transcriptionText    String?
  /// Segmentos JSON de la transcripcion normalizada (TranscriptionResult)
  transcriptionJson    Json?
  transcriptionStatus  TranscriptionStatus @default(PENDING)
  transcriptionProvider TranscriptionProvider?
  /// Fecha en que se realizo la entrevista (no la fecha de upload)
  interviewDate        DateTime?
  /// Resultado consolidado de extraccion (JSON: entities, relations, claims, problems, summary)
  extractionResult     Json?
  /// Status general de procesamiento del pipeline
  processingStatus     String              @default("PENDING")
  /// Mensaje de error si fallo algun paso
  processingError      String?
  deletedAt            DateTime?
  createdAt            DateTime            @default(now())
  updatedAt            DateTime            @updatedAt

  projectId String
  project   OrgProject @relation(fields: [projectId], references: [id], onDelete: Cascade)

  tenantId String

  speakers  InterviewSpeaker[]
  chunks    InterviewChunk[]

  @@index([projectId])
  @@index([tenantId])
  @@index([tenantId, processingStatus])
  @@map("interviews")
}
```

**Justificacion y decisiones criticas:**

1. **`transcriptionText` vs `transcriptionJson`**: Se almacenan AMBOS. El `transcriptionText` es el texto plano concatenado (para full-text search rapido y visualizacion). El `transcriptionJson` es el `TranscriptionResult` completo (segmentos con timestamps, speakers, confidence) para procesamiento programatico. Esto es redundancia intencional: el text es para lectura humana y busqueda, el JSON es para el pipeline.

2. **`extractionResult Json?`**: El resultado consolidado de las 5 pasadas de extraccion se almacena como JSON inmutable. Esto sirve como snapshot de lo que el LLM extrajo, antes de que se reconcilie y normalice en OrgEntity/OrgRelation. Util para debugging, re-procesamiento, y auditoria.

3. **`processingStatus String` (no enum)**: Los estados del pipeline pueden expandirse (ej: `"TRANSCRIBING"`, `"EXTRACTING_PASS_1"`, `"EXTRACTING_PASS_2"`, etc.). Un string permite granularidad sin migraciones.

4. **`tenantId` sin FK directa**: El tenant se hereda del `project.tenantId`. Sin embargo, incluimos `tenantId` como columna desnormalizada para que los queries de aislamiento multi-tenant no requieran JOIN a OrgProject. Este patron es consistente con como Zeru maneja el multi-tenancy (siempre filtra por `tenantId` directamente, nunca por join chain).

5. **`audioS3Key` en lugar de reutilizar Document**: El modelo `Document` existente tiene campos especificos de contabilidad (`category: FACTURA | BOLETA...`) y relaciones a `Conversation` y `JournalEntry`. Contaminar ese modelo con audio de entrevistas romperia la cohesion. Un campo dedicado en Interview es mas limpio.

6. **NO hay FK de Interview a tenantId -> Tenant**: Deliberadamente, la relacion multi-tenant se resuelve via la cadena Interview -> OrgProject -> Tenant. El campo `tenantId` en Interview es un indice desnormalizado para queries rapidos, no una FK. Esto evita duplicar la relacion `Tenant.interviews` (que seria confusa dado que ya existe `Tenant.orgProjects[].interviews`). **Alternativa considerada y descartada:** Agregar FK a Tenant. Razon del descarte: crea ambiguedad sobre quien es el "owner" (Project o Tenant directo) y Prisma requiere nombrar ambas relaciones, lo que genera boilerplate sin valor.

---

#### MODELO: InterviewSpeaker

```prisma
/// Hablante identificado en una entrevista
model InterviewSpeaker {
  id           String  @id @default(uuid())
  /// Label del speaker en la transcripcion (ej: "Speaker_A", "Speaker_B")
  speakerLabel String
  /// Nombre real si se identifica (ej: "Juan Martinez")
  name         String?
  /// Cargo/rol si se identifica (ej: "Jefe de Logistica")
  role         String?
  /// Departamento si se identifica
  department   String?
  /// Si es el entrevistador (no un entrevistado)
  isInterviewer Boolean @default(false)

  interviewId String
  interview   Interview @relation(fields: [interviewId], references: [id], onDelete: Cascade)

  /// Referencia a OrgEntity de tipo PERSON/ROLE si se vinculo al knowledge graph
  personEntityId String?

  chunks InterviewChunk[]

  @@unique([interviewId, speakerLabel])
  @@index([interviewId])
  @@map("interview_speakers")
}
```

**Justificacion:**

1. **`@@unique([interviewId, speakerLabel])`**: Garantiza que no haya duplicados de speaker label dentro de una entrevista. El label ("Speaker_A") viene del STT y es unico por entrevista.

2. **`personEntityId String?` (sin FK a OrgEntity)**: Este campo vincula el speaker a una entidad del knowledge graph. Se implementa sin FK porque: (a) El entity linking puede ocurrir asincronamente, despues de que el KG se construye. (b) El `OrgEntity` puede no existir aun cuando se crea el speaker. (c) La referencia se resuelve en el paso de reconciliacion, no en el momento de la transcripcion. **En una fase posterior, se podria agregar la FK si se necesita integridad referencial estricta.**

3. **`role` y `department` como strings simples**: Estos campos son metadata informativa del speaker que viene de la transcripcion/extraccion. NO son foreign keys a OrgEntity. La vinculacion formal al grafo se hace via `personEntityId`. Esto evita dependencias circulares (InterviewSpeaker -> OrgEntity -> Interview).

---

#### MODELO: InterviewChunk

```prisma
/// Chunk semantico de una entrevista para RAG (embedding + full-text search)
model InterviewChunk {
  id            String  @id @default(uuid())
  /// Texto del chunk
  content       String
  /// Prefijo contextual generado por LLM (tecnica Anthropic Contextual Retrieval)
  contextPrefix String?
  /// Resumen del tema de este chunk (generado por LLM)
  topicSummary  String?
  /// Timestamp de inicio en milisegundos dentro del audio
  startTimeMs   Int?
  /// Timestamp de fin en milisegundos
  endTimeMs     Int?
  /// Numero de orden del chunk dentro de la entrevista
  chunkOrder    Int     @default(0)
  /// Numero de tokens estimado del chunk
  tokenCount    Int?
  /// Modelo de embedding usado (para migracion futura: "text-embedding-3-small", etc.)
  embeddingModel String?

  /// Embedding pgvector(1536) para busqueda semantica — gestionado via raw SQL
  embedding     Unsupported("vector(1536)")?
  /// tsvector para busqueda BM25 — gestionado via raw SQL trigger
  tsv           Unsupported("tsvector")?

  interviewId String
  interview   Interview @relation(fields: [interviewId], references: [id], onDelete: Cascade)

  /// Speaker principal de este chunk (puede haber varios turnos, pero uno dominante)
  speakerId   String?
  speaker     InterviewSpeaker? @relation(fields: [speakerId], references: [id], onDelete: SetNull)

  /// Referencia al chunk padre para parent-document retrieval
  parentChunkId String?

  tenantId String

  @@index([interviewId])
  @@index([tenantId])
  @@index([tenantId, interviewId])
  @@map("interview_chunks")
}
```

**Decisiones criticas para be-rag:**

1. **`embedding Unsupported("vector(1536)")?`**: Sigue exactamente el patron de `Memory`. El embedding se gestiona via raw SQL (INSERT con `::vector`, query con `<=>` operador). Prisma no genera el indice HNSW; se crea en la migracion SQL manual:
   ```sql
   CREATE INDEX idx_interview_chunks_embedding_hnsw ON interview_chunks
   USING hnsw (embedding vector_cosine_ops)
   WITH (m = 16, ef_construction = 200);
   ```

2. **`tsv Unsupported("tsvector")?`**: El tsvector para BM25 se gestiona via un trigger de PostgreSQL que actualiza automaticamente cuando `content` cambia:
   ```sql
   -- Trigger para mantener tsvector actualizado
   CREATE FUNCTION interview_chunks_tsv_trigger() RETURNS trigger AS $$
   BEGIN
     NEW.tsv := to_tsvector('spanish', COALESCE(NEW.content, ''));
     RETURN NEW;
   END
   $$ LANGUAGE plpgsql;

   CREATE TRIGGER tsvector_update BEFORE INSERT OR UPDATE OF content
   ON interview_chunks FOR EACH ROW EXECUTE FUNCTION interview_chunks_tsv_trigger();

   -- Indice GIN para busqueda full-text
   CREATE INDEX idx_interview_chunks_tsv ON interview_chunks USING gin(tsv);
   ```

3. **`embeddingModel String?`**: Critico para migracion futura. Cuando migremos de text-embedding-3-small a Cohere embed-v4 o text-embedding-3-large, necesitamos saber que modelo genero cada embedding para re-embeddir selectivamente. Sin este campo, tendriamos que re-embeddir TODO.

4. **`parentChunkId String?` (sin FK self-referential)**: Para parent-document retrieval. Se mantiene como string simple en vez de FK self-referential porque: (a) El chunk padre es la entrevista completa o un chunk de nivel superior, y la relacion es de lectura, no de integridad. (b) FK self-referential en Prisma agrega complejidad (requiere nombrar relacion doble). Si se necesita integridad futura, se agrega.

5. **`tenantId` desnormalizado (sin FK)**: Mismo patron que Interview. El tenant se hereda del chain chunk -> interview -> project -> tenant, pero `tenantId` se desnormaliza como columna indexada para filtrado multi-tenant directo en queries de RAG (que deben ser extremadamente rapidos).

6. **NO hay `deletedAt`**: Los chunks son datos derivados. Si se re-procesa una entrevista, se eliminan (DELETE hard) y se regeneran. No tiene sentido soft-delete de datos derivados.

---

#### MODELO: OrgEntity

```prisma
/// Nodo del knowledge graph organizacional
model OrgEntity {
  id          String        @id @default(uuid())
  type        OrgEntityType
  name        String
  description String?
  /// Atributos flexibles por tipo (frecuencia, duracion, volumen, responsable, etc.)
  metadata    Json?
  /// Estado: ACTIVE (vigente), DEPRECATED (reemplazado), PROPOSED (sugerido, no confirmado)
  status      String        @default("ACTIVE")
  /// Aliases conocidos de esta entidad (para entity linking)
  aliases     String[]

  // --- SCD Type 2: Versionado temporal ---
  /// Fecha desde la cual esta version es valida
  validFrom   DateTime      @default(now())
  /// Fecha hasta la cual esta version es valida (null = version vigente)
  validTo     DateTime?
  /// Numero de version (1, 2, 3...)
  version     Int           @default(1)
  /// ID de la version original (para vincular todas las versiones de una entidad)
  originalEntityId String?

  // --- Procedencia y confianza ---
  /// Score de confianza 0.0-1.0 (HECHO >= 0.8, INFERENCIA 0.4-0.8, HIPOTESIS < 0.4)
  confidence  Float         @default(0.5)
  /// ID del chunk de entrevista que origino esta entidad (trazabilidad)
  sourceChunkIds String[]
  /// ID de la entrevista de origen
  sourceInterviewId String?

  /// Embedding pgvector(1536) para busqueda semantica — gestionado via raw SQL
  embedding   Unsupported("vector(1536)")?

  deletedAt   DateTime?
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  tenantId  String
  projectId String
  project   OrgProject @relation(fields: [projectId], references: [id], onDelete: Cascade)

  relationsFrom  OrgRelation[] @relation("FromEntity")
  relationsTo    OrgRelation[] @relation("ToEntity")
  problemLinks   ProblemLink[]

  @@index([tenantId, projectId, type])
  @@index([tenantId, type, status])
  @@index([tenantId, projectId, type, validTo])
  @@map("org_entities")
}
```

**Decisiones de diseno criticas:**

1. **SCD Type 2 (`validFrom`/`validTo`/`version`/`originalEntityId`)**:
   - Cuando una entidad cambia (ej: un rol se reestructura), se cierra la version actual (`validTo = now()`) y se crea una nueva version con `version = prev + 1` y `originalEntityId = id de la primera version`.
   - Queries de "estado actual": `WHERE validTo IS NULL`.
   - Queries point-in-time: `WHERE validFrom <= @date AND (validTo IS NULL OR validTo > @date)`.
   - **Trade-off reconocido**: Cada query sobre estado actual necesita el filtro `validTo IS NULL`. Esto es overhead constante pero aceptable para la trazabilidad que aporta.
   - **Alternativa descartada**: Tabla de historia separada (`OrgEntityHistory`). Razon: pierde la elegancia de queries temporales unificadas y duplica logica.

2. **`aliases String[]`**: Array de PostgreSQL para almacenar todas las formas en que una entidad fue mencionada en entrevistas. Critico para entity linking inter-entrevista. Ejemplo: `["SAP", "el ERP", "el sistema de gestion", "SAP Business One"]`.

3. **`sourceChunkIds String[]`**: Array de IDs de chunks de entrevista que evidencian esta entidad. Se usa array en vez de tabla de enlace porque: (a) Es write-once, read-many (se escribe al extraer, se lee para mostrar evidencia). (b) No necesitamos queries invertidos frecuentes ("dame todas las entidades de este chunk" — eso lo resuelve el `extractionResult` de Interview).

4. **`status String` (no enum)**: ACTIVE, DEPRECATED, PROPOSED. String en vez de enum porque podrian aparecer mas estados (MERGED, DISPUTED, etc.) sin requerir migracion.

5. **`metadata Json?`**: Campos flexibles por tipo de entidad:
   - PROCESS: `{ frequency: "diario", estimatedDuration: "3 dias", steps: 8 }`
   - SYSTEM: `{ vendor: "SAP", type: "ERP", version: "Business One 10" }`
   - ROLE: `{ headcount: 3, seniority: "senior" }`
   - Esto evita tener tablas separadas para cada tipo de entidad (OrgProcess, OrgSystem, OrgRole...) que serinn el enfoque relacional puro pero multiplicarian la complejidad del schema por N.

6. **`embedding Unsupported("vector(1536)")?`**: Para busqueda semantica sobre el grafo. Se embede `name + " - " + description + " | " + JSON.stringify(metadata_textual)` (segun consenso del equipo). Indice HNSW en migracion SQL.

7. **Indice `[tenantId, projectId, type, validTo]`**: Soporta la query mas critica: "dame todas las entidades vigentes de tipo PROCESS en este proyecto" = `WHERE tenantId=? AND projectId=? AND type='PROCESS' AND validTo IS NULL`.

---

#### MODELO: OrgRelation

```prisma
/// Arista del knowledge graph organizacional
model OrgRelation {
  id          String          @id @default(uuid())
  type        OrgRelationType
  /// Descripcion textual de la relacion
  description String?
  /// Atributos flexibles (peso, frecuencia, volumen de interaccion, etc.)
  metadata    Json?
  /// Peso/fuerza de la relacion (0.0-1.0)
  weight      Float           @default(1.0)

  fromEntityId String
  fromEntity   OrgEntity @relation("FromEntity", fields: [fromEntityId], references: [id], onDelete: Cascade)

  toEntityId   String
  toEntity     OrgEntity @relation("ToEntity", fields: [toEntityId], references: [id], onDelete: Cascade)

  // --- Versionado y procedencia ---
  validFrom   DateTime        @default(now())
  validTo     DateTime?
  confidence  Float           @default(0.5)
  sourceInterviewId String?
  sourceChunkId     String?

  tenantId  String
  projectId String
  project   OrgProject @relation(fields: [projectId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([tenantId, projectId])
  @@index([fromEntityId])
  @@index([toEntityId])
  @@index([type])
  @@index([tenantId, type, validTo])
  @@map("org_relations")
}
```

**Decisiones:**

1. **`onDelete: Cascade` en ambos lados (fromEntity, toEntity)**: Si se elimina una entidad, sus relaciones se eliminan automaticamente. Esto es correcto porque una relacion sin ambos extremos no tiene sentido.

2. **`weight Float @default(1.0)`**: Permite ponderar relaciones. Ejemplo: un DEPENDS_ON con weight 0.9 (dependencia fuerte) vs 0.3 (dependencia debil/ocasional).

3. **`sourceChunkId String?` (singular, no array)**: A diferencia de OrgEntity (que puede tener multiples sources), una relacion tipicamente se evidencia por un chunk especifico. Si multiples entrevistas confirman la misma relacion, se crean multiples instancias de OrgRelation con diferentes `sourceInterviewId` que luego se reconcilian (o se mantiene la de mayor confidence).

4. **No hay `@@unique` en `[fromEntityId, toEntityId, type]`**: Deliberadamente. La misma relacion puede existir multiples veces con diferentes sourceInterviewId (evidencia de diferentes entrevistas) o con diferentes validFrom/validTo (versiones temporales). La reconciliacion maneja duplicados a nivel de aplicacion.

5. **Indice `[tenantId, type, validTo]`**: Soporta queries de grafo filtrados por tipo de relacion y estado vigente.

---

#### MODELO: Problem

```prisma
/// Problema/ineficiencia detectado en la organizacion
model Problem {
  id          String          @id @default(uuid())
  title       String
  description String
  severity    ProblemSeverity
  /// Categoria del problema (bottleneck, redundancy, manual_work, knowledge_gap, etc.)
  category    String?
  /// Citas textuales de entrevistas que evidencian el problema
  evidence    Json?
  /// Score de confianza 0.0-1.0
  confidence  Float           @default(0.5)
  /// ID de la entrevista de origen
  sourceInterviewId String?
  /// RICE scoring (calculado por LLM + proxies del grafo)
  riceScore   Json?

  deletedAt DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tenantId  String
  projectId String
  project   OrgProject @relation(fields: [projectId], references: [id], onDelete: Cascade)

  affectedEntities ProblemLink[]
  improvements     Improvement[]

  @@index([tenantId, projectId])
  @@index([severity])
  @@index([tenantId, projectId, severity])
  @@map("problems")
}
```

**Decisiones:**

1. **Problem como tabla separada (no solo OrgEntity)**: El Problem tiene campos ricos especificos (severity, evidence, riceScore) que no caben en el `metadata Json?` generico de OrgEntity. Sin embargo, cada Problem TAMBIEN tiene un OrgEntity correspondiente de tipo `PROBLEM` para participar en el grafo de relaciones. La vinculacion se hace via la tabla `ProblemLink`.

2. **`evidence Json?`**: Array de citas textuales estructuradas: `[{ text: "...", interviewId: "...", speakerName: "...", timestamp: "..." }]`. JSON porque el numero y estructura de las evidencias es variable.

3. **`riceScore Json?`**: `{ reach: 8, impact: 7, confidence: 6, effort: 4, total: 84, justification: "..." }`. JSON porque el scoring puede evolucionar (agregar dimensiones, cambiar formulas).

4. **`category String?`**: No enum porque las categorias de problemas son emergentes (el LLM las identifica) y domain-specific. Ejemplos: "bottleneck", "redundancy", "manual_work", "knowledge_gap", "communication_failure", "system_limitation".

---

#### MODELO: ProblemLink

```prisma
/// Relacion polimorfica entre Problem y OrgEntity (que entidades afecta un problema)
model ProblemLink {
  id                String  @id @default(uuid())
  /// Como impacta especificamente a esta entidad
  impactDescription String?

  problemId String
  problem   Problem   @relation(fields: [problemId], references: [id], onDelete: Cascade)

  entityId String
  entity   OrgEntity @relation(fields: [entityId], references: [id], onDelete: Cascade)

  @@unique([problemId, entityId])
  @@index([problemId])
  @@index([entityId])
  @@map("problem_links")
}
```

**Justificacion:**
- Resuelve el polimorfismo de "un problema afecta a Procesos, Roles, Departamentos, Sistemas" sin campos nullable ni discriminadores.
- OrgEntity ya tiene `type` que indica si es PROCESS, ROLE, etc. El query "que problemas afectan al proceso X?" es: `ProblemLink WHERE entityId = X -> Problem`.
- `@@unique([problemId, entityId])` evita vinculaciones duplicadas.

---

#### MODELO: Improvement

```prisma
/// Mejora propuesta para resolver problemas detectados
model Improvement {
  id          String  @id @default(uuid())
  title       String
  description String
  /// Tipo: QUICK_WIN, STRATEGIC, FILL_IN (segun matriz esfuerzo-impacto)
  type        String?
  /// Estimacion de esfuerzo (BAJO, MEDIO, ALTO o en horas/dias)
  effort      String?
  /// Impacto estimado (BAJO, MEDIO, ALTO)
  impact      String?
  /// Prioridad calculada (RICE score u otro)
  priority    Int?
  /// Estado de implementacion
  status      String  @default("PROPOSED")

  deletedAt DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tenantId  String
  projectId String
  project   OrgProject @relation(fields: [projectId], references: [id], onDelete: Cascade)

  /// Problema que esta mejora busca resolver
  problemId String
  problem   Problem @relation(fields: [problemId], references: [id], onDelete: Cascade)

  @@index([tenantId, projectId])
  @@index([problemId])
  @@map("improvements")
}
```

**Decisiones:**
- Improvement es 1:N con Problem (una mejora resuelve un problema). Si una mejora resuelve multiples problemas, se crean multiples Improvement records (uno por problema) o se usa la tabla ProblemLink inversa. La relacion 1:N es mas simple para el MVP.
- `type`, `effort`, `impact`, `status` como strings: evolucionaran con el uso. No queremos migraciones por cada nuevo tipo de mejora.

---

#### MODELO: FactualClaim

```prisma
/// Claim factico extraido de una entrevista con score de confianza
model FactualClaim {
  id         String @id @default(uuid())
  /// Sujeto del claim (ej: "Proceso de Despacho")
  subject    String
  /// Predicado del claim (ej: "duracion_promedio", "tiene_pasos", "es_responsable_de")
  predicate  String
  /// Objeto del claim (ej: "3 dias", "8", "Juan Martinez")
  object     String
  /// QUANTITATIVE (numerico, comparable), QUALITATIVE (opinion), RELATIONAL (modelable como OrgRelation)
  claimType  String
  /// Score de confianza 0.0-1.0
  confidence Float  @default(0.5)
  /// Cita textual de la entrevista
  evidence   String?
  /// ID de la entrevista de origen
  sourceInterviewId String?
  /// ID del chunk especifico
  sourceChunkId String?

  createdAt DateTime @default(now())

  tenantId  String
  projectId String
  project   OrgProject @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([tenantId, projectId])
  @@index([subject])
  @@index([tenantId, projectId, subject, predicate])
  @@map("factual_claims")
}
```

**Decisiones:**

1. **Modelo de tuplas (sujeto, predicado, objeto)**: Alineado con la propuesta del Investigador 3. Es la representacion mas atomica de un hecho. Ejemplo: `("Proceso de Despacho", "duracion_promedio", "3 dias")`.

2. **`claimType String`**: Tres tipos segun consenso con Investigador 2:
   - `QUANTITATIVE`: Datos numericos comparables. Contradiccion detectable automaticamente (ej: "3 dias" vs "7 dias").
   - `QUALITATIVE`: Opiniones subjetivas. No son directamente contradictorias.
   - `RELATIONAL`: Modelables como OrgRelation ademas de claim.

3. **Indice `[tenantId, projectId, subject, predicate]`**: Soporta la query de deteccion de contradicciones: "dame todos los claims sobre el mismo sujeto+predicado de diferentes entrevistas" para comparar.

4. **No hay `deletedAt` ni `updatedAt`**: Los claims son inmutables (datos extraidos). Si se re-procesa la entrevista, se eliminan y regeneran.

---

#### MODELO: ConflictRecord

```prisma
/// Contradiccion detectada entre claims de diferentes entrevistas
model ConflictRecord {
  id          String             @id @default(uuid())
  type        ConflictType
  /// Descripcion de la contradiccion
  description String
  /// Claims involucrados en el conflicto (IDs o datos inline)
  claimsData  Json
  /// Entrevistas involucradas
  interviewIds String[]
  /// Resolucion del conflicto
  resolution   ConflictResolution @default(PENDING)
  /// Justificacion de la resolucion (texto del consultor o del LLM)
  resolutionNotes String?
  resolvedAt      DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tenantId  String
  projectId String
  project   OrgProject @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([tenantId, projectId])
  @@index([tenantId, projectId, resolution])
  @@map("conflict_records")
}
```

**Decisiones:**

1. **`claimsData Json`**: Los claims involucrados se almacenan como JSON inline (con IDs de referencia a FactualClaim + texto para visualizacion rapida) porque: (a) Un conflicto puede involucrar N claims. (b) Los claims pueden eliminarse si se re-procesa, pero el conflicto debe persistir con su evidencia.

2. **`interviewIds String[]`**: Array de IDs de entrevistas involucradas, para navegar rapidamente a las fuentes.

3. **Enums para type y resolution**: Estos SI son estables y finitos (3 tipos, 5 resoluciones). Enums aportan validacion sin costo de flexibilidad.

---

### 1.3 Relaciones al Modelo Tenant (cambios requeridos)

El modelo `Tenant` necesita una nueva relacion:

```prisma
model Tenant {
  // ... campos existentes ...
  orgProjects OrgProject[]
}
```

El modelo `User` necesita:

```prisma
model User {
  // ... campos existentes ...
  orgProjectsCreated OrgProject[]
}
```

---

### 1.4 Migraciones: Orden y Dependencias

#### Orden de migraciones propuesto

```
Migration 1: org_intelligence_enums_and_project
  - Crear enums: OrgProjectStatus, TranscriptionStatus, TranscriptionProvider,
    OrgEntityType, OrgRelationType, ProblemSeverity, ConflictType, ConflictResolution
  - Crear tabla: org_projects

Migration 2: interviews_and_speakers
  - Crear tabla: interviews
  - Crear tabla: interview_speakers
  Depende de: Migration 1 (org_projects FK)

Migration 3: interview_chunks_with_vector
  - Crear tabla: interview_chunks
  - Crear extension pgvector (IF NOT EXISTS — ya existe de Memory)
  - Crear HNSW index en interview_chunks.embedding
  - Crear trigger + GIN index para tsvector en interview_chunks
  Depende de: Migration 2 (interviews FK, interview_speakers FK)
  NOTA: Esta migracion tiene SQL manual (no auto-generada por Prisma)

Migration 4: knowledge_graph_core
  - Crear tabla: org_entities
  - Crear tabla: org_relations
  - Crear HNSW index en org_entities.embedding
  Depende de: Migration 1 (org_projects FK)
  NOTA: SQL manual para pgvector index

Migration 5: problems_and_improvements
  - Crear tabla: problems
  - Crear tabla: problem_links
  - Crear tabla: improvements
  Depende de: Migration 4 (org_entities FK)

Migration 6: claims_and_conflicts
  - Crear tabla: factual_claims
  - Crear tabla: conflict_records
  Depende de: Migration 1 (org_projects FK)
```

#### Dependencias criticas

```
Migration 1 (enums + project)
    |
    +--- Migration 2 (interviews)
    |       |
    |       +--- Migration 3 (chunks + vector) [SQL manual]
    |
    +--- Migration 4 (KG core) [SQL manual]
    |       |
    |       +--- Migration 5 (problems)
    |
    +--- Migration 6 (claims + conflicts)
```

Las migraciones 2, 4 y 6 son independientes entre si y pueden desarrollarse en paralelo. La migracion 3 depende de 2, y la 5 depende de 4.

#### Migraciones SQL manuales requeridas

Las migraciones 3 y 4 requieren SQL manual para:
1. Crear indices HNSW para columnas de embedding
2. Crear triggers para mantener tsvector actualizado
3. Crear indices GIN para tsvector

Estas se agregan al archivo `migration.sql` generado por `prisma migrate dev` como sentencias adicionales, siguiendo el patron establecido en `20260224100000_add_memory/migration.sql`.

---

### 1.5 Consideraciones Tecnicas Adicionales

#### Indices a crear via raw SQL (no Prisma)

```sql
-- InterviewChunk: HNSW para busqueda vectorial
CREATE INDEX idx_interview_chunks_embedding_hnsw ON interview_chunks
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 200);

-- InterviewChunk: GIN para full-text search
CREATE INDEX idx_interview_chunks_tsv ON interview_chunks USING gin(tsv);

-- InterviewChunk: tsvector trigger
CREATE FUNCTION interview_chunks_tsv_trigger() RETURNS trigger AS $$
BEGIN
  NEW.tsv := to_tsvector('spanish', COALESCE(NEW.content, ''));
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER tsvector_update BEFORE INSERT OR UPDATE OF content
ON interview_chunks FOR EACH ROW EXECUTE FUNCTION interview_chunks_tsv_trigger();

-- OrgEntity: HNSW para busqueda semantica sobre el grafo
CREATE INDEX idx_org_entities_embedding_hnsw ON org_entities
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 200);
```

#### Idioma del tsvector

Se usa `'spanish'` como configuracion del tsvector porque el consenso del equipo indica que los usuarios hablan espanol y las entrevistas seran en espanol. Si se necesita soporte multi-idioma futuro, se puede agregar una columna `language` al InterviewChunk y usar `to_tsvector(language, content)` dinamicamente.

**Alternativa considerada**: `'simple'` (sin stemming ni stopwords). Descartada porque el stemming en espanol mejora significativamente el recall (ej: "procesos" y "proceso" matchean).

#### Performance del tsvector trigger

El trigger `BEFORE INSERT OR UPDATE OF content` es eficiente porque:
1. Solo se ejecuta cuando `content` cambia (no en updates de otros campos).
2. `to_tsvector` es una operacion in-process de PostgreSQL, sin I/O externo.
3. El costo es negligible comparado con la generacion de embeddings (que SI es asincrona).

#### Tamano estimado de datos

Para un proyecto tipico (15 entrevistas de 75 min):
- InterviewChunk: ~15 entrevistas x ~30 chunks/entrevista = ~450 rows
- OrgEntity: ~50-200 entidades (roles, procesos, sistemas, etc.)
- OrgRelation: ~100-500 relaciones
- FactualClaim: ~200-600 claims
- Embedding storage: 450 chunks x 1536 dims x 4 bytes = ~2.7 MB (trivial)

PostgreSQL maneja este volumen sin ningun problema. Incluso con 100 proyectos, estamos en decenas de miles de rows -- ordenes de magnitud por debajo de cualquier limite.

---

### 1.6 Mensajes para Otros Miembros del Equipo

#### Para be-pipeline (Pipeline de Procesamiento):

**Como se almacenan transcripciones y resultados de extraccion:**

1. **Audio**: Se sube a S3 y el key se guarda en `Interview.audioS3Key`. Mime type y duracion en `audioMimeType` y `audioDurationMs`.

2. **Transcripcion raw**: El texto plano va en `Interview.transcriptionText`. El JSON completo (`TranscriptionResult` con segmentos, timestamps, speakers) va en `Interview.transcriptionJson`. El status se trackea en `transcriptionStatus` (PENDING -> PROCESSING -> COMPLETED/FAILED).

3. **Speakers**: Cada speaker identificado por el STT se registra en `InterviewSpeaker` con su label, nombre (si se identifica), rol y departamento. La relacion al knowledge graph se hace via `personEntityId`.

4. **Resultado de extraccion**: El JSON consolidado de las 5 pasadas va en `Interview.extractionResult`. Este es el snapshot inmutable de lo que el LLM extrajo. Los datos normalizados se persisten en `OrgEntity`, `OrgRelation`, `Problem`, `FactualClaim`.

5. **Progreso del pipeline**: `Interview.processingStatus` (string) puede tomar valores granulares como `"TRANSCRIBING"`, `"EXTRACTING_PASS_1"`, `"EXTRACTING_PASS_3"`, `"RECONCILING"`, `"COMPLETED"`, `"FAILED"`. Al ser string, se puede expandir sin migraciones.

6. **Tracking de costos**: Cada llamada a la API (STT, cada pasada de extraccion, embeddings) debe crear un `AiUsageLog` con `feature` apropiado (ej: `"org-transcription"`, `"org-extraction-pass-1"`, `"org-embedding"`).

**Punto critico**: Los chunks (`InterviewChunk`) son generados DESPUES de la transcripcion pero ANTES de la extraccion. El flujo es: Audio -> Transcripcion -> Chunking semantico -> Embedding de chunks -> Extraccion multi-pasada -> Persistencia en KG. Los chunks son input del RAG; la extraccion es input del knowledge graph.

#### Para be-rag (RAG e Indexacion):

**Como se indexan embeddings y tsvector en los chunks:**

1. **Embedding**: `InterviewChunk.embedding` es `Unsupported("vector(1536)")`. Se gestiona via raw SQL identico al patron de `Memory`. El indice HNSW se crea en la migracion SQL manual con parametros `m=16, ef_construction=200`.

2. **tsvector para BM25**: `InterviewChunk.tsv` es `Unsupported("tsvector")`. Se mantiene automaticamente via trigger de PostgreSQL (`to_tsvector('spanish', content)`). El indice GIN se crea en la migracion.

3. **Hybrid search**: La query de hybrid search (BM25 + vector con RRF) puede ejecutarse en una sola query SQL como se describe en el documento de consenso. Los campos necesarios estan en la misma tabla (`embedding` para vector, `tsv` para BM25).

4. **Filtrado multi-tenant**: `InterviewChunk.tenantId` es una columna desnormalizada (no FK) con indice. Todos los queries de RAG DEBEN filtrar por `tenantId` para aislamiento.

5. **Embedding de entidades**: `OrgEntity.embedding` sigue el mismo patron. Se embede `name + " - " + description + " | " + JSON.stringify(metadata)`. Indice HNSW en migracion SQL.

6. **`embeddingModel` en InterviewChunk**: Campo string que registra que modelo genero el embedding. Critico para migracion futura de modelo de embedding sin re-embeddir todo de golpe.

7. **Parent-document retrieval**: `InterviewChunk.parentChunkId` permite navegar al chunk padre. Para expandir contexto: query el chunk + query su parent si el LLM lo necesita.

**Pregunta para ti**: El Investigador 1 propone contextual retrieval (tecnica de Anthropic) con un `contextPrefix` prepended al chunk antes de embedding. He incluido `InterviewChunk.contextPrefix` para esto. La pregunta es: se embede `contextPrefix + content` concatenado, o se embede solo `content` y se usa `contextPrefix` solo para augmentar el prompt? Esto afecta como se genera y almacena el embedding.

#### Para be-api (Endpoints REST):

**Como se organizan los modelos para los endpoints:**

1. **OrgProject** es la raiz. CRUD: `POST/GET/PATCH/DELETE /org-projects`. Scoped a `tenantId`.

2. **Interview** es hijo de OrgProject. CRUD: `POST/GET/PATCH/DELETE /org-projects/:projectId/interviews`. El upload de audio es un endpoint especial: `POST /org-projects/:projectId/interviews/:id/upload-audio` (multipart).

3. **InterviewChunk** es read-only desde la API (generado por el pipeline). `GET /org-projects/:projectId/interviews/:id/chunks`. El endpoint de busqueda RAG: `POST /org-intelligence/search` con body `{ query, projectId, filters }`.

4. **OrgEntity/OrgRelation** forman el knowledge graph. Endpoints:
   - `GET /org-projects/:projectId/entities?type=PROCESS&status=ACTIVE`
   - `GET /org-projects/:projectId/entities/:id/relations`
   - `GET /org-projects/:projectId/graph` (grafo completo para visualizacion)
   - Las entidades se generan por el pipeline pero pueden editarse manualmente.

5. **Problem/Improvement**: CRUD anidado bajo proyecto.
   - `GET /org-projects/:projectId/problems?severity=CRITICAL`
   - `GET /org-projects/:projectId/problems/:id/improvements`

6. **ConflictRecord**: Read + resolve.
   - `GET /org-projects/:projectId/conflicts?resolution=PENDING`
   - `PATCH /org-projects/:projectId/conflicts/:id/resolve`

7. **Patron de modulos NestJS sugerido**:
   ```
   src/org-intelligence/
     org-intelligence.module.ts
     org-project/
       org-project.controller.ts
       org-project.service.ts
     interview/
       interview.controller.ts
       interview.service.ts
       interview-processing.job.ts  // BullMQ job
     knowledge-graph/
       knowledge-graph.controller.ts
       knowledge-graph.service.ts
     problem/
       problem.controller.ts
       problem.service.ts
     search/
       org-search.controller.ts
       org-search.service.ts  // RAG hybrid search
   ```

**Multi-tenancy**: Todos los queries deben filtrar por `tenantId`. El schema desnormaliza `tenantId` en tablas hijas (Interview, InterviewChunk, OrgEntity, etc.) para que los endpoints no necesiten JOINs a OrgProject para verificar acceso.

---

## 2. Pipeline de Procesamiento (Backend-2: be-pipeline)

### 2.1 Analisis de Servicios Existentes

#### Infraestructura reutilizable

Tras analizar el codebase de Zeru, identifico los siguientes componentes directamente reutilizables para el pipeline de procesamiento de entrevistas:

**OpenAI SDK y API keys por tenant:**
- `AiConfigService` (`apps/api/src/modules/ai/services/ai-config.service.ts`) gestiona API keys encriptadas por tenant via `getDecryptedApiKey(tenantId)`. Cada tenant tiene su propia key OpenAI almacenada en `AiProviderConfig` (tabla `ai_provider_configs`).
- `MemoryService` ya instancia clientes OpenAI por API key con cache (`openaiClientCache = new Map<string, OpenAI>()`). Este patron se replica para el pipeline de extraccion.
- La key de OpenAI del tenant se usa para: embeddings (`text-embedding-3-small`), chat (GPT-5.4 via Responses API), y sera usada tambien para las pasadas de extraccion con Structured Outputs.

**AiUsageLog (obligatorio por CLAUDE.md):**
- Modelo Prisma `AiUsageLog` en `apps/api/prisma/schema.prisma` con campos: `provider`, `model`, `feature`, `inputTokens`, `outputTokens`, `totalTokens`, `cachedTokens`, `compacted`, `tenantId`, `conversationId`.
- El patron de logging ya esta establecido en `ChatService` (lineas ~674 y ~938): despues de cada respuesta de OpenAI, se crea un registro con `prisma.aiUsageLog.create()`.
- Para el pipeline de extraccion, el campo `feature` sera la clave de diferenciacion: `transcription`, `extraction-p1` ... `extraction-p5`, `summarization`, `coreference-resolution`, `embedding-generation`.
- **Nota para be-schema**: `conversationId` es nullable en AiUsageLog. Para el pipeline de entrevistas NO hay conversacion de chat. Propongo agregar un campo `interviewId` (nullable) al modelo AiUsageLog, o bien un generico `referenceId`+`referenceType` que cubra ambos casos.

**BackgroundQueueService (`apps/api/src/modules/ai/services/background-queue.service.ts`):**
- Cola in-memory con concurrencia max 3, retries con backoff exponencial (base 1s, factor 4x), max 3 reintentos por defecto.
- Interfaz simple: `enqueue({ name, fn, maxRetries })`.
- **Limitacion critica**: Cola in-memory, no persistente. Si el proceso de Node.js se reinicia durante el procesamiento, los jobs en curso se pierden. Para el MVP esto es aceptable si mantenemos el estado del pipeline en la base de datos (ver seccion 2.5). Para produccion, se necesita BullMQ con Redis.
- No tiene concepto de "pipeline" ni dependencias entre jobs. Cada job es independiente. El pipeline de entrevistas requiere orquestacion secuencial adicional.

**S3Service (`apps/api/src/modules/files/s3.service.ts`):**
- Upload generico: `upload(tenantId, key, buffer, mimeType)`.
- Download: `download(tenantId, key)` retorna `{ buffer, contentType }`.
- Presigned URLs: `getPresignedUrl(tenantId, key, expiresIn)`.
- Key builder: `S3Service.buildKey(tenantId, docId, filename)` genera `tenants/{tenantId}/documents/{docId}/{filename}`.
- **Para audio de entrevistas**: Usar key pattern dedicado `tenants/{tenantId}/interviews/{interviewId}/audio/{filename}` para separar audio de documentos contables.

**Embeddings existentes:**
- `MemoryService` usa `text-embedding-3-small` (1536 dims) con timeout de 15s.
- Formato de vector: `[${embedding.join(',')}]` para queries raw SQL con pgvector.
- El embedding se genera en background via `BackgroundQueueService`.
- Mismo patron se aplica para embeddings de chunks de entrevista y entidades del KG.

**Zod y DTOs:**
- `apps/api/src/modules/ai/dto/index.ts` ya usa Zod para validacion. Los schemas de extraccion multi-pasada se definen con Zod y se convierten via `zodResponseFormat()` para Structured Outputs de OpenAI.

#### Brechas identificadas

| Brecha | Impacto | Solucion propuesta |
|--------|---------|-------------------|
| No hay soporte Deepgram | No podemos transcribir con diarizacion nativa | Nuevo `DeepgramConfigService` + modelo Prisma para API key |
| Cola no persistente | Perdida de jobs en reinicio | Estado del pipeline en DB + recovery en bootstrap |
| No hay pipeline orquestado | Jobs independientes, sin secuencia | Nuevo `InterviewPipelineOrchestrator` |
| AiUsageLog sin interviewId | No podemos atribuir costos a entrevistas | Agregar campo (ver nota para be-schema) |
| No hay chunking semantico | Solo memorias atomicas | Nuevo modelo `InterviewChunk` + servicio de chunking |
| No hay Structured Outputs | Chat usa streaming con tools, no extraccion estructurada | Nuevo `ExtractionPipelineService` usando `zodResponseFormat()` |

---

### 2.2 Diseno del Pipeline Completo

#### Diagrama del pipeline

```
[Audio MP3/WAV/M4A]
    |
    v
[PASO 1: Upload a S3 + Registro en DB]
    Estado: UPLOADED
    - Validar formato y tamano (max ~500 MB para 90 min WAV)
    - Upload a S3: tenants/{tenantId}/interviews/{interviewId}/audio/{filename}
    - Crear registro Interview con status=UPLOADED
    - Retornar interviewId al cliente inmediatamente
    |
    v
[PASO 2: Transcripcion + Diarizacion] (ASYNC)
    Estado: TRANSCRIBING
    - Provider primario: Deepgram Nova-3 (pre-recorded, diarize=true)
    - Fallback: OpenAI gpt-4o-transcribe-diarize (si Deepgram falla o no configurado)
    - Output: TranscriptionResult (formato unificado)
    - Guardar transcripcion completa en DB (Interview.transcriptionJson)
    - Guardar texto plano en DB (Interview.transcriptionText)
    - AiUsageLog: feature="transcription", provider="DEEPGRAM" o "OPENAI"
    |
    v
[PASO 3: Post-procesamiento de transcripcion] (ASYNC)
    Estado: POST_PROCESSING
    - Limpiar artefactos: fillers (um, eh, este...), repeticiones tartamudeo
    - Normalizar speakers: Speaker_0 -> labels consistentes
    - Identificar speakers por nombre si se presentan en la entrevista
    - Segmentar por preguntas/temas (heuristicamente + LLM ligero GPT-5.4-mini)
    - Output: TranscriptionResult con segments limpios y speakers identificados
    - AiUsageLog: feature="post-processing"
    |
    v
[PASO 4: Extraccion multi-pasada] (ASYNC, secuencial)
    Estado: EXTRACTING
    - 5 pasadas con Structured Outputs + Zod schemas
    - Cada pasada recibe transcripcion completa + outputs de pasadas anteriores
    - Detallado en seccion 2.3
    - AiUsageLog por CADA pasada: feature="extraction-p1" ... "extraction-p5"
    |
    v
[PASO 5: Resolucion de correferencias] (ASYNC)
    Estado: RESOLVING_COREFERENCES
    - Unificar aliases: "Juan", "el jefe de logistica", "el gerente" -> entidad unica
    - Entity linking por embedding similarity con KG existente
    - Threshold: >0.85 merge auto, 0.7-0.85 sugerir, <0.7 nueva entidad
    - AiUsageLog: feature="coreference-resolution"
    |
    v
[PASO 6: Generacion de resumenes multi-nivel] (ASYNC)
    Estado: SUMMARIZING
    - Resumen por pregunta/tema (GPT-5.4-mini)
    - Resumen ejecutivo de la entrevista (GPT-5.4-mini)
    - AiUsageLog: feature="summarization"
    |
    v
[PASO 7: Chunking multi-capa para RAG] (ASYNC)
    Estado: CHUNKING
    - Capa 1: Speaker-turn chunks (unidad atomica)
    - Capa 2: Agrupacion semantica (3-8 turnos por tema, 500-1000 tokens)
    - Capa 3: Contextual prepend (parrafo de contexto por chunk, GPT-5.4-mini)
    - Crear registros InterviewChunk con tsvector para BM25
    - AiUsageLog: feature="contextual-prepend"
    |
    v
[PASO 8: Generacion de embeddings] (ASYNC, paralelizable)
    Estado: EMBEDDING
    - Embeddings de cada InterviewChunk (text-embedding-3-small)
    - Embeddings de cada OrgEntity nueva (name + description + metadata)
    - Batch processing (max 2048 inputs por llamada a la API)
    - AiUsageLog: feature="embedding-generation"
    |
    v
[PASO 9: Completado]
    Estado: COMPLETED
    - Notificar al usuario (via WebSocket o polling)
    - Marcar Interview como completada con timestamps de cada paso
```

#### CORRECCION CRITICA: Modelos a usar

El documento de hallazgos referencia `gpt-4.1`, `gpt-4.1-mini` y `gpt-4.1-nano`. Segun las instrucciones del proyecto, **usamos GPT-5.4 y GPT-5.4-mini (NO GPT-4.1)**. Tabla corregida:

| Pasada | Modelo en findings | Modelo correcto para Zeru |
|--------|-------------------|---------------------------|
| P1: Entidades basicas | gpt-4.1-nano | **GPT-5.4-mini** |
| P2: Procesos y actividades | gpt-4.1-mini | **GPT-5.4-mini** |
| P3: Problemas e ineficiencias | gpt-4.1 | **GPT-5.4** |
| P4: Dependencias | gpt-4.1 | **GPT-5.4** |
| P5: Claims facticos | gpt-4.1-mini | **GPT-5.4-mini** |
| Post-procesamiento | gpt-4.1-mini | **GPT-5.4-mini** |
| Resumenes simples | gpt-4.1-nano | **GPT-5.4-mini** |
| Resumenes complejos | gpt-4.1 | **GPT-5.4** |
| Correferencias | gpt-4.1-mini | **GPT-5.4-mini** |
| Contextual prepend | gpt-4.1-mini | **GPT-5.4-mini** |

**Implicaciones de costo**: GPT-5.4-mini es mas capaz pero mas caro que gpt-4.1-nano. Estimacion revisada: ~$0.88 USD por entrevista (90 min). Para 15 entrevistas: ~$13.20 USD. Sigue siendo extremadamente accesible.

#### Principio clave: Entrevistas caben completas en contexto

Las entrevistas duran max 90 minutos (~22K tokens). Esto es apenas 2-15% del contexto de GPT-5.4. **No hay necesidad de chunking para extraccion.** Cada pasada recibe la transcripcion COMPLETA. Esto elimina complejidad de map-reduce, deduplicacion entre chunks, y perdida de contexto.

---

### 2.3 Extraccion Multi-Pasada — Diseno Detallado

**Pasada 1: Entidades basicas (GPT-5.4-mini)**
- Input: Transcripcion completa + system prompt con instrucciones + 2 few-shot examples
- Output: Roles, departamentos/areas, sistemas/herramientas mencionados
- Incluye campo `aliases` para correferencia in-context

**Pasada 2: Procesos y actividades (GPT-5.4-mini)**
- Input: Transcripcion + output de Pasada 1 (roles y sistemas ya identificados)
- Output: Procesos con actividades ordenadas, linked a roles y sistemas ya identificados
- Few-shot con 2 ejemplos

**Pasada 3: Problemas e ineficiencias (GPT-5.4)**
- Input: Transcripcion + outputs de P1 y P2
- Output: Problemas con severidad, evidencia textual (cita), entidades afectadas
- Chain-of-thought + Structured Output (el modelo razona antes de clasificar severidad)
- Modelo mas potente porque requiere razonamiento sobre subjetividad

**Pasada 4: Dependencias y relaciones inter-proceso (GPT-5.4)**
- Input: Transcripcion + todos los outputs previos (P1-P3)
- Output: Dependencias entre procesos, triggers, flujos de informacion/aprobacion/material
- Chain-of-thought. La pasada mas compleja: infiere relaciones no siempre explicitas

**Pasada 5: Claims facticos y metricas (GPT-5.4-mini)**
- Input: Transcripcion (SIN outputs previos, para evitar sesgo)
- Output: Claims cuantitativos y cualitativos, cada uno con confidence y hedging level
- Zero-shot (extraccion directa)

**Invocacion para cada pasada (patron conceptual):**

```typescript
// Patron de invocacion (pseudocodigo, NO implementacion)
const response = await openai.responses.create({
  model: 'gpt-5.4-mini', // o 'gpt-5.4' segun pasada
  input: [
    { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
    { role: 'user', content: buildExtractionPrompt(transcription, previousOutputs) },
  ],
  response_format: zodResponseFormat(PassNSchema, 'extraction_result'),
  max_output_tokens: 8192,
});

// Log de uso obligatorio (CLAUDE.md)
await prisma.aiUsageLog.create({
  data: {
    provider: 'OPENAI',
    model: response.model,
    feature: `extraction-p${passNumber}`,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    totalTokens: response.usage.total_tokens,
    cachedTokens: response.usage.input_tokens_details?.cached_tokens ?? 0,
    tenantId,
    // interviewId: interview.id (campo nuevo propuesto para be-schema)
  },
});
```

**Nota sobre prompt caching**: Las pasadas 2-5 comparten la transcripcion como prefijo comun. GPT-5.4 cachea automaticamente prefijos repetidos con 75% descuento en input tokens.

---

### 2.4 Schemas Zod para Structured Outputs

#### Pasada 1: Entidades basicas

```typescript
// Ubicacion: apps/api/src/modules/org-intelligence/schemas/extraction-p1.schema.ts

const RoleSchema = z.object({
  canonicalName: z.string().describe("Nombre mas completo: 'Juan Martinez, Jefe de Logistica'"),
  aliases: z.array(z.string()).describe("Todas las formas en que se menciona"),
  department: z.string().nullable().describe("Area/departamento al que pertenece"),
  responsibilities: z.array(z.string()).describe("Responsabilidades mencionadas"),
  reportsTo: z.string().nullable().describe("Cargo al que reporta, si se menciona"),
  confidence: z.number().min(0).max(1).describe("1.0=explicitamente dicho, 0.5=inferido"),
});

const DepartmentSchema = z.object({
  name: z.string().describe("Nombre del area o departamento"),
  aliases: z.array(z.string()),
  parentDepartment: z.string().nullable(),
  headRole: z.string().nullable().describe("Cargo que dirige el area"),
  confidence: z.number().min(0).max(1),
});

const SystemSchema = z.object({
  name: z.string().describe("Nombre comercial del sistema/herramienta"),
  aliases: z.array(z.string()).describe("Ej: ['el ERP', 'SAP', 'el sistema']"),
  type: z.enum([
    'ERP', 'CRM', 'SPREADSHEET', 'EMAIL', 'MESSAGING', 'DATABASE',
    'CUSTOM_SOFTWARE', 'CLOUD_SERVICE', 'PHYSICAL_TOOL', 'OTHER'
  ]),
  usedBy: z.array(z.string()).describe("Roles que lo usan"),
  purpose: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

const ExtractionP1Schema = z.object({
  roles: z.array(RoleSchema),
  departments: z.array(DepartmentSchema),
  systems: z.array(SystemSchema),
});
```

#### Pasada 2: Procesos y actividades

```typescript
// extraction-p2.schema.ts

const ActivitySchema = z.object({
  name: z.string().describe("Nombre descriptivo de la actividad"),
  executor: z.string().nullable().describe("Rol que ejecuta (del output P1)"),
  systems: z.array(z.string()).describe("Sistemas usados (del output P1)"),
  documents: z.array(z.string()).describe("Documentos/formularios involucrados"),
  order: z.number().int().describe("Posicion en la secuencia del proceso"),
  estimatedDuration: z.string().nullable().describe("Ej: '2 horas', '3 dias'"),
  isManual: z.boolean().describe("true si manual, false si automatizada"),
  description: z.string().nullable(),
});

const ProcessSchema = z.object({
  name: z.string().describe("Nombre del proceso de negocio"),
  aliases: z.array(z.string()),
  owner: z.string().nullable().describe("Rol responsable del proceso completo"),
  department: z.string().nullable().describe("Area principal donde ocurre"),
  activities: z.array(ActivitySchema),
  frequency: z.enum([
    'CONTINUOUS', 'DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY',
    'QUARTERLY', 'YEARLY', 'ON_DEMAND', 'UNKNOWN'
  ]),
  trigger: z.string().nullable().describe("Que inicia el proceso"),
  output: z.string().nullable().describe("Resultado final del proceso"),
  confidence: z.number().min(0).max(1),
});

const ExtractionP2Schema = z.object({
  processes: z.array(ProcessSchema),
});
```

#### Pasada 3: Problemas e ineficiencias

```typescript
// extraction-p3.schema.ts

const ProblemSchema = z.object({
  description: z.string().describe("Descripcion clara del problema"),
  severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
  category: z.enum([
    'BOTTLENECK', 'REDUNDANCY', 'MANUAL_WORK', 'COMMUNICATION_GAP',
    'LACK_OF_SYSTEM', 'DATA_INCONSISTENCY', 'APPROVAL_DELAY',
    'KNOWLEDGE_SILO', 'RESOURCE_CONSTRAINT', 'PROCESS_GAP', 'OTHER'
  ]),
  affectedProcesses: z.array(z.string()).describe("Procesos afectados (de P2)"),
  affectedRoles: z.array(z.string()).describe("Roles afectados (de P1)"),
  affectedSystems: z.array(z.string()).describe("Sistemas involucrados (de P1)"),
  evidence: z.string().describe("Cita textual directa de la entrevista"),
  speakerRole: z.string().nullable().describe("Quien lo menciono"),
  suggestedImprovement: z.string().nullable().describe("Si el entrevistado propuso solucion"),
  frequency: z.enum(['ALWAYS', 'OFTEN', 'SOMETIMES', 'RARELY', 'UNKNOWN']),
  confidence: z.number().min(0).max(1),
});

const ExtractionP3Schema = z.object({
  problems: z.array(ProblemSchema),
});
```

#### Pasada 4: Dependencias

```typescript
// extraction-p4.schema.ts

const DependencySchema = z.object({
  from: z.string().describe("Proceso, area o rol de origen"),
  fromType: z.enum(['PROCESS', 'DEPARTMENT', 'ROLE', 'SYSTEM', 'ACTIVITY']),
  to: z.string().describe("Proceso, area o rol destino"),
  toType: z.enum(['PROCESS', 'DEPARTMENT', 'ROLE', 'SYSTEM', 'ACTIVITY']),
  type: z.enum([
    'INFORMATION_FLOW', 'APPROVAL_REQUIRED', 'MATERIAL_FLOW',
    'TRIGGER', 'SHARED_RESOURCE', 'DATA_DEPENDENCY', 'SEQUENTIAL'
  ]),
  description: z.string().nullable(),
  isCritical: z.boolean().describe("true si la dependencia bloquea al destino"),
  evidence: z.string().nullable().describe("Cita textual si existe"),
  confidence: z.number().min(0).max(1),
});

const ExtractionP4Schema = z.object({
  dependencies: z.array(DependencySchema),
});
```

#### Pasada 5: Claims facticos

```typescript
// extraction-p5.schema.ts

const FactualClaimSchema = z.object({
  subject: z.string().describe("Entidad sobre la que se hace el claim"),
  predicate: z.string().describe("Atributo: 'duracion_promedio', 'frecuencia', 'cantidad'"),
  value: z.string().describe("Valor afirmado: '3 dias', 'semanal', '500 unidades'"),
  valueType: z.enum(['QUANTITATIVE', 'QUALITATIVE', 'RELATIONAL']),
  unit: z.string().nullable().describe("Unidad si cuantitativo: 'dias', 'horas', 'unidades'"),
  numericValue: z.number().nullable().describe("Valor numerico si parseable"),
  speakerRole: z.string().nullable().describe("Quien lo afirmo"),
  hedging: z.enum(['CERTAIN', 'PROBABLE', 'UNCERTAIN', 'SPECULATIVE']).describe(
    "CERTAIN='siempre hacemos X', PROBABLE='normalmente...', UNCERTAIN='creo que...', SPECULATIVE='podria ser...'"
  ),
  evidence: z.string().describe("Cita textual exacta"),
  confidence: z.number().min(0).max(1),
});

const ExtractionP5Schema = z.object({
  claims: z.array(FactualClaimSchema),
});
```

#### Restricciones respetadas

- No hay `$ref` recursivo (ningun schema se referencia a si mismo)
- No hay `patternProperties` ni regex constraints
- No hay discriminated unions complejas (se usa `z.enum()`)
- Todos los objetos tienen propiedades fijas
- `z.describe()` extensivo (Structured Outputs lee las descripciones como guia)

---

### 2.5 Manejo de Errores, Retries y Resiliencia

#### Transcripcion (Paso 2)

| Escenario | Estrategia |
|-----------|-----------|
| Deepgram API key no configurada | Fallback automatico a OpenAI (ya tenemos API key) |
| Deepgram timeout o error 5xx | Retry 3x con backoff (1s, 4s, 16s). Si persiste, fallback OpenAI |
| Deepgram error 4xx (audio invalido) | NO retry. Marcar FAILED con mensaje descriptivo |
| OpenAI fallback falla (audio >25 MB) | Pre-dividir en segmentos de ~20 min con overlap 30s |
| Audio corrupto o vacio | Validar buffer.length > 0 antes de enviar. FAILED inmediato |

#### Extraccion multi-pasada (Paso 4)

| Escenario | Estrategia |
|-----------|-----------|
| Rate limit o timeout de API | Retry 3x con backoff. Estado de pasada anterior guardado en DB |
| JSON invalido (imposible con Structured Outputs) | Retry 1x. Si persiste, loggear raw response, marcar pasada FAILED |
| Resultado vacio (0 entidades) | Aceptar como valido. No toda entrevista menciona todo |
| Error parsing Zod post-API | Bug del SDK. Loggear detalladamente |
| Pasada intermedia falla permanentemente | Continuar pasadas independientes. Marcar fallida en status |

#### Modelo de estados del pipeline

```
UPLOADED -> TRANSCRIBING -> POST_PROCESSING -> EXTRACTING -> RESOLVING_COREFERENCES
   -> SUMMARIZING -> CHUNKING -> EMBEDDING -> COMPLETED
   (cualquier estado puede transicionar a -> FAILED)
```

Cada estado se persiste en `Interview.processingStatus`. Al reiniciar la app, un job de bootstrap busca entrevistas en estados intermedios y las re-encola desde el ultimo paso completado:

```typescript
// Recovery en bootstrap (pseudocodigo)
async onApplicationBootstrap() {
  const stuck = await prisma.interview.findMany({
    where: { processingStatus: { notIn: ['COMPLETED', 'FAILED', 'UPLOADED'] } },
  });
  for (const interview of stuck) {
    this.logger.warn(`Resuming interview ${interview.id} from ${interview.processingStatus}`);
    this.continueFromStep(interview.id, interview.processingStatus);
  }
}
```

#### Timeouts por paso

| Paso | Timeout | Justificacion |
|------|---------|---------------|
| Transcripcion Deepgram | 300s | Audio 90 min toma 1-3 min en batch |
| Transcripcion OpenAI fallback | 600s | OpenAI puede ser mas lento |
| Extraccion (cada pasada) | 120s | ~22K in + 8K out = segundos tipicos |
| Post-procesamiento | 60s | Tarea ligera con GPT-5.4-mini |
| Resumen por entrevista | 120s | Transcripcion completa como input |
| Chunking (local) | 30s | Operacion en memoria |
| Embedding (por batch) | 30s/batch | API rapida |

---

### 2.6 AiUsageLog — Tracking de Costos (OBLIGATORIO)

#### Registro por cada llamada API

| Feature tag | Modelo | Momento del registro |
|-------------|--------|---------------------|
| `transcription` | Deepgram Nova-3 / OpenAI | Al completar transcripcion |
| `post-processing` | GPT-5.4-mini | Al completar limpieza |
| `extraction-p1` a `extraction-p5` | GPT-5.4-mini / GPT-5.4 | Al completar cada pasada |
| `coreference-resolution` | GPT-5.4-mini | Al completar correferencias |
| `summarization` | GPT-5.4-mini / GPT-5.4 | Por cada nivel de resumen |
| `contextual-prepend` | GPT-5.4-mini | Por cada chunk contextualizado |
| `embedding-generation` | text-embedding-3-small | Por cada batch de embeddings |

#### Deepgram: tracking especial

Deepgram NO retorna token counts (no es LLM). Costo por duracion de audio ($0.0043/min batch). Para AiUsageLog:
- `provider`: "DEEPGRAM"
- `model`: "nova-3"
- `inputTokens`/`outputTokens`/`totalTokens`: 0 (no aplica)
- **Propuesta para be-schema**: Agregar campo `metadata Json?` al AiUsageLog para almacenar `{ durationMs, estimatedCostUsd }` sin cambiar la estructura relacional.

#### Costo estimado por entrevista (90 min, ~22K tokens)

```
Transcripcion Deepgram (90 min):         $0.39
Post-procesamiento (GPT-5.4-mini):       ~$0.02
Extraccion P1 (GPT-5.4-mini):            ~$0.02
Extraccion P2 (GPT-5.4-mini):            ~$0.03
Extraccion P3 (GPT-5.4):                 ~$0.15
Extraccion P4 (GPT-5.4):                 ~$0.15
Extraccion P5 (GPT-5.4-mini):            ~$0.02
Correferencias (GPT-5.4-mini):           ~$0.01
Resumenes (GPT-5.4-mini):                ~$0.03
Contextual prepend (x~30 chunks):        ~$0.05
Embeddings (~50 items):                  ~$0.01
                                         -------
TOTAL POR ENTREVISTA:                    ~$0.88 USD
TOTAL 15 ENTREVISTAS:                    ~$13.20 USD
```

---

### 2.7 Procesamiento Asincrono — Extension del BackgroundQueueService

#### Patron: Orquestador de pipeline sobre BackgroundQueueService

En lugar de migrar a BullMQ (requiere Redis), propongo un `InterviewPipelineOrchestrator` que usa la cola existente pero agrega secuenciacion:

```typescript
// Patron conceptual (pseudocodigo, NO implementacion)
class InterviewPipelineOrchestrator {
  async startPipeline(interviewId: string): Promise<void> {
    await this.updateStatus(interviewId, 'TRANSCRIBING');
    this.backgroundQueue.enqueue({
      name: `interview:${interviewId}:transcribe`,
      fn: async () => {
        await this.transcriptionService.transcribe(interviewId);
        await this.continueFromStep(interviewId, 'POST_PROCESSING');
      },
      maxRetries: 3,
    });
  }

  async continueFromStep(interviewId: string, step: string): Promise<void> {
    await this.updateStatus(interviewId, step);
    // Switch por estado, encolar el job del paso correspondiente
  }
}
```

**Ventaja**: No necesitamos Redis/BullMQ para MVP. Estado en PostgreSQL permite recovery.

**Limitacion**: Concurrencia max 3 compartida con otros jobs (embeddings memorias). Para MVP con volumen moderado es aceptable.

**Migracion futura a BullMQ** (no bloqueante): colas dedicadas, persistencia Redis, rate limiting, dashboard Bull Board. La interfaz del orquestador abstrae la cola; solo cambia la implementacion interna.

---

### 2.8 Servicios Nuevos a Crear

#### Estructura de modulos

```
apps/api/src/modules/org-intelligence/
  org-intelligence.module.ts
  controllers/
    interview.controller.ts
  services/
    transcription.service.ts            // Deepgram + OpenAI fallback
    transcription-post-processor.ts     // Limpieza, speaker identification
    extraction-pipeline.service.ts      // Orquesta 5 pasadas
    coreference.service.ts              // Correferencias + entity linking
    interview-chunking.service.ts       // Chunking multi-capa para RAG
    interview-summary.service.ts        // Resumenes multi-nivel
    interview-pipeline.orchestrator.ts  // Orquesta pipeline end-to-end
  schemas/
    transcription.schema.ts             // TranscriptionResult, TranscriptionSegment
    extraction-p1.schema.ts a p5        // Schemas por pasada
    extraction-result.schema.ts         // Tipo compuesto final
  dto/
    upload-interview.dto.ts
    interview-status.dto.ts
```

#### Dependencias entre servicios

```
InterviewPipelineOrchestrator
  -> TranscriptionService (DeepgramConfig o AiConfigService para API keys)
  -> TranscriptionPostProcessor (AiConfigService para OpenAI key)
  -> ExtractionPipelineService (AiConfigService para OpenAI key)
  -> CoreferenceService (MemoryService para embedding similarity)
  -> InterviewSummaryService (AiConfigService para OpenAI key)
  -> InterviewChunkingService (local + AiConfigService para contextual prepend)
  -> MemoryService (embeddings de chunks)
  -> BackgroundQueueService (ejecucion asincrona)
  -> PrismaService (persistencia de estado y resultados)
  -> S3Service (download del audio)
```

---

### 2.9 Mensajes para Otros Investigadores

#### Para be-schema:

Mi pipeline necesita estos cambios/adiciones al schema:

1. **Interview**: Campos adicionales `processingStatus` (enum con 9 estados), `transcriptionJson` (Json), `transcriptionText` (String), `extractionResults` (Json con outputs de 5 pasadas), `summaryJson` (Json), timestamps por paso (`transcriptionStartedAt/CompletedAt`, etc.).

2. **InterviewChunk**: Modelo nuevo. Campos: `interviewId`, `tenantId`, `projectId`, `content`, `contextPrefix`, `speakerLabel`, `speakerRole`, `startMs`, `endMs`, `topicSummary`, `chunkIndex`, `layerType` (enum: SPEAKER_TURN, SEMANTIC, CONTEXTUAL), `parentChunkId?`, `embedding` (vector(1536)), `tsv` (tsvector).

3. **AiUsageLog**: Campo `interviewId` (nullable) o generico `referenceId`+`referenceType`. Tambien `metadata Json?` para datos de providers no-LLM (duracion audio Deepgram).

4. **DeepgramConfig o ExternalProviderConfig**: API key de Deepgram por tenant. Propongo tabla generalizada `ExternalProviderConfig` para evitar crear un modelo por cada provider.

#### Para be-rag:

Mi pipeline produce chunks en 3 capas para tu sistema RAG:

1. **Speaker-turn chunks**: Unidad atomica con `speakerLabel`, `speakerRole`, `startMs`, `endMs`.
2. **Semantic chunks**: 3-8 turns agrupados por tema, 500-1000 tokens, con `topicSummary`.
3. **Contextual chunks**: Semantic + parrafo prepended ("Este segmento proviene de entrevista con [Nombre], [Cargo]..."). Mejora retrieval 49% (Anthropic).
4. **tsvector**: Cada chunk tiene `tsv` con `to_tsvector('spanish', content)` para BM25.
5. **Parent-document**: Transcripcion completa en `Interview.transcriptionText` accesible via `interviewId`.

Pregunta: El contextual prepend agrega ~$0.05/entrevista. Mejora retrieval 49% segun Anthropic. Desde mi lado, vale la pena. Necesito tu opinion como owner del pipeline de retrieval.

#### Para be-api:

Endpoints que mi pipeline necesita:

1. **POST /org-intelligence/projects/:projectId/interviews** - Upload audio (multipart), response `{ interviewId, status }`
2. **GET /org-intelligence/interviews/:interviewId/status** - Status del pipeline para polling
3. **GET /org-intelligence/interviews/:interviewId/transcription** - TranscriptionResult completo
4. **GET /org-intelligence/interviews/:interviewId/extraction** - Resultado de 5 pasadas
5. **GET /org-intelligence/interviews/:interviewId/summary** - Resumenes multi-nivel
6. **POST /org-intelligence/interviews/:interviewId/retry** - Re-encolar desde ultimo paso fallido
7. **POST/GET/DELETE /settings/deepgram-config** - Config API key Deepgram por tenant

---

### 2.10 Decisiones y Trade-offs

| Decision | Alternativa descartada | Justificacion |
|----------|----------------------|---------------|
| Pipeline secuencial in-process | BullMQ con Redis | Simplicidad para MVP. Estado en DB permite recovery |
| Transcripcion en campo JSON | Tabla TranscriptionSegment por fila | Se lee completa frecuentemente. JSON mas eficiente |
| Schemas Zod separados por pasada | Mega-schema unico | Schemas simples = mayor adherencia Structured Outputs |
| GPT-5.4-mini para pasadas simples | GPT-5.4 para todo | ~60% ahorro sin sacrificio significativo |
| Deepgram default + OpenAI fallback | Solo OpenAI | Resuelve cross-chunk speaker identity problem |
| Estado pipeline en Interview | Tabla separada PipelineRun | Simplicidad: 1 entrevista = 1 pipeline (1:1) |

#### Riesgos

1. **Deepgram como dependencia nueva**: API key adicional por tenant, SDK nuevo. Mitigado por fallback OpenAI.
2. **Latencia total pipeline**: 3-8 min por entrevista. Aceptable para batch. Usuario notificado al completar.
3. **Cola in-memory**: Jobs perdidos en restart. Mitigado por estado en DB + recovery en bootstrap.
4. **OpenAI SDK version**: Necesita >= 4.55 para `zodResponseFormat()`. Verificar version actual del proyecto.
5. **Calidad depende de transcripcion**: Diarizacion incorrecta propaga errores. Post-procesamiento + confidence scoring mitigan.

#### Preguntas abiertas para el equipo

1. **AiUsageLog interviewId**: Campo especifico `interviewId` o generico `referenceId`+`referenceType`? be-schema decide.
2. **ExternalProviderConfig vs DeepgramConfig**: Tabla generalizada o especifica? Propongo generalizada para futuro (Cohere, etc.).
3. **Concurrencia de BackgroundQueueService**: Subir MAX_CONCURRENCY de 3 a 5 para acomodar pipeline de entrevistas sin bloquear otros jobs? O mantener 3 y priorizar?

---

## 3. RAG Hibrido, Knowledge Graph Queries y Evaluacion (Backend-3: be-rag)

### 3.1 Analisis del RAG Existente en Zeru

#### Estado actual (memory.service.ts)

El sistema actual implementa un RAG basico (Naive RAG) sobre la tabla `memories`:

- **Modelo de embedding:** `text-embedding-3-small`, 1536 dimensiones, timeout de 15s.
- **Almacenamiento:** Columna `embedding` de tipo `vector(1536)` en la tabla `memories` (Prisma `Unsupported`). Los embeddings se generan en background via `BackgroundQueueService` (concurrencia 3, reintentos 3 con backoff exponencial base 1s x4^attempt).
- **Busqueda:** Cosine similarity pura: `1 - (embedding <=> query::vector)`, ordenada por distancia coseno, con `LIMIT` fijo. No hay threshold de similitud minima — devuelve top-N sin importar calidad.
- **Indice HNSW:** Creado en migracion `20260224100000` SIN parametros explicitos (`CREATE INDEX ... USING hnsw (embedding vector_cosine_ops)`), por lo que usa defaults de pgvector (m=16, ef_construction=64). El ef_construction=64 es suboptimo; el consenso del findings doc recomienda ef_construction=200.
- **Scoping:** Filtrado por `tenantId` y opcionalmente `userId`, construido con string interpolation en raw SQL. Los valores vienen de tokens JWT validados pero el patron deberia parametrizarse.
- **Contexto para conversacion:** `getContextForConversation()` busca top-8 memorias por similitud semantica y las formatea como markdown (separando tenant vs user memories) para inyectar en el system prompt.

#### Lo que NO existe aun

| Componente | Estado |
|---|---|
| tsvector / full-text search | NO implementado en ningun modelo |
| BM25 o busqueda por keywords | NO. Solo vector search puro |
| Reciprocal Rank Fusion (RRF) | NO |
| Re-ranking (cross-encoder) | NO |
| Multi-query expansion | NO |
| Contextual retrieval (context prefix) | NO |
| Parent-document retrieval | NO. Memorias son atomicas sin jerarquia |
| Indice HNSW con parametros optimizados | PARCIAL. Indice existe pero con ef_construction=64 (default) |
| Indice GIN para tsvector | NO |
| Tabla InterviewChunk | NO. No existe aun en schema Prisma |
| Knowledge Graph (OrgEntity/OrgRelation) | NO. No existe aun |
| Evaluacion RAGAS | NO |

#### Vulnerabilidades del RAG actual

1. **Sin threshold de similitud:** La busqueda devuelve top-N sin importar que tan malos sean los resultados. Si la query no tiene relacion con ninguna memoria, igual devuelve basura. Se debe agregar `WHERE 1 - (embedding <=> query) > 0.3` como filtro minimo de calidad.

2. **Sin fallback inteligente:** Si el embedding falla, `search()` cae a `list()` que devuelve por recencia/importancia — sin relacion semantica con la query. Correcto como fallback pero deberia logearse como degradacion de servicio.

3. **Embedding sincrono en search, asincrono en store:** Al buscar, el embedding de la query se genera en linea (sincrono, timeout 15s). Si OpenAI tiene latencia alta, la busqueda se bloquea. No hay circuit breaker ni cache de embeddings de queries frecuentes.

4. **String interpolation en raw SQL:** Las clausulas `scopeClause` en `search()` se construyen con template literals (`WHERE "tenantId" = '${tenantId}'`). Aunque los valores vienen de contextos confiables (JWT), debe parametrizarse como `$1::text` para defense-in-depth.

---

### 3.2 Diseno del RAG Hibrido Completo

#### 3.2.1 BM25 via tsvector en InterviewChunk

**Requisitos para be-schema (migracion):**

La tabla `interview_chunks` necesita una columna `tsv` de tipo `tsvector`. PostgreSQL no tiene BM25 puro pero `ts_rank_cd` (cover density ranking) con normalizacion es funcionalmente equivalente para nuestro volumen.

**Trigger para tsvector con pesos (recomendado sobre GENERATED ALWAYS para compatibilidad con Prisma):**

```sql
CREATE FUNCTION interview_chunks_tsv_trigger() RETURNS trigger AS $$
BEGIN
  NEW.tsv :=
    setweight(to_tsvector('spanish', COALESCE(NEW."topicSummary", '')), 'A') ||
    setweight(to_tsvector('spanish', COALESCE(NEW."contextPrefix", '')), 'B') ||
    setweight(to_tsvector('spanish', COALESCE(NEW.content, '')), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER tsvector_update
  BEFORE INSERT OR UPDATE OF content, "contextPrefix", "topicSummary"
  ON interview_chunks
  FOR EACH ROW EXECUTE FUNCTION interview_chunks_tsv_trigger();

CREATE INDEX idx_interview_chunks_tsv ON interview_chunks USING gin(tsv);
```

**Justificacion de pesos:**
- **A (topicSummary):** El resumen tematico es lo mas denso semanticamente. Peso maximo asegura que queries que coincidan con el tema rankeen alto.
- **B (contextPrefix):** El prefijo contextual contiene metadata critica (nombre del entrevistado, cargo, proyecto, tema). Peso medio.
- **C (content):** Texto crudo de la transcripcion. Peso menor individualmente pero el volumen compensa.

**Configuracion del diccionario espanol:**

PostgreSQL incluye `spanish` como configuracion de text search por defecto (Snowball stemmer). Para mejorar calidad en transcripciones orales, en fase 2 crear configuracion custom con stopwords adicionales para muletillas orales ("ehh", "mmm", "digamos", "osea", "basicamente"). Para el MVP, `spanish` vanilla es suficiente.

**Mensaje para be-schema:** La columna `tsv` DEBE gestionarse fuera de Prisma (raw migration SQL). En el schema Prisma se declara como `Unsupported("tsvector")?` y se omite en CRUD normal. La migracion crea trigger + indice GIN. El trigger cubre INSERT y UPDATE de `content`, `contextPrefix` y `topicSummary`.

#### 3.2.2 Vector Search con pgvector HNSW optimizado

**Indice HNSW para InterviewChunk:**

```sql
CREATE INDEX idx_interview_chunks_embedding_hnsw ON interview_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 200);
```

**Parametros:**
- `m = 16`: Conexiones bidireccionales por nodo. Default de pgvector, optimo para 1024-2048 dims.
- `ef_construction = 200`: Lista de candidatos durante construccion. Mayor que default (64), mejora recall. Para ~450 chunks por proyecto, construccion toma <1s.
- `vector_cosine_ops`: Consistente con el operador `<=>` ya usado en memory.service.ts.

**Parametro de busqueda en runtime:**

```sql
SET LOCAL hnsw.ef_search = 100;  -- Default 40. Mejora recall ~5%, penalidad ~20% latencia
```

`SET LOCAL` aplica solo a la transaccion actual.

**Indice HNSW para OrgEntity:**

```sql
CREATE INDEX idx_org_entities_embedding_hnsw ON org_entities
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 200);
```

**Correccion del indice existente de memories:**

```sql
DROP INDEX IF EXISTS memories_embedding_idx;
CREATE INDEX memories_embedding_idx ON memories
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 200);
```

**Mensaje para be-schema:** El indice HNSW de `memories` usa defaults suboptimos (ef_construction=64). Recrear con parametros explicitos. Crear indices HNSW para `interview_chunks` y `org_entities` con m=16, ef_construction=200. Agregar `@@index([fromEntityId, type])` y `@@index([toEntityId, type])` en `org_relations` para traversal eficiente.

#### 3.2.3 Reciprocal Rank Fusion (RRF)

RRF combina listas rankeadas sin normalizar scores (cosine similarity 0-1 vs ts_rank rango arbitrario). Formula:

```
RRF_score(doc) = SUM( 1 / (k + rank_i(doc)) ) para cada ranking i
```

k=60 (constante del paper original, Cormack/Clarke/Butt 2009).

**Query SQL completa para hybrid search:**

```sql
WITH params AS (
  SELECT
    $1::vector AS query_vec,
    plainto_tsquery('spanish', $2) AS query_ts,
    $3::text AS tenant_id,
    $4::text AS project_id
),
vector_results AS (
  SELECT
    c.id, c.content, c."contextPrefix", c."topicSummary",
    c."interviewId", c."speakerId",
    ROW_NUMBER() OVER (ORDER BY c.embedding <=> p.query_vec) AS vrank
  FROM interview_chunks c, params p
  WHERE c."tenantId" = p.tenant_id
    AND c.embedding IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM interviews i
      WHERE i.id = c."interviewId" AND i."projectId" = p.project_id
    )
  ORDER BY c.embedding <=> p.query_vec
  LIMIT 30
),
bm25_results AS (
  SELECT
    c.id, c.content, c."contextPrefix", c."topicSummary",
    c."interviewId", c."speakerId",
    ROW_NUMBER() OVER (ORDER BY ts_rank_cd(c.tsv, p.query_ts, 32) DESC) AS brank
  FROM interview_chunks c, params p
  WHERE c."tenantId" = p.tenant_id
    AND c.tsv @@ p.query_ts
    AND EXISTS (
      SELECT 1 FROM interviews i
      WHERE i.id = c."interviewId" AND i."projectId" = p.project_id
    )
  ORDER BY ts_rank_cd(c.tsv, p.query_ts, 32) DESC
  LIMIT 30
),
fused AS (
  SELECT
    COALESCE(v.id, b.id) AS id,
    COALESCE(v.content, b.content) AS content,
    COALESCE(v."contextPrefix", b."contextPrefix") AS "contextPrefix",
    COALESCE(v."topicSummary", b."topicSummary") AS "topicSummary",
    COALESCE(v."interviewId", b."interviewId") AS "interviewId",
    COALESCE(v."speakerId", b."speakerId") AS "speakerId",
    COALESCE(1.0 / (60 + v.vrank), 0) + COALESCE(1.0 / (60 + b.brank), 0) AS rrf_score,
    v.vrank,
    b.brank
  FROM vector_results v
  FULL OUTER JOIN bm25_results b ON v.id = b.id
)
SELECT * FROM fused ORDER BY rrf_score DESC LIMIT $5;
```

**Notas de implementacion:**

1. **`ts_rank_cd` (cover density):** Preferible para chunks de entrevistas porque penaliza terminos dispersos. Un chunk donde los terminos de busqueda aparecen juntos es mas relevante.

2. **Flag `32`:** Normaliza rank por longitud (`rank / (1 + log(length))`), evitando sesgo hacia chunks mas largos.

3. **`plainto_tsquery('spanish', $2)`:** Convierte query a tsquery con stemming espanol. Para queries booleanas naturales, usar `websearch_to_tsquery`.

4. **`LIMIT 30` por brazo:** Impacto de documentos mas alla del top-30 es negligible en RRF: 1/(60+31) = 0.011, <2% del score del #1.

5. **FULL OUTER JOIN:** Critico: documentos que aparecen solo en un brazo se incluyen en la fusion.

6. **Filtro projectId via EXISTS:** InterviewChunk tiene `tenantId` desnormalizado pero no `projectId`. Si la performance es insuficiente, desnormalizar `projectId` en `interview_chunks`.

**Alpha weighting (fase futura):** `rrf_score = alpha * (1/(k + vrank)) + (1-alpha) * (1/(k + brank))`. Inicialmente alpha=0.5. El alpha optimo se determina empiricamente con el golden dataset RAGAS.

#### 3.2.4 Multi-Query Expansion

**Flujo:**

```
Input: "Como funciona el proceso de compras?"
-> gpt-5.4-mini genera 3 variantes (temperature=0.7):
   ["proceso de adquisiciones y abastecimiento",
    "workflow de procurement y compra de materiales",
    "pasos para solicitar y aprobar ordenes de compra"]
-> 4 embeddings en paralelo (original + 3 variantes)
-> 4 hybrid searches en paralelo (4 queries SQL)
-> Fusion: score final = MAX(rrf_scores) por documento
-> Top-20 pasan al re-ranker
```

**Justificacion del MAX (no AVG ni SUM):**
- MAX: Un match fuerte en cualquier variante basta. Evita que variantes malas diluyan buenos resultados.
- SUM favoreceria documentos en multiples variantes, pero las variantes son sinonimos — los mismos docs tienden a aparecer en todas.
- AVG penaliza docs que solo matchean una variante, lo cual es contraproducente.

**Costo y latencia adicional:** ~$0.0006 por query (LLM + 3 embeddings). Latencia: ~200-300ms paralelo. Aceptable.

**Cuando NO expandir:** Query < 5 palabras, query con nombres propios/codigos, query con acronimos. Heuristica: `if (words < 5 || /[A-Z]{2,}|\d{3,}/.test(query)) skip`.

#### 3.2.5 Re-ranking con Cross-Encoder

**Opcion recomendada (MVP): Cohere Rerank v3.5**

```
POST https://api.cohere.com/v2/rerank
Modelo: rerank-v3.5 (multilingue, espanol nativo)
Costo: $2/1000 queries
Latencia: ~200-400ms para 20 documentos
```

**Pipeline:**

```
1. Top-20 del RRF
2. Construir documents: top20.map(c => ({ text: `${c.contextPrefix}\n\n${c.content}` }))
3. POST /v2/rerank { model: "rerank-v3.5", query: QUERY_ORIGINAL, documents, top_n: 5 }
4. Seleccionar top-5 con mejor relevance_score
5. Pasar top-5 como contexto al LLM
```

**Punto critico:** Re-rankear con la query ORIGINAL, no con variantes expandidas. Las variantes amplian recall; el re-ranking maximiza precision contra la intencion original.

**Opcion B (fallback sin dependencia): LLM-as-reranker con gpt-5.4-mini.** Mas lento (~1-2s), mas caro (~$0.01), GPT tiene position bias. Mitiga randomizando orden de presentacion.

**Opcion C (fase futura): Cross-encoder self-hosted via ONNX Runtime.** Complejidad no justificada para volumen inicial.

**Mensaje para be-schema:** API key de Cohere por tenant. Modelo generico `ExternalProviderConfig { providerId, encryptedApiKey, tenantId }` o individual `CohereConfig`.

**Mensaje para be-api:** Parametros `useReranking` y `expandQuery` opcionales para degradacion graceful. Si Cohere no configurado o falla, continuar sin re-ranking. Logear en AiUsageLog con `feature: "org-rerank"`.

#### 3.2.6 Contextual Retrieval (tecnica Anthropic)

Cada chunk almacena un `contextPrefix` que lo situa dentro de la entrevista. Reduce retrieval failure en 49% segun Anthropic.

**Formato:**

```
"Este fragmento proviene de una entrevista con {speakerName}, {speakerRole}
del departamento de {department}, realizada el {date} dentro del proyecto
'{projectName}'. En este segmento se discute: {chunkTopicSummary}."
```

**Impacto triple:**

1. **En tsvector (peso B):** BM25 matchea por metadata del hablante/departamento/tema, incluso si el content no los menciona.
2. **En embedding:** Se genera sobre `contextPrefix + "\n\n" + content` concatenado. El vector captura contexto + contenido.
3. **En contexto del LLM:** Permite atribucion sin cargar la entrevista completa ("Segun Juan Martinez, Jefe de Logistica...").

**Costo:** ~$0.005 por chunk, ~$0.10 por entrevista, ~$1.50 por proyecto de 15 entrevistas. Negligible.

**Respuesta a la pregunta de be-schema:** Se embede `contextPrefix + "\n\n" + content` CONCATENADO. Esto es fundamental para la tecnica de contextual retrieval.

#### 3.2.7 Parent-Document Retrieval

**Estrategia de expansion:**

| Caso | Cuando | Accion |
|---|---|---|
| Vecinos | Chunk < 200 tokens o empieza con pronombre | Cargar chunk anterior + posterior por `chunkOrder` |
| Padre | Chunk tiene `parentChunkId` | Cargar chunk padre (agrupacion semantica) |
| Completo | LLM solicita via tool call | Cargar `Interview.transcriptionText` |

**Query SQL para vecinos:**

```sql
WITH target AS (
  SELECT "interviewId", "chunkOrder" FROM interview_chunks WHERE id = $1
)
SELECT c.*
FROM interview_chunks c
JOIN target t ON c."interviewId" = t."interviewId"
WHERE c."chunkOrder" BETWEEN t."chunkOrder" - $2 AND t."chunkOrder" + $2
ORDER BY c."chunkOrder";
```

**Default: NO expandir.** Chunks bien hechos con contextPrefix son autocontenidos. Expandir solo cuando la heuristica lo justifique.

**Mensaje para be-schema:** Indice `@@index([interviewId, chunkOrder])` para esta query. `parentChunkId String?` para jerarquia.

---

### 3.3 Knowledge Graph Queries

#### 3.3.1 Traversal OrgEntity -> OrgRelation

**Query de relaciones directas (bidireccional):**

```sql
SELECT
  r.id, r.type AS relation_type, r.confidence,
  CASE WHEN r."fromEntityId" = $1 THEN 'OUTGOING' ELSE 'INCOMING' END AS direction,
  CASE WHEN r."fromEntityId" = $1 THEN e_to.id ELSE e_from.id END AS related_id,
  CASE WHEN r."fromEntityId" = $1 THEN e_to.name ELSE e_from.name END AS related_name,
  CASE WHEN r."fromEntityId" = $1 THEN e_to.type ELSE e_from.type END AS related_type
FROM org_relations r
LEFT JOIN org_entities e_to ON e_to.id = r."toEntityId" AND e_to."validTo" IS NULL
LEFT JOIN org_entities e_from ON e_from.id = r."fromEntityId" AND e_from."validTo" IS NULL
WHERE (r."fromEntityId" = $1 OR r."toEntityId" = $1)
  AND r."tenantId" = $2
  AND r."validTo" IS NULL
ORDER BY direction, r.type;
```

**Query de subgrafo (profundidad N):**

```sql
WITH RECURSIVE subgraph AS (
  SELECT e.id, e.type, e.name, e.description, e.metadata,
    NULL::text AS relation_type, NULL::text AS parent_id, 0 AS depth
  FROM org_entities e
  WHERE e.id = $1 AND e."tenantId" = $2
    AND e."validTo" IS NULL AND e."deletedAt" IS NULL

  UNION ALL

  SELECT child.id, child.type, child.name, child.description, child.metadata,
    r.type, sg.id, sg.depth + 1
  FROM subgraph sg
  JOIN org_relations r ON r."fromEntityId" = sg.id
    AND r."tenantId" = $2 AND r."validTo" IS NULL
  JOIN org_entities child ON child.id = r."toEntityId"
    AND child."validTo" IS NULL AND child."deletedAt" IS NULL
  WHERE sg.depth < $3
    AND child.id NOT IN (SELECT id FROM subgraph)
)
SELECT * FROM subgraph ORDER BY depth, type, name;
```

#### 3.3.2 CTEs Recursivos para Dependencias Transitivas

**"Que procesos dependen transitivamente del Sistema SAP?"**

```sql
WITH RECURSIVE dependency_chain AS (
  SELECT e.id, e.type, e.name, r.type AS via_relation,
    1 AS depth, ARRAY[e.id] AS path
  FROM org_relations r
  JOIN org_entities e ON e.id = r."fromEntityId"
  WHERE r."toEntityId" = $1
    AND r.type IN ('USES', 'DEPENDS_ON')
    AND r."tenantId" = $2 AND r."validTo" IS NULL
    AND e."validTo" IS NULL AND e."deletedAt" IS NULL

  UNION ALL

  SELECT e.id, e.type, e.name, r.type, dc.depth + 1, dc.path || e.id
  FROM dependency_chain dc
  JOIN org_relations r ON r."toEntityId" = dc.id
  JOIN org_entities e ON e.id = r."fromEntityId"
  WHERE r.type IN ('DEPENDS_ON', 'TRIGGERS', 'USES')
    AND r."tenantId" = $2 AND r."validTo" IS NULL
    AND e."validTo" IS NULL AND e."deletedAt" IS NULL
    AND e.id != ALL(dc.path)
    AND dc.depth < 10
)
SELECT DISTINCT ON (id) id, type, name, via_relation, depth
FROM dependency_chain ORDER BY id, depth;
```

**"Cadena de mando desde un rol hasta la Organizacion" (upstream):**

```sql
WITH RECURSIVE hierarchy AS (
  SELECT e.id, e.type, e.name, NULL::text AS relation_type,
    0 AS level, ARRAY[e.id] AS path
  FROM org_entities e
  WHERE e.id = $1 AND e."tenantId" = $2 AND e."validTo" IS NULL

  UNION ALL

  SELECT parent.id, parent.type, parent.name, r.type,
    h.level + 1, h.path || parent.id
  FROM hierarchy h
  JOIN org_relations r ON r."fromEntityId" = h.id
    AND r.type = 'BELONGS_TO' AND r."validTo" IS NULL
  JOIN org_entities parent ON parent.id = r."toEntityId"
    AND parent."validTo" IS NULL
  WHERE parent.id != ALL(h.path) AND h.level < 10
)
SELECT * FROM hierarchy ORDER BY level;
```

**Rendimiento:** Para grafos tipicos (50-500 nodos, 5-6 niveles max), CTEs ejecutan en <10ms. Anti-ciclo via `ARRAY path` + depth limit. Indices `[fromEntityId, type]` y `[toEntityId, type]` son criticos.

#### 3.3.3 Query Router: RAG vs Knowledge Graph vs Hibrido

**Clasificacion:**

| Tipo | Ejemplo | Estrategia |
|---|---|---|
| SEMANTIC | "Que opina la gente sobre TI?" | RAG puro |
| STRUCTURAL | "Que procesos dependen del ERP?" | KG (CTE recursivo) |
| HYBRID | "Problemas del area de logistica?" | KG + RAG |
| ANALYTIC | "Rol mas sobrecargado?" | KG + metricas |
| CITATION | "Que dijo el gerente de TI sobre backups?" | RAG con filtro speakerId |

**MVP: Heuristica regex:**

```typescript
function classifyQuery(query: string): 'SEMANTIC' | 'STRUCTURAL' | 'HYBRID' | 'ANALYTIC' {
  const q = query.toLowerCase();
  if (/\b(depende|reporta|pertenece|usa el sistema|jerarqu|organigrama)\b/.test(q)) return 'STRUCTURAL';
  if (/\b(cuanto|cuantos|mas (critico|sobrecargado)|ranking|top|metrica)\b/.test(q)) return 'ANALYTIC';
  if (/\b(dijo|menciono|opino|segun|cita|textual)\b/.test(q)) return 'SEMANTIC';
  return 'HYBRID';
}
```

Default HYBRID: el peor caso de mala clasificacion es latencia extra (busca en ambos), no resultados vacios.

**Fase 2:** LLM router con gpt-5.4-mini + structured output (~100ms, ~$0.0001).

**Pipelines por tipo:**

- **SEMANTIC:** multi-query -> hybrid search -> RRF -> re-rank -> top-5 -> LLM genera respuesta
- **STRUCTURAL:** parse entities -> lookup en KG -> CTE recursivo -> format estructurado -> LLM enriquece
- **HYBRID:** KG encuentra entidades relevantes -> hybrid search con filtros -> merge -> re-rank -> LLM sintetiza
- **ANALYTIC:** graph metrics (SQL o graphology) -> format -> LLM interpreta

#### 3.3.4 Metricas de Grafo

**En SQL (eficiente):**

| Metrica | Query |
|---|---|
| Degree centrality | `GROUP BY entity_id, COUNT(*)` sobre org_relations |
| Fan-in/Fan-out | Agregacion por direccion |
| Connected components | CTE con UNION bidireccional |

**En aplicacion (via `graphology` JS library):**

| Metrica | Algoritmo | Complejidad |
|---|---|---|
| Betweenness centrality | Brandes | O(N*E), <50ms para 500 nodos |
| Articulation points | Tarjan | O(N+E), <1ms |

**Flujo para metricas en aplicacion:**

1. Cargar todos los nodos y aristas del tenant/proyecto a memoria (<1MB para 500 nodos)
2. Construir grafo con `graphology` (adjacency list)
3. Ejecutar algoritmo (betweenness, articulation points)
4. Cachear resultado por `(tenantId, projectId, metricType)` con TTL 1h
5. Invalidar cache en mutaciones de OrgEntity/OrgRelation

**Degree centrality para detectar roles sobrecargados (SQL):**

```sql
SELECT e.id, e.name, e.type,
  COUNT(DISTINCT r_out.id) AS out_degree,
  COUNT(DISTINCT r_in.id) AS in_degree,
  COUNT(DISTINCT r_out.id) + COUNT(DISTINCT r_in.id) AS total_degree
FROM org_entities e
LEFT JOIN org_relations r_out ON r_out."fromEntityId" = e.id AND r_out."validTo" IS NULL
LEFT JOIN org_relations r_in ON r_in."toEntityId" = e.id AND r_in."validTo" IS NULL
WHERE e."tenantId" = $1 AND e."projectId" = $2
  AND e."validTo" IS NULL AND e."deletedAt" IS NULL
GROUP BY e.id, e.name, e.type
ORDER BY total_degree DESC LIMIT 10;
```

---

### 3.4 Evaluacion RAGAS

#### 3.4.1 Metricas y Targets

| Metrica | Que mide | Target MVP |
|---|---|---|
| **Faithfulness** | Respuesta basada solo en chunks recuperados? | > 0.85 (CRITICO) |
| **Context Recall** | Se recuperaron todos los chunks relevantes? | > 0.80 |
| **Context Precision** | Los chunks recuperados son relevantes? | > 0.75 |
| **Answer Relevancy** | La respuesta aborda la pregunta? | > 0.80 |

Faithfulness > 0.85 es la metrica mas critica. Un diagnostico organizacional que inventa datos seria desastroso para la credibilidad.

#### 3.4.2 Golden Dataset

**Estructura:**

```typescript
interface RagTestCase {
  id: string;
  query: string;
  expectedAnswer: string;
  relevantChunkIds: string[];
  queryType: 'SEMANTIC' | 'STRUCTURAL' | 'HYBRID' | 'ANALYTIC';
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  metadata: { category: string; requiresMultiHop: boolean; requiresGraphTraversal: boolean; };
}
```

**Plan:** Fase 1: 50-100 casos manuales (consultor). Fase 2: expansion semi-automatica a 200+ (LLM genera preguntas desde chunks, consultor valida). Fase 3: evaluacion en CI/CD.

#### 3.4.3 Implementacion en TypeScript (no Python)

Las metricas RAGAS son fundamentalmente prompts "LLM-as-judge". Re-implementar las 3 core en TypeScript como `RagEvaluationService`:

**Faithfulness:**
1. Prompt: "Descompone esta respuesta en claims atomicos" -> claims[]
2. Para cada claim: "Este claim esta soportado por el contexto? SI/NO"
3. Score = claims_soportados / total_claims

**Context Precision:**
1. Para cada chunk: "Este fragmento es relevante para la pregunta? SI/NO"
2. Score = chunks_relevantes / total_chunks

**Answer Relevancy:**
1. Prompt: "Genera 3 preguntas que esta respuesta podria responder"
2. Embedding similarity de cada pregunta generada vs query original
3. Score = avg(similarities)

Python RAGAS solo para CI/CD completo (GitHub Action en PRs que tocan retrieval).

#### 3.4.4 Feedback Loop

1. Consultor califica respuestas (thumbs up/down)
2. Si thumbs down: notas opcionales sobre que fallo
3. Feedback se acumula como ground truth para expandir golden dataset
4. Re-evaluacion periodica del pipeline

Almacenar en tabla `RagFeedback { id, query, response, chunkIds, rating, notes?, tenantId, projectId, createdAt }`.

---

### 3.5 Mensajes Consolidados para Otros Equipos

#### Para be-schema:

1. Recrear indice HNSW de `memories` con `WITH (m=16, ef_construction=200)`
2. Crear indice HNSW en `interview_chunks.embedding` con mismos parametros
3. Crear indice HNSW en `org_entities.embedding` con mismos parametros
4. Crear trigger tsvector en `interview_chunks` con pesos A/B/C + indice GIN
5. Agregar `@@index([fromEntityId, type])` y `@@index([toEntityId, type])` en org_relations
6. Agregar `@@index([interviewId, chunkOrder])` en interview_chunks
7. Evaluar desnormalizar `projectId` en `interview_chunks`
8. Modelo generico `ExternalProviderConfig` para API keys de Cohere/Deepgram

#### Para be-pipeline:

1. Embeddings sobre `contextPrefix + "\n\n" + content` (NO solo content)
2. tsvector se genera automaticamente via trigger al INSERT
3. Orden: segmentar -> contextPrefix (LLM) -> topicSummary -> INSERT -> embedding (background)
4. Guardar `embeddingModel: "text-embedding-3-small"` en cada chunk

#### Para be-api:

1. `POST /org-intelligence/search` — busqueda unificada con strategy, filters, useReranking, expandQuery
2. `GET /org-intelligence/graph/:entityId/relations` — relaciones directas con depth y direction
3. `GET /org-intelligence/graph/:entityId/dependencies` — dependencias transitivas
4. `GET /org-intelligence/graph-metrics` — metricas de grafo (cacheadas)
5. `POST /org-intelligence/evaluate-rag` — evaluacion de calidad (admin)
6. `POST /org-intelligence/search-feedback` — feedback thumbs up/down

---

### 3.6 Riesgos y Mitigaciones

| Riesgo | Prob. | Impacto | Mitigacion |
|---|---|---|---|
| Cohere Rerank agrega 200-400ms | Media | Medio | Parametro `useReranking: false`, pre-calentar conexiones |
| tsvector pierde terminos tecnicos | Alta | Medio | Acronimos sobreviven stemming espanol. Vector search captura lo que BM25 pierde |
| CTEs lentos en grafos >1000 nodos | Baja | Medio | Depth limit obligatorio. Pre-computar paths. Apache AGE como escape hatch |
| Multi-query genera variantes irrelevantes | Media | Bajo | MAX (no AVG) protege contra variantes malas |
| Query router clasifica mal | Media | Bajo | Default HYBRID: latencia extra, no resultados vacios |
| Golden dataset insuficiente | Media | Medio | 50 casos manuales minimo. Expansion semi-auto ASAP |

---

### 3.7 Resumen de Decisiones

| Componente | Decision | Confianza |
|---|---|---|
| BM25 | tsvector trigger + setweight A/B/C + GIN | ALTA |
| Vector search | HNSW (m=16, ef_construction=200, ef_search=100) | ALTA |
| Fusion | RRF (k=60), alpha=0.5, top-30 por brazo | ALTA |
| Multi-query | gpt-5.4-mini, 3 variantes, MAX fusion | MEDIA-ALTA |
| Re-ranking | Cohere Rerank v3.5 (MVP) | MEDIA-ALTA |
| Contextual retrieval | contextPrefix en embedding Y tsvector | ALTA |
| Parent-document | Expansion por chunkOrder, transcript como fallback | ALTA |
| Query router | Regex heuristica (MVP), LLM (fase 2), default HYBRID | MEDIA |
| Graph traversal | CTEs recursivos + depth limit + cycle detection | ALTA |
| Graph metrics | SQL (degree), graphology JS (betweenness, articulation) | ALTA |
| Evaluacion | TypeScript LLM-as-judge (runtime), Python RAGAS (CI/CD) | MEDIA-ALTA |
| Golden dataset | 50-100 manual, semi-auto expansion | ALTA |

---

## 4. Arquitectura NestJS y API Design (Backend-4: be-api)

### 4.1 Analisis de la Arquitectura NestJS Actual

#### 4.1.1 Estructura de Modulos Existente

El API (`apps/api/src/`) sigue un patron consistente de modulos NestJS:

```
apps/api/src/
  app.module.ts              # Root module, registra todos los modulos
  prisma/                    # PrismaModule (global, inyectable)
  common/
    decorators/              # @CurrentTenant(), @CurrentUser(), @RequireScope()
    filters/                 # HttpExceptionFilter (catch-all)
    guards/                  # JwtAuthGuard, TenantGuard, ApiKeyGuard, ApiKeyScopeGuard
    interceptors/            # TenantContextInterceptor
    middleware/              # TenantResolverMiddleware (x-tenant-id header)
    pipes/                   # ZodValidationPipe
    services/                # EncryptionService + EncryptionModule
  modules/
    auth/                    # Passwordless + JWT auth
    tenants/                 # CRUD tenants
    users/                   # CRUD users
    accounting/              # 5 controllers, 5 services (mayor modulo actual)
    ai/                      # Chat, Memory, Skills, Config (modulo core AI)
    files/                   # Upload/download S3 + Document CRUD
    storage-config/          # Config S3 por tenant
    email-config/            # Config SES por tenant
    email/                   # Envio de correos
    linkedin/                # Agent LinkedIn (auth, posts, scheduler, tools)
    api-keys/                # API keys para integraciones
    public-api/              # Endpoints publicos (API keys)
    mcp/                     # Model Context Protocol
```

#### 4.1.2 Patron de Modulo Estandar

Cada modulo sigue este patron (referencia: AccountingModule con 5 controllers y 5 services):

```
module-name/
  module-name.module.ts      # @Module con imports, controllers, providers, exports
  controllers/
    feature-a.controller.ts  # Prefijo de ruta, guards a nivel de clase
    feature-b.controller.ts
  services/
    feature-a.service.ts     # Logica de negocio, inyecta PrismaService
    feature-b.service.ts
  dto/
    index.ts                 # Schemas Zod + tipos TypeScript inferidos
  tools/                     # (solo AI y LinkedIn) Definiciones de tools para LLM
```

**Convenciones observadas en todo el codebase:**
- Controllers siempre usan `@UseGuards(JwtAuthGuard, TenantGuard)` a nivel de clase
- `@CurrentTenant()` y `@CurrentUser()` como param decorators para extraer tenant/user del request
- Validacion con `@Body(new ZodValidationPipe(schema))` inline
- DTOs definidos como Zod schemas en `dto/index.ts`, con tipo inferido via `z.infer<typeof schema>`
- Schemas compartidos entre frontend y backend van en `@zeru/shared` (packages/shared/src/schemas/)
- Schemas solo del API se definen en el propio modulo (ej: `modules/ai/dto/index.ts`)
- Servicios inyectan PrismaService directamente, no hay repositorios intermedios
- Multi-tenancy via `tenantId` en todas las queries Prisma (filtrado obligatorio)
- No hay interceptors de transformacion de respuesta; los controllers retornan objetos directamente
- Paginacion manual: `{ data: [...], meta: { page, perPage, total, totalPages } }` (patron de FilesService)

#### 4.1.3 Modulo AI Actual (El Mas Relevante)

El AiModule es la referencia principal para OrgIntelligence:

```
ai/
  ai.module.ts
    imports: [PrismaModule, AccountingModule, FilesModule, EncryptionModule, LinkedInModule (forwardRef)]
    controllers: 5 (AiConfig, GeminiConfig, Chat, Memory, Skills)
    providers: 8 (ActiveStreams, AiConfig, GeminiConfig, BackgroundQueue, Chat, Memory, Skills, ToolExecutor)
    exports: 6 (ActiveStreams, AiConfig, GeminiConfig, BackgroundQueue, Memory, Skills)
```

**Patrones clave del AiModule:**
- `ChatService` (53KB) orquesta streaming SSE, tool execution, memory search, y AiUsageLog tracking
- `BackgroundQueueService` es in-process (no Redis/BullMQ), concurrencia 3, retry exponencial (3 reintentos, backoff 4^attempt * 1s)
- `MemoryService` usa raw SQL (`$executeRawUnsafe`, `$queryRawUnsafe`) para pgvector (embeddings)
- Embeddings se generan en background queue, no bloqueando la request
- Chat usa SSE (Server-Sent Events) via `Subject<ChatEvent>` de RxJS, no WebSockets
- `AiUsageLog` se registra por cada interaccion AI con: provider, model, feature, inputTokens, outputTokens, conversationId

#### 4.1.4 Cadena de Multi-Tenancy

```
Request -> TenantResolverMiddleware (x-tenant-id header -> req.tenantId)
        -> JwtAuthGuard (valida JWT, inyecta req.user con userId + tenantId)
        -> TenantGuard (verifica req.tenantId existe y coincide con req.user.tenantId)
        -> Controller (usa @CurrentTenant() para extraer tenantId)
        -> Service (SIEMPRE filtra por tenantId en queries Prisma)
```

**Patron obligatorio:** Cada query Prisma DEBE incluir `where: { tenantId }`. No hay RLS a nivel de PostgreSQL; el aislamiento es a nivel de aplicacion.

#### 4.1.5 Servicios Existentes Reutilizables

| Servicio | Modulo | Que hace | Como reutilizar para OrgIntelligence |
|----------|--------|----------|--------------------------------------|
| `AiConfigService` | AiModule | API key OpenAI decryptada por tenant | `getDecryptedApiKey(tenantId)` para llamadas al pipeline de extraccion |
| `AiUsageLog` (modelo Prisma) | - | Registro tokens/costos por interaccion | Insertar log por cada pasada de extraccion, transcripcion, embedding |
| `BackgroundQueueService` | AiModule | Cola in-process con retry | Encolar pipeline de procesamiento de entrevistas |
| `MemoryService` | AiModule | CRUD + embeddings + vector search | Patron de referencia para raw SQL con pgvector |
| `S3Service` | FilesModule | Upload/download S3 por tenant | Upload de audio, almacenamiento de transcripciones |
| `FilesService` | FilesModule | CRUD Document en DB + S3 | Registrar archivos de audio como Documents |
| `EncryptionService` | EncryptionModule | Encrypt/decrypt con ENCRYPTION_KEY | Encriptar API key de Deepgram por tenant |
| `PrismaService` | PrismaModule | Acceso a DB | Inyeccion directa en todos los servicios nuevos |

---

### 4.2 Propuesta de Estructura de Modulos

#### 4.2.1 Decision: Un Solo Modulo Principal

Propongo **un modulo principal `OrgIntelligenceModule`** con sub-organizacion interna por carpetas.

**Razones:**
1. **Cohesion:** Todo comparte el mismo modelo de datos (OrgProject, Interview, OrgEntity) y los mismos servicios base.
2. **Precedente:** AiModule ya agrupa 5 controllers y 8 services. AccountingModule agrupa 5 controllers y 5 services.
3. **Dependencias cruzadas internas:** TranscriptionService -> ExtractionPipelineService -> OrgKnowledgeService. Si fueran modulos separados, habria circular dependencies.
4. **Un solo `exports` limpio:** Los demas modulos solo necesitan importar OrgIntelligenceModule.

**Clausula de escape:** Si la complejidad supera ~15 servicios, extraer `OrgRagModule` (search) y `OrgAnalysisModule` (diagnosis, diagrams) como sub-modulos. Para MVP, un solo modulo.

#### 4.2.2 Estructura de Carpetas

```
apps/api/src/modules/org-intelligence/
  org-intelligence.module.ts

  controllers/
    org-projects.controller.ts       # CRUD de proyectos
    interviews.controller.ts         # CRUD, upload audio, status, transcripcion
    org-entities.controller.ts       # CRUD entidades del KG
    org-relations.controller.ts      # CRUD relaciones del KG
    org-search.controller.ts         # RAG hibrido (busqueda sobre KG + chunks)
    org-diagrams.controller.ts       # Generacion de diagramas Mermaid
    org-diagnosis.controller.ts      # Analisis: SPOF, cuellos de botella, contradicciones
    org-improvements.controller.ts   # CRUD mejoras + priorizacion RICE
    org-problems.controller.ts       # CRUD problemas detectados

  services/
    # --- Pipeline de procesamiento ---
    transcription.service.ts         # STT con Deepgram/OpenAI, formato unificado
    extraction-pipeline.service.ts   # Orquesta 5 pasadas de extraccion multi-paso
    coreference.service.ts           # Resolucion de correferencias + entity linking
    chunking.service.ts              # Chunking multi-capa de transcripciones

    # --- Knowledge Graph ---
    org-knowledge.service.ts         # CRUD OrgEntity + OrgRelation, reconciliacion
    org-reconciliation.service.ts    # Entity linking inter-entrevista, deteccion contradicciones

    # --- RAG y Busqueda ---
    org-search.service.ts            # Hybrid search (BM25 + vector), RRF, re-ranking
    org-embedding.service.ts         # Embeddings para entidades y chunks (pgvector)

    # --- Analisis y Diagnostico ---
    org-diagnosis.service.ts         # SPOF, betweenness centrality, metricas de complejidad
    org-summary.service.ts           # Resumenes multi-nivel (entrevista, area, ejecutivo)

    # --- Diagramas ---
    org-diagram.service.ts           # Generacion JSON -> Mermaid

    # --- Mejoras ---
    org-improvements.service.ts      # CRUD + scoring RICE con LLM

    # --- Procesamiento asincrono ---
    interview-processing.job.ts      # Job que orquesta el pipeline end-to-end

  dto/
    org-project.dto.ts
    interview.dto.ts
    org-entity.dto.ts
    org-relation.dto.ts
    org-search.dto.ts
    org-diagram.dto.ts
    org-diagnosis.dto.ts
    org-improvement.dto.ts
    org-problem.dto.ts
    index.ts                         # Re-exports

  schemas/                           # Schemas Zod para Structured Outputs (OpenAI)
    extraction-pass-1.schema.ts      # Entidades basicas (roles, departamentos, sistemas)
    extraction-pass-2.schema.ts      # Procesos y actividades
    extraction-pass-3.schema.ts      # Problemas e ineficiencias
    extraction-pass-4.schema.ts      # Dependencias inter-proceso
    extraction-pass-5.schema.ts      # Claims facticos y metricas
    transcription-result.schema.ts   # Formato unificado de transcripcion
    diagram-intermediate.schema.ts   # JSON intermedio para diagramas
    index.ts
```

#### 4.2.3 Registro del Modulo

```typescript
// org-intelligence.module.ts
@Module({
  imports: [
    PrismaModule,
    FilesModule,          // S3Service, FilesService
    AiModule,             // AiConfigService, BackgroundQueueService, MemoryService
    EncryptionModule,     // Para encriptar API keys de Deepgram
  ],
  controllers: [
    OrgProjectsController,
    InterviewsController,
    OrgEntitiesController,
    OrgRelationsController,
    OrgSearchController,
    OrgDiagramsController,
    OrgDiagnosisController,
    OrgImprovementsController,
    OrgProblemsController,
  ],
  providers: [
    TranscriptionService,
    ExtractionPipelineService,
    CoreferenceService,
    ChunkingService,
    OrgKnowledgeService,
    OrgReconciliationService,
    OrgSearchService,
    OrgEmbeddingService,
    OrgDiagnosisService,
    OrgSummaryService,
    OrgDiagramService,
    OrgImprovementsService,
  ],
  exports: [
    OrgKnowledgeService,   // Para que AiModule consulte el KG desde el chat
    OrgSearchService,      // Para que el chat busque en el KG
  ],
})
export class OrgIntelligenceModule {}
```

**En app.module.ts:** agregar `OrgIntelligenceModule` al array de imports.

---

### 4.3 Endpoints REST - API Design

#### 4.3.1 Convencion de Naming

Siguiendo los patrones existentes:
- **Prefijo base:** `/org-intelligence` (como `/accounting` agrupa journal-entries, chart-of-accounts)
- **Recursos en plural:** `/projects`, `/interviews`, `/entities`, `/relations`
- **Acciones como sub-paths:** `POST /interviews/:id/upload-audio`, `POST /interviews/:id/process`
- **Busqueda como recurso:** `POST /search` (POST porque el body puede ser complejo)
- **Generaciones como acciones:** `POST /diagrams/generate`

#### 4.3.2 Endpoints Completos

##### OrgProjects (`/org-intelligence/projects`)

| Metodo | Path | Descripcion | DTO |
|--------|------|-------------|-----|
| `POST` | `/` | Crear proyecto | `CreateOrgProjectDto` |
| `GET` | `/` | Listar proyectos del tenant | Query: `?status=ACTIVE&page=1&perPage=20` |
| `GET` | `/:id` | Detalle de proyecto (con stats) | - |
| `PATCH` | `/:id` | Actualizar proyecto | `UpdateOrgProjectDto` |
| `DELETE` | `/:id` | Soft-delete proyecto | - |
| `GET` | `/:id/summary` | Resumen ejecutivo del proyecto | - |

##### Interviews (`/org-intelligence/interviews`)

| Metodo | Path | Descripcion | DTO |
|--------|------|-------------|-----|
| `POST` | `/` | Crear entrevista (metadata) | `CreateInterviewDto` |
| `GET` | `/?projectId=xxx` | Listar entrevistas de un proyecto | Query params |
| `GET` | `/:id` | Detalle de entrevista (con speakers, status) | - |
| `PATCH` | `/:id` | Actualizar metadata | `UpdateInterviewDto` |
| `DELETE` | `/:id` | Soft-delete entrevista | - |
| `POST` | `/:id/upload-audio` | Subir audio (multipart/form-data) | File upload |
| `POST` | `/:id/process` | Lanzar pipeline de procesamiento async | - |
| `GET` | `/:id/status` | Estado del pipeline (step tracker) | - |
| `GET` | `/:id/transcription` | Obtener transcripcion con diarizacion | - |
| `GET` | `/:id/extraction` | Obtener resultado de extraccion | - |
| `GET` | `/:id/chunks` | Obtener chunks semanticos | Query: `?page=1&perPage=50` |
| `PATCH` | `/:id/speakers` | Actualizar metadata de speakers | `UpdateSpeakersDto` |

##### OrgEntities (`/org-intelligence/entities`)

| Metodo | Path | Descripcion | DTO |
|--------|------|-------------|-----|
| `GET` | `/?projectId=xxx&type=PROCESS` | Listar entidades con filtros | Query params |
| `GET` | `/:id` | Detalle de entidad (con relaciones) | - |
| `PATCH` | `/:id` | Editar entidad (validacion humana) | `UpdateOrgEntityDto` |
| `POST` | `/:id/approve` | Aprobar entidad (sube confidence) | - |
| `POST` | `/:id/reject` | Rechazar entidad (marca inactiva) | - |
| `POST` | `/merge` | Fusionar dos entidades duplicadas | `MergeEntitiesDto` |

##### OrgRelations (`/org-intelligence/relations`)

| Metodo | Path | Descripcion | DTO |
|--------|------|-------------|-----|
| `GET` | `/?projectId=xxx&type=DEPENDS_ON` | Listar relaciones con filtros | Query params |
| `GET` | `/:id` | Detalle de relacion (con evidencia) | - |
| `PATCH` | `/:id` | Editar relacion | `UpdateOrgRelationDto` |
| `DELETE` | `/:id` | Eliminar relacion | - |

##### Search (`/org-intelligence/search`)

| Metodo | Path | Descripcion | DTO |
|--------|------|-------------|-----|
| `POST` | `/` | Busqueda hibrida RAG | `OrgSearchDto` |
| `POST` | `/entities` | Busqueda semantica sobre entidades | `EntitySearchDto` |
| `POST` | `/graph` | Query de grafo (traversal) | `GraphQueryDto` |

##### Diagrams (`/org-intelligence/diagrams`)

| Metodo | Path | Descripcion | DTO |
|--------|------|-------------|-----|
| `POST` | `/generate` | Generar diagrama Mermaid desde KG | `GenerateDiagramDto` |
| `GET` | `/?projectId=xxx` | Listar diagramas guardados | Query params |
| `GET` | `/:id` | Obtener diagrama guardado | - |

##### Diagnosis (`/org-intelligence/diagnosis`)

| Metodo | Path | Descripcion | DTO |
|--------|------|-------------|-----|
| `POST` | `/analyze` | Lanzar analisis completo async | `AnalyzeProjectDto` |
| `GET` | `/?projectId=xxx` | Obtener diagnostico del proyecto | - |
| `GET` | `/spof?projectId=xxx` | Single Points of Failure | - |
| `GET` | `/bottlenecks?projectId=xxx` | Cuellos de botella (betweenness) | - |
| `GET` | `/contradictions?projectId=xxx` | Contradicciones entre entrevistas | - |
| `POST` | `/contradictions/:id/resolve` | Resolver contradiccion | `ResolveContradictionDto` |

##### Problems (`/org-intelligence/problems`)

| Metodo | Path | Descripcion | DTO |
|--------|------|-------------|-----|
| `GET` | `/?projectId=xxx&severity=CRITICAL` | Listar problemas | Query params |
| `GET` | `/:id` | Detalle de problema (entidades afectadas + evidencia) | - |
| `PATCH` | `/:id` | Editar problema | `UpdateProblemDto` |
| `POST` | `/:id/approve` | Validar problema | - |

##### Improvements (`/org-intelligence/improvements`)

| Metodo | Path | Descripcion | DTO |
|--------|------|-------------|-----|
| `POST` | `/` | Crear mejora propuesta | `CreateImprovementDto` |
| `GET` | `/?projectId=xxx` | Listar mejoras (con RICE score) | Query params |
| `GET` | `/:id` | Detalle de mejora | - |
| `PATCH` | `/:id` | Editar mejora | `UpdateImprovementDto` |
| `POST` | `/score` | Calcular RICE scores con LLM | `ScoreImprovementsDto` |
| `GET` | `/matrix?projectId=xxx` | Matriz esfuerzo-impacto | - |

#### 4.3.3 Respuestas Estandar

**Paginacion** (consistente con `FilesService.findAll`):

```typescript
{
  data: T[],
  meta: {
    page: number,
    perPage: number,
    total: number,
    totalPages: number
  }
}
```

**Errores** (consistente con `HttpExceptionFilter`):

```typescript
{
  statusCode: number,
  message: string,
  timestamp: string,
  errors?: Array<{ field: string, message: string }>  // Solo en 400 de validacion Zod
}
```

**Status de pipeline** (tipo nuevo para procesamiento asincrono):

```typescript
{
  interviewId: string,
  status: "PENDING" | "TRANSCRIBING" | "EXTRACTING" | "CHUNKING" | "EMBEDDING" | "RECONCILING" | "COMPLETED" | "FAILED",
  currentStep: number,      // 1-8
  totalSteps: number,       // 8
  stepName: string,          // "Transcribiendo audio..."
  progress: number,          // 0-100
  startedAt: string,
  completedAt?: string,
  error?: string
}
```

---

### 4.4 DTOs con Zod

#### 4.4.1 Patron de DTO (Consistente con el Proyecto)

- Definidos como Zod schemas con tipo TypeScript inferido
- Validados via `ZodValidationPipe` en el controller
- Schemas compartidos (frontend + backend) en `@zeru/shared`
- Schemas solo API en `modules/org-intelligence/dto/`
- Schemas de Structured Outputs (extraction) en `modules/org-intelligence/schemas/` (separados de DTOs)

#### 4.4.2 DTOs Principales

**Proyecto:**
```typescript
// dto/org-project.dto.ts
export const createOrgProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});
export const updateOrgProjectSchema = createOrgProjectSchema.partial();
export type CreateOrgProjectDto = z.infer<typeof createOrgProjectSchema>;
```

**Entrevista:**
```typescript
// dto/interview.dto.ts
export const createInterviewSchema = z.object({
  projectId: z.string().uuid(),
  interviewDate: z.string().datetime().optional(),
  notes: z.string().optional(),
  speakers: z.array(z.object({
    label: z.string().min(1),
    role: z.string().optional(),
    department: z.string().optional(),
  })).optional(),
});

export const updateSpeakersSchema = z.object({
  speakers: z.array(z.object({
    id: z.string().uuid().optional(),
    label: z.string().min(1),
    role: z.string().optional(),
    department: z.string().optional(),
    personEntityId: z.string().uuid().optional(),
  })),
});
```

**Busqueda:**
```typescript
// dto/org-search.dto.ts
export const orgSearchSchema = z.object({
  query: z.string().min(1),
  projectId: z.string().uuid(),
  mode: z.enum(["hybrid", "semantic", "graph"]).default("hybrid"),
  filters: z.object({
    entityTypes: z.array(z.string()).optional(),
    speakerRoles: z.array(z.string()).optional(),
    minConfidence: z.number().min(0).max(1).optional(),
    interviewIds: z.array(z.string().uuid()).optional(),
  }).optional(),
  limit: z.number().int().min(1).max(50).default(10),
});
```

**Diagrama:**
```typescript
// dto/org-diagram.dto.ts
export const generateDiagramSchema = z.object({
  projectId: z.string().uuid(),
  type: z.enum(["flowchart", "sequence", "state", "hierarchy"]),
  scope: z.object({
    entityIds: z.array(z.string().uuid()).optional(),
    processId: z.string().uuid().optional(),
    departmentId: z.string().uuid().optional(),
  }),
  format: z.enum(["mermaid", "json"]).default("mermaid"),
});
```

**Mejora:**
```typescript
// dto/org-improvement.dto.ts
export const createImprovementSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string(),
  problemIds: z.array(z.string().uuid()).optional(),
  reach: z.number().int().min(1).max(10).optional(),
  impact: z.number().int().min(1).max(10).optional(),
  confidence: z.number().int().min(1).max(10).optional(),
  effort: z.number().int().min(1).max(10).optional(),
});
```

#### 4.4.3 Schemas para @zeru/shared

Schemas que el frontend necesita para validacion de formularios:

- `createOrgProjectSchema` / `updateOrgProjectSchema`
- `createInterviewSchema` / `updateSpeakersSchema`
- `createImprovementSchema` / `updateImprovementSchema`
- Enums: `OrgEntityType`, `OrgRelationType`, `ProblemSeverity`, `InterviewProcessingStatus`
- Tipos: `OrgEntityDetail`, `SearchResult`, `ProcessingStatus`

**Nota para be-schema:** Los DTOs (input del controller) son DISTINTOS de los schemas de Structured Outputs (output del LLM). DTOs en `dto/`, extraction schemas en `schemas/`. No mezclarlos.

---

### 4.5 Guards y Permisos

#### Estado Actual

Zeru tiene roles: `OWNER`, `ADMIN`, `ACCOUNTANT`, `VIEWER` (enum `UserRole`). Actualmente NO se aplican roles granulares -- todos los endpoints autenticados son accesibles para cualquier miembro del tenant.

#### Propuesta para OrgIntelligence

**MVP:** Mantener el mismo patron simple: `JwtAuthGuard + TenantGuard` en todos los controllers. Cualquier miembro del tenant puede acceder.

**Fase 2:** Guard de rol ligero si se necesita restringir (ej: solo OWNER/ADMIN pueden crear proyectos, VIEWER solo puede leer).

**Justificacion:** Los primeros usuarios seran consultores con acceso completo. Granularidad de permisos es una preocupacion de Fase 3.

---

### 4.6 Integracion con Modulos Existentes

#### 4.6.1 AiUsageLog - Tracking de Costos

Cada operacion AI del pipeline DEBE registrar un `AiUsageLog`. Patron existente en ChatService:

```typescript
await this.prisma.aiUsageLog.create({
  data: {
    provider: 'OPENAI',
    model: 'gpt-4.1-nano',
    feature: 'org-extraction-pass-1',
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    totalTokens: response.usage.total_tokens,
    cachedTokens: response.usage.input_tokens_details?.cached_tokens ?? 0,
    tenantId,
  },
});
```

**Features para AiUsageLog:**
- `org-transcription` (Deepgram STT)
- `org-extraction-pass-1` a `org-extraction-pass-5`
- `org-embedding`
- `org-summary-interview`, `org-summary-area`, `org-summary-executive`
- `org-diagram-generation`
- `org-rice-scoring`
- `org-contradiction-detection`
- `org-coreference-resolution`

#### 4.6.2 S3 - Almacenamiento de Audio

Reutilizar `S3Service` y `FilesService` existentes:
- Key format: `tenants/${tenantId}/org-intelligence/${projectId}/interviews/${interviewId}/audio.${ext}`
- Audio se registra como Document (model existente) + referencia en tabla Interview (`audioDocumentId`)

#### 4.6.3 BackgroundQueueService - Procesamiento Asincrono

**MVP:** Reutilizar tal cual (in-process, concurrencia 3, retry exponencial):

```typescript
this.backgroundQueue.enqueue({
  name: `interview-pipeline:${interviewId.slice(0, 8)}`,
  fn: () => this.processInterview(interviewId, tenantId),
  maxRetries: 2,
});
```

**Fase 2:** Considerar BullMQ con Redis si se necesita:
- Persistencia de jobs entre reinicios
- Monitoring (Bull Board)
- Concurrencia configurable por tipo de job

**Decision diferida:** No migrar a BullMQ para MVP. El servicio actual es suficiente para ~10-15 entrevistas por proyecto.

#### 4.6.4 Chat + Knowledge Graph Integration

El chat existente podria consultar el KG. Integracion:

1. OrgIntelligenceModule exporta `OrgKnowledgeService` y `OrgSearchService`
2. AiModule importa OrgIntelligenceModule (con `forwardRef`, mismo patron que LinkedInModule)
3. ToolExecutor del chat recibe nuevas tools:
   - `search_org_knowledge`: Busca en el KG del proyecto activo
   - `get_org_entity_details`: Detalles de una entidad
   - `get_process_diagram`: Genera diagrama del proceso consultado

**Circular dependency AiModule <-> OrgIntelligenceModule:** Se resuelve con `forwardRef(() => OrgIntelligenceModule)`, patron ya establecido con LinkedInModule.

---

### 4.7 Servicios Internos - Responsabilidades

#### TranscriptionService
- **Responsabilidad:** Interfaz unificada para STT. Abstrae Deepgram vs OpenAI.
- **Dependencias:** AiConfigService, S3Service, PrismaService.
- **Metodos:** `transcribe(tenantId, interviewId)`, `getTranscription(interviewId, tenantId)`
- **Nota para be-pipeline:** Almacenar resultado como JSON en Interview (`transcriptionJson`), no solo texto plano.

#### ExtractionPipelineService
- **Responsabilidad:** Orquesta 5 pasadas de extraccion con Structured Outputs.
- **Dependencias:** AiConfigService, PrismaService, OrgKnowledgeService.
- **Metodos:** `runFullExtraction(tenantId, interviewId)`, `runPass(passNumber, tenantId, transcription, previousResults)`
- **Nota para be-pipeline:** Cada pasada usa modelo diferente (nano/mini/gpt-4.1). Debe ser idempotente (reiniciable desde el punto de falla).

#### OrgKnowledgeService
- **Responsabilidad:** CRUD de OrgEntity y OrgRelation. Logica de merge/dedup.
- **Dependencias:** PrismaService, OrgEmbeddingService.
- **Metodos:** `createEntity()`, `createRelation()`, `findEntities()`, `getEntityWithRelations()`, `mergeEntities()`, `approveEntity()`

#### OrgSearchService
- **Responsabilidad:** Busqueda hibrida RAG sobre chunks y entidades.
- **Dependencias:** PrismaService, OrgEmbeddingService, AiConfigService.
- **Metodos:** `hybridSearch()` (BM25 + vector + RRF), `entitySearch()`, `graphTraversal()`
- **Nota para be-rag:** Implementado con raw SQL via `prisma.$queryRawUnsafe()`, consistente con MemoryService.

#### OrgDiagnosisService
- **Responsabilidad:** Analisis del grafo organizacional.
- **Metodos:** `detectSPOF()` (articulation points + betweenness), `detectBottlenecks()` (fan-in/fan-out), `detectContradictions()`, `calculateProcessMetrics()` (CFC, NOA, density, handoffs)

#### InterviewProcessingJob
- **Responsabilidad:** Orquesta pipeline end-to-end.
- **Pasos secuenciales:** TRANSCRIBING -> EXTRACTING -> CHUNKING -> EMBEDDING -> RECONCILING -> COMPLETED
- **Idempotencia:** Campo `processingStep` en Interview permite reanudar desde punto de falla.

---

### 4.8 Mensajes para Otros Investigadores

#### Para be-schema:

Los DTOs mapean directamente a los modelos Prisma del findings:
- `CreateOrgProjectDto` -> `OrgProject`
- `CreateInterviewDto` -> `Interview`
- `UpdateOrgEntityDto` -> `OrgEntity`
- `MergeEntitiesDto` -> operacion sobre `OrgEntity`

Los schemas compartidos con frontend deben ir en `@zeru/shared`:
- Enums: `OrgEntityType`, `OrgRelationType`, `ProblemSeverity`, `InterviewProcessingStatus`
- Schemas de formulario: `createOrgProjectSchema`, `createInterviewSchema`, `createImprovementSchema`

Los schemas de Structured Outputs (extraction) NO van en shared -- son internos del API.

#### Para be-pipeline:

La estructura de servicios alinea con el pipeline:
- `TranscriptionService` -> Steps 1-3 (STT + post-processing)
- `ExtractionPipelineService` -> Steps 4-6 (5 pasadas + validation)
- `ChunkingService` -> Crea InterviewChunks con embedding + tsvector
- `OrgReconciliationService` -> Steps 7-8 (entity linking + contradicciones)
- `InterviewProcessingJob` -> Orquestador secuencial

Sobre BackgroundQueueService: concurrencia 3, in-process. Funciona para MVP (~10-15 entrevistas). Si necesitas paralelismo real, habremos de migrar a BullMQ.

Sobre idempotencia: cada servicio debe guardar resultado en DB antes de pasar al siguiente paso. El campo `processingStep` en Interview permite detectar pasos incompletos.

#### Para be-rag:

Endpoints de busqueda:
- `POST /org-intelligence/search` -> busqueda hibrida general
- `POST /org-intelligence/search/entities` -> semantica sobre KG
- `POST /org-intelligence/search/graph` -> traversal de grafo

La query hibrida se implementa en SQL puro (tsvector + pgvector + RRF) via `prisma.$queryRawUnsafe()`, consistente con MemoryService. Sin Elasticsearch ni servicios externos.

El DTO de busqueda incluye `mode: "hybrid" | "semantic" | "graph"` para cambiar estrategia sin romper el contrato del API. Re-ranking (Cohere Rerank) se agrega en Fase 3 sin cambiar endpoints.

---

### 4.9 Riesgos y Trade-offs

1. **BackgroundQueueService in-process:** Si el server se reinicia durante procesamiento, el job se pierde. Mitigacion: campo `processingStep` en Interview permite detectar y re-lanzar jobs incompletos al iniciar.

2. **Raw SQL para pgvector/tsvector:** Prisma no soporta estos tipos nativamente. Se usan `$queryRawUnsafe` / `$executeRawUnsafe`, lo que pierde type safety. Mitigacion: encapsular en metodos dedicados de OrgEmbeddingService y OrgSearchService (mismo patron que MemoryService).

3. **Modulo grande:** 9 controllers y 12+ services. Si se vuelve inmanejable, dividir en OrgIntelligenceModule (core) + OrgRagModule (search) + OrgAnalysisModule (diagnosis). Para MVP, la cohesion justifica un solo modulo.

4. **Circular dependency AiModule <-> OrgIntelligenceModule:** Solucion probada: `forwardRef()` (ya usado con LinkedInModule). Alternativa: modulo intermedio compartido.

5. **No hay WebSocket para progress tracking:** Status del pipeline via polling (`GET /:id/status`). Para Fase 2, considerar SSE stream de progreso (patron ya existente en ChatController).
