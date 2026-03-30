# 📋 Auditoría de Componentes UI y Sistema de Diseño - Zeru Web

**Fecha:** 2026-03-30
**Proyecto:** Zeru (apps/web - Next.js)
**Scope:** Componentes compartidos, shadcn/ui, Tailwind config, estilos globales, consistencia visual

---

## 📊 Inventario de Componentes

### Estructura General
```
apps/web/
├── components/
│   ├── ui/               (30 componentes de shadcn/ui)
│   ├── layouts/          (4 componentes de navegación/layout)
│   ├── org-intelligence/ (14 componentes específicos del dominio)
│   ├── linkedin/         (7 componentes para LinkedIn)
│   ├── ai/              (5 componentes para AI features)
│   ├── config/          (4 formularios de configuración)
│   ├── auth/            (1 componente de autenticación)
│   └── organizations/   (1 componente de diálogo)
├── app/(marketing)/components/ (20 componentes de marketing)
└── lib/utils.ts         (utilities)
```

### Componentes shadcn/ui Instalados (30 total)
**UI Base Primitives:**
- `button`, `card`, `input`, `label`, `textarea`, `checkbox`, `switch`, `radio-group` (form controls)
- `badge`, `avatar`, `skeleton`, `alert-dialog`, `dialog`, `sheet` (display)
- `breadcrumb`, `separator`, `scroll-area` (layout)

**Advanced UI:**
- `sidebar`, `dropdown-menu`, `hover-card`, `tooltip`, `popover`
- `select`, `combobox`, `command`, `tabs`, `toggle-group`, `toggle`
- `collapsible`, `progress`, `slider`, `input-otp`, `input-group`
- `resizable`, `sonner` (toast notifications)

### Componentes Reutilizables (86 total)
| Categoría | Cantidad | Ejemplos |
|-----------|----------|----------|
| Org Intelligence | 14 | `status-badge`, `confidence-badge`, `orgchart-node`, `project-analysis-tab` |
| LinkedIn | 7 | `post-draft-card`, `post-preview-card`, `post-carousel`, `version-history-popover` |
| AI Features | 5 | `token-meter`, `thinking-block`, `tool-execution`, `question-card` |
| Config Forms | 4 | `ai-config-form`, `email-config-form`, `gemini-config-form` |
| Layouts | 4 | `app-sidebar`, `nav-main`, `nav-user`, `team-switcher`, `breadcrumbs` |
| Marketing | 20+ | `hero-section`, `pricing-section`, `features-section`, `developer-section` |
| Others | 12+ | `onboarding-banner`, `auth-cover`, `create-org-dialog`, etc. |

---

## 🎨 Análisis del Sistema de Diseño

### 1. **Tailwind CSS Configuration**
✅ **Fortalezas:**
- **Versión v4** con `@tailwindcss/postcss` (moderna)
- **CSS variables dinámicas** correctamente configuradas en `globals.css`
- **Dark mode** completamente implementado usando `.dark` class
- **Tokens semánticos bien definidos**: `primary`, `secondary`, `accent`, `muted`, `destructive`, `chart-*`

📋 **Configuración:**
```css
@theme inline {
  --color-primary: var(--primary)
  --color-secondary: var(--secondary)
  --color-sidebar-*: var(--sidebar-*)
  --radius-*: calculated values
  --color-chart-1 to chart-5: color progression
}
```

✅ **Color Palette (OKLch):**
- **Light mode:** Background blanco (oklch(1 0 0)), foreground oscuro
- **Dark mode:** Background gris (oklch(0.147 0.004 49.25)), foreground claro
- **Accent:** Teal-based (oklch(0.60 0.10 185)) para light, más brillante en dark
- **Semantic colors:** Destructive (rojo), input borders, chart colors progresivos

✅ **Border Radius:**
- Base: `--radius: 0.45rem`
- Variables: `radius-sm` a `radius-4xl` (escalable)

### 2. **Dark Mode**
✅ **Completamente implementado:**
- CSS variables separadas para `.dark` class
- Transiciones suave entre light/dark
- Colores primarios ajustados para cada modo (más claros en dark)
- Sidebar y componentes UI mantienen consistencia

❌ **Problema identificado:**
- Algunos componentes hardcodean colores específicos de Tailwind en lugar de usar variables

