# Configuración de Webhooks en FileMaker para Zeru

Esta guía explica cómo configurar FileMaker Server para enviar notificaciones a Zeru cada vez que se crea, actualiza o elimina un registro en una tabla sincronizada.

## Requisitos previos

- FileMaker Server 19+ (soporte para `Insert from URL` con cURL)
- Acceso de administrador a las bases de datos FM
- URL del API de Zeru (ej: `https://api.zeru.cl`)
- Webhook key configurada en Zeru (env var `FM_WEBHOOK_KEY`)

## Concepto

Zeru expone un endpoint webhook:

```
POST https://api.zeru.cl/filemaker/webhook
```

FileMaker envía un JSON a este endpoint cada vez que un registro cambia. Zeru recibe la notificación y sincroniza los datos.

**Payload que espera Zeru:**

```json
{
  "database": "BIOPSIAS",
  "layout": "Liquidaciones",
  "recordId": "12176",
  "action": "update"
}
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `database` | texto | Nombre de la base de datos FM (ej: `BIOPSIAS`, `PAPANICOLAOU`) |
| `layout` | texto | Nombre del layout FM donde ocurrió el cambio |
| `recordId` | texto | ID del registro en FM (`Get(RecordID)`) |
| `action` | texto | Tipo de operación: `create`, `update`, o `delete` |

**Autenticación:** Header `X-FM-Webhook-Key` con la clave configurada.

---

## Paso 1: Crear el script de webhook

En FileMaker Pro, crea un nuevo script llamado **`Webhook - Notificar Zeru`**:

```
# ============================================
# Script: Webhook - Notificar Zeru
# Propósito: Envía una notificación a Zeru cuando un registro cambia
# Parámetro: JSON con "layout" y "action"
#   Ejemplo: JSONSetElement ( "{}" ; ["layout"; "Liquidaciones"; 1] ; ["action"; "update"; 1] )
# ============================================

Set Error Capture [ On ]

# Leer parámetros
Set Variable [ $param ; Value: Get ( ScriptParameter ) ]
Set Variable [ $layout ; Value: JSONGetElement ( $param ; "layout" ) ]
Set Variable [ $action ; Value: JSONGetElement ( $param ; "action" ) ]

# Construir el payload JSON
Set Variable [ $payload ; Value:
  JSONSetElement ( "{}" ;
    [ "database" ; Get ( FileName ) ; JSONString ] ;
    [ "layout" ; $layout ; JSONString ] ;
    [ "recordId" ; Get ( RecordID ) ; JSONString ] ;
    [ "action" ; $action ; JSONString ]
  )
]

# URL del webhook de Zeru
Set Variable [ $url ; Value: "https://api.zeru.cl/filemaker/webhook" ]

# Clave de autenticación (reemplazar con tu clave real)
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
Insert from URL [ Select ; With dialog: Off ; Target: $response ; $url ; cURL options: $curlOptions ]

# Log de errores (opcional)
If [ Get ( LastError ) ≠ 0 ]
  # Registrar error en un campo o tabla de log
  # Set Field [ Logs::Error ; "Webhook failed: " & Get ( LastErrorDetail ) ]
End If
```

### Notas importantes del script:

- **`Get ( FileName )`** devuelve el nombre de la base de datos actual (ej: "BIOPSIAS").
- **`Get ( RecordID )`** devuelve el ID interno del registro actual en FM.
- **`--data @$payload`** envía el contenido de la variable `$payload` como body. El prefijo `@` indica a FM que lea el contenido de la variable.
- **`--max-time 5`** establece un timeout de 5 segundos para no bloquear FM si Zeru no responde.
- **`--show-error`** permite capturar errores detallados con `Get ( LastErrorDetail )`.
- Las comillas dentro de las opciones cURL deben escaparse con `\"`.

---

## Paso 2: Configurar Script Triggers

Para cada tabla que se sincroniza con Zeru, configura un **Script Trigger** en el layout correspondiente.

### En FileMaker Pro:

1. Abre el layout que quieres sincronizar (ej: `Liquidaciones`)
2. Ve a **Layout Setup** (Configuración del Layout) → pestaña **Script Triggers**
3. Agrega un trigger:

| Evento | Script | Parámetro |
|--------|--------|-----------|
| **OnRecordCommit** | `Webhook - Notificar Zeru` | `JSONSetElement ( "{}" ; ["layout"; "Liquidaciones"; 1] ; ["action"; "update"; 1] )` |

4. Marca la casilla **Activo**
5. Haz click en **OK**

### Para cada layout/tabla:

Repite el paso 2 cambiando el nombre del layout en el parámetro:

| Layout FM | Parámetro del trigger |
|-----------|----------------------|
| `Liquidaciones` | `JSONSetElement ( "{}" ; ["layout"; "Liquidaciones"; 1] ; ["action"; "update"; 1] )` |
| `Procedencias*` | `JSONSetElement ( "{}" ; ["layout"; "Procedencias*"; 1] ; ["action"; "update"; 1] )` |
| `FICHA INSTITUCION COBRANZAS` | `JSONSetElement ( "{}" ; ["layout"; "FICHA INSTITUCION COBRANZAS"; 1] ; ["action"; "update"; 1] )` |

### Detectar creates vs updates:

Para distinguir entre creación y actualización, puedes verificar si el registro es nuevo:

```
# En el parámetro del trigger, usar un cálculo condicional:
Let (
  $isNew = IsEmpty ( Get ( RecordID ) ) or Get ( RecordOpenState ) = 1 ;
  JSONSetElement ( "{}" ;
    [ "layout" ; "Liquidaciones" ; JSONString ] ;
    [ "action" ; If ( $isNew ; "create" ; "update" ) ; JSONString ]
  )
)
```

---

## Paso 3: Manejar eliminaciones (opcional)

`OnRecordCommit` no se ejecuta al eliminar registros. Para capturar eliminaciones:

1. Crea un script **`Webhook - Notificar Eliminación`**:

```
Set Error Capture [ On ]

Set Variable [ $param ; Value: Get ( ScriptParameter ) ]
Set Variable [ $layout ; Value: JSONGetElement ( $param ; "layout" ) ]

Set Variable [ $payload ; Value:
  JSONSetElement ( "{}" ;
    [ "database" ; Get ( FileName ) ; JSONString ] ;
    [ "layout" ; $layout ; JSONString ] ;
    [ "recordId" ; JSONGetElement ( $param ; "recordId" ) ; JSONString ] ;
    [ "action" ; "delete" ; JSONString ]
  )
]

Set Variable [ $url ; Value: "https://api.zeru.cl/filemaker/webhook" ]
Set Variable [ $webhookKey ; Value: "TU_FM_WEBHOOK_KEY_AQUI" ]

Set Variable [ $curlOptions ; Value:
  "--request POST" &
  " --header \"Content-Type: application/json\"" &
  " --header \"X-FM-Webhook-Key: " & $webhookKey & "\"" &
  " --data @$payload" &
  " --show-error" &
  " --max-time 5"
]

Insert from URL [ Select ; With dialog: Off ; Target: $response ; $url ; cURL options: $curlOptions ]
```

2. En cualquier script que elimine registros, llama a este script **antes** de ejecutar `Delete Record`:

```
# Antes de eliminar, notificar a Zeru
Perform Script [ "Webhook - Notificar Eliminación" ;
  Parameter: JSONSetElement ( "{}" ;
    [ "layout" ; "Liquidaciones" ; JSONString ] ;
    [ "recordId" ; Get ( RecordID ) ; JSONString ]
  )
]
Delete Record/Request [ With dialog: Off ]
```

---

## Paso 4: Probar la conexión

1. Abre un registro en el layout configurado
2. Modifica cualquier campo
3. Haz commit del registro (click fuera del campo o Ctrl+S)
4. Verifica en Zeru: ve a **Integraciones → FileMaker → Estado de Sync**
5. Deberías ver un nuevo log con la operación `webhook:update`

### Debugging:

- **En FileMaker:** Si el webhook falla, revisa `Get ( LastError )` y `Get ( LastErrorDetail )` en el script
- **En Zeru:** Los logs de webhook se registran en la tabla `fm_sync_logs` (schema `citolab_fm`)
- **Timeout:** Si Zeru no responde en 5 segundos, FM continúa sin bloquear al usuario

---

## Tablas recomendadas para configurar

Para el módulo de cobranzas, configura triggers en estos layouts:

| Layout | Prioridad | Notas |
|--------|-----------|-------|
| `Liquidaciones` | Alta | Core de cobranzas |
| `Procedencias*` | Alta | Datos maestros de clientes |
| `FICHA INSTITUCION COBRANZAS` | Media | Ficha de facturación |
| `Conceptos de cobro (CDC)*` | Baja | Catálogo de conceptos (cambia poco) |

---

## Referencia

- [Insert from URL — Claris FileMaker Pro Help](https://help.claris.com/en/pro-help/content/insert-from-url.html)
- [Supported cURL options — Claris FileMaker Pro Help](https://help.claris.com/en/pro-help/content/curl-options.html)
- [JSONSetElement — Claris FileMaker Pro Help](https://help.claris.com/en/pro-help/content/jsonsetelement.html)
- [OnRecordCommit — Claris FileMaker Pro Help](https://help.claris.com/en/pro-help/content/onrecordcommit.html)
