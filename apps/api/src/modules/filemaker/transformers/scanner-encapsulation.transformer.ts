import type { FmRecord } from '@zeru/shared';
import type { ExtractedAttachmentRef } from './types';
import { str, parseNum, parseDate, encodeS3Path } from './helpers';

const DATABASE = 'SCANNER BIOPSIAS CITOLAB 2014';
const LAYOUT = 'FOTOS ENCAPSULACION';

export interface ExtractedEncapsulationRecord {
  fmInformeNumber: number;
  fmInformeKey: string;
  fmRecordId: string;
  fmModId: string;
  scannerCapturedAt: Date | null;
  attachments: ExtractedAttachmentRef[];
}

/**
 * Extrae el basename del path de la URL de FM (ej: foto1.jpg).
 * Si la URL no parsea, devuelve un sentinel determinístico.
 */
function urlBasename(url: string): string {
  try {
    const parsed = new URL(url);
    const last = parsed.pathname.split('/').filter(Boolean).pop();
    return last ? encodeS3Path(last) : 'attachment';
  } catch {
    return 'attachment';
  }
}

export const ScannerEncapsulationTransformer = {
  database: DATABASE,
  layout: LAYOUT,

  extract(record: FmRecord): ExtractedEncapsulationRecord {
    const fd = record.fieldData ?? {};
    // INFORME Nº puede venir como número (88888) o string compuesto ("2026-99999").
    // Preservamos el valor original como informeKey para el path S3 y dejamos
    // fmInformeNumber=0 si no parsea numéricamente (consumidor decide).
    const rawInforme = str(fd['INFORME Nº']);
    const informeNumber = parseNum(fd['INFORME Nº']);
    const informeKey = rawInforme
      ? rawInforme.replace(/[^a-zA-Z0-9_-]/g, '_')
      : 'unknown';
    const attachments: ExtractedAttachmentRef[] = [];

    for (let i = 1; i <= 8; i++) {
      const url = str(fd[`FOTO ${i}`]);
      if (url) {
        attachments.push({
          category: 'ENCAPSULATION_PHOTO',
          label: `Foto encapsulación ${i}`,
          sequenceOrder: i,
          s3Key: `cases/${informeKey}/photos/encapsulation/${i}-${urlBasename(url)}`,
          contentType: 'image/jpeg',
          fmSourceField: `FOTO ${i}`,
          fmContainerUrlOriginal: url,
          citolabS3KeyOriginal: null,
        });
      }
    }

    const special = str(fd['FOTO ENCAPSULACIÓN 1']);
    if (special) {
      attachments.push({
        category: 'ENCAPSULATION_PHOTO',
        label: 'Foto encapsulación especial',
        sequenceOrder: 99,
        s3Key: `cases/${informeKey}/photos/encapsulation/special-${urlBasename(special)}`,
        contentType: 'image/jpeg',
        fmSourceField: 'FOTO ENCAPSULACIÓN 1',
        fmContainerUrlOriginal: special,
        citolabS3KeyOriginal: null,
      });
    }

    return {
      fmInformeNumber: informeNumber,
      fmInformeKey: informeKey,
      fmRecordId: record.recordId,
      fmModId: record.modId,
      scannerCapturedAt: parseDate(str(fd['Trazabilidad::Fecha_Scanner'])),
      attachments,
    };
  },
};
