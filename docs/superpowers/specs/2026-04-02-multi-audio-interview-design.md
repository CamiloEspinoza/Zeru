# Multi-Audio para Entrevistas

**Fecha:** 2026-04-02
**Estado:** Aprobado

---

## 1. Problema

Las entrevistas se graban simultáneamente con iPhone (cerca del entrevistado) y MacBook (mic de sala). Hoy solo se puede subir un audio, perdiendo la ventaja de tener dos fuentes. La diarización algorítmica tiene ~90% de accuracy en identificación de speakers.

## 2. Decisiones de diseño

1. **Merge estéreo + Deepgram multichannel**: Los dos audios se combinan en un WAV estéreo (iPhone=L, MacBook=R) y se envían a Deepgram con `multichannel=true`. Cada canal se transcribe independientemente → identificación de speaker 100% determinista.
2. **Sincronización automática**: Cross-correlación para detectar el offset entre los dos audios (pueden diferir hasta 1 minuto). Detección de palmada como fast-path cuando disponible.
3. **Segundo archivo opcional**: Si solo hay un audio, el flujo es idéntico al actual (mono + diarización).
4. **Modelo `InterviewAudioTrack`**: Los audios originales se preservan siempre. `Interview.audioS3Key` apunta al audio final (mergeado o único).

## 3. Modelo de datos

### Nueva tabla

```prisma
model InterviewAudioTrack {
  id            String   @id @default(uuid())
  interviewId   String
  interview     Interview @relation(fields: [interviewId], references: [id], onDelete: Cascade)
  trackOrder    Int      // 1 = primary, 2 = secondary
  s3Key         String
  mimeType      String   @default("audio/mpeg")
  durationMs    Int?
  sourceLabel   String?  // "iPhone", "MacBook", "Grabadora externa", "Otro"
  originalName  String?
  createdAt     DateTime @default(now())
  tenantId      String

  @@unique([interviewId, trackOrder])
  @@index([interviewId])
  @@map("interview_audio_tracks")
}
```

### Cambio en Interview

```prisma
model Interview {
  // campo existente audioS3Key se reutiliza para el audio final (mergeado o único)
  // nueva relación:
  audioTracks   InterviewAudioTrack[]
}
```

### S3 keys

```
tenants/{tenantId}/interviews/{id}/audio/track-1-{name}.mp3    # Original normalizado
tenants/{tenantId}/interviews/{id}/audio/track-2-{name}.mp3    # Original normalizado
tenants/{tenantId}/interviews/{id}/audio/merged.wav            # Estéreo alineado (16kHz)
```

## 4. Pipeline de procesamiento

### Nuevo paso: MERGING (antes de TRANSCRIBING)

```
Upload Track 1 → normalizar (ffmpeg mp3) → S3
Upload Track 2 → normalizar (ffmpeg mp3) → S3
         ↓
[Procesar]
         ↓
Paso 0: MERGING (solo si hay 2 tracks)
  1. Descargar ambos tracks de S3
  2. Normalizar niveles (loudnorm EBU R128)
  3. Resamplear a 16kHz mono cada track
  4. Detectar offset (palmada o cross-correlación)
  5. Merge a WAV estéreo alineado (track1=L, track2=R)
  6. Subir merged.wav a S3
  7. Actualizar interview.audioS3Key → merged.wav
         ↓
Paso 1: TRANSCRIBING
  - Si hay 2 tracks: Deepgram multichannel=true (sin diarize)
  - Si hay 1 track: Deepgram diarize=true (como hoy)
         ↓
Pasos 2-5: sin cambios
```

### Sincronización automática

**Estrategia dual:**

1. **Fast-path (palmada):** Buscar un pico de amplitud prominente (>6dB sobre el promedio) en los primeros 60 segundos de cada audio. Si ambos tienen un pico claro, el offset es la diferencia entre los dos picos.

