# Reporting Formulas — definiciones y criterios

## Regla general
Todos los reportes deben construirse desde movimientos posteados (`JournalEntry` + `JournalEntryLine`) y filtros de empresa/periodo.

## 1) Libro Diario
Listado cronológico de asientos posteados con detalle de líneas.
- Filtros: company, rango de fechas, sourceType, account, partner
- Incluir: entryNumber, fecha, descripción, líneas, sourceType/sourceId

## 2) Libro Mayor
Agrupa por cuenta y muestra movimientos + saldo acumulado.
Saldo depende de naturaleza de cuenta:
- Activo/Gasto: saldo = débitos - créditos
- Pasivo/Patrimonio/Ingresos: saldo = créditos - débitos

## 3) Balance de Comprobación
Por cuenta:
- saldo inicial
- débitos periodo
- créditos periodo
- saldo final
Validación global:
- total débitos periodo = total créditos periodo

## 4) Estado de Resultados (P&L)
Basado en cuentas tipo ingreso/gasto:
- Ingresos
- Costos (si se modelan por clasificación)
- Gastos operacionales
- Resultado operacional
- Otros resultados
- Resultado antes de impuestos (financiero)

## 5) Balance General
Agrupa cuentas de activo/pasivo/patrimonio y valida:
- Activo = Pasivo + Patrimonio (+ resultado acumulado según diseño)

## 6) Resumen IVA mensual
Separar:
- ventas afectas / exentas
- IVA débito fiscal
- compras afectas / exentas
- IVA crédito fiscal
- ajustes / NC/ND
No asumir F29 final: solo preparar base auditable.
