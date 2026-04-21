# Citolab validation F2.0 — LLM shared infrastructure

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared infrastructure that the 6 LLM-assisted validation agents (F2.1 text + F2.2 vision) will consume: a structured-LLM helper, a versioned prompt loader, Anthropic provider support, and latency tracking in `AiUsageLog`. No business agent is written in this plan — only the foundation they will sit on.

**Architecture:** Extend `AiUsageService.logUsage()` to record `durationMs` and `completedAt`. Create a new `ValidationLlmModule` under `lab/validation/llm/` that exposes `ValidationLlmService.callStructured<T>()` — a thin wrapper around the existing `zodTextFormat` pattern that adds: per-call latency measurement, automatic `logUsage` with the right feature tag, one schema-retry on parse failure, and a provider-agnostic surface so F2.1 text agents can call it without knowing whether the backend is OpenAI or Anthropic. Store prompts as versioned markdown files under `lab/validation/llm/prompts/<agent-key>.md`, loaded through a tiny typed loader. Add `ANTHROPIC` to `AiProvider` enum + minimal `AiConfigService` support so the `concordance` agent (F2.1) can run its ensemble. No vision, no OCR — those belong to F2.2.

**Tech Stack:** NestJS 11 · Prisma 7 · PostgreSQL 16 · TypeScript 5 · Zod · OpenAI SDK (`openai@^4`) · `@anthropic-ai/sdk` (new) · Jest · pnpm.

**Working directory:** `/Users/camiloespinoza/Zeru/.claude/worktrees/feature+citolab-validation-f2-0/`
**Branch:** `feature/citolab-validation-f2-0` (based on `feature/citolab-validation-f1`)

---

## File structure

```
apps/api/prisma/schema.prisma                                                       # +durationMs/completedAt in AiUsageLog, +ANTHROPIC in AiProvider
apps/api/prisma/migrations/YYYYMMDDhhmmss_ai_usage_log_duration_anthropic/          # new migration
apps/api/src/modules/ai/services/ai-usage.service.ts                                # logUsage accepts durationMs + completedAt
apps/api/src/modules/ai/services/ai-usage.service.spec.ts                           # new — cover durationMs flow
apps/api/src/modules/ai/services/ai-config.service.ts                               # support ANTHROPIC provider
apps/api/src/modules/ai/services/ai-config.service.spec.ts                          # extend if exists; create if not
apps/api/src/modules/lab/validation/llm/validation-llm.module.ts                    # new NestJS module
apps/api/src/modules/lab/validation/llm/validation-llm.service.ts                   # new — callStructured<T>()
apps/api/src/modules/lab/validation/llm/validation-llm.service.spec.ts              # new — unit tests with mocked OpenAI client
apps/api/src/modules/lab/validation/llm/prompt-loader.ts                            # new — loadPrompt(key) -> PromptTemplate
apps/api/src/modules/lab/validation/llm/prompt-loader.spec.ts                       # new — cover missing/malformed prompts
apps/api/src/modules/lab/validation/llm/prompts/_example.md                         # new — reference prompt showing the schema
apps/api/src/modules/lab/validation/llm/types.ts                                    # new — StructuredLlmCall, PromptTemplate types
apps/api/src/modules/lab/validation/validation.module.ts                            # +import ValidationLlmModule
apps/api/package.json                                                               # +@anthropic-ai/sdk dependency
docs/superpowers/notes/2026-04-20-f2_0-close.md                                     # closing note for the phase
```

Each file has one responsibility. The helper is provider-agnostic at the call-site but per-call we always know which provider fired so `logUsage` receives correct `provider`/`model`. Prompts are data, not code — they live as files the team can review without opening TS.

---

## Task 1: Kickoff and baseline

**Files:**
- None to modify
- Read-only: confirm worktree state and that F1 tests pass before touching anything

- [ ] **Step 1.1: Confirm worktree and branch**

```bash
cd /Users/camiloespinoza/Zeru/.claude/worktrees/feature+citolab-validation-f2-0
pwd
# expected: /Users/camiloespinoza/Zeru/.claude/worktrees/feature+citolab-validation-f2-0
git rev-parse --abbrev-ref HEAD
# expected: feature/citolab-validation-f2-0
git status
# expected: On branch feature/citolab-validation-f2-0, working tree clean
```

If any command reports the wrong branch or a dirty tree: stop. Abort and fix before continuing.

- [ ] **Step 1.2: Baseline build check**

```bash
pnpm --filter @zeru/api build 2>&1 | tail -3
# expected: "Successfully compiled: 418 files" or similar — no errors
```

- [ ] **Step 1.3: Baseline test suite (F1 agents + AI module)**

```bash
pnpm --filter @zeru/api exec jest --testPathPattern='(validation|ai/services/ai-usage|ai/services/ai-config|ai/services/ai-pricing)' 2>&1 | tail -6
# expected: all tests pass
```

If anything fails here — stop. F1 is supposed to be green; a failure means the worktree branched from a bad state.

- [ ] **Step 1.4: Kickoff commit (empty)**

```bash
git commit --allow-empty -m "chore(f2.0): kickoff llm infrastructure"
```

---

## Task 2: Prisma schema — AiUsageLog duration fields + ANTHROPIC provider

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (lines ~392–426, `AiUsageLog` model + `AiProvider` enum)
- Create: `apps/api/prisma/migrations/YYYYMMDDhhmmss_ai_usage_log_duration_anthropic/migration.sql`

