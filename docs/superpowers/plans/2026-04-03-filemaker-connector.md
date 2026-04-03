# FileMaker Data API Connector — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a bidirectional FileMaker Data API connector for Citolab with discovery UI, async sync, and a transformer architecture for gradual module migration starting with collections.

**Architecture:** NestJS module (`filemaker`) with FmAuthService (session management), FmApiService (HTTP client), FmDiscoveryService (metadata exploration), and FmSyncService (orchestration). Prisma models in `citolab_fm` PostgreSQL schema. Next.js discovery UI at `/integrations/filemaker`. Shared types in `@zeru/shared`.

**Tech Stack:** NestJS, Prisma (multiSchema), native `fetch()`, Zod DTOs, `@nestjs/schedule`, Next.js, shadcn/ui

**Spec:** `docs/superpowers/specs/2026-04-03-filemaker-connector-design.md`

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `apps/api/prisma/schema.prisma` | Modify | Add multiSchema config, `citolab_fm` schema, FmSyncRecord, FmSyncLog, FmSyncStatus |
| `packages/shared/src/types/filemaker.ts` | Create | Shared FM types (FmRecord, FmQueryOptions, FmLayout, etc.) |
| `packages/shared/src/index.ts` | Modify | Export filemaker types |
| `apps/api/src/modules/filemaker/filemaker.module.ts` | Create | NestJS module definition |
| `apps/api/src/modules/filemaker/services/fm-auth.service.ts` | Create | Session management (login, token cache, auto-refresh) |
| `apps/api/src/modules/filemaker/services/fm-api.service.ts` | Create | Generic HTTP client for all FM Data API endpoints |
| `apps/api/src/modules/filemaker/services/fm-discovery.service.ts` | Create | Metadata exploration (layouts, fields, sample data, search) |
| `apps/api/src/modules/filemaker/services/fm-sync.service.ts` | Create | Sync orchestration (import, export, retry, events) |
| `apps/api/src/modules/filemaker/controllers/fm-discovery.controller.ts` | Create | REST API for discovery UI |
| `apps/api/src/modules/filemaker/controllers/fm-sync.controller.ts` | Create | REST API for sync status and manual operations |
| `apps/api/src/modules/filemaker/transformers/transformer.interface.ts` | Create | Base transformer interface |
| `apps/api/src/modules/filemaker/dto/index.ts` | Create | Zod schemas for controller validation |
| `apps/api/src/app.module.ts` | Modify | Import FileMakerModule |
| `apps/web/app/(dashboard)/integrations/filemaker/page.tsx` | Create | Discovery UI main page |
| `apps/web/app/(dashboard)/integrations/page.tsx` | Modify | Link to FileMaker page |

---

### Task 1: Prisma Schema — multiSchema + citolab_fm Models

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Enable multiSchema in Prisma generator and datasource**

In `apps/api/prisma/schema.prisma`, update the generator and datasource blocks:

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["multiSchema"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  schemas  = ["public", "citolab_fm"]
}
```

Note: If Prisma version is 6+ `multiSchema` may no longer be a preview feature. Check `apps/api/package.json` for the Prisma version. If v6+, the `previewFeatures` line may not be needed — the `schemas` field alone suffices.

- [ ] **Step 2: Add FmSyncStatus enum**

Add after the last enum in the schema:

```prisma
enum FmSyncStatus {
  SYNCED
  PENDING_TO_FM
  PENDING_TO_ZERU
  ERROR

  @@schema("citolab_fm")
}
```

- [ ] **Step 3: Add FmSyncRecord model**

Add after the new enum:

```prisma
model FmSyncRecord {
  id          String       @id @default(uuid())
  tenantId    String
  tenant      Tenant       @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  entityType  String
  entityId    String

  fmDatabase  String
  fmLayout    String
  fmRecordId  String
  fmModId     String?

  syncStatus  FmSyncStatus @default(SYNCED)
  lastSyncAt  DateTime     @default(now())
  syncError   String?
  retryCount  Int          @default(0)

  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  @@unique([tenantId, entityType, entityId])
  @@unique([tenantId, fmDatabase, fmLayout, fmRecordId])
  @@index([syncStatus])
  @@schema("citolab_fm")
  @@map("fm_sync_records")
}
```

- [ ] **Step 4: Add FmSyncLog model**

```prisma
model FmSyncLog {
  id          String   @id @default(uuid())
  tenantId    String
  entityType  String
  entityId    String?
  fmRecordId  String?
  action      String
  direction   String
  details     Json?
  error       String?
  duration    Int?
  createdAt   DateTime @default(now())

  @@index([tenantId, createdAt])
  @@index([entityType, action])
  @@schema("citolab_fm")
  @@map("fm_sync_logs")
}
```

- [ ] **Step 5: Add relations to Tenant model**

Find the Tenant model and add these relation fields (alongside the existing ones like `linkedInConnection`):

```prisma
  fmSyncRecords  FmSyncRecord[]
