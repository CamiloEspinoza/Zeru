# Auditoría de Estructura de Páginas y Navegación — Zeru Web App

**Fecha:** 2026-03-30
**Versión:** 1.0
**Revisor:** UX/UI Expert

---

## 📊 Resumen Ejecutivo

La app web Zeru utiliza Next.js 13+ con App Router y tiene una arquitectura de rutas **bien organizada** con 64 páginas. La navegación es intuitiva en desktop pero presenta algunos puntos de mejora. Se identificaron **9 problemas críticos y de severidad media** que afectan la experiencia del usuario. Hallazgos adicionales integrados con auditoría de diseño (brand colors inconsistentes).

---

## 1. Estructura de Rutas Encontrada

### Árbol Completo de Rutas

```
app/
├── layout.tsx (Root layout - Providers)
├── oauth-linkedin-redirect/page.tsx
│
├── (marketing)/ [Landing page y features]
│   ├── layout.tsx (MarketingNav, tema dark)
│   ├── page.tsx (Landing)
│   └── features/
│       ├── inteligencia-organizacional/page.tsx
│       ├── personas-organigrama/page.tsx
│       ├── gestion-documental/page.tsx
│       ├── gestion-rrhh/page.tsx
│       ├── asistente-ia/page.tsx
│       ├── api-publica/page.tsx
│       ├── reportes-bi/page.tsx
│       ├── integraciones/page.tsx
│       ├── contabilidad/page.tsx
│       └── marketing/page.tsx
│
├── (auth)/ [Auth layout]
│   ├── layout.tsx (MarketingNav reutilizado)
│   ├── login/page.tsx
│   └── register/page.tsx
│
├── (onboarding)/ [Onboarding flow]
│   ├── layout.tsx (Centered layout)
│   └── onboarding/page.tsx
│
├── (dashboard)/ [Main app]
│   ├── layout.tsx (AppSidebar + Header + Breadcrumbs)
│   ├── dashboard/page.tsx
│   ├── assistant/
│   │   ├── layout.tsx
│   │   ├── page.tsx (New conversation)
│   │   └── [id]/page.tsx
│   ├── documents/page.tsx
│   ├── calendar/page.tsx
│   ├── personas/
│   │   ├── page.tsx (Redirect → /directorio)
│   │   ├── directorio/page.tsx
│   │   └── organigrama/page.tsx
│   ├── accounting/
│   │   ├── page.tsx
│   │   ├── chart-of-accounts/page.tsx
│   │   ├── journal/
│   │   │   ├── page.tsx
│   │   │   ├── new/page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── periods/page.tsx
│   │   └── reports/
│   │       ├── page.tsx
│   │       ├── general-ledger/page.tsx
│   │       └── balance/page.tsx
│   ├── linkedin/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── posts/page.tsx
│   │   └── [id]/page.tsx
│   ├── org-intelligence/
│   │   ├── page.tsx (Redirect → /projects)
│   │   ├── projects/
│   │   │   ├── page.tsx
│   │   │   └── [id]/
│   │   │       ├── page.tsx
│   │   │       └── interviews/
│   │   │           ├── page.tsx
│   │   │           └── [interviewId]/page.tsx
│   │   ├── knowledge-base/page.tsx
│   │   └── persons/page.tsx
│   └── settings/
│       ├── page.tsx
│       ├── organization/page.tsx
│       ├── appearance/page.tsx
│       ├── api-keys/page.tsx
│       ├── storage/page.tsx
│       ├── email/page.tsx
│       ├── linkedin/page.tsx
│       ├── accounting-process/page.tsx
│       └── ai/
│           ├── page.tsx
│           ├── memory/page.tsx
│           ├── gemini/page.tsx
│           └── skills/page.tsx
│
└── (docs)/ [API documentation]
    └── docs/
        ├── rate-limits/page.tsx
        └── journal-entries/page.tsx
```

**Estadísticas:**
- 64 páginas totales
- 11 grupos de rutas (route groups con `()`)
- 4 niveles de profundidad máxima (dashboard/org-intelligence/projects/[id]/interviews/[interviewId])

---

## 2. Análisis de Navegación

### 2.1 Landing Page & Features (Marketing)