- [ ] **Step 2.1: Add `durationMs` and `completedAt` to `AiUsageLog`**

Edit `apps/api/prisma/schema.prisma`. Locate `model AiUsageLog {` (around line 400) and add two fields **immediately after** `createdAt` and before the `tenantId` block:

```prisma
  createdAt       DateTime @default(now())
  /// Latency of the LLM call in milliseconds (nullable: legacy rows have no value)
  durationMs      Int?
  /// Timestamp when the LLM call finished (nullable: legacy rows have no value)
  completedAt     DateTime?
```

- [ ] **Step 2.2: Add `ANTHROPIC` to the `AiProvider` enum**

In the same file, locate `enum AiProvider {` (around line 392) and add the value:

```prisma
enum AiProvider {
  OPENAI
  ANTHROPIC

  @@map("ai_provider")
}
```

- [ ] **Step 2.3: Validate the schema**

```bash
pnpm --filter @zeru/api exec prisma validate 2>&1 | tail -3
# expected: "The schema at prisma/schema.prisma is valid 🚀"
```

If it fails, fix the typo and re-run before continuing.

- [ ] **Step 2.4: Create the migration SQL manually**

The shadow DB in this repo is broken for a pre-existing migration (`20260328200000_add_departments_model`), so we cannot use `prisma migrate dev`. Create the file manually:

```bash
TS=$(date -u +%Y%m%d%H%M%S)
DIR="apps/api/prisma/migrations/${TS}_ai_usage_log_duration_anthropic"
mkdir -p "$DIR"
cat > "$DIR/migration.sql" <<'SQL'
-- Add durationMs + completedAt to AiUsageLog for LLM latency tracking.
ALTER TABLE "public"."AiUsageLog" ADD COLUMN "durationMs" INTEGER;
ALTER TABLE "public"."AiUsageLog" ADD COLUMN "completedAt" TIMESTAMP(3);

-- Add ANTHROPIC to ai_provider enum.
ALTER TYPE "public"."ai_provider" ADD VALUE IF NOT EXISTS 'ANTHROPIC';
SQL
echo "created: $DIR"
```

> **Note on table/schema:** verify the table name by running the query below. If the table lives in a different schema or under quoted/unquoted naming, adjust the SQL. Do not guess.

```bash
PGPASSWORD=zeru psql -h localhost -p 5437 -U zeru -d zeru -c "
SELECT n.nspname AS schema, c.relname AS table
FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid
WHERE c.relname ILIKE 'AiUsageLog' OR c.relname ILIKE 'ai_usage_log';
"
```

If the schema/name differs from `"public"."AiUsageLog"`, edit the migration SQL before continuing.

- [ ] **Step 2.5: Apply the migration**

```bash
cd apps/api && pnpm exec prisma migrate deploy 2>&1 | tail -10
# expected: "Applying migration `..._ai_usage_log_duration_anthropic`" + "All migrations have been successfully applied."
cd ../..
```

- [ ] **Step 2.6: Verify in the database**

```bash
PGPASSWORD=zeru psql -h localhost -p 5437 -U zeru -d zeru -c "
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'AiUsageLog' AND column_name IN ('durationMs','completedAt');
" | tail -5
# expected: durationMs integer, completedAt timestamp(3) without time zone

PGPASSWORD=zeru psql -h localhost -p 5437 -U zeru -d zeru -c "
SELECT enumlabel FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'ai_provider';
"
# expected: OPENAI and ANTHROPIC both listed
```

- [ ] **Step 2.7: Regenerate Prisma client**

```bash
cd apps/api && pnpm exec prisma generate 2>&1 | tail -3
cd ../..
# expected: "Generated Prisma Client" line, no errors
```

- [ ] **Step 2.8: Build to confirm nothing broke**

```bash
pnpm --filter @zeru/api build 2>&1 | tail -3
# expected: Successfully compiled
```

