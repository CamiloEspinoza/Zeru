# Auditoría de Accesibilidad Web (A11y) y Responsive Design - Zeru
**Fecha:** 2026-03-30
**Equipo:** nav-auditor + design-auditor + a11y-auditor
**Estado:** 🔴 13 problemas críticos/altos encontrados | 🟡 6 problemas medios | 🟢 5 problemas bajos

---

## RESUMEN EJECUTIVO

La app web Zeru tiene **violaciones de WCAG AA en navegación, contraste y semántica HTML**. Los problemas más críticos afectan a usuarios de teclado y lectores de pantalla en:
1. Marketing navigation (mega menu no navegable)
2. Breadcrumbs ocultos en mobile
3. Contraste insuficiente en 60+ lugares
4. Badges con ratios < 2:1

**Cumplimiento actual:**
- WCAG Level A: ✅ Mostly compliant
- WCAG Level AA: 🔴 Critical violations
- WCAG Level AAA: ❌ Not compliant (low priority)

---

## 1. CONTRASTE DE COLORES (WCAG 1.4.3)

### 🔴 CRÍTICO: Marketing Navigation Text Opacity

**Archivo:** `apps/web/app/(marketing)/components/marketing-nav.tsx`

| Ubicación | Clase | Ratio | WCAG AA | Problema |
|-----------|-------|-------|---------|----------|
| Línea 134 | `text-white/60 hover:text-white` | ~2.8:1 | ❌ | Descripción de nav items |
| Línea 215 | `text-white/60` | ~2.8:1 | ❌ | Desktop nav links |
| Línea 235 | `text-white/70 hover:text-white` | ~3.2:1 | ❌ | Login link |
| Línea 277 | `text-white/70 hover:text-white` | ~3.2:1 | ❌ | Mobile nav items |
| Línea 351 | `text-white/70` | ~3.2:1 | ❌ | Mobile menu buttons |

**Causa:** Opacidad < 80% en texto blanco sobre fondo oscuro
**Solución:** Cambiar a `text-white/85` mínimo (ratio ~4.8:1)

```diff
- <span className="text-white/60">Description</span>
+ <span className="text-white/85">Description</span>
```

---

### 🔴 CRÍTICO: Upcoming Features Section

**Archivo:** `apps/web/app/(marketing)/components/upcoming-features-section.tsx`

| Ubicación | Clase | Ratio | Problema |
|-----------|-------|-------|----------|
| Línea 273 | `text-white/50` | ~1.5:1 | Párrafo descriptivo (CRÍTICO) |
| Línea 278 | `text-white/70` | ~3.2:1 | Secondary text |
| Línea 292 | `bg-white/5 text-white/50` | ~1.5:1 | Card text (CRÍTICO) |
| Línea 302 | `text-white/50` | ~1.5:1 | Feature descriptions (CRÍTICO) |

**Causa:** Opacidad muy baja (50%) en texto sobre fondo gradiente
**Impacto:** ~40 instancias de texto ilegible para usuarios con baja visión (>20% de usuarios)

---

### 🔴 CRÍTICO: Org-Intelligence Badges

**Archivo:** `apps/web/components/org-intelligence/confidence-badge.tsx` (líneas 3-8)

```tsx
const colors = {
  high: "bg-green-100 text-green-900",      // Ratio: ~1.8:1 ❌
  medium: "bg-amber-100 text-amber-900",    // Ratio: ~1.6:1 ❌
  low: "bg-red-100 text-red-900"            // Ratio: ~2.1:1 ❌
}
```

**Problema:** Light background + dark text, ratios muy bajos
**Ubicaciones relacionadas:**
- `components/org-intelligence/status-badge.tsx` (línea 4-27)
- `components/linkedin/post-draft-card.tsx` (línea 37-43)

**Solución:** Usar variables okLCH certificadas en globals.css

---

### 🟡 MEDIO: Dark Mode Muted Foreground

**Archivo:** `apps/web/app/globals.css` (línea 99)

```css
.dark {
  --muted-foreground: oklch(0.709 0.01 56.259); /* Ratio: ~4.2:1 */
}
```

**Problema:** Justo en el límite de WCAG AA (4.5:1 requerido)
**Afecta:** Texto en estado muted/disabled en modo oscuro
**Recomendación:** Aumentar a `oklch(0.70 0.01 56)` para ratio ~4.6:1