**Componentes:**
- `MarketingNav`: Navbar fija, sticky con blur backdrop
- Menú "Producto" con mega dropdown (2 columnas: Plataforma + Próximamente)
- Links de CTA (Login/Register) condicionales al estado auth

**Fortalezas:**
✅ Responsive (desktop/mobile hamburger)
✅ Mega menú con descripciones detalladas
✅ Diferencia visualmente plataforma vs. próximamente (opacity)
✅ CTAs contextuales (muestra "Ir al Dashboard" si ya está logueado)

**Debilidades:**
⚠️ El mega menú solo está en desktop (hidden md:flex)
⚠️ En mobile, el menú de "Producto" toma mucho espacio vertical
⚠️ No hay indicador visual de página activa en features

### 2.2 Dashboard & App (Sidebar + Header)

**Componentes Principales:**
- `AppSidebar`: Sidebar colapsible con 3 secciones
  - Header: `TeamSwitcher` (switcher de organización)
  - Content: `NavMain` (navegación app)
  - Footer: Link a docs + `NavUser` (profile menu)
- Header: `SidebarTrigger` + `Breadcrumbs`
- Breadcrumbs: Sistema LABELS manual para traducir rutas

**Estructura de NavMain:**
```
appNav = [
  Dashboard (simple)
  Asistente (simple)
  Documentos (simple)
  Contabilidad (collapsible → 4 subitems)
  Calendario (simple)
  Personas (collapsible → Directorio, Organigrama)
  Inteligencia Org. (collapsible → Proyectos, KB)
  Marketing/LinkedIn (collapsible → LinkedIn → Posts + Settings)
]

settingsNav = [
  12 opciones en Settings (incluyendo subgrupo AI)
]
```

**Fortalezas:**
✅ Sidebar colapsible (icon-only mode)
✅ Soporte anidado hasta 3 niveles de profundidad
✅ Auto-expand en rutas activas
✅ Breadcrumbs dinámicas con traducción manual

**Debilidades:**
⚠️ Las rutas Settings tienen su propio "árbol" NavMain y confunden al usuario
⚠️ No hay indicador visual de ruta activa en breadcrumbs (solo última es página actual)
⚠️ Breadcrumbs solo visible en md+ (hidden md:block)
⚠️ NavMain requiere traducción manual en LABELS dict (maintenance nightmare)

---

## 3. Flujos Principales del Usuario

### Flujo 1: Acceso público → Landing → Feature pages

```
/ (landing)
  → /features/[feature]/ (feature pages)
    → (sin CTA interna, solo links back to landing)
```

**Problema:** Las feature pages no tienen CTA a dashboard o login claros en el flujo.

### Flujo 2: Autenticación

```
/login o /register
  → Completa auth
  → /onboarding (OnboardingGuard redirige si no completa)
    → Completa setup
    → /dashboard
```

**Fortaleza:** OnboardingGuard impide saltarse onboarding
**Debilidad:** Si el endpoint `/tenants/current/onboarding-status` falla, fail-open (setChecked=true)

### Flujo 3: Dashboard → Inteligencia Org. (Caso de uso principal)

```
/dashboard
  → /org-intelligence (redirect a /projects)
    → /org-intelligence/projects
      → /org-intelligence/projects/[id]
        → /org-intelligence/projects/[id]/interviews
          → /org-intelligence/projects/[id]/interviews/[interviewId]
```

**Problema:** `/org-intelligence` requiere redirect manual. Por qué no es `/org-intelligence/projects` directamente?

### Flujo 4: Settings

```
/dashboard
  → /settings (index)
  → /settings/[subsection]
    → SIEMPRE muestra otro NavMain (settingsNav)
    → No hay "breadcrumb" visual de dónde estás en settings
```

**Problema:** Settings cambia el árbol NavMain, confundiendo el contexto.

---

## 4. Layouts y Posible Duplicación

### Layouts Encontrados