- [ ] **Step 2.9: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(prisma): add durationMs/completedAt to AiUsageLog, ANTHROPIC provider"
```

---

## Task 3: `AiUsageService.logUsage()` accepts `durationMs` and `completedAt`

**Files:**
- Modify: `apps/api/src/modules/ai/services/ai-usage.service.ts`
- Create: `apps/api/src/modules/ai/services/ai-usage.service.spec.ts`

- [ ] **Step 3.1: Write the failing test**

Create `apps/api/src/modules/ai/services/ai-usage.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { AiUsageService } from './ai-usage.service';
import { AiPricingService } from './ai-pricing.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('AiUsageService.logUsage', () => {
  let service: AiUsageService;
  let prismaCreate: jest.Mock;

  beforeEach(async () => {
    prismaCreate = jest.fn().mockResolvedValue({ id: 'row-1' });
    const module = await Test.createTestingModule({
      providers: [
        AiUsageService,
        { provide: PrismaService, useValue: { aiUsageLog: { create: prismaCreate } } },
        { provide: AiPricingService, useValue: { calculateCost: jest.fn().mockResolvedValue(0.0123) } },
      ],
    }).compile();
    service = module.get(AiUsageService);
  });

  it('persists durationMs and completedAt when provided', async () => {
    const completedAt = new Date('2026-04-20T14:30:00.000Z');
    await service.logUsage({
      provider: 'OPENAI',
      model: 'gpt-5.4-mini',
      feature: 'validation.sample',
      tenantId: 't1',
      inputTokens: 100,
      outputTokens: 40,
      durationMs: 1234,
      completedAt,
    });

    expect(prismaCreate).toHaveBeenCalledTimes(1);
    const data = prismaCreate.mock.calls[0][0].data;
    expect(data.durationMs).toBe(1234);
    expect(data.completedAt).toEqual(completedAt);
    expect(data.feature).toBe('validation.sample');
  });

  it('omits durationMs and completedAt when not provided (backwards compatible)', async () => {
    await service.logUsage({
      provider: 'OPENAI',
      model: 'gpt-5.4-mini',
      feature: 'chat',
      tenantId: 't1',
    });

    const data = prismaCreate.mock.calls[0][0].data;
    expect(data.durationMs).toBeUndefined();
    expect(data.completedAt).toBeUndefined();
  });
});
```

- [ ] **Step 3.2: Run the test — expect FAIL**

```bash
pnpm --filter @zeru/api exec jest ai-usage.service 2>&1 | tail -15
# expected: 2 failing tests (durationMs is undefined in data object)
```

- [ ] **Step 3.3: Update `LogAiUsageParams` and `logUsage()`**

Edit `apps/api/src/modules/ai/services/ai-usage.service.ts`:

```ts
export interface LogAiUsageParams {
  provider: string;
  model: string;
  feature: string;
  tenantId: string;
  userId?: string;
  conversationId?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cachedTokens?: number;
  compacted?: boolean;
  units?: number;
  pricingUnit?: string;
  costOverrideUsd?: number;
  durationMs?: number;
  completedAt?: Date;
}
```

Inside `logUsage`, extend the `data` object passed to `prisma.aiUsageLog.create`. Add these two lines just below `pricingUnit: params.pricingUnit,`:

```ts
        durationMs: params.durationMs,
        completedAt: params.completedAt,
```

- [ ] **Step 3.4: Run the test — expect PASS**

```bash
pnpm --filter @zeru/api exec jest ai-usage.service 2>&1 | tail -10
# expected: 2 passing tests
```

- [ ] **Step 3.5: Build**

```bash
pnpm --filter @zeru/api build 2>&1 | tail -3
# expected: Successfully compiled
```

- [ ] **Step 3.6: Commit**

```bash
git add apps/api/src/modules/ai/services/ai-usage.service.ts apps/api/src/modules/ai/services/ai-usage.service.spec.ts
git commit -m "feat(ai): ai-usage logUsage accepts durationMs and completedAt"
```

---

## Task 4: Shared types for the LLM helper

**Files:**
- Create: `apps/api/src/modules/lab/validation/llm/types.ts`

- [ ] **Step 4.1: Create the types file**

Create `apps/api/src/modules/lab/validation/llm/types.ts`:

```ts
import { z } from 'zod';

/** Output of a structured LLM call. Always includes the parsed + typed data,
 *  plus metadata the caller needs to log usage and reason about latency. */
export interface StructuredLlmResult<T> {
  data: T;
  provider: 'OPENAI' | 'ANTHROPIC';
  model: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  completedAt: Date;
}

/** Input for ValidationLlmService.callStructured(). */
export interface StructuredLlmCall<T extends z.ZodTypeAny> {
  /** Stable feature tag persisted in AiUsageLog (e.g. 'validation.sample'). */
  feature: string;
  /** Tenant scope for usage logging. */
  tenantId: string;
  /** Markdown prompt body. Variables must be pre-rendered before this call. */
  prompt: string;
  /** Zod schema the model output MUST conform to. */
  schema: T;
  /** Logical name used in zodTextFormat(schema, schemaName). Keep stable per agent. */
  schemaName: string;
  /** Provider preference. Defaults to 'OPENAI'. */
  provider?: 'OPENAI' | 'ANTHROPIC';
  /** Override model. If omitted, provider's default small model is used. */
  model?: string;
  /** Temperature. Defaults to 0 for deterministic-ish outputs. */
  temperature?: number;
  /** Optional user message, if the caller wants to separate system vs user. */
  userMessage?: string;
}

/** A prompt loaded from a .md file. */
export interface PromptTemplate {
  /** Stable id, same as the file name without extension. */
  key: string;
  /** Raw markdown body, with {{variable}} placeholders not yet rendered. */
  body: string;
}
```

- [ ] **Step 4.2: Build**

```bash
pnpm --filter @zeru/api build 2>&1 | tail -3
# expected: Successfully compiled
```

- [ ] **Step 4.3: Commit**

```bash
git add apps/api/src/modules/lab/validation/llm/types.ts
git commit -m "feat(lab): add validation-llm shared types"
```

---

## Task 5: Prompt loader with variable interpolation

**Files:**
- Create: `apps/api/src/modules/lab/validation/llm/prompt-loader.ts`
- Create: `apps/api/src/modules/lab/validation/llm/prompt-loader.spec.ts`
- Create: `apps/api/src/modules/lab/validation/llm/prompts/_example.md`

- [ ] **Step 5.1: Create the reference prompt file**

Create `apps/api/src/modules/lab/validation/llm/prompts/_example.md`:

```md
# Validation agent prompt — _example

You are a histopathology report validator. Receive the following report and
decide whether rule "{{ruleId}}" holds. Return only the JSON schema provided.

## Report text

{{reportText}}

## Rule

