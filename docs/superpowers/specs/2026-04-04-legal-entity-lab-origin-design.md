# Personas Jurídicas y Procedencias de Laboratorio

**Fecha:** 2026-04-04
**Estado:** Aprobado
**Contexto:** Citolab usa FileMaker con 862 procedencias y 770 instituciones. Zeru necesita modelos normalizados para personas jurídicas (transversal) y procedencias de laboratorio (módulo lab), con transformer bidireccional desde FM.

---

## 1. Problema

FileMaker mezcla datos de persona jurídica (RUT, razón social) con datos operativos de laboratorio (plazos, entrega de informes, precios) en una sola tabla `Procedencias`. No hay modelo de cliente en Zeru. El módulo de cobranzas, facturación y laboratorio necesitan una entidad jurídica compartida.

## 2. Decisiones de diseño

1. **LegalEntity** como modelo transversal (módulo business). Representa una persona jurídica con la que se hacen transacciones. Puede ser cliente, proveedor, o ambos.
2. **LabOrigin** como modelo del módulo laboratorio. Representa una procedencia (origen de muestras). Se relaciona N:1 con LegalEntity — una persona jurídica puede tener múltiples procedencias.
3. **legalEntityId nullable en LabOrigin** — 31% de las procedencias FM no tienen institución asociada (consultas individuales). Se vinculan después.
4. **Subprocedencias como self-reference** — LabOrigin tiene FK a sí mismo para modelar jerarquía padre→hijo (Hospital → Pabellón, Centro Médico).
5. **Composite Transformer** — un registro FM Procedencias genera 2 entidades Zeru (LegalEntity + LabOrigin). Deduplicación de LegalEntity por RUT.
6. **Cambio a FmSyncRecord** — agregar `entityType` al unique constraint para soportar mapeo 1→N.

## 3. Datos FM de referencia

### 3.1 Estadísticas

| Métrica | Valor |
|---------|-------|
| Total procedencias | 862 |
| Activas | 388 (45%) |
| Con RUT institucional | 592 (69%) |
| Sin RUT (consultas individuales) | 270 (31%) |
| Subprocedencias | 148 (17%) |
| Instituciones únicas | 770 |
| Precios por convenio | 3,647 |
| Categorías | Consulta (31%), Centro Médico (37%), Clínica/Hospital (17%), Laboratorio (9%) |
| Convenios | Convenio (54%), Pago Directo (29%) |

### 3.2 Relación N:1 confirmada

| Institución | Nº Procedencias |
|------------|-----------------|
| LABORATORIO MEGASALUD S.A. | 42 |
| OMESA S.A. | 27 |
| BIONET S.A. | 20 |
| LABORATORIO VIDA TEST LTDA | 7 |
| SANALAB S.A. | 5 |

### 3.3 Problemas de calidad de datos

- `Activo`: 4 variantes de texto ("SI", "Si", "No (por que ya no envian examenes)", "No (por no haber enviado examenes nunca)")
- `modalidad_pago`: 61+ variantes de texto libre
- `VIA ENTREGA INFORMES`: valores concatenados sin separador consistente ("WEBFTP", "FTPWEB")
- `tipo_examenes`: multivalue separado por `\r`, incluye valor espurio "hotmail.com"
- Campos numéricos con decimales de punto flotante (ej: 44931.99999904)
- FTP credentials en texto plano
- Campos con punto en nombre (`A.PATERNO`) no buscables via Data API

## 4. Modelo de datos

### 4.1 Enums

```prisma
enum PaymentTerms {
  IMMEDIATE
  NET_15
  NET_30
  NET_45
  NET_60
  NET_90
  CUSTOM

  @@schema("public")
}

enum BankAccountType {
  CHECKING
  SAVINGS
  VISTA
  OTHER

  @@schema("public")
}

enum LabOriginCategory {
  CONSULTA
  CENTRO_MEDICO
  CLINICA_HOSPITAL
  LABORATORIO
  OTRO

  @@schema("public")
}

enum SampleReceptionMode {
  PRESENCIAL
  COURIER
  AMBAS

  @@schema("public")
}

enum ReportDeliveryMethod {
  WEB
  IMPRESO
  FTP
  EMAIL

  @@schema("public")
}
```

### 4.2 LegalEntity (persona jurídica — transversal)

