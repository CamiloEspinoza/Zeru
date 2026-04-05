# BillingAgreement + BillingConcept — Modelo de Convenios

**Fecha:** 2026-04-05
**Estado:** Borrador
**Contexto:** La exploración de FM reveló que los precios de laboratorio pertenecen a un Convenio (acuerdo comercial), no directamente a la procedencia. FM tiene 770 convenios, 3,647 precios negociados y 181 conceptos maestros (códigos FONASA). Se necesita un modelo de convenios en el módulo transversal de cobranzas.
**Spec anterior:** `2026-04-04-legal-entity-lab-origin-design.md` (actualiza secciones 4.6, 9)

---

## 1. Problema

El spec anterior simplificó los precios como `LabOriginPricing` directamente en el LabOrigin, declarando "Modelo de Convenio" fuera de alcance. La exploración real de FM reveló que:

- Los precios pertenecen a un **Convenio** (acuerdo comercial entre Citolab y una institución), no a una procedencia
- Múltiples procedencias comparten el mismo convenio (ej: MEGASALUD tiene 48 procedencias con 1 convenio)
- Existe un **catálogo maestro** de 181 conceptos de cobro (códigos FONASA) que los precios referencian
- El convenio tiene datos propios (plazo pago, día facturación, modalidad cobro, contactos, flags operativos) que estaban incorrectamente asignados a LegalEntity o LabOrigin

## 2. Decisiones de diseño

1. **BillingAgreement** como modelo del módulo transversal de cobranzas. Representa un acuerdo comercial con una persona jurídica. FK a LegalEntity. Múltiples LabOrigins pueden referenciar el mismo agreement.
2. **BillingConcept** como catálogo maestro transversal. Representa un tipo de servicio facturable con código FONASA y precio de referencia. Compartido entre todos los convenios.
3. **BillingAgreementLine** como precio negociado. Vincula un BillingAgreement con un BillingConcept, aplicando un factor/multiplicador sobre el precio de referencia.
4. **BillingContact** reemplaza a LegalEntityContact para contactos de cobranzas. Viven en el agreement, no en la entidad jurídica. LegalEntityContact se mantiene para contactos generales.
5. **LabOrigin.billingAgreementId** reemplaza la relación pricing directa. Los plazos de entrega por tipo de examen se mantienen en LabOrigin (son operativos del lab, no del convenio).
6. **Migración**: Los campos contractuales (`contractDate`, `contractActive`, `paymentTerms`, `billingDayOfMonth`) se mueven de LegalEntity/LabOrigin a BillingAgreement. `LabOriginPricing` se reemplaza por `BillingAgreementLine`.

## 3. Datos FM de referencia

### 3.1 Estadísticas

| Métrica | Valor |
|---------|-------|
| Total convenios | 770 |
| Convenios con 1 procedencia | 594 (77%) |
| Convenios compartidos (2+ procedencias) | 45 (algunos hasta 48) |
| Convenios activos | ~388 |
| Precios negociados (CDC) | 3,647 |
| Promedio precios por convenio | 4.6 |
| Máximo precios por convenio | 23 |
| Conceptos maestros (catálogo) | 181 |
| Códigos FONASA base | 13 |
| Grupos/bundles de conceptos | 760 |

### 3.2 Relación Convenio → Procedencias (ejemplos)

| Convenio | Nº Procedencias |
|----------|-----------------|
| LABORATORIO MEGASALUD S.A. | 48 |
| VIDAINTEGRA | 27 |
| INTEGRAMEDICA | 21 |
| BIONET S.A. | 20 |

### 3.3 Cadena de relaciones en FM

```
LegalEntity (Institución, RUT)
    └── 1:N → BillingAgreement (Convenio, __pk_convenio)
                  └── 1:N → BillingAgreementLine (CDC, Convenio_fk)
                                └── N:1 → BillingConcept (catálogo, Concepto de cobro_fk)
                  └── 1:N → LabOrigin (Procedencia, _fk_convenio)
```

### 3.4 Códigos FONASA base

