import { Injectable } from '@nestjs/common';
import type { FmRecord } from '@zeru/shared';
import { str, isYes, splitFullName } from './helpers';
import type { ExtractedPractitioner } from './types';

@Injectable()
export class PractitionersTransformer {
  readonly database = 'BIOPSIAS';
  readonly layout = 'PATOLOGOS INFORMANTES';

  extract(record: FmRecord): ExtractedPractitioner {
    const d = record.fieldData;
    const { firstName, paternalLastName, maternalLastName } = splitFullName(str(d['Nombre']));

    return {
      code: str(d['Codigo']),
      firstName,
      paternalLastName,
      maternalLastName,
      specialty: str(d['ESPECIALIDAD']) || null,
      isActive: isYes(str(d['Asignable'])),
    };
  }
}
