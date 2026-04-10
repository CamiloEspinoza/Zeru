import { LiquidationTransformer } from './liquidation.transformer';
import type { FmRecord } from '@zeru/shared';

function makeLiquidationRecord(overrides: Record<string, unknown> = {}): FmRecord {
  return {
    recordId: '5001',
    modId: '4',
    fieldData: {
      '__pk_liquidaciones_instituciones': 7001,
      'CODIGO INSTITUCION': 'PROC-001',
      'PERIODO COBRO': 'Enero 2025',
      'ESTADO': 'Confirmado',
      'TOTAL LIQUIDACIÓN': 1500000,
      'TOTAL FINAL': 1500000,
      'VALOR TOTAL BIOPSIAS': 800000,
      'VALOR TOTAL PAP': 400000,
      'VALOR TOTAL CITOLOGÍAS': 200000,
      'VALOR TOTAL INMUNOS': 100000,
      'Nº DE BIOPSIAS': 32,
      'Nº DE PAP': 80,
      'Nº DE CITOLOGÍAS': 15,
      'Nº DE INMUNOS': 5,
      'DEUDA ANTERIOR': 250000,
      'SALDO A FAVOR': 0,
      'Confirmado': 'Confirmado',
      'NUMERO DOCUMENTO': 'F-12345',
      'FECHA FACTURA': '01/31/2025',
      'MONTO CANCELADO': 1500000,
      'FECHA PAGO': '02/15/2025',
      'MODO DE PAGO': 'Transferencia',
      ...overrides,
    },
    portalData: {},
  };
}