| Código | Descripción |
|--------|-------------|
| 0801001 | PAPANICOLAOU |
| 0801002 | CITOLOGÍA MISCELÁNEA |
| 0801003 | MICROSCOPÍA ELECTRÓNICA |
| 0801004 | ESTUDIO INMUNOHISTOQUÍMICO |
| 0801005 | ESTUDIO HISTOQUÍMICO |
| 0801006 | BIOPSIA RÁPIDA |
| 0801007 | ESTUDIO SERIADO |
| 0801008 | ESTUDIO HISTOLÓGICO |
| 0801009 | NECROPSIA ADULTO/NIÑO |
| 0801010 | NECROPSIA FETO/RECIÉN NACIDO |
| 0801011 | PCR TIEMPO REAL MARCADORES TUMORALES |
| 0801012 | TÉC INMUNOHISTOQUÍMICA (ALK-PDL1-ROS1) |
| 0801013 | HIBRIDACIÓN IN SITU |
| 0306123 | PCR HPV / TIPIFICACIÓN |

## 4. Modelo de datos

### 4.1 Enums nuevos

```prisma
enum BillingAgreementStatus {
  ACTIVE
  EXPIRED
  DRAFT

  @@schema("public")
}

enum BillingModality {
  MONTHLY_SETTLEMENT
  FONASA_VOUCHER
  ISAPRE_VOUCHER
  CASH
  CHECK
  BANK_TRANSFER
  OTHER

  @@schema("public")
}
```

### 4.2 BillingConcept (catálogo maestro — transversal)

```prisma
model BillingConcept {
  id               String   @id @default(uuid())
  code             String
  name             String
  description      String?
  referencePrice   Decimal  @db.Decimal(18, 2)
  currency         String   @default("CLP")

  isActive         Boolean  @default(true)
  deletedAt        DateTime?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  tenantId         String
  tenant           Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  agreementLines   BillingAgreementLine[]

  @@unique([tenantId, code])
  @@index([tenantId])
  @@schema("public")
  @@map("billing_concepts")
}
```

**Campos clave:**
- `code`: código FONASA o identificador interno (ej: "0801001", "(FNS 3) 0801004"). Unique por tenant.
- `name`: nombre descriptivo (ej: "PAPANICOLAOU", "ESTUDIO INMUNOHISTOQUÍMICO").
- `referencePrice`: precio de lista/referencia. Los convenios aplican un factor sobre este precio.
- 181 registros iniciales desde FM. Incluye variantes por tier FONASA (FNS 1/2/3), particular, etc.

### 4.3 BillingAgreement (convenio — módulo cobranzas)

```prisma
model BillingAgreement {
  id                     String                  @id @default(uuid())
  code                   String
  name                   String

  legalEntityId          String
  legalEntity            LegalEntity             @relation(fields: [legalEntityId], references: [id], onDelete: Cascade)

  status                 BillingAgreementStatus  @default(ACTIVE)
  contractDate           DateTime?
  effectiveFrom          DateTime?
  effectiveTo            DateTime?

  paymentTerms           PaymentTerms            @default(NET_30)
  customPaymentDays      Int?
  billingDayOfMonth      Int?
  isMonthlySettlement    Boolean                 @default(false)
  billingModalities      BillingModality[]

  examTypes              String[]
  operationalFlags       Json?

  notes                  String?
  isActive               Boolean                 @default(true)
  deletedAt              DateTime?
  createdAt              DateTime                @default(now())
  updatedAt              DateTime                @updatedAt

  tenantId               String
  tenant                 Tenant                  @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  lines                  BillingAgreementLine[]
  contacts               BillingContact[]
  labOrigins             LabOrigin[]

  @@unique([tenantId, code])
  @@index([tenantId])
  @@index([legalEntityId])
  @@schema("public")
  @@map("billing_agreements")
}
```