---

## ⚠️ Problemas de Consistencia Encontrados

### **CRÍTICO: Colores Hardcodeados en Lugar de Variables CSS**

#### Problema #1: Colores Tailwind Específicos en Componentes de Dominio
**Ubicación:** `confidence-badge.tsx`, `status-badge.tsx`, componentes de LinkedIn

```typescript
// ❌ PROBLEMA: Hardcodear colores específicos de Tailwind
const color = confidence >= 0.8
  ? "text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900"
  : confidence >= 0.5
    ? "text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-900"
    : "text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900"
```

**Impacto:**
- ✅ Funciona correctamente con dark mode
- ❌ NO usa el design system definido en `globals.css`
- ❌ Hace difícil cambiar paleta de colores global
- ❌ Viola el principio de single source of truth

**Archivos afectados (7 total):**
1. `components/org-intelligence/confidence-badge.tsx`
2. `components/org-intelligence/status-badge.tsx`
3. `components/linkedin/post-draft-card.tsx` (STATUS_LABELS)
4. `components/linkedin/post-preview-card.tsx`
5. `components/linkedin/linkedin-sidebar.tsx`
6. `components/linkedin/image-preview-card.tsx`
7. `components/ui/sidebar.tsx` (minor)

---

#### Problema #2: Colores Inline/Gradientes en Marketing Pages
**Ubicación:** `app/(marketing)/components/` - Especialmente hero-section, features, etc.

```typescript
// ❌ PROBLEMA: Colores hardcodeados en hero section
<div className="absolute top-1/4 left-1/4 w-[600px] h-[600px]
  rounded-full bg-teal-500/10 blur-[120px]" />
<div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px]
  rounded-full bg-teal-400/6 blur-[100px]" />

<span className="bg-gradient-to-r from-teal-400 to-teal-300
  bg-clip-text text-transparent">
  Entiende tu empresa
</span>
```

**Impacto:**
- ❌ Colores teal hardcodeados en múltiples componentes
- ❌ Inconsistencia con la paleta OKLch definida
- ❌ Shadow colors (`shadow-teal-500/20`) también hardcodeados
- ❌ Limita flexibilidad de branding/personalización

**Patrón observado:**
- `bg-teal-500`, `bg-teal-400`, `text-teal-400`
- `border-teal-500/30`, `shadow-teal-500/20`
- Múltiples variaciones de opacidad y saturación

---

### Problema #3: Duplicación de Lógica de Mapeo de Colores
**Ubicación:** `status-badge.tsx`

```typescript
const COLOR_MAP: Record<string, string> = {
  gray: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  green: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  red: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  // ... 7 más combinaciones manuales
}
```

**Problemas:**
- ❌ Duplica dark mode en cada entrada
- ❌ Hardcodea números de escala Tailwind (100, 700, 800, 900)
- ❌ Difícil de mantener - cambiar la paleta requiere múltiples ediciones
- ✅ Buena estructura de mapeo (debería usar variables CSS en su lugar)

---

### Problema #4: Inconsistencia en Spacing y Tamaños
**No centralizado:**
- Padding/margin: algunos componentes usan `px-2 py-0.5`, otros `px-3 py-1.5`
- Tamaños de texto: variaciones no documentadas
- Border radius: aunque tienen variables, no todas las componentes las usan

---

### Problema #5: Uso de Variables CSS Incompleto
**Oportunidad perdida:**

```css
/* ✅ Bien definidas en globals.css */
--primary: oklch(0.60 0.10 185)
--accent: oklch(0.60 0.10 185)
--chart-1 to chart-5: color progression

/* ❌ Pero los componentes no las aprovechan */
/* Usan "teal-500" en lugar de "primary" */
```

---

### Problema #6: Indicadores Visuales Débiles en Navegación
**Ubicación:** `nav-main.tsx`, `breadcrumbs.tsx`

**Problemas identificados:**
1. **Active state en sidebar insuficientemente diferenciado**
   - El componente `SidebarMenuButton` calcula `isActive` correctamente (línea 252-260)
   - Pero los estilos visuales son débiles - no hay bold, left border, o highlight claro
   - En mobile collapsed mode, imposible distinguir qué item está activo

