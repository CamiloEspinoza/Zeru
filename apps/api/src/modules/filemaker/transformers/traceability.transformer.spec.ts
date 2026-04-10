import { TraceabilityTransformer } from './traceability.transformer';
import type { FmRecord } from '@zeru/shared';

function makeTraceRecord(overrides: Record<string, unknown> = {}): FmRecord {
  return {
    recordId: '6001',
    modId: '2',
    fieldData: {
      'INFORME Nº': 12345,
      'Trazabilidad::Responsable_Ingreso examen': 'Ana Torres',
      'Trazabilidad::Fecha_Ingreso examen': '03/10/2026',
      'Trazabilidad::Responsable_Entrega a Estafeta en origen': 'Carlos Ruiz',
      'Trazabilidad::Fecha_Entrega a Estafeta en origen': '03/10/2026',
      'Trazabilidad::Responsable_Transporte': 'Pedro López',
      'Trazabilidad::Fecha_Transporte': '03/11/2026',
      'Trazabilidad::Responsable_Recibe en Citolab': 'María Campos',
      'Trazabilidad::Fecha_Recibe en Citolab': '03/11/2026',
      'Trazabilidad::Responsable_Macroscopía': 'Dr. Martínez',
      'Trazabilidad::Fecha_Macroscopía': '03/12/2026',
      'Trazabilidad::Responsable_Inclusión': 'Tec. Soto',
      'Trazabilidad::Fecha_Inclusión': '03/12/2026',
      'Trazabilidad::Responsable_Corte tinción montaje y registro de placas': 'Tec. Vega',
      'Trazabilidad::Fecha_Corte tinción montaje y registro de placas': '03/13/2026',
      'Trazabilidad::Responsable_Patólogo informante histología': 'Dr. García',
      'Trazabilidad::Fecha_Patólogo informante histología': '03/13/2026',
      'Trazabilidad::Responsable_Validación': 'Sec. Mora',
      'Trazabilidad::Fecha_Validación': '03/14/2026',
      'Trazabilidad::Responsable_Aprueba resultado': 'Dr. González',
      'Trazabilidad::Fecha_Aprueba resultado': '03/14/2026',
      'Trazabilidad::Responsable_Entrega resultado': 'Ana Torres',
      'Trazabilidad::Fecha_Entrega resultado': '03/15/2026',
      ...overrides,
    },
    portalData: {},
  };
}

