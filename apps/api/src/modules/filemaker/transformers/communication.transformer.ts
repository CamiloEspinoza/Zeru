import { Injectable } from '@nestjs/common';
import type { FmRecord } from '@zeru/shared';
import { str, parseNum, parseFmDateTime } from './helpers';
import type { ExtractedCommunication, CommunicationCategoryType } from './types';

@Injectable()
export class CommunicationTransformer {
  readonly biopsyDatabase = 'BIOPSIAS';
  readonly biopsyLayout = 'Validación Final*';
  readonly papDatabase = 'PAPANICOLAOU';
  readonly papLayout = 'COMUNICACIONES';

  /**
   * Extract communications from the COMUNICACIONES portal on a biopsy record.
   */
  extractFromBiopsyPortal(record: FmRecord): ExtractedCommunication[] {
    const portalData = record.portalData?.['COMUNICACIONES'];
    if (!portalData || !Array.isArray(portalData)) return [];

    const informeNumber = parseNum(record.fieldData['INFORME Nº']);

    return portalData
      .map((row: Record<string, unknown>) => {
        const content = str(row['COMUNICACIONES::COMENTARIO']);
        if (!content) return null;

        const motivo = str(row['COMUNICACIONES::MOTIVO']);
        const responseText = str(row['COMUNICACIONES::Respuesta']);

        return {
          fkInformeNumber: informeNumber,
          reason: motivo || null,
          content,
          response: responseText || null,
          loggedAt: parseFmDateTime(
            str(row['COMUNICACIONES::Ingreso Fecha']),
            str(row['COMUNICACIONES::Ingreso Hora']),
          ),
          loggedByNameSnapshot:
            str(row['COMUNICACIONES::Ingreso Responsable']) || 'Desconocido',
          category: inferCategory(motivo),
        };
      })
      .filter((c): c is ExtractedCommunication => c !== null);
  }

  /**
   * Extract a single communication from a standalone PAP COMUNICACIONES record.
   */
  extractFromPapRecord(record: FmRecord): ExtractedCommunication | null {
    const d = record.fieldData;
    const content = str(d['Comentario']);
    if (!content) return null;

    const motivo = str(d['Motivo']);
    const responseText = str(d['Respuesta']);

    return {
      fkInformeNumber: parseNum(d['fk_InformeNumero']),
      reason: motivo || null,
      content,
      response: responseText || null,
      loggedAt: parseFmDateTime(str(d['IngresoFecha']), str(d['IngresoHora'])),
      loggedByNameSnapshot: str(d['IngresoResponsable']) || 'Desconocido',
      category: inferCategory(motivo),
    };
  }
}

// ── Pure helpers ──

function inferCategory(motivo: string): CommunicationCategoryType | null {
  if (!motivo) return null;

  const lower = motivo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (
    lower.includes('muestra') &&
    (lower.includes('insuficiente') ||
      lower.includes('danada') ||
      lower.includes('calidad'))
  )
    return 'SAMPLE_QUALITY_ISSUE';
  if (
    lower.includes('solicitud') ||
    lower.includes('antecedentes') ||
    lower.includes('informacion adicional')
  )
    return 'ADDITIONAL_INFO_REQUEST';
  if (
    lower.includes('critico') ||
    lower.includes('alterado') ||
    lower.includes('urgente')
  )
    return 'CRITICAL_RESULT';
  if (
    lower.includes('correccion') ||
    lower.includes('enmienda') ||
    lower.includes('modificacion')
  )
    return 'CORRECTION_REQUEST';
  if (lower.includes('calidad') && lower.includes('interno'))
    return 'INTERNAL_QC';
  if (
    lower.includes('consulta') ||
    lower.includes('cliente') ||
    lower.includes('procedencia')
  )
    return 'CLIENT_INQUIRY';

  return 'OTHER';
}
