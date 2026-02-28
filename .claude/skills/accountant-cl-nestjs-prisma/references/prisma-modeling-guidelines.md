# Prisma Modeling Guidelines — contabilidad (NestJS)

## Objetivo
Reglas específicas para modelar un sistema contable en Prisma ORM. Para el schema completo, ver `assets/prisma-schema-starter.prisma`.

## 1) Dinero y decimales
- Precisión consistente: `Decimal @db.Decimal(18, 2)` para montos, `Decimal @db.Decimal(18, 6)` para tasas/FX
- En DTOs HTTP: aceptar/retornar montos como `string`; convertir con `new Prisma.Decimal(...)` en servicios
- Nunca operar montos con aritmética de `number`/`Float`

## 2) Correlativos contables
- `entryNumber` como campo propio: `@@unique([companyId, entryNumber])`
- No usar el ID como correlativo visible; el ID es interno (`cuid()`/`uuid()`)

## 3) Enums contables
Modelar como `enum` de Prisma:
- `AccountType`: ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
- `JournalEntryStatus`: DRAFT, VALIDATED, POSTED, REVERSED, VOID
- `AccountingPeriodStatus`: OPEN, SOFT_CLOSED, CLOSED, LOCKED
- `DteStatus`: DRAFT, ISSUED, RECEIVED, ACCEPTED, REJECTED, VOIDED

## 4) Auditoría contable
- Campos estándar: `createdAt`, `updatedAt`, `createdBy`, `updatedBy`
- `AuditLog` separado para eventos de alto impacto: posteo, reverso, reapertura de periodo, cambio de estado DTE
- Registrar `action`, `entityType`, `entityId`, `actorId`, `metadataJson`

## 5) Índices para queries contables reales
```
JournalEntry:      @@index([companyId, entryDate, status])
                   @@index([sourceType, sourceId])
JournalEntryLine:  @@index([accountId])
                   @@index([partnerId])
                   @@index([taxCodeId])
DteDocument:       @@index([companyId, dteType, issueDate])
                   @@index([companyId, folio])
TaxTransaction:    @@index([companyId, periodId, taxCodeId])
                   @@index([sourceType, sourceId])
AccountingPeriod:  @@index([companyId, status])
TaxCode:           @@index([companyId, kind, isActive])
```

## 6) Flujo transaccional de posteo
Siempre con `prisma.$transaction(async (tx) => { ... })`:
1. Validar que periodo esté `OPEN`
2. Validar que cuentas estén activas y vigentes
3. Crear `JournalEntry` (status: `DRAFT` o `VALIDATED`)
4. Crear `JournalEntryLine[]`
5. Validar cuadratura: `sum(debit) === sum(credit)`
6. Si procede, crear `TaxTransaction` por cada línea con `taxCodeId`
7. Marcar `status = POSTED`, setear `postedAt`
8. Registrar `AuditLog`

## 7) Relaciones clave
- `JournalEntry` ↔ `JournalEntry` (self-relation para reversos: `reversalOfEntryId` / `reversedByEntryId`)
- `DteDocument` ↔ `DteDocument` (self-relation para NC/ND: `referenceDteId`)
- `DteDocument` → `JournalEntry` (link documento → asiento generado)
- `Account` → `Account` (jerarquía: `parentAccountId`)

## 8) Reportes pesados
Usar `$queryRaw` para: trial balance, libro mayor con saldos acumulados, resúmenes IVA, conciliación bancaria.
Ver ejemplos en `scripts/*.sql`.