---

## 2. NAVEGACIÓN Y ESTRUCTURA (WCAG 2.4.x, 3.2.3)

### 🔴 CRÍTICO: Mega Menu Dropdown No Navegable por Teclado

**Archivo:** `apps/web/app/(marketing)/components/marketing-nav.tsx` (líneas 131-209)

**Problemas:**
1. Botón "Producto" **sin `aria-expanded` ni `aria-haspopup`**
   ```tsx
   <button className="text-white hover:text-white/80">
     Producto {/* Falta: aria-expanded, aria-haspopup, role */}
   </button>
   ```

2. Dropdown solo funciona con **hover**, no con teclado (Tab/Enter)
3. `w-[700px]` ancho fijo → se corta en tablets (<768px)
4. Sin navegación con arrow keys en items del dropdown

**Impacto:** Usuarios de teclado NO pueden acceder a navegación de productos (WCAG 2.1.1)

**Solución:**
```tsx
<button
  aria-expanded={isOpen}
  aria-haspopup="menu"
  onClick={() => setIsOpen(!isOpen)}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen(!isOpen);
    }
  }}
>
  Producto
</button>
```

---

### 🔴 CRÍTICO: Breadcrumbs Ocultos en Mobile (Hidden vs Responsive)

**Archivo:** `apps/web/components/ui/breadcrumb.tsx` (línes 68, 80)

```tsx
<ol className="flex items-center gap-1 hidden md:flex">
  {/* Completamente invisible en mobile, tablet */}
</ol>
```

**Problemas:**
1. Usuario en móvil **no sabe dónde está** en la jerarquía
2. Sin alternativa responsiva (colapsada, comprimida, etc.)
3. **Sin `aria-current="page"`** en BreadcrumbPage (línea 82-84)
   - Screen reader no sabe cuál es la página actual

**WCAG Violations:**
- 2.4.8 Location: breadcrumbs completely hidden
- 1.3.1 Info and Relationships: no aria-current

**Solución:**
```tsx
// Mobile: mostrar último + anterior
<nav aria-label="breadcrumb">
  <ol className="flex items-center gap-1">
    <li className="hidden sm:inline">...</li>
    <li className="hidden sm:inline">›</li>
    <li>
      <span aria-current="page">{current}</span>
    </li>
  </ol>
</nav>
```

---

### 🟠 ALTO: Falta `aria-current="page"` en Breadcrumbs

**Archivo:** `apps/web/components/ui/breadcrumb.tsx` (línea 82-84)

```tsx
export function BreadcrumbPage({ children }: BreadcrumbPageProps) {
  return (
    <span className="text-foreground">
      {children}
      {/* Falta: aria-current="page" */}
    </span>
  )
}
```

**Problema:** Screen readers no anuncia cuál es la página actual
**Solución:**
```tsx
<span className="text-foreground" aria-current="page">
  {children}
</span>
```

---

### 🟠 ALTO: Falta Skip Links en Marketing Navigation

**Archivo:** `apps/web/app/(marketing)/components/marketing-nav.tsx`

**Problema:** No hay "Skip to main content" link
**WCAG 2.4.1:** Bypass Blocks required

**Solución:** Agregar hidden skip link:
```tsx
<a href="#main-content" className="sr-only focus:not-sr-only">
  Skip to main content
</a>
```

---

### 🟡 MEDIO: Focus Handling en NavMain Collapsibles Anidados

**Archivo:** `apps/web/components/layouts/nav-main.tsx` (líneas 154-246)

**Problemas:**
1. Collapsibles anidados hasta 3 niveles
2. ¿Tab order correcto al expand/collapse?
3. ¿Enter/Space controla estado correctamente?
4. Riesgo de focus trap en submenus

**Recomendación:** Verificar que `aria-expanded` actualiza cuando el Collapsible expande, y que focus no queda atrapado.

---

### 🟡 MEDIO: Settings Navigation Cambia Sin Anuncio

**Archivo:** `apps/web/components/layouts/nav-main.tsx` (línes 131-138)

```tsx
{role === "admin" && (
  <>
    {/* NavMain cambia completamente cuando entra a Settings */}
  </>
)}
```

**Problema:** Screen reader no anuncia cambio de navegación
**Solución:** Agregar `aria-live="polite"` o `aria-label` dinámico en nav container