```prisma
model LegalEntity {
  id                String       @id @default(uuid())

  rut               String
  legalName         String
  tradeName         String?
  businessActivity  String?

  isClient          Boolean      @default(false)
  isSupplier        Boolean      @default(false)

  street            String?
  streetNumber      String?
  unit              String?
  commune           String?
  city              String?

  email             String?
  phone             String?
  website           String?

  paymentTerms      PaymentTerms @default(NET_30)
  customPaymentDays Int?
  billingDayOfMonth Int?

  isActive          Boolean      @default(true)
  deletedAt         DateTime?
  createdAt         DateTime     @default(now())
  updatedAt         DateTime     @updatedAt

  tenantId          String
  tenant            Tenant       @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  contacts          LegalEntityContact[]
  bankAccounts      LegalEntityBankAccount[]
  labOrigins        LabOrigin[]

  @@unique([tenantId, rut])
  @@index([tenantId])
  @@index([tenantId, isClient])
  @@index([tenantId, isSupplier])
  @@schema("public")
  @@map("legal_entities")
}
```

**Campos clave:**
- `rut`: normalizado sin puntos ni guión (ej: `768765432`). Unique por tenant. Formateado en UI.
- `isClient` + `isSupplier`: no mutuamente excluyentes. Una entidad puede ser ambas.
- `paymentTerms`: enum con los plazos comunes en Chile. `CUSTOM` + `customPaymentDays` para excepciones.
- `billingDayOfMonth`: día del mes en que se emite factura (1-28). Null = sin restricción.
- `businessActivity`: giro, requerido por SII para emisión de DTE.
- Dirección con `commune` (concepto chileno, requerido por SII).

### 4.3 LegalEntityContact

```prisma
model LegalEntityContact {
  id              String   @id @default(uuid())
  name            String
  role            String?
  email           String?
  phone           String?
  mobile          String?
  isPrimary       Boolean  @default(false)
  notes           String?
  isActive        Boolean  @default(true)
  deletedAt       DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  legalEntityId   String
  legalEntity     LegalEntity @relation(fields: [legalEntityId], references: [id], onDelete: Cascade)
  tenantId        String

  @@index([legalEntityId])
  @@index([tenantId])
  @@schema("public")
  @@map("legal_entity_contacts")
}
```

**Mapeo FM:** Portal `CONTACTOS Cobranzas` en Procedencias → `LegalEntityContact` con datos de Nombre, Apellido (concatenados), Cargo, Email, Tel Fijo, Tel Celular.

### 4.4 LegalEntityBankAccount

```prisma
model LegalEntityBankAccount {
  id              String          @id @default(uuid())
  bankName        String
  accountType     BankAccountType
  accountNumber   String
  holderName      String
  holderRut       String?
  isPrimary       Boolean         @default(false)
  isActive        Boolean         @default(true)
  deletedAt       DateTime?
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  legalEntityId   String
  legalEntity     LegalEntity     @relation(fields: [legalEntityId], references: [id], onDelete: Cascade)
  tenantId        String

  @@index([legalEntityId])
  @@index([tenantId])
  @@schema("public")
  @@map("legal_entity_bank_accounts")
}
```

**Nota:** No existe en FM — se crea vacío. Los datos bancarios se cargan manualmente en Zeru. `holderRut` permite titular distinto a la entidad (representante legal, empresa relacionada).

### 4.5 LabOrigin (procedencia de laboratorio)

```prisma
model LabOrigin {
  id                         String              @id @default(uuid())
  code                       String
  name                       String
  category                   LabOriginCategory   @default(OTRO)

  legalEntityId              String?
  legalEntity                LegalEntity?        @relation(fields: [legalEntityId], references: [id], onDelete: SetNull)

  parentId                   String?
  parent                     LabOrigin?          @relation("LabOriginHierarchy", fields: [parentId], references: [id], onDelete: SetNull)
  children                   LabOrigin[]         @relation("LabOriginHierarchy")

  street                     String?
  streetNumber               String?
  unit                       String?
  commune                    String?
  city                       String?
  phone                      String?
  email                      String?

  sampleReceptionMode        SampleReceptionMode @default(PRESENCIAL)
  reportDeliveryMethods      ReportDeliveryMethod[]

  deliveryDaysBiopsy         Int?
  deliveryDaysPap            Int?
  deliveryDaysCytology       Int?
  deliveryDaysIhc            Int?
  deliveryDaysDefault        Int?

  encryptedFtpHost           String?
  encryptedFtpUser           String?
  encryptedFtpPassword       String?
  ftpPath                    String?

  criticalNotificationEmails String[]
  sendsQualityReports        Boolean             @default(false)

  contractDate               DateTime?
  notes                      String?
  isActive                   Boolean             @default(true)
  deletedAt                  DateTime?
  createdAt                  DateTime            @default(now())
  updatedAt                  DateTime            @updatedAt

  tenantId                   String
  tenant                     Tenant              @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  pricing                    LabOriginPricing[]

  @@unique([tenantId, code])
  @@index([tenantId])
  @@index([tenantId, category])
  @@index([tenantId, isActive])
  @@index([legalEntityId])
  @@schema("public")
  @@map("lab_origins")
}
```

