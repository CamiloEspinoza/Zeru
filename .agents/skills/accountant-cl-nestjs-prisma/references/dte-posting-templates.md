# DTE Posting Templates (Chile) — referencia

## Objetivo
Definir plantillas reutilizables para traducir DTE/documentos a asientos contables sin hardcodear reglas en servicios.

## Estructura sugerida de plantilla
- `code`
- `version`
- `description`
- `activeFrom`, `activeTo`
- `conditions`
- `lines` (expresiones de débito/crédito)
- `metadata` (tax behavior, source types, validation rules)

## Plantillas base (ejemplos)

### CL_SALE_DTE_33_CASH
Venta afecta con factura electrónica (33), pago contado.

**Entrada esperada**
- netAmount
- taxAmount
- totalAmount
- cashOrBankAccountId
- revenueAccountId
- ivaDebitoAccountId

**Asiento**
- Debe: Caja/Banco = total
- Haber: Ingresos = neto
- Haber: IVA Débito Fiscal = IVA

---

### CL_SALE_DTE_33_AR
Venta afecta crédito (cuenta por cobrar).

**Asiento**
- Debe: Clientes (CxC control o auxiliar) = total
- Haber: Ingresos = neto
- Haber: IVA Débito Fiscal = IVA

---

### CL_PURCHASE_DTE_33_AP
Compra afecta recibida (proveedor).

**Asiento**
- Debe: Gasto/Inventario = neto
- Debe: IVA Crédito Fiscal = IVA
- Haber: Proveedores (CxP) = total

---

### CL_SALE_DTE_61_REVERSAL
Nota de crédito de venta (61).

**Asiento típico**
- Debe: Devoluciones/Rebajas o reversa de Ingresos = neto NC
- Debe: IVA Débito Fiscal (reversa) = IVA NC
- Haber: Clientes / Banco = total NC

---

### CL_PURCHASE_DTE_61_REVERSAL
Nota de crédito de compra (61 recibida).

**Asiento típico**
- Debe: Proveedores = total NC
- Haber: Gasto/Inventario (reversa) = neto NC
- Haber: IVA Crédito Fiscal (reversa) = IVA NC

## Validaciones mínimas por plantilla
- sum(debe) = sum(haber)
- montos no negativos
- taxAmount consistente con base/tasa (según configuración y redondeo)
- referencia obligatoria en NC/ND cuando aplique
- periodo abierto
- cuentas activas y vigentes