```

- [ ] **Step 6: Add `@@schema("public")` to ALL existing models and enums**

When enabling multiSchema, Prisma requires every model and enum to declare its schema. Add `@@schema("public")` to every existing model (before `@@map`) and every existing enum. This is tedious but required.

For models, add before `@@map(...)`:
```prisma
  @@schema("public")
```

For enums, add as last line inside the enum:
```prisma
  @@schema("public")
```

- [ ] **Step 7: Create the schema in PostgreSQL and run migration**

```bash
cd apps/api && npx prisma migrate dev --name add_citolab_fm_schema
```

If the migration tool doesn't auto-create the schema, create it manually first:

```bash
cd apps/api && npx prisma db execute --stdin <<< "CREATE SCHEMA IF NOT EXISTS citolab_fm;"
```

Then retry the migration.

- [ ] **Step 8: Generate Prisma Client**

```bash
cd apps/api && npx prisma generate
```

- [ ] **Step 9: Commit**

```bash
git add apps/api/prisma/ && git commit -m "feat: add citolab_fm schema with FmSyncRecord and FmSyncLog models"
```

---

### Task 2: Shared FileMaker Types

**Files:**
- Create: `packages/shared/src/types/filemaker.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Create shared FM types**

Create `packages/shared/src/types/filemaker.ts`:

```typescript
// ── FM Data API types ──

export interface FmRecord {
  recordId: string;
  modId: string;
  fieldData: Record<string, unknown>;
  portalData?: Record<string, Record<string, unknown>[]>;
}

export interface FmResponse {
  records: FmRecord[];
  totalRecordCount: number;
}

export interface FmQueryOptions {
  offset?: number;
  limit?: number;
  sort?: { fieldName: string; sortOrder: 'ascend' | 'descend' }[];
  portals?: string[];
  dateformats?: 0 | 1 | 2;
}

export interface FmFindQuery {
  [field: string]: string;
}

export interface FmLayout {
  name: string;
  table: string;
  isFolder?: boolean;
  folderLayoutNames?: FmLayout[];
}

export interface FmFieldMetadata {
  name: string;
  type: string;
  result: string;
  global: boolean;
  autoEnter: boolean;
  fourDigitYear: boolean;
  maxRepeat: number;
  maxCharacters: number;
  notEmpty: boolean;
  numeric: boolean;
  repetitions: number;
  timeOfDay: boolean;
}

export interface FmPortalMetadata {
  name: string;
  fields: FmFieldMetadata[];
}

export interface FmLayoutMetadata {
  fields: FmFieldMetadata[];
  portals: FmPortalMetadata[];
}

export interface FmScript {
  name: string;
  isFolder?: boolean;
  folderScriptNames?: FmScript[];
}

export interface FmScriptResult {
  scriptResult?: string;
  scriptError?: string;
}

// ── Sync types ──

export type FmSyncStatus = 'SYNCED' | 'PENDING_TO_FM' | 'PENDING_TO_ZERU' | 'ERROR';

export interface FmSyncRecordInfo {
  id: string;
  entityType: string;
  entityId: string;
  fmDatabase: string;
  fmLayout: string;
  fmRecordId: string;
  syncStatus: FmSyncStatus;
  lastSyncAt: string;
  syncError: string | null;
  retryCount: number;
}

export interface FmSyncStats {
  synced: number;
  pendingToFm: number;
  pendingToZeru: number;
  error: number;
  total: number;
}

// ── Connection status ──

export interface FmConnectionStatus {
  connected: boolean;
  host: string;
  database: string;
  lastChecked: string;
  error?: string;
}
```

- [ ] **Step 2: Export from shared index**

In `packages/shared/src/index.ts`, add:

```typescript
export * from './types/filemaker';
```

- [ ] **Step 3: Build shared**

```bash
cd packages/shared && pnpm build
```

- [ ] **Step 4: Commit**

```bash
git add packages/shared/ && git commit -m "feat: add shared FileMaker types for Data API, sync, and discovery"
```

---