2. **Breadcrumbs sin indicator visual de página actual**
   - `BreadcrumbPage` (línea 82-84) es el mismo peso visual que links
   - No hay: diferente color, bold, underline, o estado visual distintivo
   - Usuario no sabe claramente dónde está

3. **Context shift visual en Settings**
   - Navbar label cambia de "Aplicación" a "Configuración" (línea 137)
   - Lista completa de items cambia (11 items en app vs 12 en settings)
   - Causa desorientación visual y pérdida de contexto

**Impacto:**
- ❌ UX confusa - usuarios no saben dónde están
- ❌ Baja accesibilidad - falta indicator visual claro
- ❌ Mobile: navegación casi ilegible en modo collapsed

---

### Problema #7: Marketing Header Con Color Hardcodeado
**Ubicación:** `app/(marketing)/components/marketing-nav.tsx` (línea ~110)

```typescript
className={`... ${
  scrolled
    ? "bg-[#0a0a0a]/90 backdrop-blur-md"  // ❌ HARDCODEADO
    : "bg-transparent"
}`}
```

**Problemas:**
- ❌ Color `#0a0a0a` hardcodeado (negro casi puro)
- ❌ No usa variables CSS del design system
- ❌ Inconsistente con sidebar que usa `--sidebar: oklch(...)`
- ❌ Si cambias marca, headermarketing queda desincronizado

---

### Problema #8: Mobile Menu "Producto" Excesivamente Largo
**Ubicación:** `app/(marketing)/components/marketing-nav.tsx`

**Estructura:**
- `platformItems`: 5 items (Inteligencia Org, Personas, Asistente, Contabilidad, Marketing)
- `upcomingItems`: 5 items (RRHH, Documental, Integraciones, BI, API)
- **Total: 10 items en mobile = casi toda la viewport**

**Problema:**
- ❌ En pantallas pequeñas, el menú "Producto" ocupa demasiado espacio
- ❌ Usuario debe hacer scroll para ver resto del contenido
- ❌ No hay paginación, collapsible, o "Ver más" button

**Solución recomendada:**
- Limitar a 5 items + "Ver más" button
- O usar accordion/collapsible para upcoming features
- O separar en pestañas "Core" vs "Próximamente"

---

## 📈 Análisis de Reutilización de Componentes

### Componentes Bien Reutilizados
✅ **Button**, **Card**, **Badge**, **Input**, **Dialog** - estándar shadcn
✅ **StatusBadge** - usado en org-intelligence y linkedin
✅ **Sidebar** - componente central para layout

### Problemas de Reutilización
⚠️ **Componentes duplicados:**
- Múltiples "post cards" (draft, preview, carousel) - baja cohesión
- Múltiples "badges" (confidence, status, entity-type) - lógica similar

⚠️ **Componentes muy específicos:**
- `mermaid-diagram.tsx` - solo usado en org-intelligence
- `journal-entry-review-card.tsx` - muy específico, difícil reutilizar
- Marketing components - completamente aislados del app principal

---

## 🔍 Auditoría de Dark Mode

✅ **Implementación técnica:** Excelente
- Variables CSS separadas para `.dark` class
- Colores primarios ajustados correctamente
- Chart colors mantienen consistencia
- Sidebar modo oscuro bien diseñado

⚠️ **Problemas:**
- Componentes con hardcoded `dark:` prefixes (`dark:text-green-300`, `dark:bg-green-900`)
- Si cambias la paleta primaria, estos colors hardcodeados quedan desincronizados

---

## 📋 Recomendaciones Prioritizadas

### 🔴 CRÍTICO (Impacto Alto)

#### 1. **Mejorar indicadores visuales en navegación**
**Prioridad:** INMEDIATA
**Effort:** Bajo

**Plan:**
1. **Breadcrumbs:** Agregar estilos distintivos a `BreadcrumbPage`
   ```css
   /* En breadcrumb.tsx o globals.css */
   [data-breadcrumb-page] {
     font-weight: 600;
     color: var(--foreground);
     /* opcional: underline o background-color */
   }
   ```

2. **Sidebar active state:** Mejorar `SidebarMenuButton` cuando `isActive`
   ```css
   [data-active="true"] {
     font-weight: 600;
     border-left: 2px solid var(--sidebar-primary);
     background-color: var(--sidebar-accent);
   }
   ```

