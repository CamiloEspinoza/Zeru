import { ScannerEncapsulationTransformer } from './scanner-encapsulation.transformer';
import type { FmRecord } from '@zeru/shared';

function makeScannerRecord(
  fields: Record<string, unknown>,
  recordId = '70',
): FmRecord {
  return {
    recordId,
    modId: '1',
    fieldData: fields,
    portalData: {},
  };
}

describe('ScannerEncapsulationTransformer', () => {
  it('extracts up to 8 encapsulation photos + 1 special', () => {
    const record = makeScannerRecord({
      'INFORME Nº': 88888,
      'FOTO 1': 'https://fm/container/enc/1-70.jpg',
      'FOTO 2': 'https://fm/container/enc/2-70.jpg',
      'FOTO 3': 'https://fm/container/enc/3-70.jpg',
      'FOTO ENCAPSULACIÓN 1': 'https://fm/container/enc/special-70.jpg',
      'Trazabilidad::Fecha_Scanner': '02/14/2026',
    });

    const result = ScannerEncapsulationTransformer.extract(record);
    expect(result.fmInformeNumber).toBe(88888);
    expect(result.attachments).toHaveLength(4);
    expect(result.attachments[0].category).toBe('ENCAPSULATION_PHOTO');
    expect(result.scannerCapturedAt).toBeInstanceOf(Date);
    expect(result.scannerCapturedAt!.getFullYear()).toBe(2026);
    expect(result.scannerCapturedAt!.getMonth()).toBe(1);
    expect(result.scannerCapturedAt!.getDate()).toBe(14);
  });

  it('skips empty foto fields', () => {
    const record = makeScannerRecord({
      'INFORME Nº': 88889,
      'FOTO 1': 'https://fm/container/enc/1-71.jpg',
      'FOTO 2': '',
      'FOTO 3': null,
    }, '71');
    const result = ScannerEncapsulationTransformer.extract(record);
    expect(result.attachments).toHaveLength(1);
  });
});
