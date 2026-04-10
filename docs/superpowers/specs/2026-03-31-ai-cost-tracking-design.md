# AI Cost Tracking & Analytics System

**Date:** 2026-03-31
**Status:** Approved
**Branch:** feature/org-intelligence

## Overview

Comprehensive system to track, calculate, and visualize costs for all AI provider interactions across the Zeru platform. Supports multiple providers (OpenAI, Gemini, ElevenLabs, Deepgram) with heterogeneous pricing models (per token, per character, per hour, per image, per generation).

## Goals

1. Every AI interaction is logged with its real USD cost at the moment it occurs
2. Tenant admins can see their organization's AI spend broken down by feature, user, model, and date
3. Platform superadmins can see cross-tenant costs for margin analysis and pricing decisions
4. Pricing is managed via DB (CRUD from superadmin panel), with validity periods for historical accuracy
5. The system is provider-agnostic and can accommodate new providers without schema changes

## Non-Goals

- Automated billing/invoicing
- Alerts or hard limits on spend (future phase)
- Real-time streaming cost display (beyond existing token meter in chat)

---

## 1. Data Model

### 1.1 Changes to `AiUsageLog`

Add the following fields to the existing model:

```prisma
userId          String?
user            User?     @relation(fields: [userId], references: [id], onDelete: SetNull)

costUsd         Decimal   @default(0)
costOverrideUsd Decimal?  // For non-token-based costs (images, fixed-price requests)

units           Decimal?  // Generic quantity: characters, seconds, minutes, etc.
pricingUnit     String?   // What `units` represents (mirrors AiModelPricing.pricingUnit)
```

New index: `@@index([tenantId, userId, createdAt])`

**Field semantics:**
- `userId`: The user who originated the AI interaction. Derived from the request context.
- `costUsd`: Calculated at creation time using `AiModelPricing`. Frozen at the price valid at that moment.
- `costOverrideUsd`: When not null, takes precedence over `costUsd`. Used for pricing models that don't fit input/output token math (e.g., Gemini image generation at a fixed cost per image).
- `units`: Generic quantity for non-token providers. Null for token-based providers (OpenAI, Gemini text).
- `pricingUnit`: Describes what `units` represents. Copied from the pricing entry for auditability.

### 1.2 New Model: `AiModelPricing`

```prisma
model AiModelPricing {
  id                    String    @id @default(uuid())
  provider              String    // OPENAI, GEMINI, ELEVENLABS, DEEPGRAM
  model                 String    // gpt-5.4, scribe-v2, flash-turbo, etc.
  contextTier           String    @default("DEFAULT") // DEFAULT, SHORT, LONG
  pricingUnit           String    // PER_1M_TOKENS, PER_1K_CHARS, PER_HOUR, PER_MINUTE, PER_IMAGE, PER_GENERATION
  inputPrice            Decimal   // Price per unit for input
  outputPrice           Decimal   // Price per unit for output
  cachedPrice           Decimal   @default(0) // Price per unit for cached input
  longContextThreshold  Int?      // Token count threshold for LONG tier (null = N/A)
  description           String?   // Free-form note (e.g., "Business tier pricing", "Audio input")
  validFrom             DateTime
  validTo               DateTime? // null = currently active
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  @@unique([provider, model, contextTier, validFrom])
  @@index([provider, model])
  @@map("ai_model_pricing")
}
```

**Pricing unit enum values:**

| Value | Unit basis | Used by |
|-------|-----------|---------|
| `PER_1M_TOKENS` | Per 1,000,000 tokens | OpenAI, Gemini (text) |
| `PER_1K_CHARS` | Per 1,000 characters | ElevenLabs TTS, Deepgram TTS |
| `PER_HOUR` | Per hour of audio | ElevenLabs STT (Scribe), Deepgram STT |
| `PER_MINUTE` | Per minute of audio/video | ElevenLabs (Music, Voice Isolator, Dubbing) |
| `PER_IMAGE` | Per image generated | Gemini image models |
| `PER_GENERATION` | Per generation request | ElevenLabs Sound Effects |

---

## 2. Backend Services

