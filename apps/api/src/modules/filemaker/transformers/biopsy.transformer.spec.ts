import { BiopsyTransformer } from './biopsy.transformer';
import type { FmRecord } from '@zeru/shared';

function makeBiopsyRecord(overrides: Record<string, unknown> = {}, portalOverrides: Record<string, Record<string, unknown>[]> = {}): FmRecord {
  return {
    recordId: '1001',
    modId: '5',
    fieldData: {
      'INFORME Nº': 12345,
      'NOMBRE': 'Juan Carlos',
      'A.PATERNO': 'González',
      'A.MATERNO': 'López',
      'RUT': '12.345.678-9',
      'EDAD': 45,
      'TIPO DE EXAMEN': 'BIOPSIA',
      'SUBTIPO EXAMEN': 'BIOPSIA DIFERIDA',
      'URGENTES': '',
      'Alterado o Crítico': '',
      'SOLICITADA POR': 'Dr. Pérez',
      'PROCEDENCIA CODIGO UNICO': 'PROC-001',
      'MUESTRA DE': 'Piel región dorsal',
      'ANTECEDENTES': 'Lesión sospechosa de 2cm',
      'DIAGNOSTICO': 'Carcinoma basocelular nodular',
      'TEXTO BIOPSIAS::TEXTO': 'Se recibe fragmento...',
      'FECHA VALIDACIÓN': '03/15/2026',
      'PATOLOGO': 'Dr. Martínez (PAT-001)',
      'Revisado por patólogo supervisor': '',
      'caso corregido por PAT SUP': '',
      'caso corregido por validacion': '',
      'Activar Subir Examen': 'Si',
      'Estado Web': 'Publicado',
      'INFORMES PDF::PDF INFORME': 'https://fm.citolab.cl/Streaming_SSL/MainDB?-db=BIOPSIAS&-lay=...',
      'FECHA': '03/10/2026',
      ...overrides,
    },
    portalData: {
      'SCANNER BP 8': [],
      ...portalOverrides,
    },
  };
}