**Campos clave:**
- `code`: `codigo_unico` de FM (ej: "GJ", "VJN"). Unique por tenant.
- `legalEntityId` nullable: 31% de procedencias no tienen institución.
- `parentId`: self-reference para subprocedencias (148 registros en FM). Ej: "HOSPITAL DEL TRABAJADOR" es padre de "PABELLÓN" y "CENTRO MÉDICO".
- `reportDeliveryMethods`: array de enum PostgreSQL. FM usa checkbox concatenado ("WEBFTP"), se parsea a array `['WEB', 'FTP']`.
- Plazos por tipo de examen como campos explícitos (no JSON) — son tipos bien definidos en Citolab.
- FTP con prefijo `encrypted*` — patrón existente del proyecto. Se encripta al importar con `EncryptionService`.
- `criticalNotificationEmails`: array. FM tiene ~15 campos de email para notificaciones, se consolidan en un array.

### 4.6 LabOriginPricing

```prisma
model LabOriginPricing {
  id              String   @id @default(uuid())
  billingConcept  String
  description     String?
  basePrice       Decimal  @db.Decimal(18, 2)
  referencePrice  Decimal? @db.Decimal(18, 2)
  multiplier      Decimal  @default(1) @db.Decimal(8, 4)
  isActive        Boolean  @default(true)
  deletedAt       DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  labOriginId     String
  labOrigin       LabOrigin @relation(fields: [labOriginId], references: [id], onDelete: Cascade)
  tenantId        String

  @@unique([labOriginId, billingConcept])
  @@index([labOriginId])
  @@index([tenantId])
  @@schema("public")
  @@map("lab_origin_pricing")
}
```

**Mapeo FM:** `conceptos de cobro procedencia` (3,647 registros). `basePrice` = `Valor` (precio negociado), `referencePrice` = `Valor Referencia` (precio catálogo), `multiplier` = `Factor` (ratio descuento/recargo).

## 5. Transformer

### 5.1 Patrón: Composite Transformer

Un registro FM `Procedencias*` genera 2 entidades Zeru. Se implementa como un servicio que orquesta dos transformers individuales:

```typescript
@Injectable()
export class ProcedenciasTransformer {
  readonly database = 'BIOPSIAS';
  readonly layout = 'Procedencias*';

  extractLegalEntity(record: FmRecord): CreateLegalEntityDto { ... }
  extractLabOrigin(record: FmRecord, legalEntityId: string): CreateLabOriginDto { ... }
  extractContacts(record: FmRecord): CreateContactDto[] { ... }
  extractPricing(record: FmRecord): CreatePricingDto[] { ... }

  legalEntityToFm(entity: LegalEntity): Record<string, unknown> { ... }
  labOriginToFm(origin: LabOrigin): Record<string, unknown> { ... }
}
```

No se modifica la interfaz base `FmTransformer` (YAGNI). El composite es una clase de servicio específica para el caso Procedencias.

### 5.2 Deduplicación de LegalEntity

Durante import:
1. Pre-cargar todos los LegalEntity existentes del tenant en `Map<rut, id>`
2. Para cada procedencia FM: extraer RUT → buscar en cache → reusar o crear
3. Si no hay RUT (31%): crear LabOrigin sin LegalEntity (`legalEntityId: null`)

### 5.3 FmSyncRecord — 2 registros por procedencia

```
FM Procedencias* recordId=456
  → FmSyncRecord(entityType: "legal-entity", entityId: "uuid-le-123")
  → FmSyncRecord(entityType: "lab-origin", entityId: "uuid-lo-789")
```

**Cambio requerido al schema:** El unique constraint `[tenantId, fmDatabase, fmLayout, fmRecordId]` debe incluir `entityType`:

```prisma
// ANTES:
@@unique([tenantId, fmDatabase, fmLayout, fmRecordId])
// DESPUÉS:
@@unique([tenantId, fmDatabase, fmLayout, fmRecordId, entityType])
```

### 5.4 Mapeo de campos FM → Zeru

#### LegalEntity (desde campos `INSTITUCIONES::*`)

| FM | Zeru |
|----|------|
| `INSTITUCIONES::Rut` | `rut` (normalizar: quitar puntos, trim) |
| `INSTITUCIONES::Razón Social` | `legalName` |
| `INSTITUCIONES::PlazoPago` | `paymentTerms` (30→NET_30, etc.) |
| `INSTITUCIONES::Día de Facturación` | `billingDayOfMonth` (parsear "10 c/mes"→10) |
| `INSTITUCIONES::Email encargado cuentas médicas` | `email` |