### 2.1 `AiPricingService`

New service at `modules/ai/services/ai-pricing.service.ts`.

**Methods:**

- **`getActivePrice(provider: string, model: string, contextTier?: string): AiModelPricing`**
  Finds the currently valid pricing entry (`validTo IS NULL`). In-memory cache with 5-minute TTL to avoid repeated DB queries.

- **`calculateCost(params: CalculateCostParams): Decimal`**
  First calls `determineContextTier()` to resolve the correct pricing row, then calculates USD cost based on the pricing unit:

  ```
  PER_1M_TOKENS  -> (inputTokens * inputPrice + outputTokens * outputPrice + cachedTokens * cachedPrice) / 1_000_000
  PER_1K_CHARS   -> (units * inputPrice) / 1_000
  PER_HOUR       -> units * inputPrice
  PER_MINUTE     -> units * inputPrice
  PER_IMAGE      -> units * outputPrice
  PER_GENERATION -> units * outputPrice
  ```

- **`determineContextTier(provider: string, model: string, inputTokens: number): string`**
  Returns `"SHORT"` or `"LONG"` based on `longContextThreshold`. Returns `"DEFAULT"` if no threshold exists.

- **`recalculateCosts(filters: { from: Date, to: Date, provider?: string, model?: string }): number`**
  Recalculates `costUsd` for matching logs using the pricing that was valid at each log's `createdAt` timestamp (not current pricing). This preserves historical accuracy while fixing incorrect price entries. Returns count of updated records. Superadmin only.

### 2.2 Centralized Usage Logging Helper

Extract a shared `logAiUsage(params)` function to eliminate duplicated logging logic across 7+ services:

```typescript
interface LogAiUsageParams {
  provider: string;
  model: string;
  feature: string;
  tenantId: string;
  userId: string;
  conversationId?: string;
  inputTokens?: number;
  outputTokens?: number;
  cachedTokens?: number;
  compacted?: boolean;
  units?: number;           // For non-token providers
  pricingUnit?: string;     // For non-token providers
  costOverrideUsd?: number; // For fixed-price interactions
}
```

The helper:
1. Calls `pricingService.calculateCost()` (unless `costOverrideUsd` is provided)
2. Creates the `AiUsageLog` record with all fields populated
3. Returns the created log

### 2.3 Integration Points

Each existing service that creates `AiUsageLog` entries is updated to use `logAiUsage()`:

| Service | Feature | Changes needed |
|---------|---------|---------------|
| `ChatService` | `chat` | Add `userId` from context, use helper |
| `ChatService` | `title-generation` | Add `userId` from context, use helper |
| `TranscriptionService` | `org-transcription` | Add `userId`, use helper |
| `InterviewQuestionsService` | `interview-question-generation` | Add `userId`, use helper |
| `ExtractionPipelineService` | `org-extraction-pass-{N}` | Add `userId`, use helper |
| `OrgEmbeddingService` | `org-embedding-*` | Add `userId`, use helper |
| `LinkedinPostsService` | `post-regeneration` | Add `userId`, use helper |
| `GeminiImageService` | `image-generation` | **New**: Add full tracking with `costOverrideUsd` |

### 2.4 Gemini Image Cost Calculation

`GeminiImageService` currently has no usage tracking. Add:
- Log each image generation request
- Calculate `costOverrideUsd` based on output token count from Gemini response
  - `gemini-3.1-flash-image-preview`: output at $60/1M tokens. 1,120 tokens per 1K image = ~$0.067/image
  - `gemini-3-pro-image-preview`: output at $120/1M tokens. 1,120 tokens per 1K/2K image = ~$0.134/image

---

## 3. API Endpoints

### 3.1 Pricing CRUD (Superadmin only)

