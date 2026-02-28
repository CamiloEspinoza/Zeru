# Chile Tax Notes (SII / IVA / DTE) — para modelado de sistema

## Objetivo
Notas de diseño para modelar tributación chilena en un sistema contable (NestJS + Prisma), sin reemplazar asesoría profesional.

## Principios
- Parametrizar por vigencia (tasa, reglas, códigos)
- Separar documento tributario de asiento contable
- Guardar trazabilidad de fuente (SII/integración/ERP)
- Mantener clasificación de operaciones afectas/exentas/no gravadas cuando aplique

## IVA (modelo)
Diseñar una tabla/configuración de `TaxCode` con:
- `code` (ej. IVA_DEBITO_19, IVA_CREDITO_19, IVA_EXENTO)
- `kind` (IVA / retención / PPM / otro)
- `rate`
- `recoverable` (para crédito fiscal, según clasificación interna)
- `validFrom`, `validTo`
- `roundingMode`
- `jurisdiction` = CL

## DTE (mínimo)
Modelar en `DteDocument`:
- `dteType` (33, 34, 39, 41, 56, 61, etc.)
- `folio`
- `issueDate`
- `partnerId`
- `netAmount`
- `exemptAmount`
- `taxAmount`
- `totalAmount`
- `status`
- `referenceDteId` (para NC/ND)
- `sourcePayloadHash`
- `sourceSystem`

## Regla importante NC (61)
Una nota de crédito:
- debe referenciar el documento original cuando corresponda
- revierte parcial/totalmente base e IVA según el caso
- debe afectar reportes de ventas/compras e IVA del periodo correspondiente

## Financiero vs tributario
No asumir que:
- utilidad financiera = base tributaria
- depreciación financiera = tributaria
- todos los créditos fiscales son plenamente recuperables

Diseñar tablas de ajuste/conciliación tributaria si el alcance lo requiere.
