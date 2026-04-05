# Configuración de Webhook Triggers — Procedencias

**Transformer:** `ProcedenciasTransformer`
**Base de datos FM:** `BIOPSIAS`
**Endpoint webhook:** `POST https://api.zeru.cl/filemaker/webhook`
**Autenticación:** Header `X-FM-Webhook-Key: <FM_WEBHOOK_KEY>`

---

## Resumen de triggers requeridos

| Layout FM | Trigger | Acción | Entidades afectadas en Zeru |
|-----------|---------|--------|-----------------------------|
| `Procedencias*` | OnRecordCommit (nuevo) | `create` | LegalEntity + LabOrigin |
| `Procedencias*` | OnRecordCommit (existente) | `update` | LegalEntity + LabOrigin |
| `Procedencias*` | Antes de Delete Record | `delete` | LabOrigin (soft-delete) |
| `FICHA INSTITUCION COBRANZAS` | OnRecordCommit | `update` | LegalEntity |

> **Nota sobre portales:** Los cambios en portales (`CONTACTOS Cobranzas`, `conceptos de cobro procedencia`) se capturan automáticamente cuando Zeru lee el registro completo de `Procedencias*` al procesar el webhook. No requieren triggers separados, PERO se debe configurar el trigger `OnRecordCommit` en el layout padre `Procedencias*` para que detecte cambios en registros de portal.

---

## 1. Script base: Webhook - Notificar Zeru

Este script ya debería existir (ver guía general de webhooks). Si no existe, crear:

```filemaker
# ============================================
# Script: Webhook - Notificar Zeru
# Parámetro: JSON con "database", "layout", "recordId", "action"
# ============================================

Set Error Capture [ On ]

# Leer parámetros
Set Variable [ $param ; Value: Get ( ScriptParameter ) ]
Set Variable [ $database ; Value: JSONGetElement ( $param ; "database" ) ]
Set Variable [ $layout ; Value: JSONGetElement ( $param ; "layout" ) ]
Set Variable [ $recordId ; Value: JSONGetElement ( $param ; "recordId" ) ]
Set Variable [ $action ; Value: JSONGetElement ( $param ; "action" ) ]

# Construir el payload JSON
Set Variable [ $payload ; Value:
  JSONSetElement ( "{}" ;
    [ "database" ; $database ; JSONString ] ;
    [ "layout" ; $layout ; JSONString ] ;
    [ "recordId" ; $recordId ; JSONString ] ;
    [ "action" ; $action ; JSONString ]
  )
]

# URL del webhook de Zeru
Set Variable [ $url ; Value: "https://api.zeru.cl/filemaker/webhook" ]

# Clave de autenticación
Set Variable [ $webhookKey ; Value: "TU_FM_WEBHOOK_KEY_AQUI" ]

# Opciones cURL para POST con JSON
Set Variable [ $curlOptions ; Value:
  "--request POST" &
  " --header \"Content-Type: application/json\"" &
  " --header \"X-FM-Webhook-Key: " & $webhookKey & "\"" &
  " --data @$payload" &
  " --show-error" &
  " --max-time 5"
]

# Enviar la notificación
Insert from URL [ Select ; With dialog: Off ;
  Target: $response ; $url ; cURL options: $curlOptions ]

# Log de errores (opcional)
If [ Get ( LastError ) ≠ 0 ]
  # Registrar error en tabla de log si existe
End If
```

---

## 2. Trigger: Procedencias — Create y Update

### Layout: `Procedencias*`
### Trigger: `OnRecordCommit`

Este trigger se dispara tanto para registros nuevos como para registros editados. El script debe detectar si es create o update.

#### Script: Webhook - Procedencias OnCommit

```filemaker
# ============================================
# Script: Webhook - Procedencias OnCommit
# Se ejecuta en OnRecordCommit del layout Procedencias*
# Detecta si es create o update
# ============================================

Set Error Capture [ On ]

# Determinar si es un registro nuevo
# Un registro es "nuevo" si fue creado en los últimos 2 segundos
Set Variable [ $isNew ; Value:
  Abs ( Get ( CurrentTimestamp ) - GetAsTimestamp ( GetField ( "Mofidicación Fecha" ) ) ) < 2
  and GetField ( "Mofidicación Fecha" ) = GetField ( "Creación Fecha" )
]

# Si no hay campo de fecha de creación, usar alternativa:
# Set Variable [ $isNew ; Value: IsEmpty ( GetField ( "migrada" ) ) and IsEmpty ( GetField ( "codigo_unico" ) ) ]

Set Variable [ $action ; Value:
  If ( $isNew ; "create" ; "update" )
]

# Construir parámetro para el script base
Set Variable [ $param ; Value:
  JSONSetElement ( "{}" ;
    [ "database" ; Get ( FileName ) ; JSONString ] ;
    [ "layout" ; "Procedencias*" ; JSONString ] ;
    [ "recordId" ; Get ( RecordID ) ; JSONString ] ;
    [ "action" ; $action ; JSONString ]
  )
]

# Llamar al script base
Perform Script [ "Webhook - Notificar Zeru" ; Parameter: $param ]
```