New controller: `AiPricingController`

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/ai/pricing` | List all prices (active + historical) |
| `GET` | `/api/ai/pricing/active` | Active prices only |
| `POST` | `/api/ai/pricing` | Create new price (auto-closes previous) |
| `PATCH` | `/api/ai/pricing/:id` | Edit price (only if no logs reference it) |
| `POST` | `/api/ai/pricing/recalculate` | Recalculate costs for a date range |

### 3.2 Tenant Admin Cost Dashboard

New controller: `AiCostController`

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/ai/costs/summary` | Total cost for tenant with filters (from, to) |
| `GET` | `/api/ai/costs/by-feature` | Breakdown by feature |
| `GET` | `/api/ai/costs/by-user` | Breakdown by user |
| `GET` | `/api/ai/costs/by-model` | Breakdown by model/provider |
| `GET` | `/api/ai/costs/daily` | Daily time series for charts |

All endpoints filter by `tenantId` from the authenticated user. Accept `from` and `to` query params for date range.

### 3.3 Superadmin Global Dashboard

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/ai/costs/global/summary` | Total cross-tenant cost |
| `GET` | `/api/ai/costs/global/by-tenant` | Breakdown by tenant |
| `GET` | `/api/ai/costs/global/by-model` | Global breakdown by model |
| `GET` | `/api/ai/costs/global/daily` | Global daily time series |

### 3.4 Response Format

All breakdown endpoints return a consistent shape:

```typescript
interface CostBreakdownResponse {
  totalCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCachedTokens: number;
  breakdown: Array<{
    key: string;        // feature name, userId, model, tenantId
    label: string;      // Human-readable name
    costUsd: number;
    inputTokens: number;
    outputTokens: number;
    percentage: number;  // % of total cost
  }>;
  period: { from: string; to: string };
}
```

---

## 4. Frontend: Tenant Admin Dashboard

### 4.1 Location

New page at `/settings/ai/costs`. Link in the settings sidebar alongside existing AI configuration.

### 4.2 Layout

**Header:**
- Title: "Costos de IA"
- Date range selector (defaults to current month; presets: last 7 days, current month, previous month, custom)

**KPI Cards (top row):**
- Total cost USD for the period
- Total input tokens
- Total output tokens
- Cached tokens (savings indicator)

### 4.3 Daily Trend Chart

- Stacked bar chart by day
- Each bar segment = one feature (chat, embeddings, transcription, etc.)
- Y-axis in USD
- Hover tooltip shows day breakdown

### 4.4 Breakdown Tables

Four tabs below the chart:

| Tab | Rows | Columns |
|-----|------|---------|
| **By Feature** | chat, embedding, transcription... | Cost, Input tokens, Output tokens, % of total |
| **By User** | User name/email | Cost, Input tokens, Output tokens, % of total |
| **By Model** | gpt-5.4, gemini-3.1-flash... | Cost, Input tokens, Output tokens, % of total |
| **Detail** | Each individual log entry | Date, User, Feature, Model, Tokens, Cost |

- All tables sortable by any column
- "Detail" tab paginated (50 per page)
- Inline percentage bars in each row for quick visualization

### 4.5 Components

Use existing shadcn/ui: `Card`, `Table`, `Tabs`, `Select`, `DateRangePicker`. Add Recharts for the bar chart (lightweight charting library).

---

## 5. Frontend: Superadmin Dashboard

### 5.1 Location

New page at the superadmin-protected route (e.g., `/admin/ai-costs`).

### 5.2 Layout

Same pattern as tenant dashboard but with global view:

**KPI Cards:**
- Total global cost USD
- Number of active tenants (used AI in the period)
- Most expensive model
- Most expensive feature

**Daily Trend Chart:**
- Stacked bars by tenant or by model (toggle between both views)

### 5.3 Breakdown Tables

| Tab | Rows | Columns |
|-----|------|---------|
| **By Tenant** | Tenant name | Cost, Tokens, % of total |
| **By Model** | gpt-5.4, gemini... | Cost, Tokens, % of total |
| **By Feature** | chat, embedding... | Cost, Tokens, % of total |

- Click on a tenant row navigates to detailed view of that tenant (reuses tenant admin dashboard with any-tenant data)

### 5.4 Pricing Management

Page at `/admin/ai-pricing`:
- Table of active prices (provider, model, context tier, pricing unit, input/output/cached price)
- "Add Price" button -> modal form
- Creating a price for a model that already has an active one auto-closes the previous entry
- Collapsible price history per model

---

## 6. Migration & Data Seeding

### 6.1 Schema Migration

1. Add `userId`, `costUsd`, `costOverrideUsd`, `units`, `pricingUnit` to `ai_usage_logs`
2. Create `ai_model_pricing` table
3. Add index `(tenantId, userId, createdAt)` on `ai_usage_logs`
4. Add relation from `AiUsageLog` to `User`

### 6.2 Initial Price Seed

**OpenAI:**

| Model | Tier | Input/1M | Cached/1M | Output/1M |
|-------|------|----------|-----------|-----------|
| gpt-5.4 | SHORT | $2.50 | $0.25 | $15.00 |
| gpt-5.4 | LONG | $5.00 | $0.50 | $22.50 |
| gpt-5.4-mini | SHORT | $0.75 | $0.075 | $4.50 |
| gpt-5.4-nano | SHORT | $0.20 | $0.02 | $1.25 |
| gpt-5.4-pro | SHORT | $30.00 | $0.00 | $180.00 |
| gpt-5.4-pro | LONG | $60.00 | $0.00 | $270.00 |
| gpt-5.2-2025-12-11 | SHORT | $1.75 | $0.175 | $14.00 |
| text-embedding-3-small | SHORT | $0.02 | $0.00 | $0.00 |

`longContextThreshold` for gpt-5.4 and gpt-5.4-pro: 200,000 tokens.

**Gemini (models currently in use):**

| Model | Tier | Input/1M | Cached/1M | Output/1M | Notes |
|-------|------|----------|-----------|-----------|-------|
| gemini-3.1-flash-image-preview | DEFAULT | $0.50 | $0.00 | $60.00 | Image output. Use `costOverrideUsd` per image |
| gemini-3-pro-image-preview | DEFAULT | $2.00 | $0.00 | $120.00 | Image output. Use `costOverrideUsd` per image |

Additional Gemini models (text-based) to be added via superadmin CRUD as needed:
- gemini-3.1-pro-preview, gemini-3-flash-preview, gemini-2.5-pro, gemini-2.5-flash, gemini-2.5-flash-lite, etc.

**ElevenLabs & Deepgram:** Seeded via superadmin CRUD based on contracted plan tier. Not hardcoded.

### 6.3 Historical Data Backfill

One-time migration script:
1. Derive `userId` from `Conversation.userId` for logs that have a `conversationId`
2. Calculate `costUsd` retroactively using seed prices
3. Logs without conversation (embeddings, transcription) remain with `userId = null` unless the originating service stored that info

### 6.4 Performance Considerations

- `costUsd` is precalculated, avoiding JOINs with pricing table on every dashboard query
- Composite indexes cover the main query patterns: `(tenantId, createdAt)`, `(tenantId, userId, createdAt)`, `(conversationId)`
- Pricing table is tiny (<50 rows); in-memory cache with 5-minute TTL is sufficient
- Dashboard aggregation queries use bounded date ranges to keep performance predictable

---

## 7. Provider-Unit Mapping Reference

| Provider | Model Example | pricingUnit | units field | How cost is calculated |
|----------|--------------|-------------|-------------|----------------------|
| OpenAI | gpt-5.4 | PER_1M_TOKENS | null | (in*price + out*price + cache*price) / 1M |
| OpenAI | text-embedding-3-small | PER_1M_TOKENS | null | (in*price) / 1M |
| Gemini | gemini-3.1-pro-preview | PER_1M_TOKENS | null | Same as OpenAI |
| Gemini | gemini-3.1-flash-image-preview | PER_IMAGE | num images | costOverrideUsd per image |
| ElevenLabs | flash-turbo (TTS) | PER_1K_CHARS | characters | (units * inputPrice) / 1K |
| ElevenLabs | scribe-v2 (STT) | PER_HOUR | hours | units * inputPrice |
| ElevenLabs | sound-effects | PER_GENERATION | generations | units * outputPrice |
| Deepgram | nova-3 (STT) | PER_HOUR | hours | units * inputPrice |
| Deepgram | aura (TTS) | PER_1K_CHARS | characters | (units * inputPrice) / 1K |
