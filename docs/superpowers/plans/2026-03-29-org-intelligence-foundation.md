# Org Intelligence Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the Prisma schema, NestJS module scaffold, and core CRUD for OrgProject and Interview — the foundation everything else builds on.

**Architecture:** 10 new Prisma models with 8 enums, raw SQL migrations for pgvector HNSW + tsvector + GIN indices, one NestJS module (`OrgIntelligenceModule`) with initial controllers/services for projects and interviews, including audio upload to S3.

**Tech Stack:** Prisma ORM, PostgreSQL + pgvector + tsvector, NestJS, Zod, S3 (existing FilesModule)

**Reference docs:**
- `docs/research/backend-plan.md` — Full backend design (2929 lines)
- `docs/research/org-intelligence-findings.md` — Research consensus (1935 lines)
- `docs/research/ux-plan.md` — UX design (2510 lines)

---

## File Structure

### New files to create

```
apps/api/prisma/schema.prisma                          # MODIFY — add 10 models + 8 enums
apps/api/prisma/migrations/XXXXXX_org_intelligence_base/migration.sql  # AUTO — prisma migrate
apps/api/prisma/migrations/XXXXXX_org_intelligence_indices/migration.sql  # MANUAL — HNSW + tsvector + GIN

apps/api/src/modules/org-intelligence/
  org-intelligence.module.ts                            # Module registration
  controllers/
    projects.controller.ts                              # CRUD OrgProject
    interviews.controller.ts                            # CRUD Interview + upload audio + process
  services/
    projects.service.ts                                 # OrgProject business logic
    interviews.service.ts                               # Interview CRUD + upload
  dto/
    index.ts                                            # Zod schemas for DTOs

packages/shared/src/org-intelligence.ts                 # Shared types/enums between API and web
```

### Files to modify

```
apps/api/src/app.module.ts                              # Register OrgIntelligenceModule
apps/api/prisma/schema.prisma                           # Add models + relations to Tenant/User
```

---

### Task 1: Add Prisma Enums

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Read current schema to find insertion point**

Read the end of schema.prisma to find where to add new enums. Existing enums are at the top of the file. Add new enums after the existing ones.

- [ ] **Step 2: Add all 8 enums to schema.prisma**

Add after the last existing enum:

```prisma
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
  PROBLEM
  IMPROVEMENT

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
```

- [ ] **Step 3: Validate schema**

