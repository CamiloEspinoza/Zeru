# Org Branding — Design Spec

## Overview

Personalización de la identidad visual de cada organización en Zeru: logotipo, isotipo, paleta de colores (manual y asistida por IA). Se aplica a toda la interfaz y a las comunicaciones por email.

## Scope

### In scope
- Tab "Apariencia" en Settings → Organización
- Upload de logotipo (rectangular) e isotipo (cuadrado) con storage global de plataforma
- Paleta de 3 colores (primary, secondary, accent) con variantes light/dark auto-derivadas
- Generación de paleta asistida por IA: desde logo (vision) y desde descripción textual
- Sidebar: isotipo de la org reemplaza la "Z", RUT con ícono de copiar debajo del nombre
- Inyección dinámica de CSS variables por organización (BrandingProvider)
- Email templates con branding del tenant (refactor de los 2 emails existentes)
- Interfaz `TenantBrandingAssets` consumible por futuros canales (PDFs, reportes)

### Out of scope
- Integración con PDFs/reportes (solo se expone la interfaz)
- Customización de fuentes tipográficas
- Temas completos (más allá de los 3 colores clave)
- Email settings page (actualmente redirect stub, fuera de este feature)

## Data Model

### New model: `TenantBranding`

```prisma
model TenantBranding {
  id              String   @id @default(uuid())
  tenantId        String   @unique
  tenant          Tenant   @relation(fields: [tenantId], references: [id])
  logoUrl         String?
  isotipoUrl      String?
  primaryColor    String?  // Hex string, e.g. "#0891b2"
  secondaryColor  String?  // Hex string, e.g. "#6366f1"
  accentColor     String?  // Hex string, e.g. "#f59e0b"
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@map("tenant_brandings")
  @@schema("public")
}
```

- 1:1 relationship with Tenant via `@unique` on `tenantId`
- Colors stored as hex strings; conversion to oklch happens in frontend
- Light/dark variants derived automatically from base color (adjusting luminosity in oklch)
- Separate model keeps Tenant table clean and allows branding extensions without migrating the main table

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/tenants/current/branding` | Get current tenant branding |
| `PATCH` | `/tenants/current/branding` | Update colors (partial update) |
| `POST` | `/tenants/current/branding/logo` | Upload logo (multipart, max 2MB) |
| `POST` | `/tenants/current/branding/isotipo` | Upload isotipo (multipart, max 1MB) |
| `DELETE` | `/tenants/current/branding/logo` | Remove logo |
| `DELETE` | `/tenants/current/branding/isotipo` | Remove isotipo |
| `POST` | `/tenants/current/branding/generate-palette` | AI palette generation |

### Generate palette request body

```typescript
// From logo (requires logo or isotipo already uploaded)
{ source: "logo" }