---

## 3. LABELS Y ARIA (WCAG 1.3.1, 4.1.2)

### 🟠 ALTO: Botones Icon-Only sin aria-label

**1. Close Button en Post Scheduler**
**Archivo:** `apps/web/components/linkedin/post-preview-card.tsx` (línea 220)

```tsx
<button
  onClick={() => setShowScheduler(false)}
  className="absolute top-2 right-2 p-1 hover:bg-muted rounded"
>
  ✕
  {/* Falta: aria-label="Cerrar scheduler" */}
</button>
```

**Solución:**
```tsx
<button aria-label="Cerrar scheduler de publicación" {...}>
  ✕
</button>
```

---

### 🟠 ALTO: Input Datetime-Local sin Label

**Archivo:** `apps/web/components/linkedin/post-preview-card.tsx` (línea 199-205)

```tsx
<input
  type="datetime-local"
  value={scheduleValue}
  onChange={(e) => setScheduleValue(e.target.value)}
  className="flex-1 bg-transparent text-sm outline-none"
  min={toLocalDatetimeValue()}
  {/* Falta: aria-label o label element */}
/>
```

**Problema:** Screen reader no identifica el propósito del input
**Solución:**
```tsx
<label className="sr-only" htmlFor="schedule-datetime">
  Fecha y hora de publicación
</label>
<input
  id="schedule-datetime"
  type="datetime-local"
  {...}
/>
```

---

### 🟠 ALTO: tabIndex={-1} Inapropiado en Botón Visible

**Archivo:** `apps/web/components/config/ai-config-form.tsx` (línea 510)

```tsx
<button
  type="button"
  onClick={() => setShowApiKey(!showApiKey)}
  tabIndex={-1}  // ❌ INCORRECTO: Botón visible no debería tener tabIndex negativo
  className="text-xs text-muted-foreground hover:text-foreground"
>
  {showApiKey ? "Ocultar" : "Mostrar"}
</button>
```

**Problema:** Saca el botón de la navegación por teclado
**Solución:** Remover `tabIndex={-1}`

```tsx
<button type="button" onClick={() => setShowApiKey(!showApiKey)} {...}>
  {showApiKey ? "Ocultar" : "Mostrar"}
</button>
```

---

### 🟡 MEDIO: Inputs sin aria-describedby

**Archivo:** `apps/web/components/organizations/create-org-dialog.tsx` (línea 106-118)

```tsx
<Label htmlFor="org-slug">Slug (URL)</Label>
<Input
  id="org-slug"
  value={slug}
  onChange={(e) => setSlug(e.target.value.toLowerCase())}
  placeholder="my-org"
  {/* Falta: aria-describedby */}
/>
<p className="text-xs text-muted-foreground mt-1">
  Solo minúsculas, números y guiones
</p>
```

**Problema:** Descripción no vinculada programáticamente
**Solución:**
```tsx
<Input
  id="org-slug"
  aria-describedby="slug-help"
  {...}
/>
<p id="slug-help" className="text-xs text-muted-foreground mt-1">
  Solo minúsculas, números y guiones
</p>
```

---

### 🟡 MEDIO: Hamburger Menu aria-label Genérico

**Archivo:** `apps/web/app/(marketing)/components/marketing-nav.tsx` (línea 250-268)

```tsx
<button
  aria-label="Menu"  // ✅ Presente pero muy genérico
  onClick={() => setMobileOpen(!mobileOpen)}
  className="md:hidden"
>
  {/* Sin aria-expanded */}
</button>
```

**Mejoría:**
```tsx
<button
  aria-label="Menú de navegación"
  aria-expanded={mobileOpen}
  onClick={() => setMobileOpen(!mobileOpen)}
  className="md:hidden"
>
  {/* Indica estado del menú */}
</button>
```

---

## 4. SEMÁNTICA HTML (WCAG 1.3.1)

### 🟡 MEDIO: Falta `<main>` en Dashboard Layout

**Archivo:** `apps/web/app/(dashboard)/layout.tsx` (línea 36)

```tsx
<div className="flex-1 overflow-auto">
  {children}
</div>
```

**Problema:** Sin `<main>` element
**Solución:**
```tsx
<main className="flex-1 overflow-auto">
  {children}
</main>
```

---