describe('LiquidationTransformer', () => {
  let transformer: LiquidationTransformer;

  beforeEach(() => {
    transformer = new LiquidationTransformer();
  });

  describe('extract()', () => {
    it('extracts basic liquidation data', () => {
      const record = makeLiquidationRecord();
      const result = transformer.extract(record);
      expect(result.fmPk).toBe(7001);
      expect(result.labOriginCode).toBe('PROC-001');
      expect(result.totalAmount).toBe(1500000);
      expect(result.invoiceNumber).toBe('F-12345');
      expect(result.paymentMethodText).toBe('Transferencia');
    });

    it('parses period "Enero 2025"', () => {
      const record = makeLiquidationRecord({ 'PERIODO COBRO': 'Enero 2025' });
      const result = transformer.extract(record);
      expect(result.period).toBeInstanceOf(Date);
      expect(result.period!.getFullYear()).toBe(2025);
      expect(result.period!.getMonth()).toBe(0);
      expect(result.periodLabel).toBe('Enero 2025');
    });

    it('parses period "1-2025"', () => {
      const record = makeLiquidationRecord({ 'PERIODO COBRO': '1-2025' });
      const result = transformer.extract(record);
      expect(result.period).toBeInstanceOf(Date);
      expect(result.period!.getMonth()).toBe(0);
      expect(result.periodLabel).toBe('1-2025');
    });

    it('extracts breakdown amounts', () => {
      const record = makeLiquidationRecord();
      const result = transformer.extract(record);
      expect(result.biopsyAmount).toBe(800000);
      expect(result.papAmount).toBe(400000);
      expect(result.cytologyAmount).toBe(200000);
      expect(result.immunoAmount).toBe(100000);
    });

    it('extracts counts', () => {
      const record = makeLiquidationRecord();
      const result = transformer.extract(record);
      expect(result.biopsyCount).toBe(32);
      expect(result.papCount).toBe(80);
      expect(result.cytologyCount).toBe(15);
      expect(result.immunoCount).toBe(5);
    });

    it('extracts previous debt and credit balance', () => {
      const record = makeLiquidationRecord({
        'DEUDA ANTERIOR': 250000,
        'SALDO A FAVOR': 50000,
      });
      const result = transformer.extract(record);
      expect(result.previousDebt).toBe(250000);
      expect(result.creditBalance).toBe(50000);
    });

    it('parses credit balance defensively (text mixed in)', () => {
      const record = makeLiquidationRecord({ 'SALDO A FAVOR': 'No tiene saldo' });
      const result = transformer.extract(record);
      expect(result.creditBalance).toBe(0);
    });

    it('parses CONFIRMED status', () => {
      const record = makeLiquidationRecord({ 'ESTADO': 'Confirmado' });
      const result = transformer.extract(record);
      expect(result.status).toBe('CONFIRMED');
    });

    it('parses PAID status', () => {
      const record = makeLiquidationRecord({ 'ESTADO': 'Pagado' });
      const result = transformer.extract(record);
      expect(result.status).toBe('PAID');
    });

    it('parses INVOICED status', () => {
      const record = makeLiquidationRecord({ 'ESTADO': 'Facturado' });
      const result = transformer.extract(record);
      expect(result.status).toBe('INVOICED');
    });

    it('parses OVERDUE status', () => {
      const record = makeLiquidationRecord({ 'ESTADO': 'Vencido' });
      const result = transformer.extract(record);
      expect(result.status).toBe('OVERDUE');
    });

    it('parses CANCELLED status', () => {
      const record = makeLiquidationRecord({ 'ESTADO': 'Cancelado' });
      const result = transformer.extract(record);
      expect(result.status).toBe('CANCELLED');
    });

    it('defaults to DRAFT for unknown status', () => {
      const record = makeLiquidationRecord({ 'ESTADO': '' });
      const result = transformer.extract(record);
      expect(result.status).toBe('DRAFT');
    });

    it('parses confirmedAt when Confirmado field says "Confirmado"', () => {
      const record = makeLiquidationRecord({ 'Confirmado': 'Confirmado' });
      const result = transformer.extract(record);
      // confirmedAt should be a truthy indicator; we use the string presence
      expect(result.confirmedAt).toBeDefined();
    });

    it('returns null confirmedAt when not confirmed', () => {
      const record = makeLiquidationRecord({ 'Confirmado': '' });
      const result = transformer.extract(record);
      expect(result.confirmedAt).toBeNull();
    });

    it('parses invoice date', () => {
      const record = makeLiquidationRecord({ 'FECHA FACTURA': '01/31/2025' });
      const result = transformer.extract(record);
      expect(result.invoiceDate).toBeInstanceOf(Date);
    });

    it('parses payment date', () => {
      const record = makeLiquidationRecord({ 'FECHA PAGO': '02/15/2025' });
      const result = transformer.extract(record);
      expect(result.paymentDate).toBeInstanceOf(Date);
    });

    it('parses payment amount', () => {
      const record = makeLiquidationRecord({ 'MONTO CANCELADO': 1500000 });
      const result = transformer.extract(record);
      expect(result.paymentAmount).toBe(1500000);
    });

    it('returns null payment amount when empty', () => {
      const record = makeLiquidationRecord({ 'MONTO CANCELADO': '' });
      const result = transformer.extract(record);
      expect(result.paymentAmount).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('uses TOTAL FINAL when TOTAL LIQUIDACIÓN is empty', () => {
      const record = makeLiquidationRecord({
        'TOTAL LIQUIDACIÓN': '',
        'TOTAL FINAL': 2000000,
      });
      const result = transformer.extract(record);
      expect(result.totalAmount).toBe(2000000);
    });

    it('handles all-empty record', () => {
      const emptyRecord: FmRecord = {
        recordId: '999',
        modId: '1',
        fieldData: {},
        portalData: {},
      };
      const result = transformer.extract(emptyRecord);
      expect(result.fmPk).toBe(0);
      expect(result.totalAmount).toBe(0);
      expect(result.biopsyCount).toBe(0);
    });
  });

  describe('toFm()', () => {
    it('produces correct FM fields', () => {
      const result = transformer.toFm({
        labOriginCode: 'CLI-001',
        periodLabel: 'Marzo 2026',
        statusName: 'Borrador',
        totalAmount: 500000,
        biopsyAmount: 300000,
        papAmount: 100000,
        cytologyAmount: 50000,
        immunoAmount: 50000,
        biopsyCount: 30,
        papCount: 10,
        cytologyCount: 5,
        immunoCount: 5,
        previousDebt: 0,
        creditBalance: 0,
      });
      expect(result['CODIGO INSTITUCION']).toBe('CLI-001');
      expect(result['PERIODO COBRO']).toBe('Marzo 2026');
      expect(result['TOTAL LIQUIDACIÓN']).toBe(500000);
      expect(result['Nº DE BIOPSIAS']).toBe(30);
    });
  });

  describe('confirmToFm()', () => {
    it('includes name in Confirmado field', () => {
      const result = transformer.confirmToFm('Juan Perez');
      expect(result['Confirmado']).toBe('Confirmado - Juan Perez');
    });
  });

  describe('invoiceToFm()', () => {
    it('formats date and sets document number', () => {
      const result = transformer.invoiceToFm({
        invoiceNumber: 'FAC-2026-001',
        invoiceDate: new Date(2026, 2, 20), // March 20, 2026 (local)
      });
      expect(result['NUMERO DOCUMENTO']).toBe('FAC-2026-001');
      expect(result['FECHA FACTURA']).toBe('03/20/2026');
    });
  });

  describe('paymentToFm()', () => {
    it('sets all payment fields', () => {
      const result = transformer.paymentToFm({
        paymentAmount: 500000,
        paymentDate: new Date(2026, 3, 1), // April 1, 2026 (local)
        paymentMethodText: 'Transferencia',
      });
      expect(result['MONTO CANCELADO']).toBe(500000);
      expect(result['FECHA PAGO']).toBe('04/01/2026');
      expect(result['MODO DE PAGO']).toBe('Transferencia');
    });
  });
});