{{ruleText}}
```

- [ ] **Step 5.2: Write the failing test**

Create `apps/api/src/modules/lab/validation/llm/prompt-loader.spec.ts`:

```ts
import { loadPrompt, renderPrompt } from './prompt-loader';

describe('loadPrompt', () => {
  it('loads a prompt file by key', () => {
    const tpl = loadPrompt('_example');
    expect(tpl.key).toBe('_example');
    expect(tpl.body).toContain('{{ruleId}}');
    expect(tpl.body).toContain('{{reportText}}');
  });

  it('throws when the prompt file does not exist', () => {
    expect(() => loadPrompt('does-not-exist')).toThrow(/prompt file not found/i);
  });

  it('rejects keys that escape the prompts directory', () => {
    expect(() => loadPrompt('../../etc/passwd')).toThrow(/invalid prompt key/i);
    expect(() => loadPrompt('sub/nested')).toThrow(/invalid prompt key/i);
  });
});

describe('renderPrompt', () => {
  it('interpolates variables surrounded by {{ }}', () => {
    const out = renderPrompt('Hello {{name}}, rule {{ruleId}}.', {
      name: 'Camilo',
      ruleId: 'V001',
    });
    expect(out).toBe('Hello Camilo, rule V001.');
  });

  it('leaves unknown placeholders intact but emits a dev warning', () => {
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const out = renderPrompt('Hello {{name}}, missing {{foo}}.', { name: 'x' });
    expect(out).toBe('Hello x, missing {{foo}}.');
    expect(spy).toHaveBeenCalledWith(expect.stringMatching(/unresolved placeholder/i));
    spy.mockRestore();
  });

  it('escapes {{ }} inside values to prevent re-interpolation', () => {
    const out = renderPrompt('{{a}}', { a: '{{b}}' });
    expect(out).toBe('{{b}}');
    // render again to prove it is treated as literal
    const again = renderPrompt(out, { b: 'ESCAPED' });
    expect(again).toBe('{{b}}'); // no re-expansion because body comes as-is
  });
});
```

- [ ] **Step 5.3: Run the test — expect FAIL**

```bash
pnpm --filter @zeru/api exec jest prompt-loader 2>&1 | tail -10
# expected: Cannot find module './prompt-loader'
```

- [ ] **Step 5.4: Implement the loader**

Create `apps/api/src/modules/lab/validation/llm/prompt-loader.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PromptTemplate } from './types';

const PROMPTS_DIR = join(__dirname, 'prompts');

/** Load a prompt template by key. Key must be a simple filename (no slashes, no ..). */
export function loadPrompt(key: string): PromptTemplate {
  if (key.includes('/') || key.includes('\\') || key.includes('..')) {
    throw new Error(`Invalid prompt key: "${key}"`);
  }
  const path = join(PROMPTS_DIR, `${key}.md`);
  let body: string;
  try {
    body = readFileSync(path, 'utf8');
  } catch (err) {
    throw new Error(`Prompt file not found: ${path}`);
  }
  return { key, body };
}

/** Render a prompt by replacing {{var}} placeholders with values from `vars`.
 *  - Unknown placeholders are left intact and a console.warn is emitted (dev aid).
 *  - Values are inserted literally; the output is not re-scanned, so a value
 *    containing "{{foo}}" will NOT be re-interpolated. */
export function renderPrompt(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, name) => {
    if (Object.prototype.hasOwnProperty.call(vars, name)) {
      return vars[name];
    }
    console.warn(`Unresolved placeholder: {{${name}}}`);
    return match;
  });
}
```

- [ ] **Step 5.5: Run the test — expect PASS**

```bash
pnpm --filter @zeru/api exec jest prompt-loader 2>&1 | tail -10
# expected: 5 passing tests
```

- [ ] **Step 5.6: Ensure prompts are shipped with the build**

The `.md` files must be copied into `dist/` when nest builds. Check the API's `nest-cli.json` (at repo root or `apps/api/nest-cli.json`):

```bash
cat apps/api/nest-cli.json 2>/dev/null || cat nest-cli.json
```

Locate the `compilerOptions.assets` array. If `"**/*.md"` is NOT already present, add an entry for the prompts directory:

```json
{
  "compilerOptions": {
    "assets": [
      { "include": "src/modules/lab/validation/llm/prompts/*.md", "outDir": "dist/apps/api" }
    ],
    "watchAssets": true
  }
}
```

> If `assets` already exists with other entries, append to it. If `nest-cli.json` uses a different output dir (e.g. `dist/`), match the existing convention — inspect one or two existing assets to see the pattern. Do not guess.

- [ ] **Step 5.7: Build and verify the prompt ends up in dist**

```bash
pnpm --filter @zeru/api build 2>&1 | tail -3
# expected: Successfully compiled