| Ruta | Layout | Providers | Sidebar | Header | Breadcrumbs |
|------|--------|-----------|---------|--------|-------------|
| Root | `layout.tsx` | ThemeProvider, TooltipProvider | — | — | — |
| (marketing) | `layout.tsx` | — | — | MarketingNav | — |
| (auth) | `layout.tsx` | — | — | MarketingNav | — |
| (onboarding) | `layout.tsx` | AuthProvider, TenantProvider | — | — | — |
| (dashboard) | `layout.tsx` | AuthProvider, TenantProvider, OnboardingGuard | ✅ | ✅ | ✅ |
| (dashboard)/assistant | `layout.tsx` | (anidado) | (heredado) | (heredado) | (heredado) |
| (dashboard)/linkedin | `layout.tsx` | (anidado) | (heredado) | (heredado) | (heredado) |

**Duplicación Detectada:**

1. **MarketingNav en (auth) y (marketing)**
   - Mismo componente reutilizado ✅
   - Import relativos diferentes:
     - (marketing): `./components/marketing-nav` ✅
     - (auth): `@/app/(marketing)/components/marketing-nav` ✅

2. **AuthProvider + TenantProvider**
   - Se repiten en (onboarding) y (dashboard)
   - ¿Por qué no en Root layout?

3. **Layouts anidados (assistant, linkedin)**
   - Existen `layout.tsx` en ambos
   - Probablemente para estilos específicos
   - **REVISAR:** ¿Qué hace? ¿Necesario?

---

## 5. Loading & Error States

### ❌ PROBLEMA CRÍTICO: No hay `loading.tsx` ni `error.tsx`

**Encontrado:**
- 0 archivos `loading.tsx` en la app
- 0 archivos `error.tsx` en la app

**Impacto:**
- Sin Suspense boundaries, rutas completas quedan en "loading state"
- Sin error.tsx, errores no manejados muestran browser error
- Dashboard, org-intelligence, accounting sin estado de carga

**Ejemplo de lo que falta en /org-intelligence/projects:**
```
/dashboard/org-intelligence/projects/
  ├── loading.tsx (Suspense fallback)
  └── error.tsx (Error boundary)
```

---

## 6. Problemas UX Identificados

### 🔴 CRÍTICOS (Impactan experencia core)

1. **No hay loading/error states globales**
   - **Severidad:** CRÍTICA
   - **Ubicación:** Todas las rutas del dashboard
   - **Impacto:** Usuario no sabe si está cargando o si hubo error
   - **Solución:** Agregar `loading.tsx` y `error.tsx` en:
     - (dashboard)
     - (dashboard)/org-intelligence
     - (dashboard)/accounting
     - (dashboard)/assistant

2. **Settings confunde el contexto de navegación**
   - **Severidad:** CRÍTICA
   - **Ubicación:** (dashboard)/settings
   - **Impacto:** El sidebar cambia entre "Aplicación" y "Configuración", perdiendo contexto
   - **Evidencia:** `NavMain` detecta `isSettings` y muestra array diferente
   - **Solución:** Mantener un único árbol de navegación o usar breadcrumbs más fuertes

### 🟠 ALTOS (Afectan usabilidad)

3. **Breadcrumbs no visibles en mobile**
   - **Severidad:** ALTA
   - **Ubicación:** Breadcrumbs component (hidden md:block)
   - **Impacto:** En móvil, usuario no sabe dónde está en jerarquía
   - **Solución:** Hacer breadcrumbs responsivas (mostrar versión colapsada en móvil)

4. **Breadcrumbs carece de indicador visual de página actual**
   - **Severidad:** ALTA
   - **Ubicación:** breadcrumbs.tsx línea 82
   - **Impacto:** No hay diferenciación clara entre navegables vs actual
   - **Solución:** Agregar `aria-current="page"` y estilos distintivos a última migaja

5. **Redirects manuales sin feedback**
   - **Severidad:** ALTA
   - **Ubicación:** `/personas` → `/personas/directorio`, `/org-intelligence` → `/org-intelligence/projects`
   - **Impacto:** Flash de contenido o loading sin explicar
   - **Solución:** Usar `notFound()` o hacer index pages inteligentes

6. **NavMain requiere mantenimiento manual de traducción**
   - **Severidad:** ALTA
   - **Ubicación:** breadcrumbs.tsx línea 14-47 (LABELS dict)
   - **Impacto:** Cada nueva ruta requiere actualizar dict + sidebar
   - **Solución:** Generar labels dinámicamente o usar metadata de rutas