#### LabOrigin (desde campos propios de procedencia)

| FM | Zeru |
|----|------|
| `codigo_unico` | `code` |
| `nombre_procedencia` | `name` |
| `Categoria` | `category` (enum: "Consulta"→CONSULTA, "Centro Médico"→CENTRO_MEDICO, etc.) |
| `calle` | `street` |
| `numero` | `streetNumber` |
| `oficina` | `unit` |
| `comuna` | `commune` |
| `ciudad` | `city` |
| `modalidad_recepcion _examenes` | `sampleReceptionMode` (enum) |
| `VIA ENTREGA INFORMES` | `reportDeliveryMethods` (parsear "WEBFTP"→[WEB, FTP]) |
| `PLAZO BIOPSIAS` | `deliveryDaysBiopsy` |
| `PLAZO PAP` | `deliveryDaysPap` |
| `PLAZO THIN PREP` | `deliveryDaysCytology` |
| `FTP Servidor` | `encryptedFtpHost` (encriptar) |
| `FTP Usuario` | `encryptedFtpUser` (encriptar) |
| `FTP Constraseña` | `encryptedFtpPassword` (encriptar) |
| `FTP Path` | `ftpPath` |
| `email_receptor_critico_*` (6+ campos) | `criticalNotificationEmails` (consolidar en array) |
| `ENVÍO INFORMES CALIDAD` | `sendsQualityReports` ("SI"→true) |
| `FECHA FIRMA CONTRATO` | `contractDate` |
| `Activo` | `isActive` ("SI"/"Si"→true, resto→false) |

#### Portal CONTACTOS Cobranzas → LegalEntityContact

| FM Portal | Zeru |
|-----------|------|
| `Nombre` + `Apellido` | `name` (concatenar) |
| `Cargo` | `role` |
| `Email` | `email` |
| `Tel Fijo` | `phone` |
| `Tel Celular` | `mobile` |

#### Portal conceptos de cobro → LabOriginPricing

| FM | Zeru |
|----|------|
| `Código` / `Concepto de cobro_fk` | `billingConcept` |
| `Descripción` | `description` |
| `Valor` | `basePrice` |
| `Valor Referencia` | `referencePrice` |
| `Factor` | `multiplier` |

### 5.5 Campos FM de solo lectura (no incluir en toFm)

- Campos calculados: `procedencias_subprocedencias`, `Nº total biopsias`
- Campos summary: `_TOTAL`
- Campos autoEnter: `procedencia_id`, `Mofidicación Fecha/Responsable`
- Campo `migrada` (metadata de sync, no dato de negocio)

### 5.6 Sync bidireccional

**FM → Zeru (webhook):** Llega evento con fmRecordId → buscar FmSyncRecords (puede haber 2) → leer registro FM → actualizar LegalEntity y/o LabOrigin según qué cambió.

**Zeru → FM (event-driven):** Actualización de LegalEntity → `legalEntityToFm()` genera solo campos `INSTITUCIONES::*`. Actualización de LabOrigin → `labOriginToFm()` genera solo campos propios. No se sobreescriben campos del otro dominio.

## 6. Cambios al Tenant

Agregar relaciones:

```prisma
model Tenant {
  // ... existentes ...
  legalEntities      LegalEntity[]
  labOrigins         LabOrigin[]
}
```

## 7. Integración con módulos existentes

- **Cobranzas (futuro):** `Liquidation` tendrá FK a `LegalEntity` + `LabOrigin`
- **Facturación (futuro):** DTE requiere `LegalEntity.rut`, `legalName`, `businessActivity`, dirección
- **Contabilidad:** `JournalEntry` podrá referenciar `LegalEntity` como contraparte
- **RBAC:** Módulo `clients` (business) para LegalEntity, módulos `lab-*` para LabOrigin. Permisos ya definidos en `module-definitions.ts`.

## 8. Soft delete

Registrar `LegalEntity`, `LegalEntityContact`, `LegalEntityBankAccount`, `LabOrigin`, `LabOriginPricing` en `SOFT_DELETABLE_MODELS` en `apps/api/src/prisma/extensions/soft-delete.extension.ts`.

## 9. Fuera de alcance

- UI de gestión de LegalEntity y LabOrigin (spec separado)
- Modelo BillingConcept (catálogo maestro de conceptos de cobro)
- Import automático de conceptos de cobro (se importa pricing pero no el catálogo)
- Modelo de Convenio (se simplifica a campos en LabOrigin)
