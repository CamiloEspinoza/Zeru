# Propuesta: Visión de imágenes en el agente LinkedIn

**Fecha:** 2026-03-10  
**Autor:** Propuesta técnica  
**Estado:** Borrador

---

## 1. Objetivo

Permitir que el agente de LinkedIn **analice visualmente** las imágenes que sube el usuario para generar posts más coherentes y contextuales. Hoy el modelo solo recibe el texto `[El usuario ha adjuntado una imagen...]` con la URL; no ve la imagen y no puede describirla, adaptar el copy a su contenido ni aprovechar la información visual.

---

## 2. Estado actual

### Assistant general (chat)

- La imagen se pasa como `input_image` con `image_url` (presigned S3 URL) y `detail: 'auto'`.
- El modelo **sí ve** la imagen y puede analizarla.

```typescript
// chat.service.ts - buildUserContent()
if (uploadedImage?.imageUrl) {
  parts.push({
    type: 'input_image',
    image_url: uploadedImage.imageUrl,
    detail: 'auto',
  });
}
```

### Agente LinkedIn

- Solo se añade texto al mensaje: `[El usuario ha adjuntado una imagen...]\n- s3_key: ...\n- url: ...`
- El `content` del mensaje es siempre string.
- El modelo **no ve** la imagen; solo sabe que hay una URL adjunta.

```typescript
// linkedin-agent.service.ts
const effectiveMessage = ctx.uploadedImage
  ? `${ctx.message}\n\n[El usuario ha adjuntado una imagen para usar en el post]\n- s3_key: ${ctx.uploadedImage.s3Key}\n- url: ${ctx.uploadedImage.imageUrl}`
  : ctx.message;
// ...
input = [{ role: 'user', content: ctx.message }];  // content = string
```

---

## 3. Cambios propuestos

### 3.1 Función auxiliar para construir contenido multimodal

Añadir en `linkedin-agent.service.ts` una función privada que construya el contenido del mensaje del usuario, igual que `buildUserContent` en `chat.service.ts`:

```typescript
/**
 * Builds user message content. When uploadedImage is present, returns multimodal
 * content (text + image) so the model can visually interpret the image.
 */
private buildLinkedInUserContent(
  text: string,
  uploadedImage?: { s3Key: string; imageUrl: string },
): string | OpenAI.Responses.ResponseInputContent[] {
  if (!uploadedImage?.imageUrl) return text;

  const augmentedText = `${text}\n\n[Imagen adjunta para el post. Analízala para adaptar el copy a su contenido. Usa create_linkedin_post con media_type=IMAGE, image_s3_key=${uploadedImage.s3Key}]`;

  return [
    { type: 'input_text', text: augmentedText } as OpenAI.Responses.ResponseInputText,
    {
      type: 'input_image',
      image_url: uploadedImage.imageUrl,
      detail: 'auto',
    } as OpenAI.Responses.ResponseInputImage,
  ];
}
```

### 3.2 Uso en `runAgentLoop`

Reemplazar la construcción del input para usar contenido multimodal cuando hay imagen:

**Antes (sin imagen o respuesta a pregunta):**
- `content: ctx.message` (string)

**Después:**
- Si `ctx.uploadedImage` y no es flujo de respuesta a pregunta → usar `buildLinkedInUserContent(ctx.message, ctx.uploadedImage)`
- Si es respuesta a pregunta (`ctx.questionToolCallId`) → mantener `ctx.message` (string), ya que la imagen viene del turno anterior y el contexto se mantiene vía `previous_response_id`.

Cambio concreto en `runAgentLoop`:

```typescript
// En el bloque else (cuando NO es questionToolCallId):
const userContent = this.buildLinkedInUserContent(ctx.message, ctx.uploadedImage);

if (currentPrevResponseId) {
  input = [{ role: 'user', content: userContent }];
} else {
  input = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent },
  ];
}
```

