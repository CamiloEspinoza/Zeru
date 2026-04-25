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

  /**
   * Codes are prefixed with `RP-` so they live in a different namespace from
   * pathologists (`PATOLOGOS INFORMANTES` uses short alpha codes like `RLC`,
   * but a numeric pathologist code is plausible — without the prefix a
   * collision on `(tenantId, code)` would silently flip a pathologist into a
   * requesting physician on re-import).
   */
  extract(record: FmRecord): ExtractedPractitioner {
    const d = record.fieldData;
    const { firstName, paternalLastName, maternalLastName } = splitFullName(
      str(d['SOLICITADO POR']),
    );
    const rawCode = str(d['CODIGO']);

    return {
      code: rawCode ? `RP-${rawCode}` : '',
      firstName,
      paternalLastName,
      maternalLastName,
      // No specialty in this catalog — schema field stays null.
      specialty: null,
      // FM doesn't track active/inactive for requesting physicians; assume
      // active on first import. Manual deactivations in Postgres are
      // preserved on re-runs (handler does not pass isActive in update).
      isActive: true,
    };
  }
}