find dist apps/api/dist -name "_example.md" 2>/dev/null | head -3
# expected: at least one hit under dist/
```

If no hit: the assets config is wrong. Fix it before moving on — the loader will crash at runtime otherwise.

- [ ] **Step 5.8: Commit**

```bash
git add apps/api/src/modules/lab/validation/llm/prompts apps/api/src/modules/lab/validation/llm/prompt-loader.ts apps/api/src/modules/lab/validation/llm/prompt-loader.spec.ts apps/api/nest-cli.json 2>/dev/null; git add apps/api/src/modules/lab/validation/llm/ nest-cli.json 2>/dev/null
git commit -m "feat(lab): add versioned prompt loader with {{var}} interpolation"
```

---

## Task 6: Anthropic provider support in `AiConfigService`

**Files:**
- Modify: `apps/api/src/modules/ai/services/ai-config.service.ts`
- Modify or create: `apps/api/src/modules/ai/services/ai-config.service.spec.ts`
- Modify: `apps/api/package.json` (add `@anthropic-ai/sdk`)

- [ ] **Step 6.1: Inspect the current service surface**

Read the file before changing anything:

```bash
sed -n '1,80p' apps/api/src/modules/ai/services/ai-config.service.ts
```

Identify:
- Where the provider enum / string union is referenced.
- Whether API keys are stored encrypted in DB and decrypted here (likely yes, per audit).
- The method that returns a provider client instance — most likely named `getOpenAiClient()` or similar.

Take note of the exact method names before writing any code. The steps below use the placeholder `getClientFor(provider)` but you MUST match whatever convention exists.

- [ ] **Step 6.2: Install the Anthropic SDK**

```bash
pnpm --filter @zeru/api add @anthropic-ai/sdk
# expected: package added, lockfile updated
```

- [ ] **Step 6.3: Write the failing test**

If `ai-config.service.spec.ts` exists, add the cases below to it. Otherwise create it with the full scaffold:

```ts
import { Test } from '@nestjs/testing';
import { AiConfigService } from './ai-config.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

describe('AiConfigService — provider support', () => {
  let service: AiConfigService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AiConfigService,
        { provide: PrismaService, useValue: {} },
        {
          provide: ConfigService,
          useValue: {
            get: (k: string) => {
              if (k === 'OPENAI_API_KEY') return 'sk-openai-fake';
              if (k === 'ANTHROPIC_API_KEY') return 'sk-ant-fake';
              return undefined;
            },
          },
        },
      ],
    }).compile();
    service = module.get(AiConfigService);
  });

  it('returns an OpenAI client for provider=OPENAI', () => {
    const client = service.getClientFor('OPENAI');
    expect(client).toBeDefined();
    expect(client.constructor.name).toBe('OpenAI');
  });

  it('returns an Anthropic client for provider=ANTHROPIC', () => {
    const client = service.getClientFor('ANTHROPIC');
    expect(client).toBeDefined();
    expect(client.constructor.name).toBe('Anthropic');
  });

  it('throws on unknown provider', () => {
    // @ts-expect-error — probing runtime guard
    expect(() => service.getClientFor('GEMINI')).toThrow(/unsupported provider/i);
  });
});
```

> **Adjust the method name** to match whatever `AiConfigService` actually exposes. If the method is `getOpenAiClient()` and there is no unified `getClientFor()`, this task becomes: add a new `getClientFor(provider)` method that delegates to the existing per-provider methods, so the surface stays backwards-compatible.

- [ ] **Step 6.4: Run the test — expect FAIL**

```bash
pnpm --filter @zeru/api exec jest ai-config.service 2>&1 | tail -15
# expected: FAIL — getClientFor is not a function OR provider ANTHROPIC not supported
```

- [ ] **Step 6.5: Implement Anthropic support**

In `ai-config.service.ts`:

1. Add at the top:
```ts
import Anthropic from '@anthropic-ai/sdk';
```

2. Add an `anthropicClient` field initialized lazily from `ANTHROPIC_API_KEY` env var (mirror how `openaiClient` is handled).

3. Add or extend `getClientFor(provider)`:
```ts
getClientFor(provider: 'OPENAI' | 'ANTHROPIC'): OpenAI | Anthropic {
  if (provider === 'OPENAI') return this.getOpenAiClient();
  if (provider === 'ANTHROPIC') return this.getAnthropicClient();
  throw new Error(`Unsupported provider: ${provider}`);
}

private getAnthropicClient(): Anthropic {
  if (!this.anthropicClient) {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set');
    }
    this.anthropicClient = new Anthropic({ apiKey });
  }
  return this.anthropicClient;
}
```

> If the existing OpenAI client factory takes extra config (baseUrl, org, encrypted key from DB), mirror that structure for Anthropic. Do not invent a divergent pattern.

- [ ] **Step 6.6: Run the test — expect PASS**

```bash
pnpm --filter @zeru/api exec jest ai-config.service 2>&1 | tail -10
# expected: all 3 tests green
```

- [ ] **Step 6.7: Build**

```bash
pnpm --filter @zeru/api build 2>&1 | tail -3
# expected: Successfully compiled
```

- [ ] **Step 6.8: Commit**

```bash
git add apps/api/src/modules/ai/services/ai-config.service.ts apps/api/src/modules/ai/services/ai-config.service.spec.ts apps/api/package.json pnpm-lock.yaml
git commit -m "feat(ai): add ANTHROPIC provider to AiConfigService"
```

---

## Task 7: `ValidationLlmService.callStructured<T>()` — the core helper

**Files:**
- Create: `apps/api/src/modules/lab/validation/llm/validation-llm.service.ts`
- Create: `apps/api/src/modules/lab/validation/llm/validation-llm.service.spec.ts`
- Create: `apps/api/src/modules/lab/validation/llm/validation-llm.module.ts`

- [ ] **Step 7.1: Write the failing test — OpenAI happy path**

Create `apps/api/src/modules/lab/validation/llm/validation-llm.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { z } from 'zod';
import { ValidationLlmService } from './validation-llm.service';
import { AiConfigService } from '../../../ai/services/ai-config.service';
import { AiUsageService } from '../../../ai/services/ai-usage.service';