**Campos clave:**
- `code`: código del convenio en FM (ej: "ALM", "SVBCH"). Unique por tenant.
- `name`: nombre de la institución del convenio (suele coincidir con LegalEntity.legalName).
- `legalEntityId`: FK a la persona jurídica. N:1 — una LE puede tener múltiples agreements (7 casos en FM).
- `paymentTerms` + `billingDayOfMonth`: migrados desde LegalEntity — pertenecen al acuerdo comercial.
- `billingModalities`: array de enum (LIQUIDACIÓN MENSUAL, BONOS FONASA, etc.).
- `examTypes`: array de strings ("BIOPSIA", "PAP") — qué tipos de examen cubre este convenio.
- `operationalFlags`: JSON con flags booleanos (registro de bonos, carga diaria, envío desfasado). JSON porque son muchos flags con baja probabilidad de query.
- `contractDate`: fecha del contrato (migrada desde LabOrigin).
- `effectiveFrom`/`effectiveTo`: vigencia del convenio.

### 4.4 BillingAgreementLine (precio negociado)

```prisma
model BillingAgreementLine {
  id                  String           @id @default(uuid())

  billingAgreementId  String
  billingAgreement    BillingAgreement @relation(fields: [billingAgreementId], references: [id], onDelete: Cascade)

  billingConceptId    String
  billingConcept      BillingConcept   @relation(fields: [billingConceptId], references: [id], onDelete: Restrict)

  factor              Decimal          @default(1) @db.Decimal(8, 4)
  negotiatedPrice     Decimal          @db.Decimal(18, 2)
  referencePrice      Decimal?         @db.Decimal(18, 2)
  currency            String           @default("CLP")

  isActive            Boolean          @default(true)
  deletedAt           DateTime?
  createdAt           DateTime         @default(now())
  updatedAt           DateTime         @updatedAt

  tenantId            String

  @@unique([billingAgreementId, billingConceptId])
  @@index([billingAgreementId])
  @@index([billingConceptId])
  @@index([tenantId])
  @@schema("public")
  @@map("billing_agreement_lines")
}
```

**Campos clave:**
- `billingConceptId`: FK al catálogo maestro. Unique por agreement — un convenio tiene un precio por concepto.
- `factor`: multiplicador sobre el precio de referencia (ej: 0.75 = 25% descuento).
- `negotiatedPrice`: precio final negociado (= referencePrice × factor, pero almacenado porque FM lo calcula con precisión variable).
- `referencePrice`: snapshot del precio de referencia al momento de la negociación.

### 4.5 BillingContact (contacto de cobranzas en el convenio)

```prisma
model BillingContact {
  id                    String           @id @default(uuid())
  name                  String
  role                  String?
  email                 String?
  phone                 String?
  mobile                String?
  isPrimary             Boolean          @default(false)
  notes                 String?
  isActive              Boolean          @default(true)
  deletedAt             DateTime?
  createdAt             DateTime         @default(now())
  updatedAt             DateTime         @updatedAt

  billingAgreementId    String
  billingAgreement      BillingAgreement @relation(fields: [billingAgreementId], references: [id], onDelete: Cascade)
  tenantId              String

  @@index([billingAgreementId])
  @@index([tenantId])
  @@schema("public")
  @@map("billing_contacts")
}
```

**Mapeo FM:** Portal `CONTACTOS Cobranzas` en el layout `CONVENIOS Conceptos de cobro*`. Misma estructura que LegalEntityContact pero vinculado al BillingAgreement.

### 4.6 Cambios a modelos existentes

#### LabOrigin — agregar billingAgreementId, remover campos de convenio

```prisma
model LabOrigin {
  // ... campos existentes ...

  billingAgreementId     String?
  billingAgreement       BillingAgreement? @relation(fields: [billingAgreementId], references: [id], onDelete: SetNull)

  // REMOVER estos campos (migran a BillingAgreement):
  // contractDate, contractActive, agreementDate
  // lastAddendumNumber, lastAddendumDate, lastAddendumDetail

  // MANTENER estos (son operativos del lab):
  // deliveryDaysBiopsy, deliveryDaysPap, deliveryDaysCytology, etc.
  // sampleReceptionMode, reportDeliveryMethods, FTP credentials
}
```

#### LegalEntity — remover campos de convenio

```prisma
model LegalEntity {
  // ... campos existentes ...

  // REMOVER estos (migran a BillingAgreement):
  // paymentTerms, customPaymentDays, billingDayOfMonth

  // AGREGAR relación:
  billingAgreements    BillingAgreement[]
}
```

#### LabOriginPricing — ELIMINAR