// From text description
{ source: "description", description: "Colores corporativos azul marino y dorado, estilo profesional médico" }
```

### Generate palette response

```typescript
{ primary: "#hex", secondary: "#hex", accent: "#hex" }
```

## Image Storage

### Platform-level S3 (new)

- New `PlatformStorageService` with global S3 credentials from env vars (`PLATFORM_S3_BUCKET`, `PLATFORM_S3_REGION`, `PLATFORM_S3_ACCESS_KEY_ID`, `PLATFORM_S3_SECRET_ACCESS_KEY`)
- Independent from per-tenant S3 storage used for documents
- Key format: `platform/tenants/{tenantId}/branding/{logo|isotipo}/{uuid}.{ext}`
- Accepted formats: PNG, SVG, JPG
- Logo: max 2MB, recommended 400×120px
- Isotipo: max 1MB, square, recommended 128×128px
- Returns presigned URLs for serving images

## UI: Settings → Organization

### Tab structure

The `/settings/organization` page changes from a single form to a tabbed layout:

1. **"Datos generales"** — existing form (name, rut, address, phone, tenant ID)
2. **"Apariencia"** — new tab with branding configuration

### Apariencia tab layout

Three sections separated by dividers:

**1. Logotipo e Isotipo**
- Two drop zones side-by-side, equal height
- Logo (left, flex: 1): rectangular, for emails and reports
- Isotipo (right, 200px wide): square, for sidebar and avatars
- Drag-and-drop or click to upload
- Preview with delete button when image is uploaded
- Icons: Heroicons outline (photo for logo, squares-2x2 for isotipo)

**2. Paleta de colores**
- Two AI assist buttons:
  - "Generar desde logo" (sparkles icon) — requires logo/isotipo uploaded, sends to AI vision
  - "Describir estilo deseado" (chat-bubble icon) — opens text input dialog
- Three color pickers: Primary, Secondary, Accent
  - Each shows color swatch (clickable to open picker), hex value, and usage hint
  - Manually editable hex input

**3. Vista previa**
- Light/Dark toggle
- Mini mockup showing sidebar + main content area with the selected colors applied
- Updates in real-time as colors change

### Save behavior
- "Guardar cambios" button persists all changes (colors via PATCH, images uploaded separately on drop)
- "Cancelar" reverts to last saved state

## UI: Sidebar (TeamSwitcher)

### Current state
- Hardcoded "Z" in black square
- Tenant name from `useTenantContext()`
- Hardcoded "Zeru" subtitle

### New state
- **Isotipo**: `<img>` from `tenant.branding.isotipoUrl` if available
- **Fallback**: First letter of tenant name in a square with `bg-primary` (org's primary color, or system default)
- **Name**: tenant name (unchanged)
- **RUT**: formatted RUT with copy-to-clipboard icon (replaces "Zeru" subtitle). Hidden if no RUT configured.
- **Dropdown**: each membership shows isotipo or initial letter avatar

## CSS Variable Injection (BrandingProvider)

### Provider hierarchy

```
AuthProvider → TenantProvider → BrandingProvider → SidebarProvider → ...
```

### Behavior

- Reads `tenant.branding` from TenantProvider
- If branding has colors, injects a `<style>` element overriding CSS variables on `:root` and `.dark`
- If no branding, does nothing (system defaults apply)
- Reacts to theme changes (light/dark) to apply correct variant

### Color derivation

```typescript
function deriveColorScale(hex: string): { light: string; dark: string; foreground: string } {
  const oklch = hexToOklch(hex);
  return {
    light: oklchToString({ ...oklch, l: 0.55 }),
    dark: oklchToString({ ...oklch, l: 0.70 }),
    foreground: oklch.l > 0.6 ? '#000000' : '#ffffff',
  };
}
```

### Variables overridden

```css
:root {
  --primary: <derived from primaryColor, light>;
  --primary-foreground: <derived foreground>;
  --secondary: <derived from secondaryColor, light>;
  --secondary-foreground: <derived foreground>;
  --accent: <derived from accentColor, light>;
  --accent-foreground: <derived foreground>;
  --sidebar-primary: <same as primary, light>;
  --sidebar-primary-foreground: <same as primary-foreground>;
}
.dark {
  --primary: <derived from primaryColor, dark>;
  --primary-foreground: <derived foreground>;
  --secondary: <derived from secondaryColor, dark>;
  --secondary-foreground: <derived foreground>;
  --accent: <derived from accentColor, dark>;
  --accent-foreground: <derived foreground>;
  --sidebar-primary: <same as primary, dark>;
  --sidebar-primary-foreground: <same as primary-foreground>;
}
```

## AI Palette Generation

### From logo (vision)

1. Frontend sends `POST /tenants/current/branding/generate-palette` with `{ source: "logo" }`
2. Backend downloads logo/isotipo image from S3
3. Sends to OpenAI with vision capability
4. Prompt instructs the model to:
   - Extract dominant colors from the logo
   - Suggest primary, secondary, accent colors
   - Ensure WCAG AA contrast ratios (4.5:1 minimum)
   - Return JSON: `{ primary, secondary, accent }` as hex
5. Backend parses response, returns to frontend
6. Frontend displays as suggestion — user can accept, adjust, or discard

### From description (text)

1. User enters text description in a dialog
2. Frontend sends `POST /tenants/current/branding/generate-palette` with `{ source: "description", description: "..." }`
3. Same endpoint, prompt adapted for text-based generation
4. Same response format and user flow

### Cost tracking

Each `generate-palette` call logs to `AiUsageLog`:
- `feature: "branding-palette-generation"`
- `provider`, `model`, `inputTokens`, `outputTokens`
- `tenantId`, timestamp

## Email Templates with Branding

### Current state

Two emails exist (`sendLoginCode`, `sendWelcomeEmail`) with inline HTML in `EmailService`. Hardcoded dark theme, teal accent, "Zeru" branding.

### New state

Refactor to a reusable email HTML builder:

```typescript
function buildBrandedEmailHtml(options: {
  branding: TenantBrandingAssets | null;
  title: string;
  body: string; // inner HTML content
}): string
```

- If tenant has branding: uses tenant logo and colors
- If no branding: falls back to Zeru defaults (current behavior preserved)
- Both existing emails migrated to use this builder
- `EmailService.sendLoginCode()` and `sendWelcomeEmail()` fetch tenant branding before rendering

### TenantBrandingAssets interface

```typescript
interface TenantBrandingAssets {
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
```

Exposed as a shared type in `@zeru/shared` for consumption by any service (email, future PDFs, reports).

## Data Flow

### Tenant fetch (updated)

`GET /tenants/current` eager-loads `branding` relation:

```typescript
prisma.tenant.findUnique({
  where: { id },
  include: { branding: true },
});
```

### Frontend context

`TenantProvider` receives branding as part of the tenant object. The `Tenant` type in `@zeru/shared` is extended with optional `branding` field.

## Fallback Behavior

| Scenario | Behavior |
|----------|----------|
| No branding record | System defaults everywhere |
| No logo/isotipo | Initial letter avatar with primary color (or system default) |
| No colors | System default CSS variables (current teal palette) |
| No RUT | RUT line hidden in sidebar |
| Partial colors (e.g. only primary) | Provided colors override, others stay system default |
