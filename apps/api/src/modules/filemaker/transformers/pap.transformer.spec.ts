import { PapTransformer } from './pap.transformer';
import type { FmRecord } from '@zeru/shared';

function makePapRecord(overrides: Record<string, unknown> = {}): FmRecord {
  return {
    recordId: '2001',
    modId: '3',
    fieldData: {
      'INFORME Nº': 54321,
      'NOMBRES': 'María Isabel',
      'A.PATERNO': 'Fernández',
      'A.MATERNO': 'Muñoz',
      'RUT': '9.876.543-2',
      'EDAD': 38,
      'EXAMEN': 'PAPANICOLAOU',
      'SOLICITADO POR': 'Dra. Rivera',
      'PROCEDENCIA': 'Consultorio Central',
      'CODIGO UNICO PROCEDENCIA': 'PROC-050',
      'MUESTRA DE': 'Cuello uterino',
      'PAP TEXTO::TEXTO': 'Frotis cervicovaginal...',
      'FECHA': '03/20/2026',
      'FECHA TOMA MUESTRA': '03/18/2026',
      'LECTOR SCREANING': 'Tec. Sánchez',
      'SUPERVISORA PAP': 'Tec. Rojas',
      'VISTO BUENO': 'Tec. Paredes',
      'APROBACION PATOLOGO WEB': 'Dr. Álvarez',
      'Estado WEB': 'Publicado',
      'Scanner Cartón': '',
      ...overrides,
    },
    portalData: {},
  };
}