Se reemplaza completamente por `BillingAgreementLine`. Los precios pertenecen al convenio, no a la procedencia. La cadena es: `LabOrigin.billingAgreementId → BillingAgreement → BillingAgreementLine`.

#### Tenant — agregar relaciones

```prisma
model Tenant {
  // ... existentes ...
  billingAgreements   BillingAgreement[]
  billingConcepts     BillingConcept[]
}
```

## 5. Transformer

### 5.1 Nuevo: ConvenioTransformer

Servicio dedicado para el layout `CONVENIOS Conceptos de cobro*`:

```typescript
@Injectable()
export class ConvenioTransformer {
  readonly database = 'BIOPSIAS';
  readonly layout = 'CONVENIOS Conceptos de cobro*';

  extractBillingAgreement(record: FmRecord): ExtractedBillingAgreement { ... }
  extractBillingContacts(record: FmRecord): ExtractedContact[] { ... }
  extractPricingLines(record: FmRecord): ExtractedPricingLine[] { ... }
}
```

### 5.2 Mapeo FM → Zeru: BillingAgreement

| FM (CONVENIOS Conceptos de cobro*) | Zeru |
|----|------|
| `__pk_convenio` | Usado como clave de dedup y para FmSyncRecord |
| `Código` | `code` |
| `Nombre Institución` | `name` |
| `Rut` | Lookup → `legalEntityId` (buscar LegalEntity por RUT) |
| `Fecha Contrato` | `contractDate` |
| `PlazoPago` | `paymentTerms` (parsear: 30→NET_30) |
| `Día de Facturación` | `billingDayOfMonth` (parsear: "10 c/mes"→10) |
| `Liquidación Mensual` | `isMonthlySettlement` ("SI"→true) |
| `Modalidades Cobro` | `billingModalities` (parsear multivalue) |
| `Activo` | `isActive` ("SI"→true) |
| `Exámenes` | `examTypes` (parsear checkbox: "BIOPSIA\rPAP") |
| `Estado Revisión Convenio` | `status` (mapear a enum) |
| `Registro de documentos...`, `Envío desfasado...`, etc. | `operationalFlags` (JSON) |

### 5.3 Mapeo FM → Zeru: BillingAgreementLine

| FM (portal portal_cdc / layout conceptos de cobro procedencia) | Zeru |
|----|------|
| `Concepto de cobro_fk` | Lookup → `billingConceptId` (buscar BillingConcept por FM recordId) |
| `Factor` | `factor` |
| `Valor` | `negotiatedPrice` |
| `Valor Referencia` | `referencePrice` |
| `Descripción` | Ignorar (viene del BillingConcept) |

### 5.4 Mapeo FM → Zeru: BillingConcept (catálogo maestro)

| FM (Conceptos de cobro (CDC)*) | Zeru |
|----|------|
| `recordId` | Usado como clave para el FK mapping |
| `Concepto` | `name` |
| `Decripción` | `description` |
| `Valor` | `referencePrice` |
| `Código` | `code` |

### 5.5 Cambios al ProcedenciasTransformer

- Ya no extrae pricing (se elimina `extractPricing` y `extractPricingFromRecord`)
- `extractLabOrigin` no incluye campos contractuales (migrados a BillingAgreement)
- El campo `_fk_convenio` se usa para vincular `LabOrigin.billingAgreementId`

## 6. Import unificado: "Importar Convenios"

El import ya no es solo "Importar Procedencias" — es un import integral que trae todos los datos relacionados desde FM. Un solo endpoint orquesta la carga completa.

### 6.1 Endpoint

```
POST /filemaker/import/convenios
```

Retorna HTTP 202 (background). Reemplaza al anterior `POST /filemaker/import/procedencias`.

### 6.2 Orden de import (dependencias)