Run: `cd apps/api && npx prisma validate`
Expected: "The schema is valid."

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(org-intelligence): add 8 prisma enums for org intelligence module"
```

---

### Task 2: Add OrgProject Model

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add OrgProject model**

Add after the enums:

```prisma
model OrgProject {
  id          String           @id @default(uuid())
  name        String
  description String?
  status      OrgProjectStatus @default(DRAFT)
  startDate   DateTime?
  endDate     DateTime?
  config      Json?

  deletedAt DateTime?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  createdById String?
  createdBy   User?    @relation("OrgProjectsCreated", fields: [createdById], references: [id], onDelete: SetNull)

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

- [ ] **Step 2: Add reverse relations to Tenant and User**

Find the `Tenant` model and add:
```prisma
orgProjects OrgProject[]
```

Find the `User` model and add:
```prisma
orgProjectsCreated OrgProject[] @relation("OrgProjectsCreated")
```

- [ ] **Step 3: Validate schema**

Run: `cd apps/api && npx prisma validate`
Expected: "The schema is valid."

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(org-intelligence): add OrgProject model with tenant/user relations"
```

---

### Task 3: Add Interview + InterviewSpeaker Models

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add Interview model**

```prisma
model Interview {
  id                   String               @id @default(uuid())
  title                String?
  audioS3Key           String?
  audioMimeType        String?
  audioDurationMs      Int?
  transcriptionText    String?
  transcriptionJson    Json?
  transcriptionStatus  TranscriptionStatus  @default(PENDING)
  transcriptionProvider TranscriptionProvider?
  interviewDate        DateTime?
  extractionResult     Json?
  processingStatus     String               @default("PENDING")
  processingError      String?

  deletedAt DateTime?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  projectId String
  project   OrgProject @relation(fields: [projectId], references: [id], onDelete: Cascade)
  tenantId  String

  speakers InterviewSpeaker[]
  chunks   InterviewChunk[]

  @@index([projectId])
  @@index([tenantId])
  @@index([tenantId, processingStatus])
  @@map("interviews")
}
```

- [ ] **Step 2: Add InterviewSpeaker model**

```prisma
model InterviewSpeaker {
  id             String  @id @default(uuid())
  speakerLabel   String
  name           String?
  role           String?
  department     String?
  isInterviewer  Boolean @default(false)

  interviewId    String
  interview      Interview @relation(fields: [interviewId], references: [id], onDelete: Cascade)
  personEntityId String?

  chunks InterviewChunk[]

  @@unique([interviewId, speakerLabel])
  @@index([interviewId])
  @@map("interview_speakers")
}
```

- [ ] **Step 3: Validate schema**

Run: `cd apps/api && npx prisma validate`
Expected: "The schema is valid."

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(org-intelligence): add Interview and InterviewSpeaker models"
```

---

### Task 4: Add InterviewChunk Model

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add InterviewChunk model**

```prisma
model InterviewChunk {
  id             String  @id @default(uuid())
  content        String
  contextPrefix  String?
  topicSummary   String?
  startTimeMs    Int?
  endTimeMs      Int?
  chunkOrder     Int
  tokenCount     Int?
  embeddingModel String?

  embedding Unsupported("vector(1536)")?
  tsv       Unsupported("tsvector")?

  interviewId String
  interview   Interview @relation(fields: [interviewId], references: [id], onDelete: Cascade)
  speakerId   String?
  speaker     InterviewSpeaker? @relation(fields: [speakerId], references: [id], onDelete: SetNull)
  parentChunkId String?
  tenantId      String

  @@index([interviewId])
  @@index([tenantId])
  @@index([tenantId, interviewId])
  @@map("interview_chunks")
}
```

- [ ] **Step 2: Validate schema**

Run: `cd apps/api && npx prisma validate`
Expected: "The schema is valid."

- [ ] **Step 3: Commit**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(org-intelligence): add InterviewChunk model with pgvector and tsvector"
```

---

### Task 5: Add OrgEntity + OrgRelation Models

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add OrgEntity model**

```prisma
model OrgEntity {
  id               String        @id @default(uuid())
  type             OrgEntityType
  name             String
  description      String?
  metadata         Json?
  status           String        @default("ACTIVE")
  aliases          String[]
  validFrom        DateTime      @default(now())
  validTo          DateTime?
  version          Int           @default(1)
  originalEntityId String?
  confidence       Float         @default(0.5)
  sourceChunkIds   String[]
  sourceInterviewId String?

  embedding Unsupported("vector(1536)")?

  deletedAt DateTime?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  tenantId  String
  projectId String
  project   OrgProject @relation(fields: [projectId], references: [id], onDelete: Cascade)

  relationsFrom OrgRelation[] @relation("FromEntity")
  relationsTo   OrgRelation[] @relation("ToEntity")
  problemLinks  ProblemLink[]

  @@index([tenantId, projectId, type])
  @@index([tenantId, type, status])
  @@index([tenantId, projectId, type, validTo])
  @@map("org_entities")
}
```

- [ ] **Step 2: Add OrgRelation model**

```prisma
model OrgRelation {
  id          String          @id @default(uuid())
  type        OrgRelationType
  description String?
  metadata    Json?
  weight      Float           @default(1.0)

  fromEntityId String
  fromEntity   OrgEntity @relation("FromEntity", fields: [fromEntityId], references: [id], onDelete: Cascade)
  toEntityId   String
  toEntity     OrgEntity @relation("ToEntity", fields: [toEntityId], references: [id], onDelete: Cascade)

  validFrom         DateTime @default(now())
  validTo           DateTime?
  confidence        Float    @default(0.5)
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

- [ ] **Step 3: Validate schema**

Run: `cd apps/api && npx prisma validate`
Expected: "The schema is valid."

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(org-intelligence): add OrgEntity and OrgRelation knowledge graph models"
```

---

### Task 6: Add Problem + ProblemLink + Improvement Models

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add Problem, ProblemLink, and Improvement models**

```prisma
model Problem {
  id          String          @id @default(uuid())
  title       String
  description String
  severity    ProblemSeverity
  category    String?
  evidence    Json?
  confidence  Float           @default(0.5)
  sourceInterviewId String?
  riceScore   Json?

  deletedAt DateTime?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

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

model ProblemLink {
  id                String @id @default(uuid())
  impactDescription String?

  problemId String
  problem   Problem   @relation(fields: [problemId], references: [id], onDelete: Cascade)
  entityId  String
  entity    OrgEntity @relation(fields: [entityId], references: [id], onDelete: Cascade)

  @@unique([problemId, entityId])
  @@index([problemId])
  @@index([entityId])
  @@map("problem_links")
}

model Improvement {
  id          String  @id @default(uuid())
  title       String
  description String
  type        String?
  effort      String?
  impact      String?
  priority    Int?
  status      String  @default("PROPOSED")

  deletedAt DateTime?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  tenantId  String
  projectId String
  project   OrgProject @relation(fields: [projectId], references: [id], onDelete: Cascade)
  problemId String
  problem   Problem    @relation(fields: [problemId], references: [id], onDelete: Cascade)

  @@index([tenantId, projectId])
  @@index([problemId])
  @@map("improvements")
}
```

- [ ] **Step 2: Validate schema**

Run: `cd apps/api && npx prisma validate`
Expected: "The schema is valid."

- [ ] **Step 3: Commit**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(org-intelligence): add Problem, ProblemLink, and Improvement models"
```

---

### Task 7: Add FactualClaim + ConflictRecord Models

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add FactualClaim and ConflictRecord models**

```prisma
model FactualClaim {
  id          String @id @default(uuid())
  subject     String
  predicate   String
  object      String
  claimType   String
  confidence  Float  @default(0.5)
  evidence    String?
  sourceInterviewId String?
  sourceChunkId     String?

  createdAt DateTime @default(now())

  tenantId  String
  projectId String
  project   OrgProject @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([tenantId, projectId])
  @@index([subject])
  @@index([tenantId, projectId, subject, predicate])
  @@map("factual_claims")
}

model ConflictRecord {
  id             String             @id @default(uuid())
  type           ConflictType
  description    String
  claimsData     Json
  interviewIds   String[]
  resolution     ConflictResolution @default(PENDING)
  resolutionNotes String?
  resolvedAt     DateTime?

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

- [ ] **Step 2: Validate schema**

Run: `cd apps/api && npx prisma validate`
Expected: "The schema is valid."

- [ ] **Step 3: Commit**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(org-intelligence): add FactualClaim and ConflictRecord models"
```

---

### Task 8: Run Prisma Migration + Manual SQL Indices

**Files:**
- Create: `apps/api/prisma/migrations/XXXXXX_org_intelligence/migration.sql` (auto)
- Create: `apps/api/prisma/migrations/XXXXXX_org_intelligence_indices/migration.sql` (manual)

- [ ] **Step 1: Generate and apply Prisma migration**

Run: `cd apps/api && npx prisma migrate dev --name org_intelligence`
Expected: Migration created and applied successfully. Prisma Client generated.

- [ ] **Step 2: Create manual migration for pgvector HNSW + tsvector indices**

Run: `cd apps/api && npx prisma migrate dev --create-only --name org_intelligence_indices`

Then replace the contents of the generated empty migration file with:

```sql
-- InterviewChunk: HNSW index for vector search
CREATE INDEX idx_interview_chunks_embedding_hnsw ON interview_chunks
USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 200);

-- InterviewChunk: tsvector auto-update trigger (Spanish, weighted A/B/C)
CREATE OR REPLACE FUNCTION interview_chunks_tsv_trigger() RETURNS trigger AS $$
BEGIN
  NEW.tsv :=
    setweight(to_tsvector('spanish', COALESCE(NEW."topicSummary", '')), 'A') ||
    setweight(to_tsvector('spanish', COALESCE(NEW."contextPrefix", '')), 'B') ||
    setweight(to_tsvector('spanish', COALESCE(NEW.content, '')), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER trig_interview_chunks_tsv
  BEFORE INSERT OR UPDATE OF content, "contextPrefix", "topicSummary"
  ON interview_chunks
  FOR EACH ROW
  EXECUTE FUNCTION interview_chunks_tsv_trigger();

-- InterviewChunk: GIN index for full-text search
CREATE INDEX idx_interview_chunks_tsv ON interview_chunks USING gin(tsv);

-- OrgEntity: HNSW index for entity embedding search
CREATE INDEX idx_org_entities_embedding_hnsw ON org_entities
USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 200);

-- Optimize existing memories HNSW index (better params)
DROP INDEX IF EXISTS memories_embedding_idx;
CREATE INDEX memories_embedding_idx ON memories
USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 200);
```

- [ ] **Step 3: Apply manual migration**

Run: `cd apps/api && npx prisma migrate dev`
Expected: Migration applied successfully.

- [ ] **Step 4: Verify indices exist**

Run: `cd apps/api && npx prisma db execute --stdin <<< "SELECT indexname FROM pg_indexes WHERE tablename IN ('interview_chunks', 'org_entities', 'memories') AND indexname LIKE 'idx_%' OR indexname = 'memories_embedding_idx';"`

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/
git commit -m "feat(org-intelligence): run migrations with HNSW, tsvector trigger, and GIN indices"
```

---

### Task 9: Create Shared Types

**Files:**
- Create: `packages/shared/src/org-intelligence.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Create shared types file**

```typescript
// packages/shared/src/org-intelligence.ts

export const ORG_PROJECT_STATUSES = ['DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED'] as const;
export type OrgProjectStatus = (typeof ORG_PROJECT_STATUSES)[number];

export const ORG_ENTITY_TYPES = [
  'ORGANIZATION', 'DEPARTMENT', 'ROLE', 'PROCESS', 'ACTIVITY',
  'SYSTEM', 'DOCUMENT_TYPE', 'PROBLEM', 'IMPROVEMENT',
] as const;
export type OrgEntityType = (typeof ORG_ENTITY_TYPES)[number];

export const ORG_RELATION_TYPES = [
  'BELONGS_TO', 'EXECUTES', 'OWNS', 'CONTAINS', 'DEPENDS_ON',
  'USES', 'PRECEDES', 'FOLLOWS', 'TRIGGERS', 'INPUTS', 'OUTPUTS',
] as const;
export type OrgRelationType = (typeof ORG_RELATION_TYPES)[number];

export const PROBLEM_SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
export type ProblemSeverity = (typeof PROBLEM_SEVERITIES)[number];

export const PROCESSING_STATUSES = [
  'PENDING', 'UPLOADED', 'TRANSCRIBING', 'POST_PROCESSING',
  'EXTRACTING', 'RESOLVING_COREFERENCES', 'SUMMARIZING',
  'CHUNKING', 'EMBEDDING', 'COMPLETED', 'FAILED',
] as const;
export type ProcessingStatus = (typeof PROCESSING_STATUSES)[number];

export const ENTITY_TYPE_COLORS: Record<OrgEntityType, string> = {
  ORGANIZATION: 'slate',
  DEPARTMENT: 'blue',
  ROLE: 'indigo',
  PROCESS: 'emerald',
  ACTIVITY: 'teal',
  SYSTEM: 'amber',
  DOCUMENT_TYPE: 'orange',
  PROBLEM: 'red',
  IMPROVEMENT: 'green',
};
```

- [ ] **Step 2: Export from shared index**

Add to `packages/shared/src/index.ts`:

```typescript
export * from './org-intelligence';
```

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/org-intelligence.ts packages/shared/src/index.ts
git commit -m "feat(org-intelligence): add shared types and constants"
```

---

### Task 10: Create Zod DTOs

**Files:**
- Create: `apps/api/src/modules/org-intelligence/dto/index.ts`

- [ ] **Step 1: Create DTOs directory and file**

```typescript
// apps/api/src/modules/org-intelligence/dto/index.ts
import { z } from 'zod';

// --- OrgProject DTOs ---

export const createProjectSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(200),
  description: z.string().max(2000).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  config: z.record(z.unknown()).optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED']).optional(),
  startDate: z.string().datetime().nullable().optional(),
  endDate: z.string().datetime().nullable().optional(),
  config: z.record(z.unknown()).nullable().optional(),
});

export const listProjectsSchema = z.object({
  status: z.enum(['DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED']).optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
});

// --- Interview DTOs ---

export const createInterviewSchema = z.object({
  projectId: z.string().uuid('ID de proyecto inválido'),
  title: z.string().max(200).optional(),
  interviewDate: z.string().datetime().optional(),
  speakers: z.array(z.object({
    speakerLabel: z.string().min(1),
    name: z.string().optional(),
    role: z.string().optional(),
    department: z.string().optional(),
    isInterviewer: z.boolean().default(false),
  })).optional(),
});

export const updateInterviewSchema = z.object({
  title: z.string().max(200).optional(),
  interviewDate: z.string().datetime().nullable().optional(),
});

export const updateSpeakerSchema = z.object({
  speakers: z.array(z.object({
    speakerLabel: z.string().min(1),
    name: z.string().optional(),
    role: z.string().optional(),
    department: z.string().optional(),
    isInterviewer: z.boolean().optional(),
  })),
});

export const listInterviewsSchema = z.object({
  projectId: z.string().uuid(),
  processingStatus: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
});

// --- Type inference ---
export type CreateProjectDto = z.infer<typeof createProjectSchema>;
export type UpdateProjectDto = z.infer<typeof updateProjectSchema>;
export type ListProjectsDto = z.infer<typeof listProjectsSchema>;
export type CreateInterviewDto = z.infer<typeof createInterviewSchema>;
export type UpdateInterviewDto = z.infer<typeof updateInterviewSchema>;
export type UpdateSpeakerDto = z.infer<typeof updateSpeakerSchema>;
export type ListInterviewsDto = z.infer<typeof listInterviewsSchema>;
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/org-intelligence/dto/index.ts
git commit -m "feat(org-intelligence): add Zod DTOs for projects and interviews"
```

---

### Task 11: Create Projects Service

**Files:**
- Create: `apps/api/src/modules/org-intelligence/services/projects.service.ts`

- [ ] **Step 1: Create the service**

```typescript
// apps/api/src/modules/org-intelligence/services/projects.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProjectDto, UpdateProjectDto, ListProjectsDto } from '../dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, userId: string, dto: CreateProjectDto) {
    return this.prisma.orgProject.create({
      data: {
        name: dto.name,
        description: dto.description,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        config: dto.config,
        tenantId,
        createdById: userId,
      },
    });
  }

  async findAll(tenantId: string, dto: ListProjectsDto) {
    const where = {
      tenantId,
      deletedAt: null,
      ...(dto.status && { status: dto.status }),
    };

    const [items, total] = await Promise.all([
      this.prisma.orgProject.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (dto.page - 1) * dto.perPage,
        take: dto.perPage,
        include: {
          _count: { select: { interviews: true, orgEntities: true, problems: true } },
        },
      }),
      this.prisma.orgProject.count({ where }),
    ]);

    return { items, total, page: dto.page, perPage: dto.perPage };
  }

  async findOne(tenantId: string, id: string) {
    const project = await this.prisma.orgProject.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        _count: {
          select: { interviews: true, orgEntities: true, problems: true, improvements: true },
        },
      },
    });
    if (!project) throw new NotFoundException('Proyecto no encontrado');
    return project;
  }

  async update(tenantId: string, id: string, dto: UpdateProjectDto) {
    await this.findOne(tenantId, id);
    return this.prisma.orgProject.update({
      where: { id },
      data: {
        ...dto,
        startDate: dto.startDate !== undefined
          ? (dto.startDate ? new Date(dto.startDate) : null)
          : undefined,
        endDate: dto.endDate !== undefined
          ? (dto.endDate ? new Date(dto.endDate) : null)
          : undefined,
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.orgProject.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/org-intelligence/services/projects.service.ts
git commit -m "feat(org-intelligence): add ProjectsService with CRUD operations"
```

---

### Task 12: Create Projects Controller

**Files:**
- Create: `apps/api/src/modules/org-intelligence/controllers/projects.controller.ts`

- [ ] **Step 1: Create the controller**

```typescript
// apps/api/src/modules/org-intelligence/controllers/projects.controller.ts
import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { ProjectsService } from '../services/projects.service';
import {
  createProjectSchema, updateProjectSchema, listProjectsSchema,
  CreateProjectDto, UpdateProjectDto, ListProjectsDto,
} from '../dto';

@Controller('org-intelligence/projects')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  create(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(createProjectSchema)) dto: CreateProjectDto,
  ) {
    return this.projectsService.create(tenantId, userId, dto);
  }

  @Get()
  findAll(
    @CurrentTenant() tenantId: string,
    @Query(new ZodValidationPipe(listProjectsSchema)) dto: ListProjectsDto,
  ) {
    return this.projectsService.findAll(tenantId, dto);
  }

  @Get(':id')
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.projectsService.findOne(tenantId, id);
  }

  @Patch(':id')
  update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateProjectSchema)) dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(tenantId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.projectsService.remove(tenantId, id);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/org-intelligence/controllers/projects.controller.ts
git commit -m "feat(org-intelligence): add ProjectsController with REST endpoints"
```

---

### Task 13: Create Interviews Service

**Files:**
- Create: `apps/api/src/modules/org-intelligence/services/interviews.service.ts`

- [ ] **Step 1: Create the service**

```typescript
// apps/api/src/modules/org-intelligence/services/interviews.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { S3Service } from '../../files/s3.service';
import { CreateInterviewDto, UpdateInterviewDto, ListInterviewsDto, UpdateSpeakerDto } from '../dto';

const ALLOWED_AUDIO_TYPES = [
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav',
  'audio/mp4', 'audio/x-m4a', 'audio/ogg', 'audio/webm',
];

@Injectable()
export class InterviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
  ) {}

  async create(tenantId: string, dto: CreateInterviewDto) {
    return this.prisma.interview.create({
      data: {
        title: dto.title,
        interviewDate: dto.interviewDate ? new Date(dto.interviewDate) : undefined,
        projectId: dto.projectId,
        tenantId,
        speakers: dto.speakers?.length
          ? { createMany: { data: dto.speakers } }
          : undefined,
      },
      include: { speakers: true },
    });
  }

  async findAll(tenantId: string, dto: ListInterviewsDto) {
    const where = {
      tenantId,
      projectId: dto.projectId,
      deletedAt: null,
      ...(dto.processingStatus && { processingStatus: dto.processingStatus }),
    };

    const [items, total] = await Promise.all([
      this.prisma.interview.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (dto.page - 1) * dto.perPage,
        take: dto.perPage,
        include: { speakers: true, _count: { select: { chunks: true } } },
      }),
      this.prisma.interview.count({ where }),
    ]);

    return { items, total, page: dto.page, perPage: dto.perPage };
  }

  async findOne(tenantId: string, id: string) {
    const interview = await this.prisma.interview.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { speakers: true, _count: { select: { chunks: true } } },
    });
    if (!interview) throw new NotFoundException('Entrevista no encontrada');
    return interview;
  }

  async update(tenantId: string, id: string, dto: UpdateInterviewDto) {
    await this.findOne(tenantId, id);
    return this.prisma.interview.update({
      where: { id },
      data: {
        ...dto,
        interviewDate: dto.interviewDate !== undefined
          ? (dto.interviewDate ? new Date(dto.interviewDate) : null)
          : undefined,
      },
      include: { speakers: true },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.interview.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async uploadAudio(tenantId: string, id: string, file: Express.Multer.File) {
    const interview = await this.findOne(tenantId, id);

    if (!ALLOWED_AUDIO_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Formato de audio no soportado: ${file.mimetype}. Formatos válidos: MP3, WAV, M4A, OGG, WebM`,
      );
    }

    const s3Key = `tenants/${tenantId}/interviews/${id}/audio/${file.originalname}`;
    await this.s3.upload(s3Key, file.buffer, file.mimetype);

    return this.prisma.interview.update({
      where: { id },
      data: {
        audioS3Key: s3Key,
        audioMimeType: file.mimetype,
        processingStatus: 'UPLOADED',
      },
      include: { speakers: true },
    });
  }

  async updateSpeakers(tenantId: string, id: string, dto: UpdateSpeakerDto) {
    await this.findOne(tenantId, id);

    await this.prisma.$transaction(async (tx) => {
      await tx.interviewSpeaker.deleteMany({ where: { interviewId: id } });
      await tx.interviewSpeaker.createMany({
        data: dto.speakers.map((s) => ({ ...s, interviewId: id })),
      });
    });

    return this.findOne(tenantId, id);
  }

  async getTranscription(tenantId: string, id: string) {
    const interview = await this.findOne(tenantId, id);
    if (!interview.transcriptionText) {
      throw new NotFoundException('La entrevista aún no ha sido transcrita');
    }
    return {
      text: interview.transcriptionText,
      json: interview.transcriptionJson,
      status: interview.transcriptionStatus,
      provider: interview.transcriptionProvider,
    };
  }

  async getStatus(tenantId: string, id: string) {
    const interview = await this.findOne(tenantId, id);
    return {
      id: interview.id,
      processingStatus: interview.processingStatus,
      processingError: interview.processingError,
      transcriptionStatus: interview.transcriptionStatus,
    };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/org-intelligence/services/interviews.service.ts
git commit -m "feat(org-intelligence): add InterviewsService with CRUD and audio upload"
```

---

### Task 14: Create Interviews Controller

**Files:**
- Create: `apps/api/src/modules/org-intelligence/controllers/interviews.controller.ts`

- [ ] **Step 1: Create the controller**

```typescript
// apps/api/src/modules/org-intelligence/controllers/interviews.controller.ts
import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { InterviewsService } from '../services/interviews.service';
import {
  createInterviewSchema, updateInterviewSchema, listInterviewsSchema, updateSpeakerSchema,
  CreateInterviewDto, UpdateInterviewDto, ListInterviewsDto, UpdateSpeakerDto,
} from '../dto';

@Controller('org-intelligence/interviews')
@UseGuards(JwtAuthGuard, TenantGuard)
export class InterviewsController {
  constructor(private readonly interviewsService: InterviewsService) {}

  @Post()
  create(
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(createInterviewSchema)) dto: CreateInterviewDto,
  ) {
    return this.interviewsService.create(tenantId, dto);
  }

  @Get()
  findAll(
    @CurrentTenant() tenantId: string,
    @Query(new ZodValidationPipe(listInterviewsSchema)) dto: ListInterviewsDto,
  ) {
    return this.interviewsService.findAll(tenantId, dto);
  }

  @Get(':id')
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.interviewsService.findOne(tenantId, id);
  }

  @Patch(':id')
  update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateInterviewSchema)) dto: UpdateInterviewDto,
  ) {
    return this.interviewsService.update(tenantId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.interviewsService.remove(tenantId, id);
  }

  @Post(':id/upload-audio')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 500 * 1024 * 1024 } }))
  uploadAudio(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.interviewsService.uploadAudio(tenantId, id, file);
  }

  @Patch(':id/speakers')
  updateSpeakers(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateSpeakerSchema)) dto: UpdateSpeakerDto,
  ) {
    return this.interviewsService.updateSpeakers(tenantId, id, dto);
  }

  @Get(':id/transcription')
  getTranscription(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.interviewsService.getTranscription(tenantId, id);
  }

  @Get(':id/status')
  getStatus(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.interviewsService.getStatus(tenantId, id);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/org-intelligence/controllers/interviews.controller.ts
git commit -m "feat(org-intelligence): add InterviewsController with upload and transcription endpoints"
```

---

### Task 15: Create and Register OrgIntelligenceModule

**Files:**
- Create: `apps/api/src/modules/org-intelligence/org-intelligence.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create the module**

```typescript
// apps/api/src/modules/org-intelligence/org-intelligence.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FilesModule } from '../files/files.module';
import { ProjectsController } from './controllers/projects.controller';
import { InterviewsController } from './controllers/interviews.controller';
import { ProjectsService } from './services/projects.service';
import { InterviewsService } from './services/interviews.service';

@Module({
  imports: [PrismaModule, FilesModule],
  controllers: [ProjectsController, InterviewsController],
  providers: [ProjectsService, InterviewsService],
  exports: [ProjectsService, InterviewsService],
})
export class OrgIntelligenceModule {}
```

- [ ] **Step 2: Register in app.module.ts**

Add the import at the top of `apps/api/src/app.module.ts`:
```typescript
import { OrgIntelligenceModule } from './modules/org-intelligence/org-intelligence.module';
```

Add `OrgIntelligenceModule` to the `imports` array in `@Module({})`.

- [ ] **Step 3: Verify the app compiles**

Run: `cd apps/api && npx nest build`
Expected: Build succeeds with no errors.

- [ ] **Step 4: Run lint**

Run: `pnpm lint`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/org-intelligence/ apps/api/src/app.module.ts
git commit -m "feat(org-intelligence): create OrgIntelligenceModule and register in app"
```

---

## Verification

After completing all tasks, verify the full system works:

- [ ] `cd apps/api && npx prisma validate` — Schema is valid
- [ ] `cd apps/api && npx prisma generate` — Client generated
- [ ] `cd apps/api && npx nest build` — Compiles without errors
- [ ] `pnpm lint` — No lint errors
- [ ] Start the API server and test endpoints manually:
  - `POST /org-intelligence/projects` — creates a project
  - `GET /org-intelligence/projects` — lists projects
  - `POST /org-intelligence/interviews` — creates an interview
  - `POST /org-intelligence/interviews/:id/upload-audio` — uploads audio file

---

## Next Plans

This foundation plan is followed by:

- **Plan B: Transcription Pipeline** — Deepgram + OpenAI STT integration
- **Plan C: Extraction Pipeline** — 5-pass Structured Outputs with Zod schemas
- **Plan D: RAG & Knowledge Graph** — Hybrid search, chunking, embeddings
- **Plan E: Diagnosis & Improvements** — SPOF detection, RICE scoring
- **Plan F: Frontend - Projects & Interviews** — UI pages, audio player
- **Plan G: Frontend - Knowledge Graph & Diagrams** — Graph explorer, Mermaid
- **Plan H: Frontend - Dashboard** — Diagnostics, validation queue, KPIs
