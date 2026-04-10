# Org Branding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow each organization to customize their visual identity (logo, isotipo, color palette) with manual and AI-assisted tools, applying branding across the UI and email communications.

**Architecture:** New `TenantBranding` 1:1 model, platform-level S3 for image storage (independent of per-tenant S3), `BrandingProvider` injects CSS variable overrides at runtime, email builder consumes branding assets. AI palette generation via OpenAI vision.

**Tech Stack:** NestJS, Prisma, AWS S3 + SES, OpenAI (vision), Next.js, Tailwind CSS v4 (oklch), React context, shadcn/ui components.

**Spec:** `docs/superpowers/specs/2026-04-09-org-branding-design.md`

---

## File Map

### packages/shared

| Action | Path | Purpose |
|--------|------|---------|
| Create | `src/types/branding.ts` | `TenantBranding`, `TenantBrandingAssets` interfaces |
| Create | `src/schemas/branding.schema.ts` | Zod schemas for branding update + palette generation |
| Modify | `src/types/tenant.ts` | Extend `Tenant` with optional `branding` field |
| Modify | `src/index.ts` | Re-export new types and schemas |

### apps/api

| Action | Path | Purpose |
|--------|------|---------|
| Modify | `prisma/schema.prisma` | Add `TenantBranding` model + relation on `Tenant` |
| Create | `src/modules/platform-storage/platform-storage.module.ts` | Module for platform-level S3 |
| Create | `src/modules/platform-storage/platform-storage.service.ts` | S3 upload/delete/presign with global creds |
| Create | `src/modules/branding/branding.module.ts` | NestJS module |
| Create | `src/modules/branding/branding.controller.ts` | REST endpoints for branding CRUD + image upload + AI |
| Create | `src/modules/branding/branding.service.ts` | Business logic for branding |
| Create | `src/modules/branding/dto.ts` | Zod DTOs |
| Modify | `src/modules/email/email.service.ts` | Refactor to branded email builder |
| Modify | `src/modules/tenants/tenants.service.ts` | Eager-load branding on `findById` |
| Modify | `src/app.module.ts` | Register new modules |

### apps/web

| Action | Path | Purpose |
|--------|------|---------|
| Create | `lib/api/branding.ts` | API wrapper for branding endpoints |
| Modify | `lib/api-client.ts` | Add `uploadFile` helper for multipart |
| Create | `providers/branding-provider.tsx` | CSS variable injection from tenant branding |
| Create | `lib/color-utils.ts` | hex↔oklch conversion + variant derivation |
| Modify | `providers/tenant-provider.tsx` | Include branding in tenant type |
| Modify | `app/(dashboard)/layout.tsx` | Insert BrandingProvider |
| Modify | `components/layouts/team-switcher.tsx` | Isotipo + RUT |
| Modify | `app/(dashboard)/settings/organization/page.tsx` | Tab layout + Apariencia tab |

---

## Task 1: Shared Types & Schemas

**Files:**
- Create: `packages/shared/src/types/branding.ts`
- Create: `packages/shared/src/schemas/branding.schema.ts`
- Modify: `packages/shared/src/types/tenant.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Create branding types**

```typescript
// packages/shared/src/types/branding.ts
export interface TenantBranding {
  id: string;
  tenantId: string;
  logoUrl: string | null;
  isotipoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantBrandingAssets {
  logoUrl: string | null;
  isotipoUrl: string | null;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  } | null;
  fallbackInitial: string;
  tenantName: string;
}

export interface UpdateBrandingInput {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
}

export interface GeneratePaletteInput {
  source: 'logo' | 'description';
  description?: string;
}

export interface GeneratePaletteResult {
  primary: string;
  secondary: string;
  accent: string;
}
```

- [ ] **Step 2: Create branding Zod schemas**

```typescript
// packages/shared/src/schemas/branding.schema.ts
import { z } from 'zod';

const hexColorRegex = /^#[0-9a-fA-F]{6}$/;

export const updateBrandingSchema = z.object({
  primaryColor: z.string().regex(hexColorRegex, 'Color primario inválido').optional(),
  secondaryColor: z.string().regex(hexColorRegex, 'Color secundario inválido').optional(),
  accentColor: z.string().regex(hexColorRegex, 'Color de acento inválido').optional(),
});

export const generatePaletteSchema = z.discriminatedUnion('source', [
  z.object({
    source: z.literal('logo'),
  }),
  z.object({
    source: z.literal('description'),
    description: z.string().min(5, 'Descripción muy corta').max(500, 'Descripción muy larga'),
  }),
]);

export type UpdateBrandingSchema = z.infer<typeof updateBrandingSchema>;
export type GeneratePaletteSchema = z.infer<typeof generatePaletteSchema>;
```

- [ ] **Step 3: Extend Tenant type with optional branding**

In `packages/shared/src/types/tenant.ts`, add import and extend the `Tenant` interface:

```typescript
import { TenantBranding } from './branding';

// Add to existing Tenant interface:
export interface Tenant {
  // ... existing fields ...
  branding?: TenantBranding | null;
}
```

- [ ] **Step 4: Update barrel exports**

In `packages/shared/src/index.ts`, add:

```typescript
export * from './types/branding';
export * from './schemas/branding.schema';
```

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/types/branding.ts packages/shared/src/schemas/branding.schema.ts packages/shared/src/types/tenant.ts packages/shared/src/index.ts
git commit -m "feat(shared): add branding types and schemas"
```

---

## Task 2: Prisma Schema & Migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add TenantBranding model to Prisma schema**

Add after existing models in `apps/api/prisma/schema.prisma`:

```prisma
model TenantBranding {
  id             String   @id @default(uuid())
  tenantId       String   @unique
  tenant         Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  logoUrl        String?
  isotipoUrl     String?
  primaryColor   String?
  secondaryColor String?
  accentColor    String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@map("tenant_brandings")
  @@schema("public")
}
```

- [ ] **Step 2: Add relation field to Tenant model**

In the `Tenant` model, add the relation field alongside the other optional config relations (near `storageConfig`, `emailConfig`):

```prisma
branding TenantBranding?
```

- [ ] **Step 3: Generate migration**

```bash
cd apps/api && pnpm db:migrate --name add_tenant_branding
```