```
Paso 1: BillingConcept (catálogo maestro, sin deps)
  └── Layout: Conceptos de cobro (CDC)*
  └── 181 registros, dedup por [tenantId, code]

Paso 2: LegalEntity (personas jurídicas, sin deps)
  └── Layout: Procedencias* (campos INSTITUCIONES::*)
  └── Dedup por [tenantId, rut]

Paso 3: BillingAgreement (convenios, requiere LegalEntity)
  └── Layout: CONVENIOS Conceptos de cobro*
  └── 770 registros, dedup por [tenantId, code]
  └── Vincula a LegalEntity por RUT

Paso 4: BillingAgreementLine (precios, requiere Agreement + Concept)
  └── Portal portal_cdc del layout CONVENIOS Conceptos de cobro*
  └── 3,647 registros, dedup por [billingAgreementId, billingConceptId]
  └── FK mapping: Concepto de cobro_fk → BillingConcept (por FM recordId)

Paso 5: BillingContact (contactos cobranzas, requiere Agreement)
  └── Portal CONTACTOS Cobranzas del layout CONVENIOS Conceptos de cobro*

Paso 6: LabOrigin (procedencias, requiere Agreement)
  └── Layout: Procedencias*
  └── 862 registros, dedup por [tenantId, code]
  └── Vincula billingAgreementId via _fk_convenio → BillingAgreement.code
```

### 6.3 Deduplicación

| Entidad | Clave unique | Estrategia |
|---------|-------------|------------|
| BillingConcept | `[tenantId, code]` | Upsert (code = `Concepto` de FM) |
| LegalEntity | `[tenantId, rut]` | Merge (solo non-null) |
| BillingAgreement | `[tenantId, code]` | Upsert |
| BillingAgreementLine | `[billingAgreementId, billingConceptId]` | Upsert |
| BillingContact | Delete + recreate por agreement | Replace |
| LabOrigin | `[tenantId, code]` | Merge (solo non-null) |

### 6.4 FK mapping entre FM recordIds y Zeru UUIDs

Durante el import se necesitan 3 mapas de traducción:

```
fmConceptRecordId → billingConceptId (UUID)
  Para: BillingAgreementLine.billingConceptId
  Fuente: FM Concepto de cobro_fk → Zeru BillingConcept

fmConvenioCode → billingAgreementId (UUID)  
  Para: LabOrigin.billingAgreementId
  Fuente: FM _fk_convenio → Zeru BillingAgreement

rut → legalEntityId (UUID)
  Para: BillingAgreement.legalEntityId
  Fuente: FM Rut → Zeru LegalEntity
```

### 6.5 Migración de datos existentes

Si ya hay datos importados con el modelo anterior (LabOriginPricing):

1. Ejecutar el nuevo import unificado (crea BillingConcept, BillingAgreement, Lines, Contacts)
2. La migración Prisma elimina LabOriginPricing y campos obsoletos
3. Los LabOrigins existentes se actualizan con `billingAgreementId` durante el import
4. LegalEntityContact de tipo cobranzas migra a BillingContact

## 7. Soft delete

Registrar en `SOFT_DELETABLE_MODELS`:
- `billingAgreement`
- `billingAgreementLine`
- `billingContact`
- `billingConcept`

## 8. Webhook triggers

### 8.1 Mapa completo de layouts y triggers

| Layout FM | Trigger | Acción webhook | Entidades afectadas en Zeru |
|-----------|---------|--------|-----------------------------|
| `Procedencias*` | OnRecordCommit | `create` / `update` | LegalEntity + LabOrigin |
| `Procedencias*` | Antes de Delete | `delete` | LabOrigin (soft-delete) |
| `FICHA INSTITUCION COBRANZAS` | OnRecordCommit | `update` | LegalEntity (campos directos) |
| `CONVENIOS Conceptos de cobro*` | OnRecordCommit | `create` / `update` | BillingAgreement + BillingContact |
| `CONVENIOS Conceptos de cobro*` | Antes de Delete | `delete` | BillingAgreement (soft-delete) |
| `Conceptos de cobro (CDC)*` | OnRecordCommit | `create` / `update` | BillingConcept |
| `conceptos de cobro procedencia` | OnRecordCommit | `create` / `update` | BillingAgreementLine |

### 8.2 Scripts FM a crear/modificar

