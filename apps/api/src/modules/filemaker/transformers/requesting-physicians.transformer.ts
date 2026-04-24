import { Injectable } from '@nestjs/common';
import type { FmRecord } from '@zeru/shared';
import { str, splitFullName } from './helpers';
import type { ExtractedPractitioner } from './types';

/**
 * FM layout `MEDICOS ENVIO MATERIAL` (~1,437 rows) — lists the doctors that
 * send material to Citolab. These become LabPractitioner rows with
 * role=REQUESTING_PHYSICIAN, isInternal=false.
 *
 * Fields available in FM:
 *   - SOLICITADO POR (Text) — full name, free-form
 *   - PROCEDENCIA    (Text) — where they work (free-form string, not FK)
 *   - CODIGO         (Number) — internal numeric id
 */
@Injectable()
export class RequestingPhysiciansTransformer {
  readonly database = 'BIOPSIAS';
  readonly layout = 'MEDICOS ENVIO MATERIAL';

  extract(record: FmRecord): ExtractedPractitioner {
    const d = record.fieldData;
    const { firstName, paternalLastName, maternalLastName } = splitFullName(
      str(d['SOLICITADO POR']),
    );

    return {
      code: str(d['CODIGO']),
      firstName,
      paternalLastName,
      maternalLastName,
      // No specialty in this catalog — schema field stays null.
      specialty: null,
      // FM doesn't track active/inactive for requesting physicians; assume active.
      isActive: true,
    };
  }
}