3. **Settings context:** Mantener visual consistency
   - No cambiar el "weight" de los items
   - Agregar icon o visual indicator para Settings (diferente color de icon)
   - Mantener altura visual similar

**Beneficio:** UX mejorada, navegación clara, mejor accesibilidad

---

#### 2. **Reemplazar colores Tailwind hardcodeados con variables CSS (Badges & Status)**
**Prioridad:** INMEDIATA
**Effort:** Medio

**Plan:**
1. Agregar nuevas variables CSS en `globals.css`:
   ```css
   --color-status-success: oklch(0.70 0.12 183)  /* green */
   --color-status-warning: oklch(0.677 0.150 70)  /* amber/yellow */
   --color-status-error: oklch(0.577 0.245 27)    /* red */
   --color-status-info: oklch(0.60 0.10 185)      /* blue/teal */
   ```

2. Rehacer `confidence-badge.tsx` y `status-badge.tsx`:
   - Usar variables CSS en lugar de hardcoded Tailwind colors
   - Eliminar múltiples `dark:` prefixes

3. Ubicaciones a refactorizar:
   - `components/org-intelligence/confidence-badge.tsx`
   - `components/org-intelligence/status-badge.tsx`
   - `components/linkedin/post-draft-card.tsx`
   - `components/linkedin/post-preview-card.tsx`

**Beneficio:** Single source of truth, accesibilidad mejorada, dark mode centralizado

---

#### 3. **Crear brand color variables para marketing pages**
**Prioridad:** ALTA
**Effort:** Bajo

**Plan:**
```css
/* En globals.css */
:root {
  --brand-accent: oklch(0.60 0.10 185);  /* teal actual */
  --brand-accent-light: oklch(0.70 0.12 183);
  --brand-accent-dark: oklch(0.51 0.09 186);
  --brand-bg-dark: #0a0a0a;
  --brand-gradient: linear-gradient(to right, var(--brand-accent-light), var(--brand-accent));
}
```

**Ubicaciones a actualizar:**
- `app/(marketing)/components/marketing-nav.tsx`: `bg-[#0a0a0a]` → `bg-[var(--brand-bg-dark)]`
- `app/(marketing)/components/hero-section.tsx`: `bg-teal-500` → `bg-[var(--brand-accent)]`
- Todos los componentes de marketing que usan `teal-*`

**Beneficio:** Consistencia global, fácil cambio de branding

---

#### 4. **Optimizar marketing header y mobile menu**
**Prioridad:** ALTA
**Effort:** Medio

**Plan:**
1. **Mobile menu:** Limitar `platformItems` a 5 items
2. Poner `upcomingItems` en section collapsible "Próximas características"
3. Agregar "Ver todas" button si necesario

**Beneficio:** Mejor UX mobile, menos scroll

---

#### 5. **Extraer y documentar spacing/sizing system**
**Prioridad:** MEDIA
**Effort:** Bajo

**Plan:**
Crear archivo `components/ui/constants.ts`:
```typescript
export const SPACING = {
  xs: "gap-1 px-2 py-0.5",
  sm: "gap-1 px-2 py-1",
  md: "gap-1 px-3 py-1.5",
  lg: "gap-1 px-4 py-2",
} as const;

export const BADGE_SIZES = {
  xs: "text-[0.625rem]",
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
} as const;
```

---

### 🟡 IMPORTANTE (Impacto Medio)

#### 6. **Consolidar componentes similares**
**Prioridad:** MEDIA
**Effort:** Alto

Opciones:
- Unificar `ConfidenceBadge` + `StatusBadge` en un componente flexible
- Crear una familia `PostCard` base con variantes
- Centralizar lógica de "entity badge"

---

#### 7. **Documentar design system**
**Prioridad:** MEDIA
**Effort:** Medio

Crear `DESIGN_SYSTEM.md`:
```markdown
# Design System - Zeru

## Color Palette
- **Primary:** oklch(0.60 0.10 185) [Teal]
- **Semantic:** Destructive, Success, Warning, Info
- **Accessibility:** WCAG AA contrast ratios verified

## Typography
- Headline: var(--font-display)
- Body: var(--font-sans)
- Mono: var(--font-geist-mono)

## Spacing Scale
- Base unit: 0.25rem (4px)
- Scale: xs, sm, md, lg, xl, 2xl

## Component Variants
...
```