| Script | Layout | Descripción |
|--------|--------|-------------|
| `Webhook - Notificar Zeru` | (base) | Script genérico que envía POST al webhook de Zeru |
| `Webhook - Procedencias OnCommit` | `Procedencias*` | Ya existe — detecta create/update |
| `Webhook - Instituciones OnCommit` | `FICHA INSTITUCION COBRANZAS` | Ya existe — actualiza LegalEntity |
| `Webhook - Convenios OnCommit` | `CONVENIOS Conceptos de cobro*` | **NUEVO** — notifica cambios en convenios |
| `Webhook - CDC OnCommit` | `Conceptos de cobro (CDC)*` | **NUEVO** — notifica cambios en catálogo |
| `Webhook - Pricing OnCommit` | `conceptos de cobro procedencia` | **NUEVO** — notifica cambios en precios |

### 8.3 Payload para cada layout

Todos usan el mismo formato:
```json
{
  "database": "BIOPSIAS",
  "layout": "<nombre exacto del layout>",
  "recordId": "<Get(RecordID)>",
  "action": "create" | "update" | "delete"
}
```

### 8.4 Procesamiento en Zeru por layout

| Layout recibido | Handler en FmSyncService |
|-----------------|--------------------------|
| `Procedencias*` | `processUnknownRecord` (composite: LE + LabOrigin) |
| `FICHA INSTITUCION COBRANZAS` | `processInstitutionWebhook` (actualiza LE por RUT) |
| `CONVENIOS Conceptos de cobro*` | **NUEVO** `processConvenioWebhook` — lee convenio FM, upsert BillingAgreement + Lines + Contacts |
| `Conceptos de cobro (CDC)*` | **NUEVO** `processBillingConceptWebhook` — lee CDC FM, upsert BillingConcept |
| `conceptos de cobro procedencia` | **NUEVO** `processPricingLineWebhook` — lee pricing FM, upsert BillingAgreementLine |

### 8.5 Checklist de configuración en FM

**Triggers existentes (ya documentados):**
- [ ] `Procedencias*` → OnRecordCommit → `Webhook - Procedencias OnCommit`
- [ ] `FICHA INSTITUCION COBRANZAS` → OnRecordCommit → `Webhook - Instituciones OnCommit`
- [ ] Scripts de eliminación de procedencias → webhook antes de Delete

**Triggers nuevos (requieren configuración):**
- [ ] Crear script `Webhook - Convenios OnCommit`
- [ ] `CONVENIOS Conceptos de cobro*` → OnRecordCommit → `Webhook - Convenios OnCommit`
- [ ] Crear script `Webhook - CDC OnCommit`
- [ ] `Conceptos de cobro (CDC)*` → OnRecordCommit → `Webhook - CDC OnCommit`
- [ ] Crear script `Webhook - Pricing OnCommit`
- [ ] `conceptos de cobro procedencia` → OnRecordCommit → `Webhook - Pricing OnCommit`
- [ ] Auditar scripts que eliminan convenios → agregar webhook antes de delete
- [ ] Probar: editar convenio → verificar BillingAgreement actualizado en Zeru
- [ ] Probar: agregar precio a convenio → verificar BillingAgreementLine creado en Zeru
- [ ] Probar: modificar concepto maestro → verificar BillingConcept actualizado en Zeru

### 8.6 Script FM genérico para nuevos triggers

Todos los nuevos scripts siguen el mismo patrón del script base existente. Solo cambia el `$layout`:

```filemaker
# Webhook - Convenios OnCommit
Set Variable [ $param ; Value:
  JSONSetElement ( "{}" ;
    [ "database" ; Get ( FileName ) ; JSONString ] ;
    [ "layout" ; "CONVENIOS Conceptos de cobro*" ; JSONString ] ;
    [ "recordId" ; Get ( RecordID ) ; JSONString ] ;
    [ "action" ; If ( /* detect create vs update */ ; "create" ; "update" ) ; JSONString ]
  )
]
Perform Script [ "Webhook - Notificar Zeru" ; Parameter: $param ]
```

## 9. Fuera de alcance

- UI de gestión de BillingAgreement (spec separado)
- Modelo de Grupo CDC / Bundles (760 registros — se implementa cuando se necesite para liquidaciones)
- Liquidaciones (módulo cobranzas futuro — usará BillingAgreement + BillingAgreementLine)
- Facturación DTE (usará LegalEntity + BillingAgreement)