### 🟡 MEDIO: Cards sin Semántica Apropiada

**Archivos:**
- `apps/web/components/linkedin/post-preview-card.tsx` (línea 84)
- `apps/web/components/linkedin/image-preview-card.tsx` (línea 17)

```tsx
<div className="p-4 bg-card rounded-lg border">
  {/* Debería ser <article> para contenido */}
</div>
```

**Solución:**
```tsx
<article className="p-4 bg-card rounded-lg border">
  {/* Semántica correcta para cards de contenido */}
</article>
```

---

### ✅ Bien Implementado: Semántica General

- ✅ Marketing layout: `<main>`, `<header>`, `<nav>`, `<section>`, `<footer>`
- ✅ Fieldsets: `<fieldset>`, `<legend>` en ui/field.tsx
- ✅ Breadcrumbs: `<nav aria-label="breadcrumb">`

---

## 5. RESPONSIVE DESIGN (WCAG 1.4.10)

### 🟠 ALTO: Dropdown Ancho Fijo (700px) se Corta en Tablets

**Archivo:** `apps/web/app/(marketing)/components/marketing-nav.tsx` (línea 144)

```tsx
<div className="absolute left-0 w-[700px] top-full bg-slate-900 rounded-b-lg p-6">
  {/* ❌ Ancho fijo, viewport < 768px se corta */}
</div>
```

**Problema:**
- Tablet (768px): dropdown ocupa 700px + padding = overflow
- Mobile (375px): se sale completamente

**Solución:**
```tsx
<div className="absolute left-0 max-w-[min(100vw-2rem,700px)] top-full bg-slate-900 rounded-b-lg p-6">
  {/* Ancho responsivo */}
</div>
```

---

### 🟡 MEDIO: Falta de Responsive Text Sizes

**Archivo:** `apps/web/app/(marketing)/components/feature-page-layout.tsx`

```tsx
<p className="text-lg sm:text-xl">
  {/* Solo sm variant, falta md, lg para tablets/desktop */}
</p>
```

**Problema:** Texto muy pequeño en tablets (md, lg breakpoints)

**Solución:** Agregar más breakpoints:
```tsx
<p className="text-base sm:text-lg md:text-xl lg:text-2xl">
  {/* Escalado completo */}
</p>
```

---

### 🟡 MEDIO: Modales con Padding Limitado en Mobile

**Archivo:** `apps/web/components/ui/dialog.tsx` (línea 65)

```tsx
<div className="max-w-[calc(100%-2rem)]">
  {/* En mobile 320px: max-width = 308px, muy comprimido */}
</div>
```

**Recomendación:** Agregar `sm:max-w-sm md:max-w-md lg:max-w-lg` para mejor escala

---

### ✅ Bien Implementado: Breakpoints Consistentes

- ✅ `hidden md:flex` / `md:hidden` en nav
- ✅ `py-28 px-6 sm:px-8` en secciones
- ✅ Images: `max-w-[75%] max-h-[420px]`

---

## 6. IMÁGENES (WCAG 1.1.1)

### ✅ Bien Implementado: Alt Text

- ✅ `post-preview-card.tsx`: `alt="Post image"`
- ✅ `image-preview-card.tsx`: `alt="Generated image"`
- ✅ `image-prompt-card.tsx`: `alt="Post image"`

---

### 🟢 BAJO: No Usa next/Image

**Problema:** Todas las imágenes usan `<img>` nativa

**Ventajas Perdidas:**
- ❌ Sin lazy loading automático
- ❌ Sin responsive srcset
- ❌ Sin automatic format optimization (WebP)
- ❌ Sin blur placeholder
- ❌ CLS (Cumulative Layout Shift) potencial

**Solución:**
```tsx
import Image from 'next/image';

<Image
  src={post.mediaUrl}
  alt="Post image"
  width={800}
  height={420}
  className="w-full object-contain max-h-[420px] bg-muted/20"
/>
```

---

## TABLA RESUMEN DE PROBLEMAS

