import { Injectable } from '@nestjs/common';
import type { FmRecord } from '@zeru/shared';
import { str, parseNum, parseDate } from './helpers';
import type { ExtractedWorkflowEvent, WorkflowEventTypeValue } from './types';

interface TraceabilityResult {
  fmInformeNumber: number;
  fmRecordId: string;
  events: ExtractedWorkflowEvent[];
}

/**
 * Step definitions mapping FM traceability field names to WorkflowEventType.
 * Order matters — it defines sequenceOrder.
 */
const TRACEABILITY_STEPS: { label: string; eventType: WorkflowEventTypeValue }[] = [
  { label: 'Ingreso examen', eventType: 'ORIGIN_INTAKE' },
  { label: 'Entrega a Estafeta en origen', eventType: 'ORIGIN_HANDOFF_TO_COURIER' },
  { label: 'Transporte', eventType: 'TRANSPORT' },
  { label: 'Recibe en Citolab', eventType: 'RECEIVED_AT_LAB' },
  { label: 'Macroscopía', eventType: 'MACROSCOPY' },
  { label: 'Inclusión', eventType: 'EMBEDDING' },
  { label: 'Corte tinción montaje y registro de placas', eventType: 'CUTTING_STAINING' },
  { label: 'Patólogo informante histología', eventType: 'HISTOLOGY_REPORTING' },
  { label: 'Validación', eventType: 'VALIDATION' },
  { label: 'Aprueba resultado', eventType: 'APPROVAL' },
  { label: 'Entrega resultado', eventType: 'DELIVERY' },
];

@Injectable()
export class TraceabilityTransformer {
  readonly database = 'BIOPSIAS';
  readonly layout = 'TRAZA';

  /**
   * Write macroscopy completion event to FM Trazabilidad record.
   * Updates the Responsable_Macroscopia and Fecha_Macroscopia fields.
   */
  macroscopyEventToFm(data: {
    performedByNameSnapshot: string;
    occurredAt: Date;
  }): Record<string, unknown> {
    return {
      'Trazabilidad::Responsable_Macroscopía': data.performedByNameSnapshot,
      'Trazabilidad::Fecha_Macroscopia': formatFmDate(data.occurredAt),
    };
  }

  extract(record: FmRecord): TraceabilityResult {
    const d = record.fieldData;
    const events: ExtractedWorkflowEvent[] = [];
    let order = 0;

    for (const step of TRACEABILITY_STEPS) {
      const responsableField = `Trazabilidad::Responsable_${step.label}`;
      const fechaField = `Trazabilidad::Fecha_${step.label}`;
      const responsable = str(d[responsableField]);
      const fechaStr = str(d[fechaField]);

      // Skip if both are empty
      if (!responsable && !fechaStr) continue;

      const occurredAt = parseDate(fechaStr) ?? new Date(0);

      order++;
      events.push({
        eventType: step.eventType,
        sequenceOrder: order,
        occurredAt,
        performedByNameSnapshot: responsable || 'Desconocido',
        sourceField: responsableField,
      });
    }

    return {
      fmInformeNumber: parseNum(d['INFORME Nº']),
      fmRecordId: record.recordId,
      events,
    };
  }
}

function formatFmDate(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const year = d.getFullYear();
  return `${month}/${day}/${year}`;
}
