import type { FmRecord } from '@zeru/shared';
import type { ExtractedAttachmentRef } from './types';
import { str, parseNum, parseDate, encodeS3Path } from './helpers';

const DATABASE = 'SCANNER BIOPSIAS CITOLAB 2014';
const LAYOUT = 'FOTOS ENCAPSULACION';

export interface ExtractedEncapsulationRecord {
  fmInformeNumber: number;
  fmRecordId: string;
  fmModId: string;
  scannerCapturedAt: Date | null;
  attachments: ExtractedAttachmentRef[];
}

export const ScannerEncapsulationTransformer = {
  database: DATABASE,
  layout: LAYOUT,

  extract(record: FmRecord): ExtractedEncapsulationRecord {
    const fd = record.fieldData ?? {};
    const informeNumber = parseNum(fd['INFORME Nº']);
    const attachments: ExtractedAttachmentRef[] = [];
    const informeKey = informeNumber > 0 ? String(informeNumber) : 'unknown';

    for (let i = 1; i <= 8; i++) {
      const url = str(fd[`FOTO ${i}`]);
      if (url) {
        attachments.push({
          category: 'ENCAPSULATION_PHOTO',
          label: `Foto encapsulación ${i}`,
          sequenceOrder: i,
          s3Key: `cases/${informeKey}/photos/encapsulation/${i}-${encodeS3Path(url)}`,
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
        s3Key: `cases/${informeKey}/photos/encapsulation/special-${encodeS3Path(special)}`,
        contentType: 'image/jpeg',
        fmSourceField: 'FOTO ENCAPSULACIÓN 1',
        fmContainerUrlOriginal: special,
        citolabS3KeyOriginal: null,
      });
    }

    return {
      fmInformeNumber: informeNumber,
      fmRecordId: record.recordId,
      fmModId: record.modId,
      scannerCapturedAt: parseDate(str(fd['Trazabilidad::Fecha_Scanner'])),
      attachments,
    };
  },
};