### Task 3: FmAuthService — Session Management

**Files:**
- Create: `apps/api/src/modules/filemaker/services/fm-auth.service.ts`

- [ ] **Step 1: Create the auth service**

Create `apps/api/src/modules/filemaker/services/fm-auth.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface FmSession {
  token: string;
  obtainedAt: number;
}

@Injectable()
export class FmAuthService {
  private readonly logger = new Logger(FmAuthService.name);
  private readonly sessions = new Map<string, FmSession>();
  private readonly host: string;
  private readonly username: string;
  private readonly password: string;

  constructor(private readonly config: ConfigService) {
    this.host = this.config.getOrThrow<string>('FM_HOST');
    this.username = this.config.getOrThrow<string>('FM_USERNAME');
    this.password = this.config.getOrThrow<string>('FM_PASSWORD');
  }

  get fmHost(): string {
    return this.host;
  }

  async getToken(database: string): Promise<string> {
    const existing = this.sessions.get(database);
    if (existing) {
      return existing.token;
    }
    return this.login(database);
  }

  async login(database: string): Promise<string> {
    const url = `${this.host}/fmi/data/vLatest/databases/${encodeURIComponent(database)}/sessions`;
    const credentials = Buffer.from(`${this.username}:${this.password}`).toString('base64');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${credentials}`,
      },
      body: '{}',
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`FM login failed for ${database}: ${response.status} ${text}`);
      throw new Error(`FileMaker login failed: ${response.status}`);
    }

    const data = await response.json();
    const token = data.response.token as string;

    this.sessions.set(database, { token, obtainedAt: Date.now() });
    this.logger.log(`FM session opened for database: ${database}`);
    return token;
  }

  async logout(database: string): Promise<void> {
    const session = this.sessions.get(database);
    if (!session) return;

    try {
      const url = `${this.host}/fmi/data/vLatest/databases/${encodeURIComponent(database)}/sessions/${session.token}`;
      await fetch(url, { method: 'DELETE', headers: { 'Content-Type': 'application/json' } });
      this.logger.log(`FM session closed for database: ${database}`);
    } catch (error) {
      this.logger.warn(`FM logout error for ${database}: ${error}`);
    } finally {
      this.sessions.delete(database);
    }
  }

  invalidateSession(database: string): void {
    this.sessions.delete(database);
  }

  async testConnection(database: string): Promise<boolean> {
    try {
      await this.login(database);
      await this.logout(database);
      return true;
    } catch {
      return false;
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/filemaker/ && git commit -m "feat: add FmAuthService with lazy login and session management"
```

---

### Task 4: FmApiService — Generic HTTP Client

**Files:**
- Create: `apps/api/src/modules/filemaker/services/fm-api.service.ts`

- [ ] **Step 1: Create the API service**

Create `apps/api/src/modules/filemaker/services/fm-api.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { FmAuthService } from './fm-auth.service';
import type {
  FmRecord,
  FmResponse,
  FmQueryOptions,
  FmFindQuery,
  FmLayout,
  FmLayoutMetadata,
  FmFieldMetadata,
  FmPortalMetadata,
  FmScript,
  FmScriptResult,
} from '@zeru/shared';

@Injectable()
export class FmApiService {
  private readonly logger = new Logger(FmApiService.name);

  constructor(private readonly auth: FmAuthService) {}

  // ── Private helpers ──

  private baseUrl(db: string): string {
    return `${this.auth.fmHost}/fmi/data/vLatest/databases/${encodeURIComponent(db)}`;
  }

  private async request<T>(
    db: string,
    path: string,
    options: { method: string; body?: unknown; retry?: boolean },
  ): Promise<T> {
    const token = await this.auth.getToken(db);
    const url = `${this.baseUrl(db)}${path}`;

    const response = await fetch(url, {
      method: options.method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    // Auto-refresh on 401
    if (response.status === 401 && options.retry !== false) {
      this.logger.warn(`FM 401 on ${options.method} ${path}, re-authenticating...`);
      this.auth.invalidateSession(db);
      return this.request<T>(db, path, { ...options, retry: false });
    }

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`FM API error ${response.status}: ${options.method} ${path} — ${text}`);
      throw new Error(`FileMaker API error: ${response.status} — ${text}`);
    }

    return response.json() as Promise<T>;
  }

  private normalizeRecords(raw: any): FmResponse {
    const data = raw.response?.data ?? [];
    const totalRecordCount = raw.response?.dataInfo?.totalRecordCount ?? data.length;

    const records: FmRecord[] = data.map((item: any) => ({
      recordId: item.recordId,
      modId: item.modId,
      fieldData: item.fieldData ?? {},
      portalData: item.portalData,
    }));

    return { records, totalRecordCount };
  }

  // ── Records ──

  async getRecords(db: string, layout: string, opts?: FmQueryOptions): Promise<FmResponse> {
    const params = new URLSearchParams();
    if (opts?.offset) params.set('_offset', String(opts.offset));
    if (opts?.limit) params.set('_limit', String(opts.limit));
    if (opts?.dateformats !== undefined) params.set('dateformats', String(opts.dateformats));
    if (opts?.sort) params.set('_sort', JSON.stringify(opts.sort));
    if (opts?.portals) params.set('portal', JSON.stringify(opts.portals));

    const qs = params.toString() ? `?${params.toString()}` : '';
    const raw = await this.request(db, `/layouts/${encodeURIComponent(layout)}/records${qs}`, {
      method: 'GET',
    });
    return this.normalizeRecords(raw);
  }

  async getRecord(db: string, layout: string, recordId: string): Promise<FmRecord> {
    const raw: any = await this.request(db, `/layouts/${encodeURIComponent(layout)}/records/${recordId}`, {
      method: 'GET',
    });
    const records = this.normalizeRecords(raw).records;
    return records[0];
  }

  async findRecords(db: string, layout: string, query: FmFindQuery[], opts?: FmQueryOptions): Promise<FmResponse> {
    const body: Record<string, unknown> = { query };
    if (opts?.offset) body.offset = String(opts.offset);
    if (opts?.limit) body.limit = String(opts.limit);
    if (opts?.sort) body.sort = opts.sort;
    if (opts?.dateformats !== undefined) body.dateformats = opts.dateformats;
    if (opts?.portals) body.portal = opts.portals;

    const raw = await this.request(db, `/layouts/${encodeURIComponent(layout)}/_find`, {
      method: 'POST',
      body,
    });
    return this.normalizeRecords(raw);
  }

  async createRecord(db: string, layout: string, fieldData: Record<string, unknown>): Promise<{ recordId: string }> {
    const raw: any = await this.request(db, `/layouts/${encodeURIComponent(layout)}/records`, {
      method: 'POST',
      body: { fieldData },
    });
    return { recordId: raw.response.recordId };
  }

  async updateRecord(
    db: string,
    layout: string,
    recordId: string,
    fieldData: Record<string, unknown>,
    modId?: string,
  ): Promise<void> {
    const body: Record<string, unknown> = { fieldData };
    if (modId) body.modId = modId;
    await this.request(db, `/layouts/${encodeURIComponent(layout)}/records/${recordId}`, {
      method: 'PATCH',
      body,
    });
  }

  async deleteRecord(db: string, layout: string, recordId: string): Promise<void> {
    await this.request(db, `/layouts/${encodeURIComponent(layout)}/records/${recordId}`, {
      method: 'DELETE',
    });
  }

  // ── Auto-paginated findAll ──

  async findAll(
    db: string,
    layout: string,
    query: FmFindQuery[],
    opts?: Omit<FmQueryOptions, 'offset' | 'limit'>,
  ): Promise<FmRecord[]> {
    const all: FmRecord[] = [];
    const batchSize = 100;
    let offset = 1;

    while (true) {
      const response = await this.findRecords(db, layout, query, {
        ...opts,
        offset,
        limit: batchSize,
        dateformats: opts?.dateformats ?? 2,
      });
      all.push(...response.records);
      if (all.length >= response.totalRecordCount || response.records.length < batchSize) {
        break;
      }
      offset += batchSize;
    }

    return all;
  }

  // ── Metadata ──

  async getDatabases(): Promise<string[]> {
    const raw: any = await this.request('BIOPSIAS', '/../databases', { method: 'GET' });
    return (raw.response?.databases ?? []).map((d: any) => d.name);
  }

  async getLayouts(db: string): Promise<FmLayout[]> {
    const raw: any = await this.request(db, '/layouts', { method: 'GET' });
    return raw.response?.layouts ?? [];
  }

  async getLayoutMetadata(db: string, layout: string): Promise<FmLayoutMetadata> {
    const raw: any = await this.request(db, `/layouts/${encodeURIComponent(layout)}`, {
      method: 'GET',
    });
    const fields: FmFieldMetadata[] = (raw.response?.fieldMetaData ?? []).map((f: any) => ({
      name: f.name,
      type: f.type,
      result: f.result ?? '',
      global: f.global ?? false,
      autoEnter: f.autoEnter ?? false,
      fourDigitYear: f.fourDigitYear ?? false,
      maxRepeat: f.maxRepeat ?? 1,
      maxCharacters: f.maxCharacters ?? 0,
      notEmpty: f.notEmpty ?? false,
      numeric: f.numeric ?? false,
      repetitions: f.repetitions ?? 1,
      timeOfDay: f.timeOfDay ?? false,
    }));

    const portals: FmPortalMetadata[] = Object.entries(raw.response?.portalMetaData ?? {}).map(
      ([name, portalFields]: [string, any]) => ({
        name,
        fields: portalFields.map((f: any) => ({
          name: f.name,
          type: f.type,
          result: f.result ?? '',
          global: f.global ?? false,
          autoEnter: f.autoEnter ?? false,
          fourDigitYear: f.fourDigitYear ?? false,
          maxRepeat: f.maxRepeat ?? 1,
          maxCharacters: f.maxCharacters ?? 0,
          notEmpty: f.notEmpty ?? false,
          numeric: f.numeric ?? false,
          repetitions: f.repetitions ?? 1,
          timeOfDay: f.timeOfDay ?? false,
        })),
      }),
    );

    return { fields, portals };
  }

  async getScripts(db: string): Promise<FmScript[]> {
    const raw: any = await this.request(db, '/scripts', { method: 'GET' });
    return raw.response?.scripts ?? [];
  }

  // ── Scripts ──

  async runScript(db: string, layout: string, script: string, param?: string): Promise<FmScriptResult> {
    const params = new URLSearchParams();
    params.set('script', script);
    if (param) params.set('script.param', param);

    const raw: any = await this.request(
      db,
      `/layouts/${encodeURIComponent(layout)}/records?${params.toString()}`,
      { method: 'GET' },
    );

    return {
      scriptResult: raw.response?.scriptResult,
      scriptError: raw.response?.scriptError,
    };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/filemaker/ && git commit -m "feat: add FmApiService with CRUD, find, metadata, scripts, and auto-pagination"
```

---

### Task 5: FmDiscoveryService + Controller + DTOs

**Files:**
- Create: `apps/api/src/modules/filemaker/services/fm-discovery.service.ts`
- Create: `apps/api/src/modules/filemaker/controllers/fm-discovery.controller.ts`
- Create: `apps/api/src/modules/filemaker/dto/index.ts`

- [ ] **Step 1: Create DTOs**

Create `apps/api/src/modules/filemaker/dto/index.ts`:

```typescript
import { z } from 'zod';

export const fmDatabaseParamSchema = z.object({
  database: z.string().min(1),
});

export const fmLayoutParamSchema = z.object({
  database: z.string().min(1),
  layout: z.string().min(1),
});

export const fmSearchSchema = z.object({
  query: z.array(z.record(z.string())).min(1),
  offset: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(200).optional(),
  sort: z
    .array(z.object({ fieldName: z.string(), sortOrder: z.enum(['ascend', 'descend']) }))
    .optional(),
});

export type FmDatabaseParam = z.infer<typeof fmDatabaseParamSchema>;
export type FmLayoutParam = z.infer<typeof fmLayoutParamSchema>;
export type FmSearchDto = z.infer<typeof fmSearchSchema>;
```

- [ ] **Step 2: Create discovery service**

Create `apps/api/src/modules/filemaker/services/fm-discovery.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { FmApiService } from './fm-api.service';
import { FmAuthService } from './fm-auth.service';
import type {
  FmLayout,
  FmLayoutMetadata,
  FmRecord,
  FmResponse,
  FmFindQuery,
  FmQueryOptions,
  FmScript,
  FmConnectionStatus,
} from '@zeru/shared';

@Injectable()
export class FmDiscoveryService {
  constructor(
    private readonly api: FmApiService,
    private readonly auth: FmAuthService,
  ) {}

  async testConnection(database: string): Promise<FmConnectionStatus> {
    const connected = await this.auth.testConnection(database);
    return {
      connected,
      host: this.auth.fmHost,
      database,
      lastChecked: new Date().toISOString(),
      error: connected ? undefined : 'Could not establish session',
    };
  }

  async listDatabases(): Promise<string[]> {
    return this.api.getDatabases();
  }

  async listLayouts(database: string): Promise<FmLayout[]> {
    return this.api.getLayouts(database);
  }

  async getLayoutFields(database: string, layout: string): Promise<FmLayoutMetadata> {
    return this.api.getLayoutMetadata(database, layout);
  }

  async sampleRecords(database: string, layout: string, limit = 10): Promise<FmResponse> {
    return this.api.getRecords(database, layout, { limit, dateformats: 2 });
  }

  async searchRecords(
    database: string,
    layout: string,
    query: FmFindQuery[],
    opts?: FmQueryOptions,
  ): Promise<FmResponse> {
    return this.api.findRecords(database, layout, query, { ...opts, dateformats: opts?.dateformats ?? 2 });
  }

  async listScripts(database: string): Promise<FmScript[]> {
    return this.api.getScripts(database);
  }
}
```

- [ ] **Step 3: Create discovery controller**

Create `apps/api/src/modules/filemaker/controllers/fm-discovery.controller.ts`:

```typescript
import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { FmDiscoveryService } from '../services/fm-discovery.service';
import { ZodPipe } from '../../../common/pipes/zod.pipe';
import { fmSearchSchema, type FmSearchDto } from '../dto';

@Controller('filemaker/discovery')
@UseGuards(JwtAuthGuard, TenantGuard)
export class FmDiscoveryController {
  constructor(private readonly discovery: FmDiscoveryService) {}

  @Get('databases')
  async listDatabases() {
    return this.discovery.listDatabases();
  }

  @Get('test-connection/:database')
  async testConnection(@Param('database') database: string) {
    return this.discovery.testConnection(database);
  }

  @Get(':database/layouts')
  async listLayouts(@Param('database') database: string) {
    return this.discovery.listLayouts(database);
  }

  @Get(':database/layouts/:layout/metadata')
  async getLayoutMetadata(
    @Param('database') database: string,
    @Param('layout') layout: string,
  ) {
    return this.discovery.getLayoutFields(database, layout);
  }

  @Get(':database/layouts/:layout/sample')
  async sampleRecords(
    @Param('database') database: string,
    @Param('layout') layout: string,
    @Query('limit') limit?: string,
  ) {
    return this.discovery.sampleRecords(database, layout, limit ? parseInt(limit, 10) : 10);
  }

  @Post(':database/layouts/:layout/search')
  async searchRecords(
    @Param('database') database: string,
    @Param('layout') layout: string,
    @Body(new ZodPipe(fmSearchSchema)) body: FmSearchDto,
  ) {
    return this.discovery.searchRecords(database, layout, body.query, {
      offset: body.offset,
      limit: body.limit,
      sort: body.sort,
    });
  }

  @Get(':database/scripts')
  async listScripts(@Param('database') database: string) {
    return this.discovery.listScripts(database);
  }
}
```

Note: Check the exact import paths for `JwtAuthGuard`, `TenantGuard`, and `ZodPipe`. Read existing controllers (e.g., `apps/api/src/modules/linkedin/controllers/linkedin.controller.ts`) to confirm the exact paths. They may be:
- `../../../common/guards/jwt-auth.guard` or `../../auth/guards/jwt-auth.guard`
- `../../../common/pipes/zod.pipe` or `../../../common/pipes/zod-validation.pipe`

Adjust imports accordingly.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/filemaker/ && git commit -m "feat: add FmDiscoveryService, controller, and DTOs for FM exploration"
```

---

### Task 6: FmSyncService + Controller

**Files:**
- Create: `apps/api/src/modules/filemaker/services/fm-sync.service.ts`
- Create: `apps/api/src/modules/filemaker/controllers/fm-sync.controller.ts`
- Create: `apps/api/src/modules/filemaker/transformers/transformer.interface.ts`

- [ ] **Step 1: Create transformer interface**

Create `apps/api/src/modules/filemaker/transformers/transformer.interface.ts`:

```typescript
import type { FmRecord, FmFindQuery } from '@zeru/shared';

export interface FmTransformer<TZeru, TFmCreate = Record<string, unknown>> {
  readonly database: string;
  readonly layouts: { primary: string; related?: string[] };

  fromFm(record: FmRecord): TZeru;
  toFm(data: TZeru): TFmCreate;
  buildFmQuery?(filters: Record<string, unknown>): FmFindQuery[];
}
```

- [ ] **Step 2: Create sync service**

Create `apps/api/src/modules/filemaker/services/fm-sync.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import { FmApiService } from './fm-api.service';
import type { FmSyncStats } from '@zeru/shared';

interface FmSyncEvent {
  tenantId: string;
  entityType: string;
  entityId: string;
  action: 'create' | 'update' | 'delete';
}

@Injectable()
export class FmSyncService {
  private readonly logger = new Logger(FmSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fmApi: FmApiService,
  ) {}

  async getStats(tenantId: string): Promise<FmSyncStats> {
    const counts = await this.prisma.fmSyncRecord.groupBy({
      by: ['syncStatus'],
      where: { tenantId },
      _count: true,
    });

    const stats: FmSyncStats = { synced: 0, pendingToFm: 0, pendingToZeru: 0, error: 0, total: 0 };
    for (const row of counts) {
      const count = row._count;
      switch (row.syncStatus) {
        case 'SYNCED': stats.synced = count; break;
        case 'PENDING_TO_FM': stats.pendingToFm = count; break;
        case 'PENDING_TO_ZERU': stats.pendingToZeru = count; break;
        case 'ERROR': stats.error = count; break;
      }
      stats.total += count;
    }
    return stats;
  }

  async getErrors(tenantId: string, limit = 20) {
    return this.prisma.fmSyncRecord.findMany({
      where: { tenantId, syncStatus: 'ERROR' },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
  }

  async getRecentLogs(tenantId: string, limit = 50) {
    return this.prisma.fmSyncLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  @OnEvent('fm.sync')
  async handleSyncEvent(event: FmSyncEvent) {
    this.logger.log(`FM sync event: ${event.action} ${event.entityType}/${event.entityId}`);

    const existing = await this.prisma.fmSyncRecord.findUnique({
      where: {
        tenantId_entityType_entityId: {
          tenantId: event.tenantId,
          entityType: event.entityType,
          entityId: event.entityId,
        },
      },
    });

    if (!existing) {
      this.logger.warn(`No FmSyncRecord found for ${event.entityType}/${event.entityId}, skipping`);
      return;
    }

    await this.prisma.fmSyncRecord.update({
      where: { id: existing.id },
      data: { syncStatus: 'PENDING_TO_FM' },
    });

    // TODO: In a future task, process the pending record
    // (read Zeru entity, transform via transformer, write to FM)
  }

  @Cron('*/5 * * * *')
  async retryErrors() {
    const maxRetries = 5;
    const errors = await this.prisma.fmSyncRecord.findMany({
      where: { syncStatus: 'ERROR', retryCount: { lt: maxRetries } },
      take: 20,
    });

    if (errors.length === 0) return;

    this.logger.log(`Retrying ${errors.length} failed sync records...`);

    for (const record of errors) {
      try {
        // Mark as pending for retry
        await this.prisma.fmSyncRecord.update({
          where: { id: record.id },
          data: {
            syncStatus: 'PENDING_TO_FM',
            retryCount: { increment: 1 },
          },
        });
        // TODO: Process the pending record via transformer
      } catch (error) {
        this.logger.error(`Retry failed for ${record.id}: ${error}`);
      }
    }
  }

  async logSync(data: {
    tenantId: string;
    entityType: string;
    entityId?: string;
    fmRecordId?: string;
    action: string;
    direction: string;
    details?: unknown;
    error?: string;
    duration?: number;
  }) {
    return this.prisma.fmSyncLog.create({
      data: {
        tenantId: data.tenantId,
        entityType: data.entityType,
        entityId: data.entityId,
        fmRecordId: data.fmRecordId,
        action: data.action,
        direction: data.direction,
        details: data.details as any,
        error: data.error,
        duration: data.duration,
      },
    });
  }
}
```

- [ ] **Step 3: Create sync controller**

Create `apps/api/src/modules/filemaker/controllers/fm-sync.controller.ts`:

```typescript
import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { FmSyncService } from '../services/fm-sync.service';

@Controller('filemaker/sync')
@UseGuards(JwtAuthGuard, TenantGuard)
export class FmSyncController {
  constructor(private readonly sync: FmSyncService) {}

  @Get('stats')
  async getStats(@CurrentTenant() tenantId: string) {
    return this.sync.getStats(tenantId);
  }

  @Get('errors')
  async getErrors(@CurrentTenant() tenantId: string) {
    return this.sync.getErrors(tenantId);
  }

  @Get('logs')
  async getLogs(@CurrentTenant() tenantId: string) {
    return this.sync.getRecentLogs(tenantId);
  }

  @Post('retry/:id')
  async retrySingle(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    // Reset error status to pending for manual retry
    const record = await this.sync['prisma'].fmSyncRecord.updateMany({
      where: { id, tenantId, syncStatus: 'ERROR' },
      data: { syncStatus: 'PENDING_TO_FM', retryCount: 0, syncError: null },
    });
    return { updated: record.count };
  }
}
```

Note: Verify import paths for `JwtAuthGuard`, `TenantGuard`, and `CurrentTenant` by reading an existing controller in the project.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/filemaker/ && git commit -m "feat: add FmSyncService with event handling, retry cron, and sync controller"
```

---

### Task 7: FileMaker Module + AppModule Registration

**Files:**
- Create: `apps/api/src/modules/filemaker/filemaker.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create the module**

Create `apps/api/src/modules/filemaker/filemaker.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { FmAuthService } from './services/fm-auth.service';
import { FmApiService } from './services/fm-api.service';
import { FmDiscoveryService } from './services/fm-discovery.service';
import { FmSyncService } from './services/fm-sync.service';
import { FmDiscoveryController } from './controllers/fm-discovery.controller';
import { FmSyncController } from './controllers/fm-sync.controller';

@Module({
  imports: [PrismaModule],
  controllers: [FmDiscoveryController, FmSyncController],
  providers: [FmAuthService, FmApiService, FmDiscoveryService, FmSyncService],
  exports: [FmAuthService, FmApiService, FmSyncService],
})
export class FileMakerModule {}
```

- [ ] **Step 2: Register in AppModule**

In `apps/api/src/app.module.ts`, add the import at the top:

```typescript
import { FileMakerModule } from './modules/filemaker/filemaker.module';
```

Add `FileMakerModule` to the `imports` array in `@Module({})`.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/filemaker/ apps/api/src/app.module.ts && git commit -m "feat: register FileMakerModule in AppModule"
```

---

### Task 8: Discovery UI — Frontend Page

**Files:**
- Create: `apps/web/app/(dashboard)/integrations/filemaker/page.tsx`
- Modify: `apps/web/app/(dashboard)/integrations/page.tsx`

- [ ] **Step 1: Create the FileMaker discovery page**

Create `apps/web/app/(dashboard)/integrations/filemaker/page.tsx`. This page should have:

1. **Tabs:** "Explorador" and "Sync Status"
2. **Explorador tab:**
   - Connection status indicator with "Probar conexión" button
   - Database selector (dropdown) that calls `GET /filemaker/discovery/databases`
   - Layout list (grouped by folder) that calls `GET /filemaker/discovery/:db/layouts`
   - When a layout is selected:
     - Fields table showing name, type, result (from `GET /filemaker/discovery/:db/layouts/:layout/metadata`)
     - Portals with their fields
     - "Registros de ejemplo" section (from `GET /filemaker/discovery/:db/layouts/:layout/sample`)
     - Search panel with dynamic field inputs + results table
3. **Sync Status tab:**
   - Stats counters from `GET /filemaker/sync/stats`
   - Error table from `GET /filemaker/sync/errors` with retry button
   - Recent logs from `GET /filemaker/sync/logs`

Use the existing patterns from the project:
- `api.get/post` from `@/lib/api-client`
- shadcn components: Card, Tabs, TabsList, TabsTrigger, TabsContent, Table, Button, Badge, Select, Input
- `toast` from sonner for notifications
- All text in Spanish

This is a large page. Build it with clear section components inline (no need for separate component files — keep it in one page file like `settings/users/page.tsx`).

- [ ] **Step 2: Update integrations index page**

Modify `apps/web/app/(dashboard)/integrations/page.tsx` to include a link/card to the FileMaker page:

```tsx
"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function IntegrationsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Integraciones</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link href="/integrations/filemaker">
          <Card className="cursor-pointer transition-colors hover:bg-muted/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">FileMaker</CardTitle>
                <Badge variant="secondary">Activo</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Bridge bidireccional con FileMaker Server vía Data API.
                Discovery de layouts, campos y scripts.
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(dashboard\)/integrations/ && git commit -m "feat: add FileMaker discovery UI and integrations index page"
```

---

### Task 9: Lint, Build, and Verify

- [ ] **Step 1: Run lint**

```bash
pnpm lint
```

Fix any errors.

- [ ] **Step 2: Build shared**

```bash
cd packages/shared && pnpm build
```

- [ ] **Step 3: Build API**

```bash
cd apps/api && npx nest build
```

- [ ] **Step 4: Final commit if needed**

```bash
git add -A && git commit -m "fix: lint and build fixes for FileMaker connector"
```