describe('BiopsyTransformer', () => {
  let transformer: BiopsyTransformer;

  beforeEach(() => {
    transformer = new BiopsyTransformer();
  });

  describe('extract()', () => {
    it('extracts basic exam data', () => {
      const record = makeBiopsyRecord();
      const result = transformer.extract(record, 'BIOPSIAS');
      expect(result.fmInformeNumber).toBe(12345);
      expect(result.fmSource).toBe('BIOPSIAS');
      expect(result.fmRecordId).toBe('1001');
      expect(result.subjectFirstName).toBe('Juan Carlos');
      expect(result.subjectPaternalLastName).toBe('González');
      expect(result.subjectMaternalLastName).toBe('López');
      expect(result.subjectAge).toBe(45);
      expect(result.category).toBe('BIOPSY');
      expect(result.subcategory).toBe('BIOPSIA DIFERIDA');
      expect(result.requestingPhysicianName).toBe('Dr. Pérez');
      expect(result.labOriginCode).toBe('PROC-001');
      expect(result.anatomicalSite).toBe('Piel región dorsal');
      expect(result.clinicalHistory).toBe('Lesión sospechosa de 2cm');
      expect(result.conclusion).toBe('Carcinoma basocelular nodular');
      expect(result.fullText).toBe('Se recibe fragmento...');
    });

    it('normalizes RUT', () => {
      const record = makeBiopsyRecord({ 'RUT': '12.345.678-9' });
      const result = transformer.extract(record, 'BIOPSIAS');
      expect(result.subjectRut).toBe('123456789');
    });

    it('returns null RUT for empty', () => {
      const record = makeBiopsyRecord({ 'RUT': '' });
      const result = transformer.extract(record, 'BIOPSIAS');
      expect(result.subjectRut).toBeNull();
    });

    it('returns null RUT for short values', () => {
      const record = makeBiopsyRecord({ 'RUT': '1' });
      const result = transformer.extract(record, 'BIOPSIAS');
      expect(result.subjectRut).toBeNull();
    });

    it('parses BIOPSY category', () => {
      const record = makeBiopsyRecord({ 'TIPO DE EXAMEN': 'BIOPSIA' });
      const result = transformer.extract(record, 'BIOPSIAS');
      expect(result.category).toBe('BIOPSY');
    });

    it('parses IMMUNOHISTOCHEMISTRY category', () => {
      const record = makeBiopsyRecord({ 'TIPO DE EXAMEN': 'INMUNOHISTOQUIMICA' });
      const result = transformer.extract(record, 'BIOPSIAS');
      expect(result.category).toBe('IMMUNOHISTOCHEMISTRY');
    });

    it('parses CYTOLOGY category', () => {
      const record = makeBiopsyRecord({ 'TIPO DE EXAMEN': 'CITOLOGIA' });
      const result = transformer.extract(record, 'BIOPSIAS');
      expect(result.category).toBe('CYTOLOGY');
    });

    it('parses MOLECULAR category', () => {
      const record = makeBiopsyRecord({ 'TIPO DE EXAMEN': 'MOLECULAR' });
      const result = transformer.extract(record, 'BIOPSIAS');
      expect(result.category).toBe('MOLECULAR');
    });

    it('defaults unknown category to OTHER', () => {
      const record = makeBiopsyRecord({ 'TIPO DE EXAMEN': 'DESCONOCIDO' });
      const result = transformer.extract(record, 'BIOPSIAS');
      expect(result.category).toBe('OTHER');
    });

    it('detects urgent exam', () => {
      const record = makeBiopsyRecord({ 'URGENTES': 'URGENTE' });
      const result = transformer.extract(record, 'BIOPSIAS');
      expect(result.isUrgent).toBe(true);
    });

    it('non-urgent by default', () => {
      const record = makeBiopsyRecord({ 'URGENTES': '' });
      const result = transformer.extract(record, 'BIOPSIAS');
      expect(result.isUrgent).toBe(false);
    });

    it('detects altered or critical when value is "Sí"', () => {
      const record = makeBiopsyRecord({ 'Alterado o Crítico': 'Sí' });
      const result = transformer.extract(record, 'BIOPSIAS');
      expect(result.isAlteredOrCritical).toBe(true);
    });

    it('does not flag as altered for non-yes values', () => {
      const record = makeBiopsyRecord({ 'Alterado o Crítico': 'No' });
      const result = transformer.extract(record, 'BIOPSIAS');
      expect(result.isAlteredOrCritical).toBe(false);
    });

    it('not altered when empty', () => {
      const record = makeBiopsyRecord({ 'Alterado o Crítico': '' });
      const result = transformer.extract(record, 'BIOPSIAS');
      expect(result.isAlteredOrCritical).toBe(false);
    });

    it('parses validatedAt date', () => {
      const record = makeBiopsyRecord({ 'FECHA VALIDACIÓN': '03/15/2026' });
      const result = transformer.extract(record, 'BIOPSIAS');
      expect(result.validatedAt).toBeInstanceOf(Date);
      expect(result.validatedAt!.getFullYear()).toBe(2026);
      expect(result.validatedAt!.getMonth()).toBe(2);
    });

    it('uses FECHA APROBACION for BIOPSIASRESPALDO', () => {
      const record = makeBiopsyRecord({
        'FECHA VALIDACIÓN': '',
        'FECHA APROBACION': '01/10/2024',
      });
      const result = transformer.extract(record, 'BIOPSIASRESPALDO');
      expect(result.validatedAt).toBeInstanceOf(Date);
      expect(result.validatedAt!.getFullYear()).toBe(2024);
    });

    it('uses fmSource parameter correctly', () => {
      const record = makeBiopsyRecord();
      const result = transformer.extract(record, 'BIOPSIASRESPALDO');
      expect(result.fmSource).toBe('BIOPSIASRESPALDO');
    });

    it('infers VALIDATED status when web published', () => {
      const record = makeBiopsyRecord({
        'Activar Subir Examen': 'Si',
        'Estado Web': 'Publicado',
      });
      const result = transformer.extract(record, 'BIOPSIAS');
      expect(result.status).toBe('DELIVERED');
    });

    it('infers VALIDATED status when only validated', () => {
      const record = makeBiopsyRecord({
        'Activar Subir Examen': '',
        'Estado Web': '',
        'FECHA VALIDACIÓN': '03/15/2026',
      });
      const result = transformer.extract(record, 'BIOPSIAS');
      expect(result.status).toBe('VALIDATED');
    });

    it('infers REGISTERED status when no validation date', () => {
      const record = makeBiopsyRecord({
        'Activar Subir Examen': '',
        'Estado Web': '',
        'FECHA VALIDACIÓN': '',
      });
      const result = transformer.extract(record, 'BIOPSIAS');
      expect(result.status).toBe('REGISTERED');
    });

    it('extracts new F0 fields: sex, birthDate, folio, IHQ, criticality, CCB', () => {
      const record: FmRecord = {
        recordId: '42',
        modId: '1',
        fieldData: {
          'INFORME Nº': '2026-99999',
          'RUT': '12345678-9',
          'NOMBRE': 'JUAN',
          'A.PATERNO': 'PÉREZ',
          'A.MATERNO': 'SOTO',
          'EDAD': '65',
          'SEXO': 'M',
          'FECHA NACIMIENTO': '05/15/1960',
          'NºFOLIO': 'FOL-12345',
          'Nº ORDEN ATENCION': 'OA-777',
          'NUMERO IDENTIFICADOR INSTITUCION': 'HTSP-555',
          'COD. MEDICO': 'MED-99',
          'TIPO DE EXAMEN': 'Biopsia',
          'TIPO ENVASE': 'Frasco 10ml',
          'TACOS': '3',
          'CASSETTES DE INCLUSION': '4',
          'PLACAS HE': '4',
          'T.ESPECIALES': '2',
          'Total especiales': '2',
          'ANTICUERPOS': 'CD20|CD3|Ki67',
          'INMUNO NUMEROS': 'IHQ-2026-0042',
          'Total Inmunos': '3',
          'INMUNOS Estado Solicitud': 'Completada',
          'INMUNOS Fecha solicitud': '03/01/2026',
          'INMUNOS Fecha Respuesta': '03/03/2026',
          'INMUNOS Responsable solicitud': 'TM-ATENEA',
          'AVISAR PACIENTE': 'Sí',
          'RESULTADO CRITICO RESPONSABLE NOTIFICACION': 'JEFE-VAL',
          'FECHA NOTIFICACION CRITICO': '03/04/2026',
          'HORA NOTIFICACION VALOR CRITICO': '14:30',
          'PDF Notificación Crítico': '/path/to/notif.pdf',
          'COMENTARIOS CCB': 'Corregir lateralidad',
          'Rechazado por CCB': 'Sí',
          'DIAGNOSTICO MODIFICADO': 'Sí',
          'Modifcado Por': 'PATOLOGO-X',
          'Modifcado Por Fecha': '03/05/2026',
          'Modifcado Por Hora': '10:15',
          'Biopsias::Rut Medico Solicitante': '9876543-K',
          'FECHA': '02/28/2026',
          'FECHA VALIDACIÓN': '03/02/2026',
          'DIAGNOSTICO': 'Carcinoma ductal',
          'Alterado o Crítico': 'Sí',
          'PATOLOGO': 'Dr. Smith (DRS01)',
        },
        portalData: {},
      };

      const result = transformer.extract(record, 'BIOPSIAS');

      expect(result.subjectGender).toBe('MALE');
      expect(result.subjectBirthDate).toBeInstanceOf(Date);
      expect(result.subjectBirthDate!.getFullYear()).toBe(1960);
      expect(result.subjectBirthDate!.getMonth()).toBe(4);
      expect(result.subjectBirthDate!.getDate()).toBe(15);
      expect(result.externalFolioNumber).toBe('FOL-12345');
      expect(result.externalOrderNumber).toBe('OA-777');
      expect(result.externalInstitutionId).toBe('HTSP-555');
      expect(result.requestingPhysicianCode).toBe('MED-99');
      expect(result.requestingPhysicianRut).toBe('9876543K');
      expect(result.containerType).toBe('Frasco 10ml');
      expect(result.tacoCount).toBe(3);
      expect(result.cassetteCount).toBe(4);
      expect(result.placaHeCount).toBe(4);
      expect(result.specialTechniquesCount).toBe(2);
      expect(result.ihqAntibodies).toEqual(['CD20', 'CD3', 'Ki67']);
      expect(result.ihqNumbers).toBe('IHQ-2026-0042');
      expect(result.ihqStatus).toBe('Completada');
      expect(result.criticalPatientNotifyFlag).toBe(true);
      expect(result.criticalNotifiedBy).toBe('JEFE-VAL');
      expect(result.rejectedByCcb).toBe(true);
      expect(result.ccbComments).toBe('Corregir lateralidad');
      expect(result.diagnosticModified).toBe(true);
      expect(result.modifiedByUser).toBe('PATOLOGO-X');
    });

    it('extracts portals: adverse events, technical observations, slides, special techniques', () => {
      const record: FmRecord = {
        recordId: '43',
        modId: '1',
        fieldData: { 'INFORME Nº': '2026-99998' },
        portalData: {
          portalEventosAdversos: [
            {
              'EventosAdversos::tipo': 'Corte mal teñido',
              'EventosAdversos::severidad': 'Media',
              'EventosAdversos::descripcion': 'Tinción pálida en lámina 2',
            },
          ],
          'Observaciones Tecnicas': [
            {
              'Obs::etapa': 'MACROSCOPY',
              'Obs::descripcion': 'Orientación cambiada',
              'Obs::responsable': 'TM-JB',
            },
          ],
          Placas: [
            { 'Placas::codigo': 'PL-001', 'Placas::tincion': 'H&E', 'Placas::nivel': '1' },
            { 'Placas::codigo': 'PL-002', 'Placas::tincion': 'PAS', 'Placas::nivel': '2' },
          ],
          'TÉCNICAS ESPECIALES': [
            { 'Tec::nombre': 'PAS', 'Tec::codigo': 'PAS-01', 'Tec::estado': 'Completada' },
          ],
        },
      };

      const result = transformer.extract(record, 'BIOPSIAS');
      expect(result.adverseEvents).toHaveLength(1);
      expect(result.adverseEvents?.[0].eventType).toBe('Corte mal teñido');
      expect(result.adverseEvents?.[0].severity).toBe('MEDIUM');
      expect(result.technicalObservations).toHaveLength(1);
      expect(result.technicalObservations?.[0].workflowStage).toBe('MACROSCOPY');
      expect(result.slides).toHaveLength(2);
      expect(result.slides?.[0].placaCode).toBe('PL-001');
      expect(result.specialTechniques).toHaveLength(1);
      expect(result.specialTechniques?.[0].name).toBe('PAS');
    });
  });

  describe('signers extraction', () => {
    it('extracts primary pathologist', () => {
      const record = makeBiopsyRecord({ 'PATOLOGO': 'Dr. Martínez (PAT-001)' });
      const result = transformer.extract(record, 'BIOPSIAS');
      expect(result.signers.length).toBeGreaterThanOrEqual(1);
      const primary = result.signers.find(s => s.role === 'PRIMARY_PATHOLOGIST');
      expect(primary).toBeDefined();
      expect(primary!.nameSnapshot).toBe('Dr. Martínez (PAT-001)');
      expect(primary!.signatureOrder).toBe(1);
    });

    it('extracts supervising pathologist', () => {
      const record = makeBiopsyRecord({
        'PATOLOGO': 'Dr. Martínez',
        'Revisado por patólogo supervisor': 'Dr. García (PAT-002)',
      });
      const result = transformer.extract(record, 'BIOPSIAS');
      const supervisor = result.signers.find(s => s.role === 'SUPERVISING_PATHOLOGIST');
      expect(supervisor).toBeDefined();
      expect(supervisor!.nameSnapshot).toBe('Dr. García (PAT-002)');
    });

    it('supersedes supervisor when PAT SUP corrects', () => {
      const record = makeBiopsyRecord({
        'PATOLOGO': 'Dr. Martínez',
        'Revisado por patólogo supervisor': 'Dr. García',
        'caso corregido por PAT SUP': 'Dr. López',
      });
      const result = transformer.extract(record, 'BIOPSIAS');
      const supervisors = result.signers.filter(s => s.role === 'SUPERVISING_PATHOLOGIST');
      expect(supervisors.length).toBe(2);
      const original = supervisors.find(s => s.nameSnapshot === 'Dr. García');
      expect(original!.isActive).toBe(false);
      const correction = supervisors.find(s => s.nameSnapshot === 'Dr. López');
      expect(correction!.isActive).toBe(true);
    });

    it('extracts validation correction signer', () => {
      const record = makeBiopsyRecord({
        'PATOLOGO': 'Dr. Martínez',
        'caso corregido por validacion': 'Dr. Soto',
      });
      const result = transformer.extract(record, 'BIOPSIAS');
      const correction = result.signers.find(s => s.role === 'VALIDATION_CORRECTION');
      expect(correction).toBeDefined();
      expect(correction!.nameSnapshot).toBe('Dr. Soto');
    });

    it('skips empty signer fields', () => {
      const record = makeBiopsyRecord({
        'PATOLOGO': 'Dr. Martínez',
        'Revisado por patólogo supervisor': '',
        'caso corregido por PAT SUP': '',
        'caso corregido por validacion': '',
      });
      const result = transformer.extract(record, 'BIOPSIAS');
      expect(result.signers.length).toBe(1);
    });

    it('handles case with no signers', () => {
      const record = makeBiopsyRecord({
        'PATOLOGO': '',
      });
      const result = transformer.extract(record, 'BIOPSIAS');
      expect(result.signers.length).toBe(0);
    });
  });

  describe('attachment refs', () => {
    it('extracts PDF attachment ref', () => {
      const record = makeBiopsyRecord({
        'INFORMES PDF::PDF INFORME': 'https://fm.citolab.cl/Streaming_SSL/...',
        'PROCEDENCIA CODIGO UNICO': 'PROC-001',
        'FECHA VALIDACIÓN': '03/15/2026',
        'INFORME Nº': 12345,
      });
      const result = transformer.extract(record, 'BIOPSIAS');
      const pdf = result.attachmentRefs.find(a => a.category === 'REPORT_PDF');
      expect(pdf).toBeDefined();
      expect(pdf!.s3Key).toContain('Biopsias/PROC-001/2026/03/12345.pdf');
      expect(pdf!.contentType).toBe('application/pdf');
      expect(pdf!.fmSourceField).toBe('INFORMES PDF::PDF INFORME');
    });

    it('encodes Ñ in S3 key', () => {
      const record = makeBiopsyRecord({
        'INFORMES PDF::PDF INFORME': 'https://fm.citolab.cl/...',
        'PROCEDENCIA CODIGO UNICO': 'PEÑALOLEN',
        'FECHA VALIDACIÓN': '03/15/2026',
        'INFORME Nº': 99999,
      });
      const result = transformer.extract(record, 'BIOPSIAS');
      const pdf = result.attachmentRefs.find(a => a.category === 'REPORT_PDF');
      expect(pdf!.s3Key).toContain('PE%C3%91ALOLEN');
    });

    it('extracts scanner photos from portal', () => {
      const record = makeBiopsyRecord(
        {},
        {
          'SCANNER BP 8': [
            { 'SCANNER BP 8::FOTO 1': 'https://fm.citolab.cl/photo1.jpg' },
            { 'SCANNER BP 8::FOTO 2': 'https://fm.citolab.cl/photo2.jpg' },
          ],
        },
      );
      const result = transformer.extract(record, 'BIOPSIAS');
      const photos = result.attachmentRefs.filter(a => a.category === 'MICRO_PHOTO');
      expect(photos.length).toBe(2);
    });

    it('extracts macro photos from portal', () => {
      const record = makeBiopsyRecord(
        {},
        {
          'SCANNER BP 8': [
            { 'SCANNER BP 8::MACRO': 'https://fm.citolab.cl/macro1.jpg' },
          ],
        },
      );
      const result = transformer.extract(record, 'BIOPSIAS');
      const macros = result.attachmentRefs.filter(a => a.category === 'MACRO_PHOTO');
      expect(macros.length).toBe(1);
    });

    it('skips empty container URLs', () => {
      const record = makeBiopsyRecord({
        'INFORMES PDF::PDF INFORME': '',
      });
      const result = transformer.extract(record, 'BIOPSIAS');
      const pdfs = result.attachmentRefs.filter(a => a.category === 'REPORT_PDF');
      expect(pdfs.length).toBe(0);
    });

    it('extracts REQUEST_DOCUMENT, MACRO_DICTATION and CRITICAL_NOTIFICATION_PDF', () => {
      const record = makeBiopsyRecord({
        'Biopsias_Ingresos::Scanner Documento': 'https://fm.example/container/requests/solicitud-44.pdf',
        'PDF Notificación Crítico': 'https://fm.example/container/critical/notif-44.pdf',
      }, {
        'SCANNER BP 8': [
          { 'SCANNER BP 8::DICTADO MACRO': 'https://fm.example/container/dictados/dict-44.mp3' },
        ],
      });

      const result = transformer.extract(record, 'BIOPSIAS');
      const requestDoc = result.attachmentRefs.find((a) => a.category === 'REQUEST_DOCUMENT');
      const dictation = result.attachmentRefs.find((a) => a.category === 'MACRO_DICTATION');
      const critPdf = result.attachmentRefs.find((a) => a.category === 'CRITICAL_NOTIFICATION_PDF');

      expect(requestDoc).toBeDefined();
      expect(requestDoc?.fmContainerUrlOriginal).toContain('solicitud-44.pdf');
      expect(requestDoc?.fmSourceField).toBe('Biopsias_Ingresos::Scanner Documento');

      expect(dictation).toBeDefined();
      expect(dictation?.fmContainerUrlOriginal).toContain('dict-44.mp3');
      expect(dictation?.fmSourceField).toBe('SCANNER BP 8::DICTADO MACRO');

      expect(critPdf).toBeDefined();
      expect(critPdf?.fmContainerUrlOriginal).toContain('notif-44.pdf');
      expect(critPdf?.fmSourceField).toBe('PDF Notificación Crítico');
    });
  });

  describe('edge cases', () => {
    it('handles numeric INFORME Nº as string', () => {
      const record = makeBiopsyRecord({ 'INFORME Nº': '12345' });
      const result = transformer.extract(record, 'BIOPSIAS');
      expect(result.fmInformeNumber).toBe(12345);
    });

    it('handles missing maternal last name', () => {
      const record = makeBiopsyRecord({ 'A.MATERNO': '' });
      const result = transformer.extract(record, 'BIOPSIAS');
      expect(result.subjectMaternalLastName).toBeNull();
    });

    it('handles all-empty record gracefully', () => {
      const emptyRecord: FmRecord = {
        recordId: '999',
        modId: '1',
        fieldData: {},
        portalData: {},
      };
      const result = transformer.extract(emptyRecord, 'BIOPSIAS');
      expect(result.fmInformeNumber).toBe(0);
      expect(result.subjectFirstName).toBe('');
      expect(result.signers).toEqual([]);
      expect(result.attachmentRefs).toEqual([]);
    });
  });
});