#### Configuración del trigger:

1. Abrir layout `Procedencias*` en modo Layout
2. **Layout Setup** → pestaña **Script Triggers**
3. Agregar trigger: **OnRecordCommit**
4. Script: **Webhook - Procedencias OnCommit**
5. Sin parámetro (el script lo construye internamente)

---

## 3. Trigger: Procedencias — Delete

`OnRecordCommit` **NO se dispara al eliminar registros**. Hay dos estrategias:

### Opción A: Script wrapper (RECOMENDADA)

Buscar TODOS los scripts de FM que usan `Delete Record/Request` en registros de Procedencias y agregar la notificación ANTES del delete:

```filemaker
# ============================================
# ANTES de cualquier Delete Record en Procedencias
# ============================================

# Notificar a Zeru antes de eliminar
Set Variable [ $param ; Value:
  JSONSetElement ( "{}" ;
    [ "database" ; Get ( FileName ) ; JSONString ] ;
    [ "layout" ; "Procedencias*" ; JSONString ] ;
    [ "recordId" ; Get ( RecordID ) ; JSONString ] ;
    [ "action" ; "delete" ; JSONString ]
  )
]
Perform Script [ "Webhook - Notificar Zeru" ; Parameter: $param ]

# Ahora sí eliminar
Delete Record/Request [ With dialog: Off ]
```

**Scripts a revisar en FM:**
- Cualquier script que contenga `Delete Record/Request` y opere sobre la tabla Procedencias
- Scripts de limpieza o mantenimiento masivo
- Scripts asociados a botones de "Eliminar" en layouts de Procedencias

### Opción B: OnLayoutKeystroke (alternativa)

Si hay eliminación interactiva (usuario presiona Delete):

```filemaker
# Script trigger: OnLayoutKeystroke en Procedencias*
# Interceptar Ctrl+E / Cmd+Backspace (eliminar registro)

If [ Code ( Get ( TriggerKeystroke ) ) = 8 and Get ( TriggerModifierKeys ) = 1 ]
  # Notificar antes de que FM elimine
  Set Variable [ $param ; Value:
    JSONSetElement ( "{}" ;
      [ "database" ; Get ( FileName ) ; JSONString ] ;
      [ "layout" ; "Procedencias*" ; JSONString ] ;
      [ "recordId" ; Get ( RecordID ) ; JSONString ] ;
      [ "action" ; "delete" ; JSONString ]
    )
  ]
  Perform Script [ "Webhook - Notificar Zeru" ; Parameter: $param ]
End If
```

---

## 4. Trigger: Instituciones — Update

Cuando se modifica datos de una institución (razón social, RUT, plazo de pago, etc.), eso afecta al `LegalEntity` en Zeru. Necesitamos un trigger separado.

### Layout: `FICHA INSTITUCION COBRANZAS`
### Trigger: `OnRecordCommit`

#### Script: Webhook - Instituciones OnCommit

```filemaker
# ============================================
# Script: Webhook - Instituciones OnCommit
# Se ejecuta en OnRecordCommit del layout FICHA INSTITUCION COBRANZAS
# ============================================

Set Error Capture [ On ]

# Las instituciones se sincronizan a través de Procedencias
# Necesitamos encontrar qué procedencias usan esta institución
# y notificar por cada una

# Opción 1 (simple): notificar con layout de institución
# Zeru buscará los FmSyncRecords asociados
Set Variable [ $param ; Value:
  JSONSetElement ( "{}" ;
    [ "database" ; Get ( FileName ) ; JSONString ] ;
    [ "layout" ; "FICHA INSTITUCION COBRANZAS" ; JSONString ] ;
    [ "recordId" ; Get ( RecordID ) ; JSONString ] ;
    [ "action" ; "update" ; JSONString ]
  )
]
Perform Script [ "Webhook - Notificar Zeru" ; Parameter: $param ]
```

#### Configuración del trigger:

1. Abrir layout `FICHA INSTITUCION COBRANZAS` en modo Layout
2. **Layout Setup** → pestaña **Script Triggers**
3. Agregar trigger: **OnRecordCommit**
4. Script: **Webhook - Instituciones OnCommit**

