# F1 Smoke E2E — Resultado

**Fecha:** 2026-04-20
**Informe probado:** BIOPSIAS #1187298
**Pipeline E2E completo:** trigger → BullMQ → processor → syncFromFm → upsertExam → emit event → 3 agentes paralelos → consolidator → COMPLETED.

## Resultado consolidado

- Status final: **COMPLETED**
- Verdict: **GREEN**
- ConfidenceAvg: **1.0000**
- isCritical: false
- Tiempo total trigger → COMPLETED: ~20 ms (startedAt 14:56:59.328 → completedAt 14:56:59.348)

## Agente runs

| Agente | Verdict | Severity | Confidence | Duration ms | Findings |
|--------|---------|----------|------------|-------------|----------|
| IDENTITY | PASS | LOW | 1.0000 | 0 | 0 |
| ORIGIN | PASS | LOW | 1.0000 | 5 | 0 |
| TRACEABILITY | PASS | LOW | 1.0000 | 0 | 0 |

## Findings

Ninguno. Caso limpio: el informe cumple todas las reglas deterministas de identity, origin y traceability.

## Bug detectado y corregido durante el smoke

El primer intento del trigger falló en `syncFromFm`:

```
Invalid `tx.labDiagnosticReportSigner.upsert()` invocation
Unknown argument `diagnosticReportId_signatureOrder`.
```

**Causa:** `report-validation.service.ts:531` usaba el compound unique
`diagnosticReportId_signatureOrder` en el `where` del upsert, pero el modelo
`LabDiagnosticReportSigner` en `schema.prisma` no tenía ese `@@unique`. Los unit
tests no lo detectaron porque los mocks de Prisma no validan el schema real.

**Fix:**
1. Agregado `@@unique([diagnosticReportId, signatureOrder])` en `schema.prisma`.
2. Migración `20260420145617_lab_signer_report_order_unique` crea el índice
   único en `mod_lab.lab_diagnostic_report_signers`.
3. Validado previamente que no había duplicados en las 853 845 filas existentes.

Tras aplicar la migración y regenerar el client, el re-trigger completó exitoso.

## Observaciones

- El verdict GREEN es consistente con el caso: informe cerrado, firmado, con
  signers válidos y trazabilidad completa (validación humana en FM coincide).
- No hubo false positives ni false negatives observados.
- Latencia de agentes muy por debajo del objetivo (<30 s). La mayor parte del
  tiempo total fue el round-trip FM, no el pipeline de validación.
- Logs del API durante el procesamiento (segundo intento): sin warnings ni
  errores. Solo los logs esperados de processor + service.