2. **Fallback (cross-correlación):** Tomar los primeros 3 minutos de cada audio, calcular cross-correlación normalizada, encontrar el lag con máxima correlación. Esto funciona porque ambos audios capturan el mismo evento (mismas voces, mismo contenido).

**Implementación:** Usar ffmpeg para extraer los primeros 3 minutos como raw PCM, luego procesar en Node.js con aritmética de arrays (no se necesita librería externa para cross-correlación básica sobre audio downsampled a 8kHz).

**Comando ffmpeg para extraer segmento raw:**
```bash
ffmpeg -i track.mp3 -t 180 -ar 8000 -ac 1 -f f32le -
```

**Aplicar offset al merge:**
```bash
ffmpeg -i track1_norm.wav -itsoffset {offset_seconds} -i track2_norm.wav \
  -filter_complex "[0:a][1:a]join=inputs=2:channel_layout=stereo:map=0.0-FL|1.0-FR[a]" \
  -map "[a]" -ar 16000 merged.wav
```

## 5. Cambios en Deepgram

### Cuando hay 2 tracks (multichannel)

```typescript
const response = await dgClient.listen.v1.media.transcribeFile(mergedWavBuffer, {
  model: 'nova-3',
  language: 'es',
  multichannel: true,    // ← cada canal se transcribe independientemente
  utterances: true,      // ← ordena cronológicamente con channel ID
  smart_format: true,
  punctuate: true,
  // NO diarize — multichannel reemplaza la diarización
});

// response.results.channels[0] → Canal L (Track 1)
// response.results.channels[1] → Canal R (Track 2)
// response.results.utterances → conversación ordenada con channel
```

### Mapeo de segments

Los segments se construyen desde `utterances` (que vienen ordenados cronológicamente):
- `utterance.channel === 0` → `speaker: "Speaker_Track1"` (o el sourceLabel del track)
- `utterance.channel === 1` → `speaker: "Speaker_Track2"`

Los InterviewSpeaker se crean con:
- `speakerLabel: "Speaker_Track1"`, `name: sourceLabel del track 1`
- `speakerLabel: "Speaker_Track2"`, `name: sourceLabel del track 2`

La auto-identificación por GPT (feature existente) sigue aplicando para refinar los nombres.

### Cuando hay 1 track (sin cambios)

Se usa el flujo actual: `diarize: true`, sin `multichannel`.

## 6. Backend

### Upload endpoint modificado

```
POST /org-intelligence/interviews/:id/upload-audio
Query: ?trackOrder=1  (default: 1, acepta 1 o 2)
Body: multipart file
```

Lógica:
1. Normalizar audio con ffmpeg (como hoy)
2. Crear/actualizar InterviewAudioTrack con trackOrder
3. Subir a S3 con key `track-{trackOrder}-{name}.mp3`
4. Si hay tracks existentes de procesamiento anterior, resetear `processingStatus = 'UPLOADED'`
5. Actualizar `interview.audioS3Key` al track 1 (para backward compatibility / single track)

### Merge service

Nuevo servicio `AudioMergeService` con método:

```typescript
async mergeAndAlign(
  tenantId: string,
  interviewId: string,
): Promise<{ mergedS3Key: string; offsetMs: number }>
```

Pasos:
1. Descargar ambos tracks de S3
2. Normalizar niveles (loudnorm)
3. Detectar offset (palmada → cross-correlación fallback)
4. Merge estéreo con offset aplicado
5. Subir merged.wav a S3
6. Actualizar `interview.audioS3Key` → merged.wav
7. Retornar offset detectado

### Pipeline orchestrator

Agregar `MERGING` como paso 0 en `PIPELINE_STEPS`:

```typescript
private static readonly PIPELINE_STEPS = [
  'MERGING',              // ← nuevo (solo si hay 2 tracks)
  'TRANSCRIBING',
  'EXTRACTING',
  'RESOLVING_COREFERENCES',
  'CHUNKING',
  'EMBEDDING',
] as const;
```

