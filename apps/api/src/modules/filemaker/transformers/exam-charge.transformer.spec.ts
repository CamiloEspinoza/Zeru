import { ExamChargeTransformer } from './exam-charge.transformer';
import type { FmRecord } from '@zeru/shared';

function makeBiopsyChargeRecord(overrides: Record<string, unknown> = {}): FmRecord {
  return {
    recordId: '3001',
    modId: '2',
    fieldData: {
      '__pk_Biopsia_Ingreso': 50001,
      '_fk_Informe_Número': 12345,
      '_fk_Tipo de Ingreso': 'TI-001',
      'Tipo de Ingreso::Nombre': 'Convenio',
      'Valor': 25000,
      'Estado Ingreso': 'VALIDADO (María)',
      'Códigos Prestación': '0301039|0301041',
      '_fk_Liquidaciones Instituciones': 'LIQ-001',
      '_fk_Rendición Pago directo': '',
      'Ingreso Fecha': '03/15/2026',
      'Ingreso Responsable': 'María Campos',
      'Punto de ingreso': 'Recepción Central',
      'BIOPSIAS Cobranzas::PROCEDENCIA CODIGO UNICO': 'PROC-001',
      ...overrides,
    },
    portalData: {},
  };
}

function makePapChargeRecord(overrides: Record<string, unknown> = {}): FmRecord {
  return {
    recordId: '4001',
    modId: '1',
    fieldData: {
      '__pk_PAP_Ingreso': 60001,
      '_fk_Informe_Número': 54321,
      '_fk_Tipo de Ingreso': 'TI-002',
      'Tipo de Ingreso::Nombre': 'Efectivo',
      'Valor': 15000,
      'Estado Ingreso': 'VALIDADO (Pedro)',
      'Códigos Prestación': '0301050',
      '_fk_Liquidaciones Instituciones': '',
      '_fk_Rendición Pago directo': 'REN-001',
      'Ingreso Fecha': '03/18/2026',
      'Ingreso Responsable': 'Pedro Gómez',
      'Punto de ingreso': 'Sucursal Norte',
      'PAP Cobranzas::CODIGO UNICO PROCEDENCIA': 'PROC-050',
      ...overrides,
    },
    portalData: {},
  };
}