Expected: Creates migration file in `prisma/migrations/` with `CREATE TABLE "tenant_brandings"`, unique index on `tenantId`, and foreign key constraint.

- [ ] **Step 4: Generate Prisma client**

```bash
cd apps/api && pnpm db:generate
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat(prisma): add TenantBranding model"
```

---

## Task 3: PlatformStorageService

**Files:**
- Create: `apps/api/src/modules/platform-storage/platform-storage.service.ts`
- Create: `apps/api/src/modules/platform-storage/platform-storage.module.ts`

- [ ] **Step 1: Create PlatformStorageService**

```typescript
// apps/api/src/modules/platform-storage/platform-storage.service.ts
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class PlatformStorageService {
  private readonly logger = new Logger(PlatformStorageService.name);
  private readonly bucket: string;
  private readonly region: string;
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.getOrThrow<string>('PLATFORM_S3_BUCKET');
    this.region = this.config.getOrThrow<string>('PLATFORM_S3_REGION');
    this.accessKeyId = this.config.getOrThrow<string>('PLATFORM_S3_ACCESS_KEY_ID');
    this.secretAccessKey = this.config.getOrThrow<string>('PLATFORM_S3_SECRET_ACCESS_KEY');
  }

  private createClient(): S3Client {
    return new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
      },
    });
  }

  async upload(key: string, buffer: Buffer, contentType: string): Promise<string> {
    const client = this.createClient();
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        }),
      );
      this.logger.log(`Uploaded: ${key}`);
      return key;
    } catch (error) {
      this.logger.error(`Upload failed: ${key}`, error);
      throw new InternalServerErrorException('Error al subir archivo');
    } finally {
      client.destroy();
    }
  }

  async getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const client = this.createClient();
    try {
      return await getSignedUrl(
        client,
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
        { expiresIn },
      );
    } catch (error) {
      this.logger.error(`Presigned URL failed: ${key}`, error);
      throw new InternalServerErrorException('Error al generar URL');
    } finally {
      client.destroy();
    }
  }

  async delete(key: string): Promise<void> {
    const client = this.createClient();
    try {
      await client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      this.logger.log(`Deleted: ${key}`);
    } catch (error) {
      this.logger.error(`Delete failed: ${key}`, error);
      throw new InternalServerErrorException('Error al eliminar archivo');
    } finally {
      client.destroy();
    }
  }

  static buildBrandingKey(tenantId: string, type: 'logo' | 'isotipo', filename: string): string {
    return `platform/tenants/${tenantId}/branding/${type}/${filename}`;
  }
}
```

- [ ] **Step 2: Create PlatformStorageModule**

```typescript
// apps/api/src/modules/platform-storage/platform-storage.module.ts
import { Module } from '@nestjs/common';
import { PlatformStorageService } from './platform-storage.service';

@Module({
  providers: [PlatformStorageService],
  exports: [PlatformStorageService],
})
export class PlatformStorageModule {}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/platform-storage/
git commit -m "feat(api): add PlatformStorageService for global S3 assets"
```

---

## Task 4: Branding NestJS Module

**Files:**
- Create: `apps/api/src/modules/branding/dto.ts`
- Create: `apps/api/src/modules/branding/branding.service.ts`
- Create: `apps/api/src/modules/branding/branding.controller.ts`
- Create: `apps/api/src/modules/branding/branding.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/modules/tenants/tenants.service.ts`

- [ ] **Step 1: Create DTOs**

```typescript
// apps/api/src/modules/branding/dto.ts
import { z } from 'zod';

const hexColorRegex = /^#[0-9a-fA-F]{6}$/;

export const updateBrandingDto = z.object({
  primaryColor: z.string().regex(hexColorRegex, 'Color primario inválido').optional(),
  secondaryColor: z.string().regex(hexColorRegex, 'Color secundario inválido').optional(),
  accentColor: z.string().regex(hexColorRegex, 'Color de acento inválido').optional(),
});

export const generatePaletteDto = z.discriminatedUnion('source', [
  z.object({ source: z.literal('logo') }),
  z.object({
    source: z.literal('description'),
    description: z.string().min(5, 'Descripción muy corta').max(500, 'Descripción muy larga'),
  }),
]);

export type UpdateBrandingDto = z.infer<typeof updateBrandingDto>;
export type GeneratePaletteDto = z.infer<typeof generatePaletteDto>;
```

- [ ] **Step 2: Create BrandingService**

