# Script FM `Zeru_Validacion_Resultado` — Contrato

Este documento describe el contrato que el script de FileMaker `Zeru_Validacion_Resultado` debe implementar para integrarse con el pipeline de validación de informes de Zeru.

## Flujo

### 1. Disparar trigger al validar

Al momento en que el usuario pulsa "Validar Informe" en FileMaker, el script `OnRecordCommit` (o un script dedicado) debe ejecutar `Insert from URL` hacia Zeru:

**Endpoint:** `POST {{ZERU_API_BASE}}/api/lab/report-validation/trigger`

**Headers:**

```
Content-Type: application/json
x-fm-webhook-key: {{FM_WEBHOOK_KEY}}
x-triggered-by-user-id: {{USUARIO_FM_ID}}  (opcional pero recomendado)
```

**Body:**

```json
{
  "database": "BIOPSIAS",
  "informeNumber": 12345
}
```

`database` admite: `BIOPSIAS`, `BIOPSIASRESPALDO`, `PAPANICOLAOU`, `PAPANICOLAOUHISTORICO`.

**Respuesta esperada (200 OK):**

```json
{ "status": "enqueued", "jobId": "tenant-1:BIOPSIAS:12345" }
```

Ante cualquier otro código, registrar en bitácora y continuar — la validación ocurre en paralelo y no debe bloquear al usuario.

### 2. Consultar `can-dispatch` antes de despachar

Cuando FileMaker está por despachar el PDF (envío por email, FTP, etc.), debe consultar primero:

**Endpoint:** `GET {{ZERU_API_BASE}}/api/lab/report-validation/can-dispatch/{database}/{informeNumber}`

**Headers:**

```
x-fm-webhook-key: {{FM_WEBHOOK_KEY}}
```

**Respuesta:**

```json
{ "canDispatch": true, "reason": "not-blocked" }
```

o

```json
{ "canDispatch": false, "reason": "blocked-by-validation" }
```

Otros valores de `reason`:

- `report-not-found-yet` — el informe aún no se sincronizó a Zeru. Por defecto se permite el despacho (no hay bloqueo activo conocido).

Si `canDispatch=false`, FileMaker debe **retener el despacho** y mostrar al usuario que el caso está en revisión.

### 3. Write-back desde Zeru (F5+)

Opcional en F0, se implementa en fases posteriores: Zeru ejecutará un script de FM pasando `informeNumber` + `verdict` para que FM actualice campos locales (flag de bloqueo, razones, observaciones).

## Variables de entorno FM

- `ZERU_API_BASE`: URL base de Zeru (e.g. `https://api.zeru.cl`)
- `FM_WEBHOOK_KEY`: clave compartida, sincronizada con el env `FM_WEBHOOK_KEY` del servidor Zeru.

## Manejo de errores

- Timeout sugerido: 5s.
- Si Zeru no responde o devuelve 5xx, registrar en bitácora local y continuar el flujo actual de FM. La validación es asíncrona y no debe bloquear la operación diaria.
- El `can-dispatch` debe ser consultado **siempre** antes de despachar, sin excepción.
- Rate limits actuales: 60 req/min en `trigger`, 600 req/min en `can-dispatch`.
