import { CommunicationTransformer } from './communication.transformer';
import type { FmRecord } from '@zeru/shared';

function makeBiopsyCommunicationRecord(
  portalRows: Record<string, unknown>[] = [],
): FmRecord {
  return {
    recordId: '7001',
    modId: '1',
    fieldData: {
      'INFORME Nº': 12345,
    },
    portalData: {
      COMUNICACIONES: portalRows,
    },
  };
}

function makePapCommunicationRecord(overrides: Record<string, unknown> = {}): FmRecord {
  return {
    recordId: '8001',
    modId: '1',
    fieldData: {
      'fk_InformeNumero': 54321,
      'Motivo': 'Muestra insuficiente',
      'Comentario': 'La muestra no es apta para procesamiento',
      'IngresoFecha': '03/15/2026',
      'IngresoHora': '14:30:00',
      'IngresoResponsable': 'Tec. Sánchez',
      'Respuesta': 'Se solicitó nueva muestra',
      ...overrides,
    },
    portalData: {},
  };
}

describe('CommunicationTransformer', () => {
  let transformer: CommunicationTransformer;

  beforeEach(() => {
    transformer = new CommunicationTransformer();
  });

  describe('extractFromBiopsyPortal()', () => {
    it('extracts communications from portal rows', () => {
      const record = makeBiopsyCommunicationRecord([
        {
          'COMUNICACIONES::MOTIVO': 'Muestra dañada',
          'COMUNICACIONES::COMENTARIO': 'Se recibió en mal estado',
          'COMUNICACIONES::Ingreso Fecha': '03/15/2026',
          'COMUNICACIONES::Ingreso Hora': '10:00:00',
          'COMUNICACIONES::Ingreso Responsable': 'María',
          'COMUNICACIONES::Respuesta': 'Se reenvía muestra',
        },
      ]);
      const result = transformer.extractFromBiopsyPortal(record);
      expect(result.length).toBe(1);
      expect(result[0].fkInformeNumber).toBe(12345);
      expect(result[0].reason).toBe('Muestra dañada');
      expect(result[0].content).toBe('Se recibió en mal estado');
      expect(result[0].loggedByNameSnapshot).toBe('María');
      expect(result[0].response).toBe('Se reenvía muestra');
    });

    it('extracts multiple portal rows', () => {
      const record = makeBiopsyCommunicationRecord([
        {
          'COMUNICACIONES::MOTIVO': 'Motivo 1',
          'COMUNICACIONES::COMENTARIO': 'Comentario 1',
          'COMUNICACIONES::Ingreso Fecha': '03/15/2026',
          'COMUNICACIONES::Ingreso Hora': '',
          'COMUNICACIONES::Ingreso Responsable': 'A',
          'COMUNICACIONES::Respuesta': '',
        },
        {
          'COMUNICACIONES::MOTIVO': 'Motivo 2',
          'COMUNICACIONES::COMENTARIO': 'Comentario 2',
          'COMUNICACIONES::Ingreso Fecha': '03/16/2026',
          'COMUNICACIONES::Ingreso Hora': '',
          'COMUNICACIONES::Ingreso Responsable': 'B',
          'COMUNICACIONES::Respuesta': 'Resp 2',
        },
      ]);
      const result = transformer.extractFromBiopsyPortal(record);
      expect(result.length).toBe(2);
    });

    it('handles empty portal', () => {
      const record = makeBiopsyCommunicationRecord([]);
      const result = transformer.extractFromBiopsyPortal(record);
      expect(result).toEqual([]);
    });

    it('handles missing portal', () => {
      const record: FmRecord = {
        recordId: '7001',
        modId: '1',
        fieldData: { 'INFORME Nº': 12345 },
        portalData: {},
      };
      const result = transformer.extractFromBiopsyPortal(record);
      expect(result).toEqual([]);
    });

    it('parses loggedAt from date + time', () => {
      const record = makeBiopsyCommunicationRecord([
        {
          'COMUNICACIONES::MOTIVO': 'Test',
          'COMUNICACIONES::COMENTARIO': 'Content',
          'COMUNICACIONES::Ingreso Fecha': '03/15/2026',
          'COMUNICACIONES::Ingreso Hora': '14:30:00',
          'COMUNICACIONES::Ingreso Responsable': 'User',
          'COMUNICACIONES::Respuesta': '',
        },
      ]);
      const result = transformer.extractFromBiopsyPortal(record);
      expect(result[0].loggedAt).toBeInstanceOf(Date);
      expect(result[0].loggedAt!.getHours()).toBe(14);
    });

    it('returns null response when empty', () => {
      const record = makeBiopsyCommunicationRecord([
        {
          'COMUNICACIONES::MOTIVO': 'Test',
          'COMUNICACIONES::COMENTARIO': 'Content',
          'COMUNICACIONES::Ingreso Fecha': '03/15/2026',
          'COMUNICACIONES::Ingreso Hora': '',
          'COMUNICACIONES::Ingreso Responsable': 'User',
          'COMUNICACIONES::Respuesta': '',
        },
      ]);
      const result = transformer.extractFromBiopsyPortal(record);
      expect(result[0].response).toBeNull();
    });

    it('skips rows where comentario is empty', () => {
      const record = makeBiopsyCommunicationRecord([
        {
          'COMUNICACIONES::MOTIVO': 'Motivo',
          'COMUNICACIONES::COMENTARIO': '',
          'COMUNICACIONES::Ingreso Fecha': '03/15/2026',
          'COMUNICACIONES::Ingreso Hora': '',
          'COMUNICACIONES::Ingreso Responsable': 'User',
          'COMUNICACIONES::Respuesta': '',
        },
      ]);
      const result = transformer.extractFromBiopsyPortal(record);
      expect(result.length).toBe(0);
    });
  });

  describe('extractFromPapRecord()', () => {
    it('extracts communication from standalone PAP record', () => {
      const record = makePapCommunicationRecord();
      const result = transformer.extractFromPapRecord(record);
      expect(result).not.toBeNull();
      expect(result!.fkInformeNumber).toBe(54321);
      expect(result!.reason).toBe('Muestra insuficiente');
      expect(result!.content).toBe('La muestra no es apta para procesamiento');
      expect(result!.loggedByNameSnapshot).toBe('Tec. Sánchez');
      expect(result!.response).toBe('Se solicitó nueva muestra');
    });

    it('parses loggedAt from date + time', () => {
      const record = makePapCommunicationRecord({
        'IngresoFecha': '03/15/2026',
        'IngresoHora': '14:30:00',
      });
      const result = transformer.extractFromPapRecord(record);
      expect(result!.loggedAt).toBeInstanceOf(Date);
      expect(result!.loggedAt!.getHours()).toBe(14);
    });

    it('returns null when Comentario is empty', () => {
      const record = makePapCommunicationRecord({ 'Comentario': '' });
      const result = transformer.extractFromPapRecord(record);
      expect(result).toBeNull();
    });

    it('returns null response when empty', () => {
      const record = makePapCommunicationRecord({ 'Respuesta': '' });
      const result = transformer.extractFromPapRecord(record);
      expect(result!.response).toBeNull();
    });
  });

  describe('category inference', () => {
    it('infers SAMPLE_QUALITY_ISSUE from motivo', () => {
      const record = makePapCommunicationRecord({ 'Motivo': 'Muestra insuficiente' });
      const result = transformer.extractFromPapRecord(record);
      expect(result!.category).toBe('SAMPLE_QUALITY_ISSUE');
    });

    it('infers ADDITIONAL_INFO_REQUEST', () => {
      const record = makePapCommunicationRecord({ 'Motivo': 'Solicitud de antecedentes' });
      const result = transformer.extractFromPapRecord(record);
      expect(result!.category).toBe('ADDITIONAL_INFO_REQUEST');
    });

    it('infers CRITICAL_RESULT', () => {
      const record = makePapCommunicationRecord({ 'Motivo': 'Resultado crítico' });
      const result = transformer.extractFromPapRecord(record);
      expect(result!.category).toBe('CRITICAL_RESULT');
    });

    it('infers CORRECTION_REQUEST', () => {
      const record = makePapCommunicationRecord({ 'Motivo': 'Corrección de informe' });
      const result = transformer.extractFromPapRecord(record);
      expect(result!.category).toBe('CORRECTION_REQUEST');
    });

    it('defaults to OTHER for unknown motivo', () => {
      const record = makePapCommunicationRecord({ 'Motivo': 'Otro motivo' });
      const result = transformer.extractFromPapRecord(record);
      expect(result!.category).toBe('OTHER');
    });

    it('returns null category when motivo is empty', () => {
      const record = makePapCommunicationRecord({ 'Motivo': '' });
      const result = transformer.extractFromPapRecord(record);
      expect(result!.category).toBeNull();
    });
  });
});