describe('PapTransformer', () => {
  let transformer: PapTransformer;

  beforeEach(() => {
    transformer = new PapTransformer();
  });

  describe('extract()', () => {
    it('extracts basic exam data', () => {
      const record = makePapRecord();
      const result = transformer.extract(record, 'PAPANICOLAOU');
      expect(result.fmInformeNumber).toBe(54321);
      expect(result.fmSource).toBe('PAPANICOLAOU');
      expect(result.fmRecordId).toBe('2001');
      expect(result.subjectFirstName).toBe('María Isabel');
      expect(result.subjectPaternalLastName).toBe('Fernández');
      expect(result.subjectMaternalLastName).toBe('Muñoz');
      expect(result.subjectAge).toBe(38);
      expect(result.category).toBe('PAP');
      expect(result.requestingPhysicianName).toBe('Dra. Rivera');
      expect(result.labOriginCode).toBe('PROC-050');
      expect(result.anatomicalSite).toBe('Cuello uterino');
      expect(result.fullText).toBe('Frotis cervicovaginal...');
    });

    it('uses NOMBRES field (not NOMBRE)', () => {
      const record = makePapRecord({ 'NOMBRES': 'Ana María' });
      const result = transformer.extract(record, 'PAPANICOLAOU');
      expect(result.subjectFirstName).toBe('Ana María');
    });

    it('uses SOLICITADO POR (not SOLICITADA POR)', () => {
      const record = makePapRecord({ 'SOLICITADO POR': 'Dr. Test' });
      const result = transformer.extract(record, 'PAPANICOLAOU');
      expect(result.requestingPhysicianName).toBe('Dr. Test');
    });

    it('uses CODIGO UNICO PROCEDENCIA', () => {
      const record = makePapRecord({ 'CODIGO UNICO PROCEDENCIA': 'CUSTOM-001' });
      const result = transformer.extract(record, 'PAPANICOLAOU');
      expect(result.labOriginCode).toBe('CUSTOM-001');
    });

    it('falls back to PROCEDENCIA when CODIGO UNICO is empty', () => {
      const record = makePapRecord({
        'CODIGO UNICO PROCEDENCIA': '',
        'PROCEDENCIA': 'Fallback',
      });
      const result = transformer.extract(record, 'PAPANICOLAOU');
      expect(result.labOriginCode).toBe('Fallback');
    });

    it('normalizes RUT', () => {
      const record = makePapRecord({ 'RUT': '9.876.543-2' });
      const result = transformer.extract(record, 'PAPANICOLAOU');
      expect(result.subjectRut).toBe('98765432');
    });

    it('parses PAP category', () => {
      const record = makePapRecord({ 'EXAMEN': 'PAPANICOLAOU' });
      const result = transformer.extract(record, 'PAPANICOLAOU');
      expect(result.category).toBe('PAP');
    });

    it('parses sampleCollectedAt', () => {
      const record = makePapRecord({ 'FECHA TOMA MUESTRA': '03/18/2026' });
      const result = transformer.extract(record, 'PAPANICOLAOU');
      expect(result.sampleCollectedAt).toBeInstanceOf(Date);
      expect(result.sampleCollectedAt!.getDate()).toBe(18);
    });

    it('parses requestedAt from FECHA', () => {
      const record = makePapRecord({ 'FECHA': '03/20/2026' });
      const result = transformer.extract(record, 'PAPANICOLAOU');
      expect(result.requestedAt).toBeInstanceOf(Date);
    });

    it('uses PAPANICOLAOUHISTORICO source', () => {
      const record = makePapRecord();
      const result = transformer.extract(record, 'PAPANICOLAOUHISTORICO');
      expect(result.fmSource).toBe('PAPANICOLAOUHISTORICO');
    });

    it('defaults category to PAP for unknown EXAMEN', () => {
      const record = makePapRecord({ 'EXAMEN': '' });
      const result = transformer.extract(record, 'PAPANICOLAOU');
      expect(result.category).toBe('PAP');
    });

    it('infers DELIVERED status for published', () => {
      const record = makePapRecord({ 'Estado WEB': 'Publicado' });
      const result = transformer.extract(record, 'PAPANICOLAOU');
      expect(result.status).toBe('DELIVERED');
    });

    it('infers VALIDATED status with date', () => {
      const record = makePapRecord({
        'Estado WEB': '',
        'APROBACION PATOLOGO WEB': '',
        'FECHA': '03/20/2026',
      });
      const result = transformer.extract(record, 'PAPANICOLAOU');
      expect(result.status).toBe('VALIDATED');
    });
  });

  describe('signers extraction', () => {
    it('extracts screening tech', () => {
      const record = makePapRecord({ 'LECTOR SCREANING': 'Tec. Sánchez' });
      const result = transformer.extract(record, 'PAPANICOLAOU');
      const screener = result.signers.find(s => s.role === 'SCREENING_TECH');
      expect(screener).toBeDefined();
      expect(screener!.nameSnapshot).toBe('Tec. Sánchez');
      expect(screener!.signatureOrder).toBe(1);
    });

    it('extracts supervising tech', () => {
      const record = makePapRecord({ 'SUPERVISORA PAP': 'Tec. Rojas' });
      const result = transformer.extract(record, 'PAPANICOLAOU');
      const supervisor = result.signers.find(s => s.role === 'SUPERVISING_TECH');
      expect(supervisor).toBeDefined();
      expect(supervisor!.nameSnapshot).toBe('Tec. Rojas');
    });

    it('extracts visto bueno tech', () => {
      const record = makePapRecord({ 'VISTO BUENO': 'Tec. Paredes' });
      const result = transformer.extract(record, 'PAPANICOLAOU');
      const vb = result.signers.find(s => s.role === 'VISTO_BUENO_TECH');
      expect(vb).toBeDefined();
    });

    it('extracts primary pathologist from web approval', () => {
      const record = makePapRecord({ 'APROBACION PATOLOGO WEB': 'Dr. Álvarez' });
      const result = transformer.extract(record, 'PAPANICOLAOU');
      const pathologist = result.signers.find(s => s.role === 'PRIMARY_PATHOLOGIST');
      expect(pathologist).toBeDefined();
      expect(pathologist!.nameSnapshot).toBe('Dr. Álvarez');
    });

    it('builds correct signer order', () => {
      const record = makePapRecord({
        'LECTOR SCREANING': 'Tec1',
        'SUPERVISORA PAP': 'Tec2',
        'VISTO BUENO': 'Tec3',
        'APROBACION PATOLOGO WEB': 'Dr4',
      });
      const result = transformer.extract(record, 'PAPANICOLAOU');
      expect(result.signers.length).toBe(4);
      expect(result.signers[0].signatureOrder).toBe(1);
      expect(result.signers[1].signatureOrder).toBe(2);
      expect(result.signers[2].signatureOrder).toBe(3);
      expect(result.signers[3].signatureOrder).toBe(4);
    });

    it('skips empty signer fields', () => {
      const record = makePapRecord({
        'LECTOR SCREANING': '',
        'SUPERVISORA PAP': '',
        'VISTO BUENO': '',
        'APROBACION PATOLOGO WEB': '',
      });
      const result = transformer.extract(record, 'PAPANICOLAOU');
      expect(result.signers.length).toBe(0);
    });
  });

  describe('attachment refs', () => {
    it('generates correct S3 key for PAP PDF', () => {
      const record = makePapRecord({
        'CODIGO UNICO PROCEDENCIA': 'PROC-050',
        'FECHA': '03/20/2026',
        'INFORME Nº': 54321,
      });
      // PAP PDFs come from Citolab S3, not from FM containers
      const result = transformer.extract(record, 'PAPANICOLAOU');
      const pdf = result.attachmentRefs.find(a => a.category === 'REPORT_PDF');
      expect(pdf).toBeDefined();
      expect(pdf!.s3Key).toContain('Papanicolaous/PROC-050/2026/03/54321.pdf');
    });

    it('extracts scanner carton attachment', () => {
      const record = makePapRecord({ 'Scanner Cartón': 'https://fm.citolab.cl/scanner.jpg' });
      const result = transformer.extract(record, 'PAPANICOLAOU');
      const scanner = result.attachmentRefs.find(a => a.category === 'SCANNER_CARTON');
      expect(scanner).toBeDefined();
      expect(scanner!.fmSourceField).toBe('Scanner Cartón');
    });

    it('skips empty scanner carton', () => {
      const record = makePapRecord({ 'Scanner Cartón': '' });
      const result = transformer.extract(record, 'PAPANICOLAOU');
      const scanner = result.attachmentRefs.filter(a => a.category === 'SCANNER_CARTON');
      expect(scanner.length).toBe(0);
    });

    it('encodes Ñ in S3 key', () => {
      const record = makePapRecord({
        'CODIGO UNICO PROCEDENCIA': 'PEÑALOLEN',
        'FECHA': '06/15/2025',
        'INFORME Nº': 11111,
      });
      const result = transformer.extract(record, 'PAPANICOLAOU');
      const pdf = result.attachmentRefs.find(a => a.category === 'REPORT_PDF');
      expect(pdf!.s3Key).toContain('PE%C3%91ALOLEN');
    });
  });

  describe('edge cases', () => {
    it('handles all-empty record gracefully', () => {
      const emptyRecord: FmRecord = {
        recordId: '999',
        modId: '1',
        fieldData: {},
        portalData: {},
      };
      const result = transformer.extract(emptyRecord, 'PAPANICOLAOU');
      expect(result.fmInformeNumber).toBe(0);
      expect(result.subjectFirstName).toBe('');
      expect(result.signers).toEqual([]);
    });

    it('handles missing maternal last name', () => {
      const record = makePapRecord({ 'A.MATERNO': '' });
      const result = transformer.extract(record, 'PAPANICOLAOU');
      expect(result.subjectMaternalLastName).toBeNull();
    });
  });
});