describe('ExamChargeTransformer', () => {
  let transformer: ExamChargeTransformer;

  beforeEach(() => {
    transformer = new ExamChargeTransformer();
  });

  describe('extractBiopsyCharge()', () => {
    it('extracts basic charge data', () => {
      const record = makeBiopsyChargeRecord();
      const result = transformer.extractBiopsyCharge(record);
      expect(result.fmRecordPk).toBe(50001);
      expect(result.fmSource).toBe('BIOPSIAS_INGRESOS');
      expect(result.fkInformeNumber).toBe(12345);
      expect(result.amount).toBe(25000);
      expect(result.enteredByNameSnapshot).toBe('María Campos');
      expect(result.pointOfEntry).toBe('Recepción Central');
      expect(result.labOriginCodeSnapshot).toBe('PROC-001');
    });

    it('parses payment method from Tipo de Ingreso', () => {
      const record = makeBiopsyChargeRecord({ 'Tipo de Ingreso::Nombre': 'Convenio' });
      const result = transformer.extractBiopsyCharge(record);
      expect(result.paymentMethod).toBe('AGREEMENT');
    });

    it('parses Efectivo payment method', () => {
      const record = makeBiopsyChargeRecord({ 'Tipo de Ingreso::Nombre': 'Efectivo' });
      const result = transformer.extractBiopsyCharge(record);
      expect(result.paymentMethod).toBe('CASH');
    });

    it('parses Bono payment method', () => {
      const record = makeBiopsyChargeRecord({ 'Tipo de Ingreso::Nombre': 'Bono' });
      const result = transformer.extractBiopsyCharge(record);
      expect(result.paymentMethod).toBe('VOUCHER');
    });

    it('parses Cheque payment method', () => {
      const record = makeBiopsyChargeRecord({ 'Tipo de Ingreso::Nombre': 'Cheque' });
      const result = transformer.extractBiopsyCharge(record);
      expect(result.paymentMethod).toBe('CHECK');
    });

    it('parses Transferencia payment method', () => {
      const record = makeBiopsyChargeRecord({ 'Tipo de Ingreso::Nombre': 'Transferencia' });
      const result = transformer.extractBiopsyCharge(record);
      expect(result.paymentMethod).toBe('BANK_TRANSFER');
    });

    it('defaults unknown payment to OTHER', () => {
      const record = makeBiopsyChargeRecord({ 'Tipo de Ingreso::Nombre': 'SomethingNew' });
      const result = transformer.extractBiopsyCharge(record);
      expect(result.paymentMethod).toBe('OTHER');
    });

    it('parses VALIDATED status', () => {
      const record = makeBiopsyChargeRecord({ 'Estado Ingreso': 'VALIDADO (María)' });
      const result = transformer.extractBiopsyCharge(record);
      expect(result.status).toBe('VALIDATED');
    });

    it('parses CANCELLED status', () => {
      const record = makeBiopsyChargeRecord({ 'Estado Ingreso': 'Cancelado' });
      const result = transformer.extractBiopsyCharge(record);
      expect(result.status).toBe('CANCELLED');
    });

    it('defaults to REGISTERED for unknown status', () => {
      const record = makeBiopsyChargeRecord({ 'Estado Ingreso': '' });
      const result = transformer.extractBiopsyCharge(record);
      expect(result.status).toBe('REGISTERED');
    });

    it('parses fee codes from pipe-separated string', () => {
      const record = makeBiopsyChargeRecord({ 'Códigos Prestación': '0301039|0301041' });
      const result = transformer.extractBiopsyCharge(record);
      expect(result.feeCodesText).toBe('0301039|0301041');
      expect(result.feeCodes).toEqual(['0301039', '0301041']);
    });

    it('handles single fee code', () => {
      const record = makeBiopsyChargeRecord({ 'Códigos Prestación': '0301039' });
      const result = transformer.extractBiopsyCharge(record);
      expect(result.feeCodes).toEqual(['0301039']);
    });

    it('handles empty fee codes', () => {
      const record = makeBiopsyChargeRecord({ 'Códigos Prestación': '' });
      const result = transformer.extractBiopsyCharge(record);
      expect(result.feeCodesText).toBeNull();
      expect(result.feeCodes).toEqual([]);
    });

    it('extracts liquidation FK', () => {
      const record = makeBiopsyChargeRecord({ '_fk_Liquidaciones Instituciones': 'LIQ-001' });
      const result = transformer.extractBiopsyCharge(record);
      expect(result.fkLiquidacion).toBe('LIQ-001');
    });

    it('extracts rendicion FK', () => {
      const record = makeBiopsyChargeRecord({ '_fk_Rendición Pago directo': 'REN-001' });
      const result = transformer.extractBiopsyCharge(record);
      expect(result.fkRendicion).toBe('REN-001');
    });

    it('parses entry date', () => {
      const record = makeBiopsyChargeRecord({ 'Ingreso Fecha': '03/15/2026' });
      const result = transformer.extractBiopsyCharge(record);
      expect(result.enteredAt).toBeInstanceOf(Date);
      expect(result.enteredAt!.getMonth()).toBe(2);
    });
  });

  describe('extractPapCharge()', () => {
    it('extracts basic PAP charge data', () => {
      const record = makePapChargeRecord();
      const result = transformer.extractPapCharge(record);
      expect(result.fmRecordPk).toBe(60001);
      expect(result.fmSource).toBe('PAP_INGRESOS');
      expect(result.fkInformeNumber).toBe(54321);
      expect(result.amount).toBe(15000);
      expect(result.labOriginCodeSnapshot).toBe('PROC-050');
    });

    it('uses PAP PK field', () => {
      const record = makePapChargeRecord({ '__pk_PAP_Ingreso': 77777 });
      const result = transformer.extractPapCharge(record);
      expect(result.fmRecordPk).toBe(77777);
    });

    it('uses PAP procedencia field', () => {
      const record = makePapChargeRecord({ 'PAP Cobranzas::CODIGO UNICO PROCEDENCIA': 'PAP-999' });
      const result = transformer.extractPapCharge(record);
      expect(result.labOriginCodeSnapshot).toBe('PAP-999');
    });
  });

  describe('edge cases', () => {
    it('handles zero amount', () => {
      const record = makeBiopsyChargeRecord({ 'Valor': 0 });
      const result = transformer.extractBiopsyCharge(record);
      expect(result.amount).toBe(0);
    });

    it('handles string amount with currency format', () => {
      const record = makeBiopsyChargeRecord({ 'Valor': '$25.000' });
      const result = transformer.extractBiopsyCharge(record);
      expect(result.amount).toBe(25000);
    });
  });

  describe('biopsyChargeToFm()', () => {
    const baseCharge = {
      fkInformeNumber: 12345,
      fkTipoIngreso: 7 as number | null,
      amount: 25000,
      feeCodesText: 'BIO-001|BIO-002',
      statusName: 'Registrado',
      enteredAt: new Date('2026-03-15'),
      enteredByNameSnapshot: 'Maria Lopez',
      pointOfEntry: 'Ventanilla 1',
      fkLiquidacion: '1234',
      fkRendicion: null,
    };

    it('produces correct FM fields', () => {
      const result = transformer.biopsyChargeToFm(baseCharge);
      expect(result['_fk_Informe_Número']).toBe(12345);
      expect(result['_fk_Tipo de Ingreso']).toBe(7);
      expect(result['Valor']).toBe(25000);
      expect(result['Estado Ingreso']).toBe('Registrado');
      expect(result['Ingreso Responsable']).toBe('Maria Lopez');
      expect(result['_fk_Liquidaciones Instituciones']).toBe('1234');
      expect(result['_fk_Rendición Pago directo']).toBe('');
    });
  });

  describe('papChargeToFm()', () => {
    const baseCharge = {
      fkInformeNumber: 12345,
      fkTipoIngreso: 7 as number | null,
      amount: 25000,
      feeCodesText: 'BIO-001|BIO-002',
      statusName: 'Registrado',
      enteredAt: new Date('2026-03-15'),
      enteredByNameSnapshot: 'Maria Lopez',
      pointOfEntry: 'Ventanilla 1',
      fkLiquidacion: '1234',
      fkRendicion: null,
    };

    it('uses PAP field names with FK', () => {
      const result = transformer.papChargeToFm(baseCharge);
      expect(result['_fk_Tipo de Ingreso']).toBe(7);
      expect(result['Valor']).toBe(25000);
    });
  });

  describe('cancelToFm()', () => {
    it('sets status to Cancelado', () => {
      const result = transformer.cancelToFm();
      expect(result['Estado Ingreso']).toBe('Cancelado');
    });
  });
});