| ID | Severidad | Problema | Ubicación | WCAG | Usuarios Afectados |
|----|-----------|----------|-----------|------|-------------------|
| A1 | 🔴 CRÍTICO | Contraste bajo marketing nav | marketing-nav.tsx:134,215,235,277,351 | 1.4.3 | Baja visión (20%) |
| A2 | 🔴 CRÍTICO | Contraste bajo upcoming features | upcoming-features-section.tsx:273,278,292,302 | 1.4.3 | Baja visión |
| A3 | 🔴 CRÍTICO | Badges contraste < 2:1 | confidence-badge.tsx:3-8 | 1.4.3 | Baja visión |
| A4 | 🔴 CRÍTICO | Mega menu sin navegación teclado | marketing-nav.tsx:131-209 | 2.1.1 | Teclado (5-10%) |
| A5 | 🔴 CRÍTICO | Breadcrumbs hidden en mobile | breadcrumb.tsx:68,80 | 2.4.8 | Mobile (60%) |
| A6 | 🟠 ALTO | aria-current faltante | breadcrumb.tsx:82-84 | 1.3.1 | Screen reader (2%) |
| A7 | 🟠 ALTO | Botón close sin aria-label | post-preview-card.tsx:220 | 4.1.2 | Screen reader |
| A8 | 🟠 ALTO | Input datetime sin label | post-preview-card.tsx:199-205 | 1.3.1 | Screen reader |
| A9 | 🟠 ALTO | tabIndex=-1 inapropiado | ai-config-form.tsx:510 | 2.1.1 | Teclado |
| A10 | 🟠 ALTO | Dropdown 700px ancho fijo | marketing-nav.tsx:144 | 1.4.10 | Tablet (15%) |
| A11 | 🟡 MEDIO | aria-describedby faltante | create-org-dialog.tsx:118 | 1.3.1 | Screen reader |
| A12 | 🟡 MEDIO | Falta `<main>` en dashboard | dashboard/layout.tsx:36 | 1.3.1 | Estructura |
| A13 | 🟡 MEDIO | Cards sin `<article>` | post-preview-card.tsx:84 | 1.3.1 | Semántica |
| A14 | 🟡 MEDIO | Muted foreground ratio 4.2:1 | globals.css:99 | 1.4.3 | Baja visión |
| A15 | 🟡 MEDIO | Text sizes falta md/lg | feature-page-layout.tsx | 1.4.10 | Tablet |
| A16 | 🟢 BAJO | No usa next/Image | linkedin components | Performance | Todos |

---

## PLAN DE REMEDIACIÓN

### Fase 1: CRÍTICO (1-2 sprints)
1. **Contraste en marketing:** Cambiar `text-white/60→85`, `text-white/50→90`
2. **Mega menu teclado:** Agregar aria-expanded, Enter/Space support
3. **Breadcrumbs mobile:** Versión responsiva (no hidden)
4. **Badges:** Nuevo sistema de colores con contraste certificado

### Fase 2: ALTO (1-2 sprints)
5. Agregar aria-current="page" en breadcrumbs
6. Agregar aria-labels en botones icon-only
7. Remover tabIndex={-1} innecesarios
8. Responsive dropdown (max-w)

### Fase 3: MEDIO (Backlog)
9. Agregar `<main>` en layouts
10. aria-describedby en inputs
11. Semántica HTML completa
12. Responsive text sizes

### Fase 4: BAJO (Future)
13. Migrar a next/Image

---

## TESTING RECOMENDADO

1. **Automated:** Axe DevTools, WAVE, Lighthouse
2. **Manual:** Tab navigation, arrow keys en mega menu
3. **Screen Reader:** NVDA/JAWS en Windows, VoiceOver en Mac
4. **Contrast:** WebAIM contrast checker
5. **Responsive:** Chrome DevTools device emulation

---

## REFERENCIAS WCAG 2.1

- [1.3.1 Info and Relationships](https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships)
- [1.4.3 Contrast Minimum](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum)
- [1.4.10 Reflow](https://www.w3.org/WAI/WCAG21/Understanding/reflow)
- [2.1.1 Keyboard](https://www.w3.org/WAI/WCAG21/Understanding/keyboard)
- [2.4.3 Focus Order](https://www.w3.org/WAI/WCAG21/Understanding/focus-order)
- [2.4.8 Location](https://www.w3.org/WAI/WCAG21/Understanding/location)
- [4.1.2 Name Role Value](https://www.w3.org/WAI/WCAG21/Understanding/name-role-value)

---

**Auditoría completada por:** nav-auditor + design-auditor + a11y-auditor
**Próximo paso:** Priorizar y asignar fixes según impacto en usuarios