```typescript
// apps/api/src/modules/branding/branding.service.ts
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PlatformStorageService } from '../platform-storage/platform-storage.service';
import { UpdateBrandingDto } from './dto';
import { v4 as uuid } from 'uuid';
import { extname } from 'path';

@Injectable()
export class BrandingService {
  private readonly logger = new Logger(BrandingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: PlatformStorageService,
  ) {}

  async getBranding(tenantId: string) {
    const branding = await this.prisma.tenantBranding.findUnique({
      where: { tenantId },
    });
    if (!branding) return null;

    return {
      ...branding,
      logoUrl: branding.logoUrl
        ? await this.storage.getPresignedUrl(branding.logoUrl)
        : null,
      isotipoUrl: branding.isotipoUrl
        ? await this.storage.getPresignedUrl(branding.isotipoUrl)
        : null,
    };
  }

  async updateColors(tenantId: string, dto: UpdateBrandingDto) {
    return this.prisma.tenantBranding.upsert({
      where: { tenantId },
      create: { tenantId, ...dto },
      update: dto,
    });
  }

  async uploadImage(
    tenantId: string,
    type: 'logo' | 'isotipo',
    file: Express.Multer.File,
  ) {
    const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/svg+xml'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Formato no soportado. Usa PNG, JPG o SVG.');
    }

    const maxSize = type === 'logo' ? 2 * 1024 * 1024 : 1 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException(
        `Archivo muy grande. Máximo ${type === 'logo' ? '2MB' : '1MB'}.`,
      );
    }

    // Delete old image if exists
    const existing = await this.prisma.tenantBranding.findUnique({
      where: { tenantId },
    });
    const oldKey = type === 'logo' ? existing?.logoUrl : existing?.isotipoUrl;
    if (oldKey) {
      await this.storage.delete(oldKey);
    }

    const filename = `${uuid()}${extname(file.originalname)}`;
    const key = PlatformStorageService.buildBrandingKey(tenantId, type, filename);
    await this.storage.upload(key, file.buffer, file.mimetype);

    const updateField = type === 'logo' ? 'logoUrl' : 'isotipoUrl';
    const branding = await this.prisma.tenantBranding.upsert({
      where: { tenantId },
      create: { tenantId, [updateField]: key },
      update: { [updateField]: key },
    });

    return {
      ...branding,
      [updateField]: await this.storage.getPresignedUrl(key),
    };
  }

  async deleteImage(tenantId: string, type: 'logo' | 'isotipo') {
    const existing = await this.prisma.tenantBranding.findUnique({
      where: { tenantId },
    });
    if (!existing) return;

    const key = type === 'logo' ? existing.logoUrl : existing.isotipoUrl;
    if (key) {
      await this.storage.delete(key);
    }

    const updateField = type === 'logo' ? 'logoUrl' : 'isotipoUrl';
    return this.prisma.tenantBranding.update({
      where: { tenantId },
      data: { [updateField]: null },
    });
  }

  /**
   * Returns branding assets for use in emails, PDFs, etc.
   * Resolves presigned URLs for images.
   */
  async getBrandingAssets(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { branding: true },
    });
    if (!tenant) return null;

    const branding = tenant.branding;
    const hasColors = branding?.primaryColor && branding?.secondaryColor && branding?.accentColor;

    return {
      logoUrl: branding?.logoUrl
        ? await this.storage.getPresignedUrl(branding.logoUrl)
        : null,
      isotipoUrl: branding?.isotipoUrl
        ? await this.storage.getPresignedUrl(branding.isotipoUrl)
        : null,
      colors: hasColors
        ? {
            primary: branding!.primaryColor!,
            secondary: branding!.secondaryColor!,
            accent: branding!.accentColor!,
          }
        : null,
      fallbackInitial: tenant.name.charAt(0).toUpperCase(),
      tenantName: tenant.name,
    };
  }
}
```

- [ ] **Step 3: Create BrandingController**

```typescript
// apps/api/src/modules/branding/branding.controller.ts
import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { BrandingService } from './branding.service';
import { updateBrandingDto, generatePaletteDto, UpdateBrandingDto, GeneratePaletteDto } from './dto';

@Controller('tenants/current/branding')
@UseGuards(JwtAuthGuard, TenantGuard)
export class BrandingController {
  constructor(private readonly brandingService: BrandingService) {}

  @Get()
  async getBranding(@CurrentTenant() tenantId: string) {
    return this.brandingService.getBranding(tenantId);
  }

  @Patch()
  async updateColors(
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(updateBrandingDto)) body: UpdateBrandingDto,
  ) {
    return this.brandingService.updateColors(tenantId, body);
  }

  @Post('logo')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  async uploadLogo(
    @CurrentTenant() tenantId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) throw new BadRequestException('Archivo requerido');
    return this.brandingService.uploadImage(tenantId, 'logo', file);
  }

  @Post('isotipo')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 1 * 1024 * 1024 } }))
  async uploadIsotipo(
    @CurrentTenant() tenantId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) throw new BadRequestException('Archivo requerido');
    return this.brandingService.uploadImage(tenantId, 'isotipo', file);
  }

  @Delete('logo')
  async deleteLogo(@CurrentTenant() tenantId: string) {
    return this.brandingService.deleteImage(tenantId, 'logo');
  }

  @Delete('isotipo')
  async deleteIsotipo(@CurrentTenant() tenantId: string) {
    return this.brandingService.deleteImage(tenantId, 'isotipo');
  }

  @Post('generate-palette')
  async generatePalette(
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(generatePaletteDto)) body: GeneratePaletteDto,
  ) {
    return this.brandingService.generatePalette(tenantId, body);
  }
}
```

- [ ] **Step 4: Create BrandingModule**

```typescript
// apps/api/src/modules/branding/branding.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PlatformStorageModule } from '../platform-storage/platform-storage.module';
import { BrandingController } from './branding.controller';
import { BrandingService } from './branding.service';

@Module({
  imports: [PrismaModule, PlatformStorageModule],
  controllers: [BrandingController],
  providers: [BrandingService],
  exports: [BrandingService],
})
export class BrandingModule {}
```

- [ ] **Step 5: Register module in AppModule**

In `apps/api/src/app.module.ts`, add import and register:

```typescript
import { BrandingModule } from './modules/branding/branding.module';
import { PlatformStorageModule } from './modules/platform-storage/platform-storage.module';

// Add to @Module imports array:
PlatformStorageModule,
BrandingModule,
```

- [ ] **Step 6: Extend TenantsService to eager-load branding**

In `apps/api/src/modules/tenants/tenants.service.ts`, modify the `findById` method (or whichever method serves `GET /tenants/current`) to include branding:

Find the `findUnique` call for tenant and add `include: { branding: true }`:

```typescript
// Change from:
return this.prisma.tenant.findUnique({ where: { id } });
// To:
return this.prisma.tenant.findUnique({
  where: { id },
  include: { branding: true },
});
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/branding/ apps/api/src/modules/platform-storage/ apps/api/src/app.module.ts apps/api/src/modules/tenants/tenants.service.ts
git commit -m "feat(api): add branding module with CRUD, image upload, and palette generation stub"
```

---

## Task 5: AI Palette Generation

**Files:**
- Modify: `apps/api/src/modules/branding/branding.service.ts`

This task adds the `generatePalette` method to `BrandingService`. It requires the OpenAI SDK which is already a dependency in the project.

- [ ] **Step 1: Add generatePalette method to BrandingService**

Add this method to `BrandingService` in `apps/api/src/modules/branding/branding.service.ts`:

```typescript
async generatePalette(tenantId: string, dto: GeneratePaletteDto) {
  const OpenAI = (await import('openai')).default;
  const openai = new OpenAI();

  if (dto.source === 'logo') {
    const branding = await this.prisma.tenantBranding.findUnique({
      where: { tenantId },
    });
    if (!branding?.logoUrl && !branding?.isotipoUrl) {
      throw new BadRequestException('Debes subir un logo o isotipo primero');
    }

    const imageKey = branding.logoUrl || branding.isotipoUrl;
    const imageUrl = await this.storage.getPresignedUrl(imageKey!);

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: imageUrl },
            },
            {
              type: 'text',
              text: `Analiza este logotipo y sugiere una paleta de 3 colores para una aplicación web:
- primary: el color dominante/principal del logo, para botones y acciones principales
- secondary: un color complementario, para badges y elementos secundarios
- accent: un color de acento, para notificaciones y alertas

Requisitos:
- Los colores deben funcionar bien sobre fondo blanco (light mode) y fondo oscuro (dark mode)
- Ratio de contraste WCAG AA mínimo (4.5:1) para texto blanco sobre cada color
- Los 3 colores deben ser visualmente distintos entre sí

Responde SOLO con JSON válido, sin markdown: {"primary":"#hex","secondary":"#hex","accent":"#hex"}`,
            },
          ],
        },
      ],
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) throw new BadRequestException('No se pudo generar la paleta');

    const palette = JSON.parse(content);
    await this.logAiUsage(tenantId, response);
    return palette;
  }

  // source === 'description'
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 256,
    messages: [
      {
        role: 'user',
        content: `Genera una paleta de 3 colores para una aplicación web basándote en esta descripción: "${dto.description}"

- primary: color principal para botones y acciones
- secondary: color complementario para badges y elementos secundarios
- accent: color de acento para notificaciones y alertas

Requisitos:
- Los colores deben funcionar bien sobre fondo blanco y fondo oscuro
- Ratio de contraste WCAG AA mínimo (4.5:1) para texto blanco sobre cada color
- Los 3 colores deben ser visualmente distintos entre sí

Responde SOLO con JSON válido, sin markdown: {"primary":"#hex","secondary":"#hex","accent":"#hex"}`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content?.trim();
  if (!content) throw new BadRequestException('No se pudo generar la paleta');

  const palette = JSON.parse(content);
  await this.logAiUsage(tenantId, response);
  return palette;
}

private async logAiUsage(tenantId: string, response: any) {
  try {
    await this.prisma.aiUsageLog.create({
      data: {
        tenantId,
        provider: 'OPENAI',
        model: response.model || 'gpt-4o',
        feature: 'branding-palette-generation',
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0,
      },
    });
  } catch (error) {
    this.logger.warn('Failed to log AI usage', error);
  }
}
```

- [ ] **Step 2: Add missing import**

At the top of `branding.service.ts`, add:

```typescript
import { GeneratePaletteDto } from './dto';
```

(The `UpdateBrandingDto` import should already be there from Task 4.)

- [ ] **Step 3: Verify it compiles**

```bash
cd apps/api && npx tsc --noEmit
```

Expected: No errors (or only pre-existing warnings).

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/branding/branding.service.ts
git commit -m "feat(api): add AI palette generation from logo and description"
```

---

## Task 6: Email Template Builder with Branding

**Files:**
- Modify: `apps/api/src/modules/email/email.service.ts`

- [ ] **Step 1: Read current EmailService**

Read `apps/api/src/modules/email/email.service.ts` to understand exact current code structure before modifying.

- [ ] **Step 2: Add BrandingService dependency**

In `EmailService` constructor, add `BrandingService` injection. In `EmailModule`, import `BrandingModule`.

In `apps/api/src/modules/email/email.module.ts`:

```typescript
import { BrandingModule } from '../branding/branding.module';