const schema = z.object({
  verdict: z.enum(['PASS', 'FAIL']),
  reason: z.string(),
});

describe('ValidationLlmService.callStructured (OpenAI)', () => {
  let service: ValidationLlmService;
  let responsesParse: jest.Mock;
  let logUsage: jest.Mock;

  beforeEach(async () => {
    responsesParse = jest.fn();
    logUsage = jest.fn().mockResolvedValue({ id: 'log-1' });
    const fakeOpenAiClient = { responses: { parse: responsesParse } };
    const module = await Test.createTestingModule({
      providers: [
        ValidationLlmService,
        {
          provide: AiConfigService,
          useValue: { getClientFor: (p: string) => (p === 'OPENAI' ? fakeOpenAiClient : undefined) },
        },
        { provide: AiUsageService, useValue: { logUsage } },
      ],
    }).compile();
    service = module.get(ValidationLlmService);
  });

  it('parses output, returns typed data, logs usage with durationMs', async () => {
    responsesParse.mockResolvedValueOnce({
      output_parsed: { verdict: 'PASS', reason: 'ok' },
      usage: { input_tokens: 150, output_tokens: 20 },
    });
    const before = Date.now();
    const result = await service.callStructured({
      feature: 'validation.test',
      tenantId: 't1',
      prompt: 'body',
      schema,
      schemaName: 'TestVerdict',
    });
    expect(result.data).toEqual({ verdict: 'PASS', reason: 'ok' });
    expect(result.provider).toBe('OPENAI');
    expect(result.inputTokens).toBe(150);
    expect(result.outputTokens).toBe(20);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.completedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(logUsage).toHaveBeenCalledTimes(1);
    const logged = logUsage.mock.calls[0][0];
    expect(logged.provider).toBe('OPENAI');
    expect(logged.feature).toBe('validation.test');
    expect(logged.durationMs).toBeGreaterThanOrEqual(0);
    expect(logged.completedAt).toBeInstanceOf(Date);
  });

  it('retries once when the first response does not match the schema', async () => {
    responsesParse
      .mockResolvedValueOnce({
        output_parsed: null,
        output_text: '{ "verdict": "MAYBE" }', // not in enum
        usage: { input_tokens: 100, output_tokens: 10 },
      })
      .mockResolvedValueOnce({
        output_parsed: { verdict: 'FAIL', reason: 'retry ok' },
        usage: { input_tokens: 110, output_tokens: 15 },
      });
    const result = await service.callStructured({
      feature: 'validation.test',
      tenantId: 't1',
      prompt: 'body',
      schema,
      schemaName: 'TestVerdict',
    });
    expect(responsesParse).toHaveBeenCalledTimes(2);
    expect(result.data.verdict).toBe('FAIL');
    expect(logUsage).toHaveBeenCalledTimes(2); // one per attempt
  });

  it('throws after two parse failures (no infinite retries)', async () => {
    responsesParse.mockResolvedValue({
      output_parsed: null,
      output_text: '{ "verdict": "NOPE" }',
      usage: { input_tokens: 100, output_tokens: 10 },
    });
    await expect(
      service.callStructured({
        feature: 'validation.test',
        tenantId: 't1',
        prompt: 'body',
        schema,
        schemaName: 'TestVerdict',
      }),
    ).rejects.toThrow(/schema validation failed/i);
    expect(responsesParse).toHaveBeenCalledTimes(2);
  });

  it('propagates provider errors without logging usage', async () => {
    responsesParse.mockRejectedValue(new Error('rate_limited'));
    await expect(
      service.callStructured({
        feature: 'validation.test',
        tenantId: 't1',
        prompt: 'body',
        schema,
        schemaName: 'TestVerdict',
      }),
    ).rejects.toThrow(/rate_limited/);
    expect(logUsage).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 7.2: Run the test — expect FAIL (module not found)**

```bash
pnpm --filter @zeru/api exec jest validation-llm.service 2>&1 | tail -10
# expected: Cannot find module './validation-llm.service'
```

- [ ] **Step 7.3: Implement the service**

Create `apps/api/src/modules/lab/validation/llm/validation-llm.service.ts`:

```ts
import { Injectable, Logger } from '@nestjs/common';
import { zodTextFormat } from 'openai/helpers/zod';
import type { z } from 'zod';
import { AiConfigService } from '../../../ai/services/ai-config.service';
import { AiUsageService } from '../../../ai/services/ai-usage.service';
import type { StructuredLlmCall, StructuredLlmResult } from './types';

const DEFAULT_MODEL_OPENAI = 'gpt-5.4-mini';
// Anthropic path is not implemented yet (F2.0 delivers OpenAI only).
// Left as an explicit guard so callers get a clear error until F2.1.
const SCHEMA_VALIDATION_ERROR = 'schema validation failed';

@Injectable()
export class ValidationLlmService {
  private readonly logger = new Logger(ValidationLlmService.name);

  constructor(
    private readonly aiConfig: AiConfigService,
    private readonly aiUsage: AiUsageService,
  ) {}

  async callStructured<T extends z.ZodTypeAny>(
    call: StructuredLlmCall<T>,
  ): Promise<StructuredLlmResult<z.infer<T>>> {
    const provider = call.provider ?? 'OPENAI';
    if (provider !== 'OPENAI') {
      throw new Error(
        `ValidationLlmService: provider ${provider} not yet implemented in F2.0. ` +
          `Anthropic support ships with the concordance agent in F2.1.`,
      );
    }
    return this.callOpenAi(call);
  }

  private async callOpenAi<T extends z.ZodTypeAny>(
    call: StructuredLlmCall<T>,
  ): Promise<StructuredLlmResult<z.infer<T>>> {
    const client = this.aiConfig.getClientFor('OPENAI') as unknown as {
      responses: {
        parse: (args: unknown) => Promise<{
          output_parsed: unknown;
          output_text?: string;
          usage?: { input_tokens?: number; output_tokens?: number };
        }>;
      };
    };
    const model = call.model ?? DEFAULT_MODEL_OPENAI;

    let lastParseError: unknown;
    for (let attempt = 1; attempt <= 2; attempt++) {
      const started = Date.now();
      const response = await client.responses.parse({
        model,
        input: call.userMessage
          ? [
              { role: 'system', content: call.prompt },
              { role: 'user', content: call.userMessage },
            ]
          : call.prompt,
        text: { format: zodTextFormat(call.schema, call.schemaName) },
        temperature: call.temperature ?? 0,
      });

      const durationMs = Date.now() - started;
      const completedAt = new Date();
      const inputTokens = response.usage?.input_tokens ?? 0;
      const outputTokens = response.usage?.output_tokens ?? 0;

      // Log usage on every attempt — we want to pay for retries too so the
      // cost dashboard reflects reality.
      await this.aiUsage.logUsage({
        provider: 'OPENAI',
        model,
        feature: call.feature,
        tenantId: call.tenantId,
        inputTokens,
        outputTokens,
        durationMs,
        completedAt,
      });

      const parsed = call.schema.safeParse(response.output_parsed);
      if (parsed.success) {
        return {
          data: parsed.data,
          provider: 'OPENAI',
          model,
          inputTokens,
          outputTokens,
          durationMs,
          completedAt,
        };
      }

      lastParseError = parsed.error;
      this.logger.warn(
        `[${call.feature}] schema validation failed on attempt ${attempt}: ${parsed.error.message}`,
      );
      // On attempt 1, loop to retry. On attempt 2, fall through to throw.
    }

    throw new Error(
      `${SCHEMA_VALIDATION_ERROR} after 2 attempts: ${
        (lastParseError as { message?: string })?.message ?? 'unknown'
      }`,
    );
  }
}
```

- [ ] **Step 7.4: Run the test — expect PASS**

```bash
pnpm --filter @zeru/api exec jest validation-llm.service 2>&1 | tail -10
# expected: 4 passing tests
```

- [ ] **Step 7.5: Create the NestJS module**

Create `apps/api/src/modules/lab/validation/llm/validation-llm.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { AiModule } from '../../../ai/ai.module';
import { ValidationLlmService } from './validation-llm.service';

@Module({
  imports: [AiModule],
  providers: [ValidationLlmService],
  exports: [ValidationLlmService],
})
export class ValidationLlmModule {}
```

> **Verify** that `AiModule` exports both `AiConfigService` and `AiUsageService`. If it does not:
> - Open `apps/api/src/modules/ai/ai.module.ts`.
> - Add `AiConfigService` and `AiUsageService` to `exports` (keep the existing list intact).

- [ ] **Step 7.6: Wire the module into `ValidationModule`**

Open `apps/api/src/modules/lab/validation/validation.module.ts`. In the `imports` array add `ValidationLlmModule`. Keep the existing imports intact:

```ts
import { ValidationLlmModule } from './llm/validation-llm.module';

@Module({
  imports: [
    /* ...existing imports... */
    ValidationLlmModule,
  ],
  /* ...rest unchanged... */
})
```

- [ ] **Step 7.7: Build**

```bash
pnpm --filter @zeru/api build 2>&1 | tail -3
# expected: Successfully compiled
```

- [ ] **Step 7.8: Run full validation test suite to ensure nothing regressed**

```bash
pnpm --filter @zeru/api exec jest --testPathPattern='validation' 2>&1 | tail -6
# expected: all validation tests green (F1 + new F2.0)
```

- [ ] **Step 7.9: Commit**

```bash
git add apps/api/src/modules/lab/validation/llm/validation-llm.service.ts apps/api/src/modules/lab/validation/llm/validation-llm.service.spec.ts apps/api/src/modules/lab/validation/llm/validation-llm.module.ts apps/api/src/modules/lab/validation/validation.module.ts apps/api/src/modules/ai/ai.module.ts 2>/dev/null; git add -u
git commit -m "feat(lab): ValidationLlmService callStructured with schema-retry + usage logging"
```

---

## Task 8: Integration smoke — one real OpenAI call (opt-in, flag-guarded)

This is a **manual** smoke, not a CI-run test. It exists so we can prove the whole stack talks to OpenAI end-to-end before F2.1 piles on agents.

**Files:**
- Create: `apps/api/scripts/smoke-validation-llm.ts` (one-off script, not a NestJS entrypoint)

- [ ] **Step 8.1: Verify OpenAI key exists**

```bash
grep -E '^OPENAI_API_KEY=' apps/api/.env | sed 's/=.*/=***SET***/' | head -1
# expected: OPENAI_API_KEY=***SET***
```

If not set: stop. Ask the user for the key before running the smoke.

- [ ] **Step 8.2: Write the smoke script**

Create `apps/api/scripts/smoke-validation-llm.ts`:

```ts
/* eslint-disable no-console */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { z } from 'zod';
import { AppModule } from '../src/app.module';
import { ValidationLlmService } from '../src/modules/lab/validation/llm/validation-llm.service';

const TestSchema = z.object({
  verdict: z.enum(['PASS', 'FAIL']),
  reason: z.string().min(1),
});

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['warn', 'error'] });
  const svc = app.get(ValidationLlmService);
  const result = await svc.callStructured({
    feature: 'validation.smoke.f2_0',
    tenantId: process.env.SMOKE_TENANT_ID ?? 'd8d330f3-075d-41a5-9e6b-783d26f2070d',
    prompt:
      'You are a test validator. The user will give you a single sentence. ' +
      'Return verdict=PASS if the sentence contains a Chilean RUT in the form "12.345.678-K" (dots + dash); ' +
      'otherwise return verdict=FAIL. In either case, give a one-sentence reason.',
    userMessage: 'El paciente Juan Pérez, RUT 12.345.678-5, fue biopsiado el 01-04-2026.',
    schema: TestSchema,
    schemaName: 'RutPresenceVerdict',
  });
  console.log('--- result ---');
  console.log(JSON.stringify(result, null, 2));
  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 8.3: Run the smoke script**

```bash
pnpm --filter @zeru/api exec tsx scripts/smoke-validation-llm.ts 2>&1 | tail -30
```

> If the project uses `ts-node` instead of `tsx`, swap the command accordingly. Inspect `apps/api/package.json` scripts to confirm.

Expected output:
- A JSON object with `data.verdict === 'PASS'`, a non-empty `reason`, `provider: 'OPENAI'`, `durationMs` > 0.
- No errors.

- [ ] **Step 8.4: Confirm usage was logged to the DB**

```bash
PGPASSWORD=zeru psql -h localhost -p 5437 -U zeru -d zeru -c "
SELECT provider, model, feature, \"inputTokens\", \"outputTokens\", \"durationMs\",
       \"completedAt\", \"costUsd\"
FROM \"AiUsageLog\"
WHERE feature = 'validation.smoke.f2_0'
ORDER BY \"createdAt\" DESC LIMIT 3;
"
# expected: one fresh row with durationMs populated and costUsd > 0
```

- [ ] **Step 8.5: Document the smoke outcome**

Create `docs/superpowers/notes/2026-04-20-f2_0-close.md`:

```md
# F2.0 LLM infra close — smoke result

**Date:** 2026-04-20
**Stack under test:** ValidationLlmService.callStructured (OpenAI) → AiUsageService.logUsage → AiUsageLog

## Outcome

- verdict: <PASS|FAIL>
- reason: <short reason from the model>
- durationMs: <measured>
- inputTokens / outputTokens: <from usage>
- costUsd: <from AiUsageLog>
- model: <model name>

## Observations

- <anything unexpected, e.g. schema retries, latency spikes>

## Gate check

- [x] Migration applied (durationMs + completedAt + ANTHROPIC)
- [x] AiUsageService.logUsage extended and unit-tested
- [x] prompt-loader + renderPrompt unit-tested; .md files ship in dist
- [x] ValidationLlmService.callStructured unit-tested (4 cases)
- [x] AiConfigService.getClientFor supports OPENAI and ANTHROPIC
- [x] Real OpenAI call completes end-to-end and lands in AiUsageLog
```

Fill the outcome values from the smoke run.

- [ ] **Step 8.6: Commit**

```bash
git add apps/api/scripts/smoke-validation-llm.ts docs/superpowers/notes/2026-04-20-f2_0-close.md
git commit -m "docs(lab): f2.0 smoke result — openai structured call end-to-end"
```

- [ ] **Step 8.7: Closing empty commit**

```bash
git commit --allow-empty -m "chore(f2.0): f2.0 llm infra complete — gate to f2.1"
```

---

## Gate to F2.1 (text agents)

Before starting F2.1, confirm all boxes below are ticked:

- [ ] Migration `ai_usage_log_duration_anthropic` applied and visible via `\d "AiUsageLog"` and `pg_enum`.
- [ ] `AiUsageService.logUsage` persists `durationMs` and `completedAt` when provided (unit test green).
- [ ] `loadPrompt` and `renderPrompt` unit tests pass; `_example.md` is present in the build output (`dist/`).
- [ ] `ValidationLlmService.callStructured` unit tests cover: happy path, 1-retry on schema mismatch, failure after 2 attempts, provider error propagation (no usage log).
- [ ] `AiConfigService.getClientFor('ANTHROPIC')` returns an `Anthropic` instance when `ANTHROPIC_API_KEY` is set; throws a clear error when not.
- [ ] Smoke script runs end-to-end against the real OpenAI API and a row lands in `AiUsageLog` with `durationMs > 0` and `costUsd > 0`.
- [ ] `pnpm --filter @zeru/api build` succeeds with no errors.
- [ ] `pnpm --filter @zeru/api exec jest --testPathPattern='(validation|ai-usage|ai-config|prompt-loader)'` all green.
- [ ] No secrets committed (grep `OPENAI_API_KEY=` and `ANTHROPIC_API_KEY=` on `git diff` — they should not appear).