> **Nota para Zeru:** El backend deberá manejar webhooks con layout `FICHA INSTITUCION COBRANZAS` de forma especial — buscar todas las procedencias vinculadas a esa institución y actualizar los LegalEntity correspondientes. Esto requiere un handler adicional en `FmSyncService` que aún no existe y debe ser implementado.

---

## 5. Escenarios de datos nuevos (Create)

### 5a. Nueva procedencia creada directamente en FM

El trigger `OnRecordCommit` la detecta como `create`. Zeru:
1. Recibe webhook con `action: "create"`
2. No encuentra FmSyncRecord existente → crea uno con `PENDING_TO_ZERU`
3. El procesador (futuro cron o procesamiento inmediato) lee el registro completo de FM
4. Ejecuta el transformer: crea LegalEntity (si tiene RUT y no existe) + LabOrigin
5. Crea 2 FmSyncRecords (legal-entity + lab-origin)

### 5b. Nueva institución creada en FM

Si se crea una institución nueva directamente en `FICHA INSTITUCION COBRANZAS`, no genera automáticamente una procedencia. El LegalEntity se creará cuando una procedencia la referencie.

### 5c. Nuevo contacto en portal

El contacto se agrega en el portal `CONTACTOS Cobranzas` dentro de `Procedencias*`. Al hacer commit del registro padre, el trigger `OnRecordCommit` del layout Procedencias se dispara → Zeru lee todo el registro incluyendo portales → actualiza/crea contactos.

### 5d. Nuevo precio en portal

Similar a contactos: se agrega en portal `conceptos de cobro procedencia` → commit del registro padre dispara el trigger → Zeru lee y sincroniza.

---

## 6. Resumen de scripts a crear en FM

| Script | Descripción | Usado por |
|--------|-------------|-----------|
| `Webhook - Notificar Zeru` | Script base que envía el HTTP POST | Todos los demás scripts |
| `Webhook - Procedencias OnCommit` | Detecta create/update y notifica | Trigger OnRecordCommit en `Procedencias*` |
| `Webhook - Instituciones OnCommit` | Notifica cambios en institución | Trigger OnRecordCommit en `FICHA INSTITUCION COBRANZAS` |

Además, modificar scripts existentes que usen `Delete Record/Request` en Procedencias para agregar la notificación antes del delete.

---

## 7. Checklist de configuración

- [ ] Crear script `Webhook - Notificar Zeru` (si no existe)
- [ ] Crear script `Webhook - Procedencias OnCommit`
- [ ] Configurar trigger OnRecordCommit en layout `Procedencias*`
- [ ] Crear script `Webhook - Instituciones OnCommit`
- [ ] Configurar trigger OnRecordCommit en layout `FICHA INSTITUCION COBRANZAS`
- [ ] Auditar scripts que eliminan procedencias → agregar webhook antes de delete
- [ ] Configurar variable `FM_WEBHOOK_KEY` en el script base
- [ ] Probar: crear nueva procedencia → verificar log en Zeru
- [ ] Probar: editar procedencia existente → verificar log en Zeru
- [ ] Probar: eliminar procedencia → verificar log en Zeru
- [ ] Probar: editar institución → verificar log en Zeru

---

## 8. Consideraciones de rendimiento

- `--max-time 5`: El webhook tiene timeout de 5 segundos. Si Zeru no responde, FM continúa sin bloquear al usuario.
- El webhook solo notifica; la sincronización real es asíncrona. Zeru encola el cambio y lo procesa después.
- No se envía data del registro en el webhook (solo IDs). Zeru lee el registro completo via Data API cuando lo procesa.
- Si hay muchos cambios simultáneos (import masivo en FM), los webhooks se encolan y se procesan secuencialmente en Zeru.

---

## 9. TODO técnico para Zeru

Para soportar completamente los webhooks de Procedencias, el backend necesita:

1. **Procesamiento de PENDING_TO_ZERU** — El `FmSyncService` actualmente solo marca registros como pendientes. Falta implementar el procesador que:
   - Lee el registro FM completo via `FmApiService`
   - Ejecuta el `ProcedenciasTransformer` para extraer datos
   - Actualiza/crea LegalEntity + LabOrigin en la base de datos
   
2. **Handler para layout FICHA INSTITUCION COBRANZAS** — El webhook actual solo busca FmSyncRecords por layout. Necesita lógica especial:
   - Recibe webhook con layout `FICHA INSTITUCION COBRANZAS`
   - Busca todas las procedencias FM vinculadas a esa institución
   - Actualiza el LegalEntity correspondiente

3. **Manejo de create** — Cuando llega un webhook con `action: "create"` y no hay FmSyncRecord, debe:
   - Leer el registro FM
   - Ejecutar el transformer completo (crear LegalEntity + LabOrigin)
   - Crear los FmSyncRecords correspondientes