---

#### 8. **Implementar Storybook o Chromatic**
**Prioridad:** BAJA
**Effort:** Alto

Beneficio: Visualizar todos los componentes en un solo lugar, documentar variantes.

---

### 🟢 BUENO (Mantener)

✅ **Continuar:**
- Estructura de componentes modular
- Uso de shadcn/ui como base
- Tailwind CSS v4
- Dark mode implementado
- CVA para variantes de componentes

---

## 📊 Resumen de Hallazgos

| Aspecto | Estado | Prioridad |
|---------|--------|-----------|
| **Estructura de Componentes** | ✅ Buena | - |
| **shadcn/ui Integration** | ✅ Bien implementado | - |
| **Tailwind v4** | ✅ Moderno | - |
| **Dark Mode** | ✅ Implementado | - |
| **Color Hardcoding** | ❌ CRÍTICO | 🔴 |
| **Indicadores Visuales (Nav)** | ❌ Débiles | 🔴 |
| **CSS Variables** | ⚠️ Subutilizado | 🟡 |
| **Marketing Header** | ⚠️ Hardcoded | 🟡 |
| **Mobile Menu** | ⚠️ Largo | 🟡 |
| **Componentes Reutilizables** | ✅ Bueno | - |
| **Documentación** | ❌ Inexistente | 🟡 |
| **Accesibilidad** | ⚠️ A revisar | 🟡 |

---

## 🚀 Plan de Acción (90 días)

**Sprint 1 (Semana 1-2) - Indicadores Visuales & Colores Críticos:**
- [ ] Mejorar estilos de active state en sidebar (bold + left border)
- [ ] Agregar visual indicator en breadcrumbs (BreadcrumbPage styling)
- [ ] Agregar variables CSS semánticas para status colors
- [ ] Actualizar `confidence-badge.tsx` y `status-badge.tsx` con variables

**Sprint 2 (Semana 3-4) - Brand Colors & Marketing:**
- [ ] Crear brand color variables en `globals.css`
- [ ] Actualizar `marketing-nav.tsx` (header color → variable)
- [ ] Actualizar `hero-section.tsx` y componentes de marketing
- [ ] Optimizar mobile "Producto" menu (limitar items)

**Sprint 3 (Semana 5-8) - Consolidación & Documentación:**
- [ ] Actualizar componentes de LinkedIn con nuevas variables
- [ ] Consolidar componentes similares (badges, cards)
- [ ] Crear constants.ts para spacing/sizing
- [ ] Documentar design system en `DESIGN_SYSTEM.md`

**Sprint 4 (Semana 9-12) - Polish & Testing:**
- [ ] Auditoría de accesibilidad (contraste, dark mode)
- [ ] Crear tests visuales (Storybook/Chromatic)
- [ ] Performance review de componentes
- [ ] Feedback loop con teammates (a11y, nav)

---

## 🎯 Conclusión

El sistema de diseño de Zeru tiene **buena estructura técnica** pero **sufre de fragmentación en la implementación**.

**Problemas principales identificados:**
1. **Colores hardcodeados** (7 archivos) violan el principio de single source of truth
2. **Indicadores visuales débiles** en navegación afectan UX y accesibilidad
3. **Marketing header y mobile menu** con inconsistencias visuales
4. **Subutilización de variables CSS** a pesar de estar bien definidas

**Hallazgos cruzados (colaboración de equipo):**
- **nav-auditor:** Encontró 5 problemas de UX visual en navegación que impactan diseño
- **a11y-auditor:** Identificó potenciales issues de contraste en badges y marketing components

**Beneficio de las recomendaciones:**
- Branding centralizado y flexible
- Dark mode robusto y consistente
- Mejor UX en navegación (claridad de contexto)
- Accesibilidad mejorada (indicadores visuales, contraste verificable)

**Impacto estimado:**
- Refactorización completa: 50-70 horas (incluye indicadores visuales)
- ROI: Mantenibilidad significativamente mejorada, flexibilidad para cambios de branding
- Critical path: Sprint 1 (2 semanas) resuelve los problemas de mayor impacto
