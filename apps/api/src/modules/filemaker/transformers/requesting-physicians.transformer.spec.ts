import { RequestingPhysiciansTransformer } from './requesting-physicians.transformer';
import type { FmRecord } from '@zeru/shared';

function makeRecord(fieldData: Record<string, unknown>): FmRecord {
  return { recordId: '1', modId: '0', fieldData };
}

describe('RequestingPhysiciansTransformer', () => {
  let transformer: RequestingPhysiciansTransformer;

  beforeEach(() => {
    transformer = new RequestingPhysiciansTransformer();
  });

  it('targets MEDICOS ENVIO MATERIAL in BIOPSIAS', () => {
    expect(transformer.database).toBe('BIOPSIAS');
    expect(transformer.layout).toBe('MEDICOS ENVIO MATERIAL');
  });

  describe('extract()', () => {
    it('maps SOLICITADO POR + CODIGO into a practitioner', () => {
      const r = transformer.extract(
        makeRecord({
          'SOLICITADO POR': 'Dr. Juan Pérez Soto',
          'PROCEDENCIA': 'Clínica Central',
          'CODIGO': 1234,
        }),
      );

      expect(r.code).toBe('1234');
      expect(r.firstName).toBe('Juan');
      expect(r.paternalLastName).toBe('Pérez');
      expect(r.maternalLastName).toBe('Soto');
      expect(r.specialty).toBeNull();
      expect(r.isActive).toBe(true);
    });

    it('coerces numeric CODIGO to string', () => {
      const r = transformer.extract(
        makeRecord({ 'SOLICITADO POR': 'Ana Díaz', 'CODIGO': 42 }),
      );
      expect(r.code).toBe('42');
    });

    it('handles a single-token name with paternalLastName fallback', () => {
      const r = transformer.extract(
        makeRecord({ 'SOLICITADO POR': 'Soloname', 'CODIGO': 7 }),
      );
      expect(r.firstName).toBe('Soloname');
      expect(r.paternalLastName).toBe('-');
      expect(r.maternalLastName).toBeNull();
    });
  });
});