@Global()
@Module({
  imports: [EmailConfigModule, BrandingModule],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
```

In `EmailService` constructor:

```typescript
import { BrandingService } from '../branding/branding.service';
import { TenantBrandingAssets } from '@zeru/shared';

constructor(
  private readonly configService: ConfigService,
  private readonly emailConfigService: EmailConfigService,
  private readonly brandingService: BrandingService,
) {}
```

- [ ] **Step 3: Add buildBrandedEmailHtml method**

Add this private method to `EmailService`:

```typescript
private buildBrandedEmailHtml(options: {
  branding: TenantBrandingAssets | null;
  title: string;
  body: string;
}): string {
  const { branding, title, body } = options;
  const logoUrl = branding?.logoUrl;
  const primaryColor = branding?.colors?.primary || '#14b8a6';
  const accentColor = branding?.colors?.accent || '#2dd4bf';
  const orgName = branding?.tenantName || 'Zeru';

  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="${orgName}" style="max-height: 40px; max-width: 200px;" />`
    : `<span style="font-size: 24px; font-weight: bold; color: ${primaryColor};">${orgName}</span>`;

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a; padding: 40px 0;">
        <tr>
          <td align="center">
            <table width="480" cellpadding="0" cellspacing="0" style="background-color: #141414; border-radius: 12px; overflow: hidden;">
              <!-- Header -->
              <tr>
                <td style="padding: 24px 32px; border-bottom: 1px solid #222;">
                  ${logoHtml}
                </td>
              </tr>
              <!-- Title -->
              <tr>
                <td style="padding: 32px 32px 0;">
                  <h1 style="margin: 0; font-size: 20px; color: #ffffff; font-weight: 600;">${title}</h1>
                </td>
              </tr>
              <!-- Body -->
              <tr>
                <td style="padding: 16px 32px 32px; color: #a3a3a3; font-size: 15px; line-height: 1.6;">
                  ${body}
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="padding: 20px 32px; border-top: 1px solid #222; text-align: center;">
                  <span style="font-size: 12px; color: #525252;">${orgName}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}
```

- [ ] **Step 4: Refactor sendWelcomeEmail to use branded builder**

Replace the existing `sendWelcomeEmail` method. The method currently calls `buildWelcomeHtml`. Change it to:

```typescript
async sendWelcomeEmail(to: string, firstName: string, tenantName: string, tenantId?: string) {
  const branding = tenantId
    ? await this.brandingService.getBrandingAssets(tenantId)
    : null;
  const primaryColor = branding?.colors?.primary || '#14b8a6';

  const body = `
    <p style="color: #e5e5e5;">Hola <strong>${firstName}</strong>,</p>
    <p>Has sido invitado a <strong style="color: ${primaryColor};">${tenantName}</strong>.</p>
    <p>Ya puedes acceder a la plataforma con tu correo electrónico.</p>
    <div style="text-align: center; margin: 24px 0;">
      <a href="https://app.zeru.cl/login" style="display: inline-block; padding: 12px 32px; background-color: ${primaryColor}; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">Iniciar sesión</a>
    </div>
  `;

  const html = this.buildBrandedEmailHtml({
    branding,
    title: `Bienvenido a ${tenantName}`,
    body,
  });

  const creds = this.systemCredentials();
  await this.withSesClient(creds, async (client) => {
    await client.send(
      new SendEmailCommand({
        Source: creds.fromEmail,
        Destination: { ToAddresses: [to] },
        Message: {
          Subject: { Data: `Bienvenido a ${tenantName}` },
          Body: { Html: { Data: html } },
        },
      }),
    );
  });
}
```

- [ ] **Step 5: Refactor sendLoginCode to use branded builder**

Replace `sendLoginCode`. Since login codes are platform-level (no tenant context), branding is null:

```typescript
async sendLoginCode(to: string, code: string, expiryMinutes: number) {
  const body = `
    <p style="color: #e5e5e5;">Tu código de verificación es:</p>
    <div style="text-align: center; margin: 24px 0;">
      <span style="display: inline-block; font-size: 36px; font-weight: bold; color: #ffffff; letter-spacing: 8px; font-family: monospace; background: #1a1a1a; padding: 16px 32px; border-radius: 8px; border: 1px solid #333;">${code}</span>
    </div>
    <p>Este código expira en <strong style="color: #e5e5e5;">${expiryMinutes} minutos</strong>.</p>
    <p style="font-size: 13px; color: #737373;">Si no solicitaste este código, puedes ignorar este correo.</p>
  `;

  const html = this.buildBrandedEmailHtml({
    branding: null,
    title: 'Código de verificación',
    body,
  });

  const creds = this.systemCredentials();
  await this.withSesClient(creds, async (client) => {
    await client.send(
      new SendEmailCommand({
        Source: creds.fromEmail,
        Destination: { ToAddresses: [to] },
        Message: {
          Subject: { Data: 'Tu código de verificación' },
          Body: { Html: { Data: html } },
        },
      }),
    );
  });
}
```

- [ ] **Step 6: Remove old buildLoginCodeHtml and buildWelcomeHtml methods**

Delete the private methods `buildLoginCodeHtml` and `buildWelcomeHtml` since they are now replaced by `buildBrandedEmailHtml`.

- [ ] **Step 7: Update callers to pass tenantId**

Check where `sendWelcomeEmail` is called (in `users.service.ts`). The method signature now has an optional `tenantId` parameter. Find the callers and pass the tenant ID:

In `apps/api/src/modules/users/users.service.ts`, find calls to `sendWelcomeEmail` and add the tenantId parameter. The tenantId is typically available in the method context.

- [ ] **Step 8: Verify compilation**

```bash
cd apps/api && npx tsc --noEmit
```

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/modules/email/ apps/api/src/modules/users/users.service.ts
git commit -m "feat(api): refactor email templates with branded builder"
```

---

## Task 7: Frontend API Client & Branding API

**Files:**
- Modify: `apps/web/lib/api-client.ts`
- Create: `apps/web/lib/api/branding.ts`

- [ ] **Step 1: Add uploadFile helper to api-client**

Read `apps/web/lib/api-client.ts` first. Then add an `uploadFile` method to the exported `api` object. This method must NOT set `Content-Type` (let the browser set `multipart/form-data` with boundary):

```typescript
// Add to the api object in api-client.ts
uploadFile: async <T>(endpoint: string, file: File, options?: RequestOptions): Promise<T> => {
  const formData = new FormData();
  formData.append('file', file);

  const tenantId = options?.tenantId || (typeof window !== 'undefined' ? localStorage.getItem('tenantId') : null);
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

  const headers: Record<string, string> = {};
  if (tenantId) headers[TENANT_HEADER] = tenantId;
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || 'Upload failed');
  }

  if (res.status === 204) return undefined as T;
  return res.json();
},
```

Also add the `RequestOptions` type if not already exported (check existing code, it may use inline types).

- [ ] **Step 2: Create branding API wrapper**

```typescript
// apps/web/lib/api/branding.ts
import { api } from '@/lib/api-client';
import { TenantBranding, GeneratePaletteResult } from '@zeru/shared';

export const brandingApi = {
  get: () =>
    api.get<TenantBranding | null>('/tenants/current/branding'),

  updateColors: (colors: {
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
  }) =>
    api.patch<TenantBranding>('/tenants/current/branding', colors),

  uploadLogo: (file: File) =>
    api.uploadFile<TenantBranding>('/tenants/current/branding/logo', file),

  uploadIsotipo: (file: File) =>
    api.uploadFile<TenantBranding>('/tenants/current/branding/isotipo', file),

  deleteLogo: () =>
    api.delete<void>('/tenants/current/branding/logo'),

  deleteIsotipo: () =>
    api.delete<void>('/tenants/current/branding/isotipo'),

  generatePalette: (input: { source: 'logo' } | { source: 'description'; description: string }) =>
    api.post<GeneratePaletteResult>('/tenants/current/branding/generate-palette', input),
};
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/api-client.ts apps/web/lib/api/branding.ts
git commit -m "feat(web): add branding API client and file upload helper"
```

---

## Task 8: Color Utilities & BrandingProvider

**Files:**
- Create: `apps/web/lib/color-utils.ts`
- Create: `apps/web/providers/branding-provider.tsx`
- Modify: `apps/web/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Create color-utils**

```typescript
// apps/web/lib/color-utils.ts

interface OklchColor {
  l: number;
  c: number;
  h: number;
}

/**
 * Convert hex color to oklch approximation.
 * Uses sRGB -> linear RGB -> OKLab -> OKLCH conversion.
 */
export function hexToOklch(hex: string): OklchColor {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  // sRGB to linear
  const toLinear = (c: number) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);

  // Linear RGB to OKLab
  const l_ = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m_ = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s_ = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

  const l_cbrt = Math.cbrt(l_);
  const m_cbrt = Math.cbrt(m_);
  const s_cbrt = Math.cbrt(s_);

  const L = 0.2104542553 * l_cbrt + 0.793617785 * m_cbrt - 0.0040720468 * s_cbrt;
  const a = 1.9779984951 * l_cbrt - 2.428592205 * m_cbrt + 0.4505937099 * s_cbrt;
  const bOk = 0.0259040371 * l_cbrt + 0.7827717662 * m_cbrt - 0.808675766 * s_cbrt;

  // OKLab to OKLCH
  const C = Math.sqrt(a * a + bOk * bOk);
  let H = (Math.atan2(bOk, a) * 180) / Math.PI;
  if (H < 0) H += 360;

  return { l: L, c: C, h: H };
}

export function oklchToString(color: OklchColor): string {
  return `oklch(${color.l.toFixed(3)} ${color.c.toFixed(3)} ${color.h.toFixed(1)})`;
}

export interface DerivedColorScale {
  light: string;
  dark: string;
  lightForeground: string;
  darkForeground: string;
}

/**
 * Given a hex base color, derive light and dark mode oklch variants
 * plus appropriate foreground colors.
 */
export function deriveColorScale(hex: string): DerivedColorScale {
  const base = hexToOklch(hex);

  const lightColor = { ...base, l: Math.min(base.l, 0.55) };
  const darkColor = { ...base, l: Math.max(base.l, 0.70) };

  return {
    light: oklchToString(lightColor),
    dark: oklchToString(darkColor),
    lightForeground: 'oklch(0.98 0.01 0)',
    darkForeground: 'oklch(0.20 0.02 0)',
  };
}
```

- [ ] **Step 2: Create BrandingProvider**

```typescript
// apps/web/providers/branding-provider.tsx
'use client';

import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useTenantContext } from './tenant-provider';
import { deriveColorScale } from '@/lib/color-utils';

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const { tenant } = useTenantContext();
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const branding = tenant?.branding;
    if (!branding) return;

    const { primaryColor, secondaryColor, accentColor } = branding;
    if (!primaryColor && !secondaryColor && !accentColor) return;

    const styleId = 'branding-overrides';
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    const vars: { light: string[]; dark: string[] } = { light: [], dark: [] };

    if (primaryColor) {
      const scale = deriveColorScale(primaryColor);
      vars.light.push(
        `--primary: ${scale.light}`,
        `--primary-foreground: ${scale.lightForeground}`,
        `--sidebar-primary: ${scale.light}`,
        `--sidebar-primary-foreground: ${scale.lightForeground}`,
      );
      vars.dark.push(
        `--primary: ${scale.dark}`,
        `--primary-foreground: ${scale.darkForeground}`,
        `--sidebar-primary: ${scale.dark}`,
        `--sidebar-primary-foreground: ${scale.darkForeground}`,
      );
    }

    if (secondaryColor) {
      const scale = deriveColorScale(secondaryColor);
      vars.light.push(
        `--secondary: ${scale.light}`,
        `--secondary-foreground: ${scale.lightForeground}`,
      );
      vars.dark.push(
        `--secondary: ${scale.dark}`,
        `--secondary-foreground: ${scale.darkForeground}`,
      );
    }

    if (accentColor) {
      const scale = deriveColorScale(accentColor);
      vars.light.push(
        `--accent: ${scale.light}`,
        `--accent-foreground: ${scale.lightForeground}`,
        `--sidebar-accent: ${scale.light}`,
        `--sidebar-accent-foreground: ${scale.lightForeground}`,
      );
      vars.dark.push(
        `--accent: ${scale.dark}`,
        `--accent-foreground: ${scale.darkForeground}`,
        `--sidebar-accent: ${scale.dark}`,
        `--sidebar-accent-foreground: ${scale.darkForeground}`,
      );
    }

    styleEl.textContent = `
      :root { ${vars.light.map(v => `${v};`).join(' ')} }
      .dark { ${vars.dark.map(v => `${v};`).join(' ')} }
    `;

    return () => {
      styleEl?.remove();
    };
  }, [tenant?.branding, resolvedTheme]);

  return <>{children}</>;
}
```

- [ ] **Step 3: Insert BrandingProvider in dashboard layout**

Read `apps/web/app/(dashboard)/layout.tsx`. Add `BrandingProvider` wrapping inside `TenantProvider`, before `SocketProvider`:

```typescript
import { BrandingProvider } from '@/providers/branding-provider';

// In the JSX, wrap after TenantProvider:
<AuthProvider>
  <TenantProvider>
    <BrandingProvider>
      <SocketProvider>
        {/* ... rest unchanged */}
      </SocketProvider>
    </BrandingProvider>
  </TenantProvider>
</AuthProvider>
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/color-utils.ts apps/web/providers/branding-provider.tsx apps/web/app/\(dashboard\)/layout.tsx
git commit -m "feat(web): add BrandingProvider with CSS variable injection"
```

---

## Task 9: Sidebar Updates (TeamSwitcher)

**Files:**
- Modify: `apps/web/components/layouts/team-switcher.tsx`

- [ ] **Step 1: Read current TeamSwitcher**

Read `apps/web/components/layouts/team-switcher.tsx` to understand the exact current code.

- [ ] **Step 2: Update the active org display**

Replace the hardcoded "Z" square and "Zeru" subtitle. Find the section that renders the current tenant (approximately lines 57-66):

Replace the `<div className="bg-black text-white flex size-8 ...">Z</div>` with:

```tsx
{tenant?.branding?.isotipoUrl ? (
  <img
    src={tenant.branding.isotipoUrl}
    alt={tenant.name}
    className="size-8 rounded-md object-cover shrink-0"
  />
) : (
  <div className="bg-primary text-primary-foreground flex size-8 items-center justify-content rounded-md text-sm font-bold shrink-0">
    {tenant?.name?.charAt(0).toUpperCase() ?? '?'}
  </div>
)}
```

Replace the "Zeru" subtitle with the RUT + copy icon:

```tsx
<div className="grid flex-1 text-left text-sm leading-tight">
  <span className="truncate font-semibold">
    {switching ? "Cambiando..." : (tenant?.name ?? "Cargando...")}
  </span>
  {tenant?.rut && (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(tenant.rut!);
      }}
      className="flex items-center gap-1 truncate text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground/80 transition-colors"
      title="Copiar RUT"
    >
      <span>{tenant.rut}</span>
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-3 shrink-0">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
      </svg>
    </button>
  )}
</div>
```

- [ ] **Step 3: Update the dropdown membership list**

In the dropdown where each org is listed, replace the letter avatar with isotipo support. Find the mapping over memberships and update:

```tsx
{/* For each membership in the dropdown */}
{tenant?.branding?.isotipoUrl ? (
  <img
    src={/* membership doesn't have branding, so use initial */}
    alt={m.tenant.name}
    className="size-6 rounded-md object-cover shrink-0"
  />
) : (
  <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-sm text-xs font-bold">
    {m.tenant.name.charAt(0).toUpperCase()}
  </div>
)}
```

Note: Memberships only have `{ id, name, slug }` — no branding data. The dropdown items should use the initial letter fallback for non-active tenants (only the active tenant has full branding loaded). This is acceptable for now.

- [ ] **Step 4: Verify in browser**

```bash
cd apps/web && pnpm dev
```

Navigate to the app, verify the sidebar shows the tenant initial (since no branding is configured yet). If the tenant has a RUT, verify it shows with the copy icon.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/layouts/team-switcher.tsx
git commit -m "feat(web): update sidebar with org isotipo and RUT"
```

---

## Task 10: Organization Settings — Tab Layout + Apariencia Tab

**Files:**
- Modify: `apps/web/app/(dashboard)/settings/organization/page.tsx`

This is the largest frontend task. The existing page becomes the "Datos generales" tab, and a new "Apariencia" tab is added.

- [ ] **Step 1: Read current organization page**

Read `apps/web/app/(dashboard)/settings/organization/page.tsx` in full.

- [ ] **Step 2: Refactor page to use Tabs**

Wrap the existing content in a `Tabs` component from shadcn/ui. The existing form content becomes `TabsContent value="general"` and a new `TabsContent value="appearance"` is added.

At the top of the file, add imports:

```typescript
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { brandingApi } from '@/lib/api/branding';
```

Wrap the existing page content:

```tsx
export default function OrganizationSettingsPage() {
  // ... existing state ...

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Organización</h2>
        <p className="text-muted-foreground">Configura los datos y apariencia de tu organización.</p>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">Datos generales</TabsTrigger>
          <TabsTrigger value="appearance">Apariencia</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6 mt-6">
          {/* Move existing Card components here — unchanged */}
        </TabsContent>

        <TabsContent value="appearance" className="space-y-6 mt-6">
          <AppearanceTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 3: Create AppearanceTab component**

Create this as a separate component in the same file (or a new file — prefer same file to keep it simple since it's the only consumer):

```tsx
function AppearanceTab() {
  const { tenant } = useTenantContext();
  const [branding, setBranding] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [colors, setColors] = useState({
    primaryColor: '',
    secondaryColor: '',
    accentColor: '',
  });
  const [generatingPalette, setGeneratingPalette] = useState(false);
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const [description, setDescription] = useState('');

  useEffect(() => {
    brandingApi.get().then((data) => {
      setBranding(data);
      if (data) {
        setColors({
          primaryColor: data.primaryColor || '',
          secondaryColor: data.secondaryColor || '',
          accentColor: data.accentColor || '',
        });
      }
      setLoading(false);
    });
  }, []);

  const handleSaveColors = async () => {
    setSaving(true);
    try {
      const payload: Record<string, string> = {};
      if (colors.primaryColor) payload.primaryColor = colors.primaryColor;
      if (colors.secondaryColor) payload.secondaryColor = colors.secondaryColor;
      if (colors.accentColor) payload.accentColor = colors.accentColor;
      const updated = await brandingApi.updateColors(payload);
      setBranding(updated);
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (type: 'logo' | 'isotipo', file: File) => {
    const method = type === 'logo' ? brandingApi.uploadLogo : brandingApi.uploadIsotipo;
    const updated = await method(file);
    setBranding(updated);
  };

  const handleDelete = async (type: 'logo' | 'isotipo') => {
    const method = type === 'logo' ? brandingApi.deleteLogo : brandingApi.deleteIsotipo;
    await method();
    setBranding((prev: any) => prev ? { ...prev, [`${type}Url`]: null } : prev);
  };

  const handleGenerateFromLogo = async () => {
    setGeneratingPalette(true);
    try {
      const palette = await brandingApi.generatePalette({ source: 'logo' });
      setColors({
        primaryColor: palette.primary,
        secondaryColor: palette.secondary,
        accentColor: palette.accent,
      });
    } finally {
      setGeneratingPalette(false);
    }
  };

  const handleGenerateFromDescription = async () => {
    if (!description.trim()) return;
    setGeneratingPalette(true);
    try {
      const palette = await brandingApi.generatePalette({
        source: 'description',
        description,
      });
      setColors({
        primaryColor: palette.primary,
        secondaryColor: palette.secondary,
        accentColor: palette.accent,
      });
      setDescriptionOpen(false);
      setDescription('');
    } finally {
      setGeneratingPalette(false);
    }
  };

  if (loading) return <div className="text-muted-foreground">Cargando...</div>;

  return (
    <div className="space-y-8">
      {/* Logo & Isotipo Section */}
      <Card>
        <CardHeader>
          <CardTitle>Logotipo e Isotipo</CardTitle>
          <p className="text-sm text-muted-foreground">
            El logotipo se usa en correos y reportes. El isotipo se muestra en el menú lateral.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex gap-6 items-stretch">
            <ImageUploadZone
              label="Logotipo"
              hint="PNG, SVG o JPG. Máx 2MB. Recomendado: 400×120px"
              currentUrl={branding?.logoUrl}
              onUpload={(file) => handleUpload('logo', file)}
              onDelete={() => handleDelete('logo')}
              className="flex-1"
            />
            <ImageUploadZone
              label="Isotipo"
              hint="Cuadrado. Máx 1MB. 128×128px"
              currentUrl={branding?.isotipoUrl}
              onUpload={(file) => handleUpload('isotipo', file)}
              onDelete={() => handleDelete('isotipo')}
              className="w-[200px]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Color Palette Section */}
      <Card>
        <CardHeader>
          <CardTitle>Paleta de colores</CardTitle>
          <p className="text-sm text-muted-foreground">
            Define los colores principales. Se aplican a toda la interfaz y comunicaciones.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* AI Buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateFromLogo}
              disabled={generatingPalette || (!branding?.logoUrl && !branding?.isotipoUrl)}
            >
              <SparklesIcon className="size-4 mr-1" />
              {generatingPalette ? 'Generando...' : 'Generar desde logo'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDescriptionOpen(true)}
              disabled={generatingPalette}
            >
              <ChatBubbleIcon className="size-4 mr-1" />
              Describir estilo deseado
            </Button>
          </div>

          {/* Description dialog */}
          {descriptionOpen && (
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Label>Describe el estilo deseado</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ej: Colores corporativos azul marino y dorado, estilo profesional médico"
                />
              </div>
              <Button onClick={handleGenerateFromDescription} disabled={generatingPalette}>
                {generatingPalette ? 'Generando...' : 'Generar'}
              </Button>
              <Button variant="ghost" onClick={() => setDescriptionOpen(false)}>
                Cancelar
              </Button>
            </div>
          )}

          {/* Color Pickers */}
          <div className="grid grid-cols-3 gap-4">
            <ColorPickerField
              label="Primario"
              hint="Botones, links, acciones"
              value={colors.primaryColor}
              onChange={(v) => setColors((c) => ({ ...c, primaryColor: v }))}
            />
            <ColorPickerField
              label="Secundario"
              hint="Badges, highlights"
              value={colors.secondaryColor}
              onChange={(v) => setColors((c) => ({ ...c, secondaryColor: v }))}
            />
            <ColorPickerField
              label="Acento"
              hint="Notificaciones, alertas"
              value={colors.accentColor}
              onChange={(v) => setColors((c) => ({ ...c, accentColor: v }))}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => {
              setColors({
                primaryColor: branding?.primaryColor || '',
                secondaryColor: branding?.secondaryColor || '',
                accentColor: branding?.accentColor || '',
              });
            }}>
              Cancelar
            </Button>
            <Button onClick={handleSaveColors} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Create ImageUploadZone helper component**

Add this component in the same file or as `apps/web/components/branding/image-upload-zone.tsx`:

```tsx
// apps/web/components/branding/image-upload-zone.tsx
'use client';

import { useRef } from 'react';
import { Button } from '@/components/ui/button';

interface ImageUploadZoneProps {
  label: string;
  hint: string;
  currentUrl: string | null;
  onUpload: (file: File) => void;
  onDelete: () => void;
  className?: string;
}

export function ImageUploadZone({
  label,
  hint,
  currentUrl,
  onUpload,
  onDelete,
  className,
}: ImageUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) onUpload(file);
  };

  return (
    <div className={className}>
      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{label}</p>
      {currentUrl ? (
        <div className="relative border rounded-lg p-4 flex flex-col items-center justify-center min-h-[140px] bg-muted/30">
          <img src={currentUrl} alt={label} className="max-h-20 max-w-full object-contain" />
          <Button
            variant="destructive"
            size="sm"
            className="mt-3"
            onClick={onDelete}
          >
            Eliminar
          </Button>
        </div>
      ) : (
        <div
          className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center min-h-[140px] cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-8 text-muted-foreground/40 mb-2">
            <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Zm16.5-13.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
          </svg>
          <p className="text-sm text-muted-foreground">Arrastra o haz clic para subir</p>
          <p className="text-xs text-muted-foreground/60 mt-1">{hint}</p>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}
```

- [ ] **Step 5: Create ColorPickerField helper component**

```tsx
// apps/web/components/branding/color-picker-field.tsx
'use client';

import { Input } from '@/components/ui/input';

interface ColorPickerFieldProps {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
}

export function ColorPickerField({ label, hint, value, onChange }: ColorPickerFieldProps) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{label}</p>
      <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border">
        <input
          type="color"
          value={value || '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="size-8 rounded-md border-0 cursor-pointer p-0 bg-transparent"
        />
        <div>
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="#000000"
            className="h-7 w-24 font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground/60 mt-1">{hint}</p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Add icon imports**

At the top of the organization page, import the Heroicons used by the AI buttons. Check which icon library the project uses. The project uses `hugeicons-react` (visible in nav-main.tsx imports). Use the closest equivalents:

```typescript
import { SparkleIcon, MessageEdit01Icon } from 'hugeicons-react';
```

Adjust the icon component names in AppearanceTab:
- `SparklesIcon` → `SparkleIcon`
- `ChatBubbleIcon` → `MessageEdit01Icon`

- [ ] **Step 7: Verify the page compiles and renders**

```bash
cd apps/web && pnpm build
```

Fix any TypeScript errors.

- [ ] **Step 8: Commit**

```bash
git add apps/web/app/\(dashboard\)/settings/organization/page.tsx apps/web/components/branding/
git commit -m "feat(web): add Apariencia tab with logo upload and color palette"
```

---

## Task 11: Lint & Final Verification

- [ ] **Step 1: Run full lint**

```bash
pnpm lint
```

Fix any new lint errors introduced by the changes.

- [ ] **Step 2: Run TypeScript check on both apps**

```bash
cd apps/api && npx tsc --noEmit && cd ../web && npx tsc --noEmit
```

Fix any type errors.

- [ ] **Step 3: Verify the API starts**

```bash
cd apps/api && pnpm dev
```

Confirm no startup errors. Test `GET /tenants/current` returns the `branding` field.

- [ ] **Step 4: Verify the web app starts**

```bash
cd apps/web && pnpm dev
```

Navigate to `/settings/organization`, verify tabs render. Switch to "Apariencia" tab.

- [ ] **Step 5: Final commit (if any lint/type fixes)**

```bash
git add -A
git commit -m "fix: lint and type fixes for branding feature"
```

---

## Environment Variables Required

Add these to the API `.env` (and document in `.env.example`):

```
PLATFORM_S3_BUCKET=zeru-platform-assets
PLATFORM_S3_REGION=us-east-1
PLATFORM_S3_ACCESS_KEY_ID=<key>
PLATFORM_S3_SECRET_ACCESS_KEY=<secret>
```

The `OPENAI_API_KEY` env var should already be configured (used by existing AI features).
