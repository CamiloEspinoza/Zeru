import { PractitionersTransformer } from './practitioners.transformer';
import type { FmRecord } from '@zeru/shared';

function makeRecord(fieldData: Record<string, unknown>): FmRecord {
  return {
    recordId: '1',
    modId: '0',
    fieldData,
  };
}

describe('PractitionersTransformer', () => {
  let transformer: PractitionersTransformer;

  beforeEach(() => {
    transformer = new PractitionersTransformer();
  });

  it('targets the PATOLOGOS INFORMANTES layout in BIOPSIAS', () => {
    expect(transformer.database).toBe('BIOPSIAS');
    expect(transformer.layout).toBe('PATOLOGOS INFORMANTES');
  });

  describe('extract()', () => {
    it('parses a three-token name into first + paternal + maternal', () => {
      const result = transformer.extract(
        makeRecord({
          Nombre: 'Ricardo Lobos Cofré',
          Codigo: 'RLC',
          ESPECIALIDAD: 'Anatomía Patológica',
          Asignable: 'Si',
        }),
      );

      expect(result.firstName).toBe('Ricardo');
      expect(result.paternalLastName).toBe('Lobos');
      expect(result.maternalLastName).toBe('Cofré');
      expect(result.code).toBe('RLC');
      expect(result.specialty).toBe('Anatomía Patológica');
      expect(result.isActive).toBe(true);
    });

    it('strips a "Dr." title prefix', () => {
      const result = transformer.extract(
        makeRecord({
          Nombre: 'Dr. Ricardo Lobos Cofré',
          Codigo: 'RLC',
          ESPECIALIDAD: '',
          Asignable: 'Si',
        }),
      );

      expect(result.firstName).toBe('Ricardo');
      expect(result.paternalLastName).toBe('Lobos');
      expect(result.maternalLastName).toBe('Cofré');
    });

    it('strips a "Dra" title prefix (case-insensitive, no period)', () => {
      const result = transformer.extract(
        makeRecord({
          Nombre: 'DRA Ana Pérez',
          Codigo: 'AP',
          ESPECIALIDAD: '',
          Asignable: 'Si',
        }),
      );

      expect(result.firstName).toBe('Ana');
      expect(result.paternalLastName).toBe('Pérez');
      expect(result.maternalLastName).toBeNull();
    });

    it('handles a two-token name (first + paternal, no maternal)', () => {
      const result = transformer.extract(
        makeRecord({
          Nombre: 'Juan Pérez',
          Codigo: 'JP',
          ESPECIALIDAD: '',
          Asignable: 'Si',
        }),
      );

      expect(result.firstName).toBe('Juan');
      expect(result.paternalLastName).toBe('Pérez');
      expect(result.maternalLastName).toBeNull();
    });

    it('handles a single-token name with paternalLastName fallback "-"', () => {
      const result = transformer.extract(
        makeRecord({
          Nombre: 'Solo',
          Codigo: 'S',
          ESPECIALIDAD: '',
          Asignable: 'Si',
        }),
      );

      expect(result.firstName).toBe('Solo');
      expect(result.paternalLastName).toBe('-');
      expect(result.maternalLastName).toBeNull();
    });

    it('handles 4+ token names: first tokens → firstName, last two → surnames', () => {
      const result = transformer.extract(
        makeRecord({
          Nombre: 'Juan Carlos Lobos Cofré',
          Codigo: 'JCLC',
          ESPECIALIDAD: '',
          Asignable: 'Si',
        }),
      );

      expect(result.firstName).toBe('Juan Carlos');
      expect(result.paternalLastName).toBe('Lobos');
      expect(result.maternalLastName).toBe('Cofré');
    });

    it('maps Asignable="No" to isActive=false', () => {
      const result = transformer.extract(
        makeRecord({
          Nombre: 'Juan Pérez',
          Codigo: 'JP',
          ESPECIALIDAD: '',
          Asignable: 'No',
        }),
      );

      expect(result.isActive).toBe(false);
    });

    it('treats empty Asignable as not active (isYes("") → false)', () => {
      const result = transformer.extract(
        makeRecord({
          Nombre: 'Juan Pérez',
          Codigo: 'JP',
          ESPECIALIDAD: '',
          Asignable: '',
        }),
      );

      expect(result.isActive).toBe(false);
    });

    it('returns null specialty when ESPECIALIDAD is empty', () => {
      const result = transformer.extract(
        makeRecord({
          Nombre: 'Juan Pérez',
          Codigo: 'JP',
          ESPECIALIDAD: '',
          Asignable: 'Si',
        }),
      );

      expect(result.specialty).toBeNull();
    });

    it('trims Codigo to build the code', () => {
      const result = transformer.extract(
        makeRecord({
          Nombre: 'Juan Pérez',
          Codigo: '  JP  ',
          ESPECIALIDAD: '',
          Asignable: 'Si',
        }),
      );

      expect(result.code).toBe('JP');
    });
  });
});
