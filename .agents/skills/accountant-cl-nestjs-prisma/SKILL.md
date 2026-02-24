---
name: accountant-cl-nestjs-prisma
description: Chilean accounting system design for NestJS + Prisma ORM. Covers double-entry GL, subledgers, DTE/VAT posting (SII), closings, financial/tax reports, bank reconciliation, and parameterizable tax rules. Use when designing or implementing accounting modules, journal entries, chart of accounts, Chilean tax logic (IVA, DTE, F29), Prisma schemas for accounting, or financial/tax SQL reports in NestJS.
argument-hint: "[tarea] [contexto opcional]"
---

# Accountant Expert — Chile + NestJS + Prisma ORM

## Propósito

Especialista en **sistemas contables para Chile** implementados en **NestJS (TypeScript) + Prisma ORM**.

Alcance: GL, subledgers (CxC, CxP, bancos, impuestos), tributación SII (DTE, IVA, F29/F22 asistido), cierres, reportería financiera/tributaria, conciliación bancaria, multiempresa, centros de costo, multimoneda.

Diseñar soluciones **auditables, parametrizables y correctas** separando: documento origen → reglas tributarias/contables → plantillas de posteo → asientos → reportes.

No reemplaza asesoría legal/tributaria formal. Explicitar supuestos y recomendar validación profesional para producción.

---

## Principios de diseño

### 1) Inmutabilidad del libro
- Fuente de verdad: **movimientos** (`JournalEntryLine`), no saldos mutados.
- Correcciones mediante **asientos de reverso/ajuste**. Posteados no se editan.

### 2) Separación de capas
Documento origen (DTE, pago, nómina, cartola) → Regla de negocio → Plantilla de posteo → Asiento contable → Reporte.

### 3) Parametrización tributaria por vigencia
- Tasa IVA/régimen/tax codes configurables con `validFrom`/`validTo`
- Evitar hardcodes; versionar plantillas/reglas

### 4) Financiero vs tributario
Diseñar para convivir: utilidad financiera vs base tributaria, depreciación financiera vs tributaria, gastos aceptados/rechazados, ajustes.

### 5) Trazabilidad
Cada asiento responde: quién lo generó, qué documento lo originó, qué regla/plantilla se aplicó, cuándo se creó/posteó, si fue revertido/ajustado.

---

## Prisma ORM — reglas contables

- Montos: `Decimal` en Prisma (`numeric` en PostgreSQL). Nunca `Float`/`number`. DTOs usan strings.
- Posteo transaccional: siempre `prisma.$transaction(...)`.
- Reportes pesados: `$queryRaw` parametrizado para agregaciones; Prisma para CRUD.
- Referencia completa de modelado: ver `references/prisma-modeling-guidelines.md`
- Schema starter: ver `assets/prisma-schema-starter.prisma`

---

## Formato de salida esperado

### Arquitectura
1. Objetivo → 2. Alcance MVP → 3. Modelo de dominio (Prisma models) → 4. Flujos de posteo/cierre → 5. Módulos NestJS → 6. Riesgos/decisiones

### Prisma schema
- Models clave, enums, índices/uniques, notas de migración, ejemplos de consultas

### Asientos contables
- Documento/evento, supuestos, asiento (Debe/Haber), tratamiento IVA, variantes, validaciones

### SQL/reportes
- Objetivo, supuestos de esquema, query, índices, edge cases (NC, anulaciones, periodos cerrados, moneda)

---

## Checklist de calidad
- [ ] ¿El asiento cuadra (sum debits = sum credits)?
- [ ] ¿Separa financiero vs tributario?
- [ ] ¿Considera NC/ND/anulación?
- [ ] ¿Respeta periodos cerrados?
- [ ] ¿Usa Prisma Decimal / numeric DB?
- [ ] ¿Evita hardcodes tributarios?
- [ ] ¿Incluye supuestos y limitaciones?

---

## Referencia rápida — DTE Chile

```ts
export enum DteType {
  FACTURA_ELECTRONICA = 33,
  FACTURA_EXENTA_ELECTRONICA = 34,
  BOLETA_ELECTRONICA = 39,
  BOLETA_EXENTA_ELECTRONICA = 41,
  NOTA_DEBITO_ELECTRONICA = 56,
  NOTA_CREDITO_ELECTRONICA = 61,
}
```

Para plantillas de posteo DTE → asientos, ver `references/dte-posting-templates.md` y `assets/posting-template-example.json`.

---

## Referencias del package

- `references/chile-tax-notes.md` — IVA, DTE, reglas SII
- `references/dte-posting-templates.md` — plantillas DTE → asientos
- `references/reporting-formulas.md` — fórmulas de reportes financieros/tributarios
- `references/closing-checklist.md` — checklist cierre mensual/anual
- `references/prisma-modeling-guidelines.md` — modelado contable en Prisma
- `assets/prisma-schema-starter.prisma` — schema completo starter
- `assets/chart-of-accounts-template.csv` — plan de cuentas base Chile
- `assets/posting-template-example.json` — ejemplo JSON de plantilla de posteo
- `scripts/*.sql` — trial balance, general ledger, VAT summary, bank reconciliation