### 🟡 MEDIOS (Mejoran experiencia)

7. **Feature pages no tienen CTA a dashboard**
   - **Severidad:** MEDIA
   - **Ubicación:** /features/[feature]/*.tsx
   - **Impacto:** Usuario en feature page no sabe cómo "comenzar" en la app
   - **Solución:** Agregar CTA "Ir a [feature] →" en cada feature page

8. **Mobile menu "Producto" toma mucho espacio**
   - **Severidad:** MEDIA
   - **Ubicación:** MarketingNav línea 272-365
   - **Impacto:** En pantallas pequeñas, menú de features casi llena la pantalla
   - **Solución:** Implementar sub-drawer o reducir cantidad de items visibles

9. **Brand colors hardcodeados rompen consistencia visual en flujos**
   - **Severidad:** MEDIA
   - **Ubicación:** layouts (marketing, auth), sidebar vs dashboard buttons
   - **Detalles:**
     - Marketing pages: `bg-teal-500` (Tailwind)
     - Auth layout: `bg-[#0a0a0a]` hardcodeado + `bg-teal-500` buttons
     - Dashboard sidebar: variables CSS (`--sidebar-primary` en oklch)
   - **Impacto:** Usuario navega landing → auth → dashboard y ve color jump
     - Falta continuidad visual
     - Hover states inconsistentes (`--sidebar-accent` vs `bg-primary/80`)
     - Dificulta reconocer "flujo de navegación"
   - **Solución:** Centralizar brand colors en `tailwind.config.ts` (variables CSS globales, no hardcoded)

---

## 7. Recomendaciones Concretas (Por Prioridad)

### P1: CRÍTICO (Esta sprint)

**1. Agregar Loading & Error States**

```bash
# Crear estos archivos:
apps/web/app/(dashboard)/loading.tsx
apps/web/app/(dashboard)/error.tsx
apps/web/app/(dashboard)/org-intelligence/loading.tsx
apps/web/app/(dashboard)/org-intelligence/error.tsx
apps/web/app/(dashboard)/accounting/loading.tsx
apps/web/app/(dashboard)/accounting/error.tsx
apps/web/app/(dashboard)/assistant/loading.tsx
apps/web/app/(dashboard)/assistant/error.tsx
```

**Ejemplo loading.tsx:**
```typescript
export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="space-y-4">
        <div className="h-12 w-48 bg-muted animate-pulse rounded" />
        <div className="space-y-2">
          <div className="h-4 w-64 bg-muted animate-pulse rounded" />
          <div className="h-4 w-56 bg-muted animate-pulse rounded" />
        </div>
      </div>
    </div>
  );
}
```

**Ejemplo error.tsx:**
```typescript
'use client';
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <h2 className="text-lg font-semibold">Algo salió mal</h2>
      <p className="text-sm text-muted-foreground">{error.message}</p>
      <button onClick={reset} className="px-4 py-2 bg-primary text-white rounded">
        Intentar de nuevo
      </button>
    </div>
  );
}
```

**2. Refactorizar Settings Navigation**

- Opción A: Hacer settings un submenú dentro de NavMain (no cambiar array)
- Opción B: Mantener NavMain pero no cambiar visualmente (usa collapsible para settings)
- **Recomendado:** Opción B con breadcrumbs más fuertes

**3. Mejorar Breadcrumbs**

```typescript
// Cambios en breadcrumbs.tsx:
// 1. Quitar hidden md:block → siempre visible (versión colapsada en móvil)
// 2. Agregar aria-current="page" al último item
// 3. Hacer diccionario LABELS más mantenible (auto-gen from URL slugs)
```

### P2: ALTO (Próximas 2 sprints)

**4. Eliminar Redirects Manuales**

Cambiar:
```typescript
// ANTES: /personas/page.tsx
redirect('/personas/directorio')

// DESPUÉS: /personas/page.tsx
import { DirectorioPage } from './directorio/page'
export default DirectorioPage
```

**5. Agregar Indicador de Página Actual en Sidebar**

- Mejorar lógica de `isActive` en NavMain
- Usar estilos más distintivos (bold, highlight color)

**6. Centralizar Brand Colors (Variables CSS Globales)**

- **Problema:** Marketing usa `bg-teal-500`, auth usa `bg-[#0a0a0a]`, dashboard usa variables CSS
- **Solución:** Actualizar `tailwind.config.ts`:
  ```typescript
  extend: {
    colors: {
      'brand-primary': 'var(--color-brand-primary)',  // teal-500 converted
      'brand-dark': 'var(--color-brand-dark)',        // #0a0a0a
    }
  }
  // En globals.css:
  :root {
    --color-brand-primary: oklch(...);  // same as sidebar primary
    --color-brand-dark: oklch(...);
  }
  ```
- Aplicar en: MarketingNav layouts + sidebar buttons
- **Beneficio:** Cambio de marca centralizado, consistencia visual en flujos (landing → auth → dashboard)

**7. Mobile Menu: Optimizar Producto**

- Limitar a 5 items principales + "Ver todos"
- O crear un scrollable container con height limit

### P3: MEDIA (Backlog)

**8. Feature Pages: Agregar CTAs**

En cada `/features/[feature]/page.tsx`:
```typescript
<Button className="mt-8">
  Explorar {feature} en Zeru →
</Button>
```

**9. Crear Sistema de Routes Helpers**

```typescript
// lib/routes.ts
export const ROUTES = {
  dashboard: '/dashboard',
  orgIntelligence: {
    home: '/org-intelligence/projects',
    projects: '/org-intelligence/projects',
    project: (id: string) => `/org-intelligence/projects/${id}`,
  },
  // ... rest of routes
} as const;
```

---

## 8. Matriz de Rutas vs. Funcionalidad

| Sección | Rutas | Estado | Flujo | UX |
|---------|-------|--------|-------|-----|
| Landing | 11 | ✅ | Claro | ✅ |
| Auth | 2 | ✅ | Claro | ✅ |
| Onboarding | 1 | ✅ | Claro | ✅ |
| Dashboard | 1 | ✅ | OK | ⚠️ (sin loading) |
| Org Intelligence | 5 | ✅ | OK | ⚠️ (sin loading, redirect) |
| Accounting | 9 | ✅ | OK | ⚠️ (sin loading) |
| Personas | 2 | ✅ | OK | ⚠️ (redirect) |
| Assistant | 3 | ✅ | Claro | ⚠️ (sin loading) |
| Settings | 12 | ✅ | Confuso | ❌ (cambia nav) |
| LinkedIn | 3 | ✅ | OK | ⚠️ (sin loading) |
| Docs | 2 | ✅ | Claro | ✅ |

---

## 9. Conclusiones

**Fortalezas:**
- ✅ Arquitectura de rutas limpia y escalable
- ✅ Uso correcto de route groups
- ✅ Sidebar sidebar responsive y colapsible
- ✅ Breadcrumbs dinámicos funcionales

**Debilidades Críticas:**
- ❌ Falta de loading.tsx y error.tsx en rutas principales
- ❌ Settings confunde el contexto de navegación
- ❌ Breadcrumbs no responsive en mobile
- ❌ Mantenimiento manual de traducciones en sidebar

**Score UX/Navegación:** 6.5/10

---

## 📋 Checklist de Implementación

- [ ] P1: Agregar loading.tsx en (dashboard), org-intelligence, accounting, assistant
- [ ] P1: Agregar error.tsx en (dashboard), org-intelligence, accounting, assistant
- [ ] P1: Refactorizar Settings navigation (mantener NavMain único)
- [ ] P2: Mejorar Breadcrumbs (responsive + aria-current)
- [ ] P2: Eliminar redirects manuales en /personas y /org-intelligence
- [ ] P2: Centralizar brand colors en tailwind.config.ts (vars CSS globales)
- [ ] P2: Mejorar active state styling en sidebar (nav-main.tsx)
- [ ] P2: Crear route helpers en lib/routes.ts
- [ ] P3: Agregar CTAs en feature pages
- [ ] P3: Optimizar mobile menu "Producto"
- [ ] P3: Integrar feedback de a11y-auditor (aria-labels, focus management)

---

**Fin del Reporte**