En `runPipeline`, antes de transcribir:
```typescript
if (startStep <= 0) {
  const tracks = await client.interviewAudioTrack.findMany({
    where: { interviewId },
    orderBy: { trackOrder: 'asc' },
  });
  if (tracks.length >= 2) {
    await this.updateStatus(interviewId, tenantId, 'MERGING');
    await this.audioMerge.mergeAndAlign(tenantId, interviewId);
  }
}
```

### Transcription service

En `transcribeWithDeepgram`, detectar si el audio es estéreo:
```typescript
const tracks = await client.interviewAudioTrack.count({ where: { interviewId } });
const useMultichannel = tracks >= 2;

const response = await dgClient.listen.v1.media.transcribeFile(audioBuffer, {
  model: 'nova-3',
  language: 'es',
  ...(useMultichannel
    ? { multichannel: true, utterances: true }
    : { diarize: true, utterances: true }),
  smart_format: true,
  punctuate: true,
});
```

Cuando es multichannel, construir segments desde `utterances` usando `channel` como speaker ID en vez de `speaker`.

## 7. Frontend

### UI de upload expandida

La card "Subir archivo" se expande para aceptar hasta 2 archivos:

```
┌─────────────────────────────────────────┐
│  Subir archivos de audio                │
│                                         │
│  Arrastra hasta 2 archivos aquí         │
│                                         │
│  Track 1: entrevista_iphone.m4a         │
│  Fuente: [iPhone ▼]         [✕ Quitar]  │
│                                         │
│  Track 2: grabacion_mac.wav             │
│  Fuente: [MacBook ▼]        [✕ Quitar]  │
│                                         │
│  ℹ️ Sube un segundo archivo para         │
│  mejorar la transcripción               │
│                                         │
│  [Subir archivos]                       │
└─────────────────────────────────────────┘
```

- Selector de fuente: iPhone, MacBook, Grabadora externa, Otro
- Segundo archivo es opcional — hint text lo sugiere
- Upload secuencial con progress bar por archivo
- Si ya hay tracks, se muestran con opción de reemplazar/quitar individualmente

### Pipeline status

Agregar label para el nuevo paso:
- `MERGING` → "Mezclando y alineando audios..."

## 8. Preview del audio mergeado

Después del paso MERGING, antes de lanzar la transcripción, el pipeline se **pausa** para que el usuario pueda escuchar el resultado.

### Flujo con preview

```
[Procesar] → MERGING → audio mergeado listo
                         ↓
              Pipeline se pausa en estado "MERGE_REVIEW"
              UI muestra player con el audio mergeado
              + offset detectado + botones:
              
              ┌──────────────────────────────────────┐
              │ 🎧 Preview del audio mezclado         │
              │                                      │
              │ ▶ ━━━━━━━━━━━━━━━━━━━━━ 0:00 / 62:30 │
              │                                      │
              │ Offset detectado: 12.3s              │
              │                                      │
              │ [Continuar procesamiento]  [Re-mezclar]│
              └──────────────────────────────────────┘
```

- **"Continuar procesamiento"**: reanuda el pipeline desde TRANSCRIBING
- **"Re-mezclar"**: permite ajustar offset manualmente y volver a mezclar (iteración futura — MVP solo muestra el preview y botón de continuar)

### Implementación

- Nuevo estado `MERGE_REVIEW` en processingStatus
- El pipeline se detiene después de MERGING si hay 2 tracks
- `GET /interviews/:id/audio-url` ya existe — sirve el merged.wav
- Frontend muestra el player (componente existente) + botón "Continuar"
- Al clickear "Continuar": `POST /interviews/:id/process?fromStep=TRANSCRIBING`

## 9. Fuera de alcance

- Visualización de waveforms
- Ajuste manual de offset/sincronización
- Más de 2 tracks
- ROVER post-processing
- Grabación multi-track desde browser
- Auto-detección de fuente por metadata del archivo