### 3.3 Actualización del system prompt

Ajustar la sección "Para posts con imagen subida por el usuario" para indicar que el modelo **puede ver y analizar** la imagen:

```diff
### Para posts con imagen subida por el usuario:
-1. Si el mensaje contiene \`[El usuario ha adjuntado una imagen...]\`, usa directamente el s3_key y url indicados
-2. NO uses generate_image cuando el usuario ya proporcionó una imagen
-3. Crea el post con media_type=IMAGE, image_s3_key={s3_key del mensaje}, media_url={url del mensaje}
+1. El usuario puede adjuntar una imagen que tú VES directamente (recibes la imagen como input visual)
+2. Analiza el contenido de la imagen (objetos, texto, composición, contexto) para adaptar el copy del post
+3. Escribe un texto que complemente o explique la imagen, no que la ignore o repita literalmente
+4. NO uses generate_image cuando el usuario ya proporcionó una imagen
+5. Crea el post con media_type=IMAGE, image_s3_key={s3_key indicado}, media_url={url indicada}
```

---

## 4. Casos especiales

### 4.1 Respuesta a `ask_user_question`

Cuando el usuario responde a una pregunta del agente, el input es:

```typescript
input = [
  ...pendingOutputs,
  { type: 'function_call_output', call_id: ctx.questionToolCallId, output: JSON.stringify({ answer: ctx.message }) },
];
```

En ese flujo normalmente no se adjunta una nueva imagen; el usuario responde texto. Si en el futuro se permitiera adjuntar imagen en la respuesta, habría que extender el flujo (por ahora fuera de alcance).

### 4.2 Continuación de conversación (`currentPrevResponseId`)

En turnos siguientes (sin pregunta pendiente), el usuario puede enviar un mensaje nuevo con imagen. Aquí sí se usa `buildLinkedInUserContent` con la imagen.

---

## 5. Consideraciones

### 5.1 Modelo con visión

- Los modelos que usamos (GPT-4o, o3, etc.) soportan visión.
- Verificar en `AiConfigService` / `fullConfig.model` que el modelo seleccionado tenga capacidad de visión.

### 5.2 Tokens y costo

- Las imágenes consumen tokens según resolución y `detail`:
  - `detail: 'auto'` — el modelo decide; suele ser eficiente.
  - Alternativa más económica: `detail: 'low'` para imágenes grandes.
- Una imagen típica puede añadir ~100–500 tokens de input.

### 5.3 URL presigned

- La URL S3 presigned debe ser accesible desde los servidores de OpenAI (públicamente alcanzable o sin restricciones de IP).
- Si la URL tiene expiración corta, asegurarse de que el modelo pueda cargarla antes de que caduque.

### 5.4 Persistencia en DB

- El mensaje del usuario se guarda actualmente como `{ type: 'text', text: ctx.message }`; no se persiste la imagen en el contenido del mensaje.
- Para historial/claridad se podría extender a `{ type: 'text', text: ctx.message, uploadedImage: ctx.uploadedImage }` si se necesita para debugging o UI. Opcional.

---

## 6. Alcance sugerido

**Fase 1 (esta propuesta):**
- Pasar la imagen como `input_image` al agente LinkedIn.
- Actualizar el system prompt.
- Probar con posts que incluyan imagen subida.

**Fase 2 (futuro):**
- Permitir imagen en respuestas a `ask_user_question` si el flujo lo requiere.
- Ajustar `detail` según tipo de imagen (gráficos vs fotos) para optimizar tokens.

---

## 7. Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `apps/api/src/modules/linkedin/services/linkedin-agent.service.ts` | Añadir `buildLinkedInUserContent`, usar en `runAgentLoop`, actualizar `LINKEDIN_SYSTEM_PROMPT` |

---

## 8. Estimación

- Implementación: ~30–45 min  
- Pruebas manuales: 15–20 min  
- Total: ~1 h