describe('TraceabilityTransformer', () => {
  let transformer: TraceabilityTransformer;

  beforeEach(() => {
    transformer = new TraceabilityTransformer();
  });

  describe('extract()', () => {
    it('extracts all 11 workflow steps', () => {
      const record = makeTraceRecord();
      const result = transformer.extract(record);
      expect(result.fmInformeNumber).toBe(12345);
      expect(result.events.length).toBe(11);
    });

    it('assigns correct event types in order', () => {
      const record = makeTraceRecord();
      const result = transformer.extract(record);
      const types = result.events.map(e => e.eventType);
      expect(types).toEqual([
        'ORIGIN_INTAKE',
        'ORIGIN_HANDOFF_TO_COURIER',
        'TRANSPORT',
        'RECEIVED_AT_LAB',
        'MACROSCOPY',
        'EMBEDDING',
        'CUTTING_STAINING',
        'HISTOLOGY_REPORTING',
        'VALIDATION',
        'APPROVAL',
        'DELIVERY',
      ]);
    });

    it('assigns sequential order numbers', () => {
      const record = makeTraceRecord();
      const result = transformer.extract(record);
      const orders = result.events.map(e => e.sequenceOrder);
      expect(orders).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    });

    it('extracts performer name and date', () => {
      const record = makeTraceRecord();
      const result = transformer.extract(record);
      const intake = result.events[0];
      expect(intake.performedByNameSnapshot).toBe('Ana Torres');
      expect(intake.occurredAt).toBeInstanceOf(Date);
      expect(intake.occurredAt.getMonth()).toBe(2); // March
    });

    it('skips steps where both name and date are empty', () => {
      const record = makeTraceRecord({
        'Trazabilidad::Responsable_Transporte': '',
        'Trazabilidad::Fecha_Transporte': '',
        'Trazabilidad::Responsable_Inclusión': '',
        'Trazabilidad::Fecha_Inclusión': '',
      });
      const result = transformer.extract(record);
      expect(result.events.length).toBe(9); // 11 - 2 skipped
    });

    it('includes step when only name is present (uses epoch date)', () => {
      const record = makeTraceRecord({
        'Trazabilidad::Fecha_Transporte': '',
        'Trazabilidad::Responsable_Transporte': 'Pedro',
      });
      const result = transformer.extract(record);
      const transport = result.events.find(e => e.eventType === 'TRANSPORT');
      expect(transport).toBeDefined();
      expect(transport!.performedByNameSnapshot).toBe('Pedro');
    });

    it('includes step when only date is present (uses "Desconocido" name)', () => {
      const record = makeTraceRecord({
        'Trazabilidad::Responsable_Transporte': '',
        'Trazabilidad::Fecha_Transporte': '03/11/2026',
      });
      const result = transformer.extract(record);
      const transport = result.events.find(e => e.eventType === 'TRANSPORT');
      expect(transport).toBeDefined();
      expect(transport!.performedByNameSnapshot).toBe('Desconocido');
    });

    it('populates sourceField with FM field name', () => {
      const record = makeTraceRecord();
      const result = transformer.extract(record);
      expect(result.events[0].sourceField).toBe('Trazabilidad::Responsable_Ingreso examen');
    });
  });

  describe('edge cases', () => {
    it('handles empty record', () => {
      const emptyRecord: FmRecord = {
        recordId: '999',
        modId: '1',
        fieldData: {},
        portalData: {},
      };
      const result = transformer.extract(emptyRecord);
      expect(result.fmInformeNumber).toBe(0);
      expect(result.events).toEqual([]);
    });

    it('handles record with only some steps', () => {
      const record = makeTraceRecord({
        'Trazabilidad::Responsable_Ingreso examen': 'Ana',
        'Trazabilidad::Fecha_Ingreso examen': '03/10/2026',
        // All other steps are empty by removing them
        'Trazabilidad::Responsable_Entrega a Estafeta en origen': '',
        'Trazabilidad::Fecha_Entrega a Estafeta en origen': '',
        'Trazabilidad::Responsable_Transporte': '',
        'Trazabilidad::Fecha_Transporte': '',
        'Trazabilidad::Responsable_Recibe en Citolab': '',
        'Trazabilidad::Fecha_Recibe en Citolab': '',
        'Trazabilidad::Responsable_Macroscopía': '',
        'Trazabilidad::Fecha_Macroscopía': '',
        'Trazabilidad::Responsable_Inclusión': '',
        'Trazabilidad::Fecha_Inclusión': '',
        'Trazabilidad::Responsable_Corte tinción montaje y registro de placas': '',
        'Trazabilidad::Fecha_Corte tinción montaje y registro de placas': '',
        'Trazabilidad::Responsable_Patólogo informante histología': '',
        'Trazabilidad::Fecha_Patólogo informante histología': '',
        'Trazabilidad::Responsable_Validación': '',
        'Trazabilidad::Fecha_Validación': '',
        'Trazabilidad::Responsable_Aprueba resultado': '',
        'Trazabilidad::Fecha_Aprueba resultado': '',
        'Trazabilidad::Responsable_Entrega resultado': '',
        'Trazabilidad::Fecha_Entrega resultado': '',
      });
      const result = transformer.extract(record);
      expect(result.events.length).toBe(1);
      expect(result.events[0].eventType).toBe('ORIGIN_INTAKE');
    });
  });
});
