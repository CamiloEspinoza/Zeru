import {
  toExamCategory,
  toDiagnosticReportStatus,
  toSigningRole,
  toWorkflowEventType,
  toCommunicationCategory,
  toAttachmentCategory,
  toLabPaymentMethod,
  toLabChargeStatus,
  toLiquidationStatus,
  toFmSource,
  toGender,
  toLabExamChargeSource,
} from './enum-maps';
import {
  ExamCategory,
  DiagnosticReportStatus,
  SigningRole,
  WorkflowEventType,
  CommunicationCategory,
  AttachmentCategory,
  LabPaymentMethod,
  LabChargeStatus,
  LiquidationStatus,
  FmSource,
  Gender,
  LabExamChargeSource,
} from '@prisma/client';

describe('Enum Maps', () => {
  describe('toExamCategory', () => {
    it('maps BIOPSY directly', () => {
      expect(toExamCategory('BIOPSY')).toBe(ExamCategory.BIOPSY);
    });
    it('maps PAP directly', () => {
      expect(toExamCategory('PAP')).toBe(ExamCategory.PAP);
    });
    it('maps OTHER to OTHER_EXAM', () => {
      expect(toExamCategory('OTHER')).toBe(ExamCategory.OTHER_EXAM);
    });
    it('maps IMMUNOHISTOCHEMISTRY directly', () => {
      expect(toExamCategory('IMMUNOHISTOCHEMISTRY')).toBe(ExamCategory.IMMUNOHISTOCHEMISTRY);
    });
    it('maps CYTOLOGY directly', () => {
      expect(toExamCategory('CYTOLOGY')).toBe(ExamCategory.CYTOLOGY);
    });
    it('maps MOLECULAR directly', () => {
      expect(toExamCategory('MOLECULAR')).toBe(ExamCategory.MOLECULAR);
    });
  });

  describe('toDiagnosticReportStatus', () => {
    it('maps REGISTERED directly', () => {
      expect(toDiagnosticReportStatus('REGISTERED')).toBe(DiagnosticReportStatus.REGISTERED);
    });
    it('maps RECEIVED to RECEIVED_STATUS', () => {
      expect(toDiagnosticReportStatus('RECEIVED')).toBe(DiagnosticReportStatus.RECEIVED_STATUS);
    });
    it('maps PROCESSING to PROCESSING_STATUS', () => {
      expect(toDiagnosticReportStatus('PROCESSING')).toBe(DiagnosticReportStatus.PROCESSING_STATUS);
    });
    it('maps VALIDATED to VALIDATED_REPORT', () => {
      expect(toDiagnosticReportStatus('VALIDATED')).toBe(DiagnosticReportStatus.VALIDATED_REPORT);
    });
    it('maps CANCELLED to CANCELLED_REPORT', () => {
      expect(toDiagnosticReportStatus('CANCELLED')).toBe(DiagnosticReportStatus.CANCELLED_REPORT);
    });
    it('maps SIGNED directly', () => {
      expect(toDiagnosticReportStatus('SIGNED')).toBe(DiagnosticReportStatus.SIGNED);
    });
    it('maps DELIVERED directly', () => {
      expect(toDiagnosticReportStatus('DELIVERED')).toBe(DiagnosticReportStatus.DELIVERED);
    });
  });

  describe('toSigningRole', () => {
    it('maps PRIMARY_PATHOLOGIST directly', () => {
      expect(toSigningRole('PRIMARY_PATHOLOGIST')).toBe(SigningRole.PRIMARY_PATHOLOGIST);
    });
    it('maps OTHER to OTHER_SIGNING', () => {
      expect(toSigningRole('OTHER')).toBe(SigningRole.OTHER_SIGNING);
    });
    it('maps SCREENING_TECH directly', () => {
      expect(toSigningRole('SCREENING_TECH')).toBe(SigningRole.SCREENING_TECH);
    });
  });

  describe('toWorkflowEventType', () => {
    it('maps PROCESSING to PROCESSING_EVENT', () => {
      expect(toWorkflowEventType('PROCESSING')).toBe(WorkflowEventType.PROCESSING_EVENT);
    });
    it('maps OTHER to OTHER_EVENT', () => {
      expect(toWorkflowEventType('OTHER')).toBe(WorkflowEventType.OTHER_EVENT);
    });
    it('maps MACROSCOPY directly', () => {
      expect(toWorkflowEventType('MACROSCOPY')).toBe(WorkflowEventType.MACROSCOPY);
    });
  });

  describe('toCommunicationCategory', () => {
    it('maps OTHER to OTHER_COMM', () => {
      expect(toCommunicationCategory('OTHER')).toBe(CommunicationCategory.OTHER_COMM);
    });
    it('maps CRITICAL_RESULT directly', () => {
      expect(toCommunicationCategory('CRITICAL_RESULT')).toBe(CommunicationCategory.CRITICAL_RESULT);
    });
  });

  describe('toAttachmentCategory', () => {
    it('maps OTHER to OTHER_ATTACHMENT', () => {
      expect(toAttachmentCategory('OTHER')).toBe(AttachmentCategory.OTHER_ATTACHMENT);
    });
    it('maps REPORT_PDF directly', () => {
      expect(toAttachmentCategory('REPORT_PDF')).toBe(AttachmentCategory.REPORT_PDF);
    });
  });

  describe('toLabPaymentMethod', () => {
    it('maps CASH to LAB_CASH', () => {
      expect(toLabPaymentMethod('CASH')).toBe(LabPaymentMethod.LAB_CASH);
    });
    it('maps BANK_TRANSFER to LAB_BANK_TRANSFER', () => {
      expect(toLabPaymentMethod('BANK_TRANSFER')).toBe(LabPaymentMethod.LAB_BANK_TRANSFER);
    });
    it('maps CHECK to LAB_CHECK', () => {
      expect(toLabPaymentMethod('CHECK')).toBe(LabPaymentMethod.LAB_CHECK);
    });
    it('maps VOUCHER to LAB_VOUCHER', () => {
      expect(toLabPaymentMethod('VOUCHER')).toBe(LabPaymentMethod.LAB_VOUCHER);
    });
    it('maps CREDIT_CARD to LAB_CREDIT_CARD', () => {
      expect(toLabPaymentMethod('CREDIT_CARD')).toBe(LabPaymentMethod.LAB_CREDIT_CARD);
    });
    it('maps DEBIT_CARD to LAB_DEBIT_CARD', () => {
      expect(toLabPaymentMethod('DEBIT_CARD')).toBe(LabPaymentMethod.LAB_DEBIT_CARD);
    });
    it('maps AGREEMENT to LAB_AGREEMENT', () => {
      expect(toLabPaymentMethod('AGREEMENT')).toBe(LabPaymentMethod.LAB_AGREEMENT);
    });
    it('maps PENDING_PAYMENT to LAB_PENDING_PAYMENT', () => {
      expect(toLabPaymentMethod('PENDING_PAYMENT')).toBe(LabPaymentMethod.LAB_PENDING_PAYMENT);
    });
    it('maps OTHER to OTHER_PAYMENT', () => {
      expect(toLabPaymentMethod('OTHER')).toBe(LabPaymentMethod.OTHER_PAYMENT);
    });
  });

  describe('toLabChargeStatus', () => {
    it('maps REGISTERED to REGISTERED_CHARGE', () => {
      expect(toLabChargeStatus('REGISTERED')).toBe(LabChargeStatus.REGISTERED_CHARGE);
    });
    it('maps VALIDATED to VALIDATED_CHARGE', () => {
      expect(toLabChargeStatus('VALIDATED')).toBe(LabChargeStatus.VALIDATED_CHARGE);
    });
    it('maps INVOICED to INVOICED_CHARGE', () => {
      expect(toLabChargeStatus('INVOICED')).toBe(LabChargeStatus.INVOICED_CHARGE);
    });
    it('maps PAID to PAID_CHARGE', () => {
      expect(toLabChargeStatus('PAID')).toBe(LabChargeStatus.PAID_CHARGE);
    });
    it('maps CANCELLED to CANCELLED_CHARGE', () => {
      expect(toLabChargeStatus('CANCELLED')).toBe(LabChargeStatus.CANCELLED_CHARGE);
    });
    it('maps REVERSED directly', () => {
      expect(toLabChargeStatus('REVERSED')).toBe(LabChargeStatus.REVERSED);
    });
  });

  describe('toLiquidationStatus', () => {
    it('maps DRAFT to DRAFT_LIQ', () => {
      expect(toLiquidationStatus('DRAFT')).toBe(LiquidationStatus.DRAFT_LIQ);
    });
    it('maps INVOICED to INVOICED_LIQ', () => {
      expect(toLiquidationStatus('INVOICED')).toBe(LiquidationStatus.INVOICED_LIQ);
    });
    it('maps PAID to PAID_LIQ', () => {
      expect(toLiquidationStatus('PAID')).toBe(LiquidationStatus.PAID_LIQ);
    });
    it('maps CANCELLED to CANCELLED_LIQ', () => {
      expect(toLiquidationStatus('CANCELLED')).toBe(LiquidationStatus.CANCELLED_LIQ);
    });
    it('maps CONFIRMED directly', () => {
      expect(toLiquidationStatus('CONFIRMED')).toBe(LiquidationStatus.CONFIRMED);
    });
    it('maps PARTIALLY_PAID directly', () => {
      expect(toLiquidationStatus('PARTIALLY_PAID')).toBe(LiquidationStatus.PARTIALLY_PAID);
    });
    it('maps OVERDUE directly', () => {
      expect(toLiquidationStatus('OVERDUE')).toBe(LiquidationStatus.OVERDUE);
    });
  });

  describe('toFmSource', () => {
    it('maps BIOPSIAS', () => {
      expect(toFmSource('BIOPSIAS')).toBe(FmSource.BIOPSIAS);
    });
    it('maps PAPANICOLAOUHISTORICO', () => {
      expect(toFmSource('PAPANICOLAOUHISTORICO')).toBe(FmSource.PAPANICOLAOUHISTORICO);
    });
  });

  describe('toGender', () => {
    it('maps OTHER to OTHER_GENDER', () => {
      expect(toGender('OTHER')).toBe(Gender.OTHER_GENDER);
    });
    it('maps MALE directly', () => {
      expect(toGender('MALE')).toBe(Gender.MALE);
    });
    it('returns null for null input', () => {
      expect(toGender(null)).toBeNull();
    });
  });

  describe('toLabExamChargeSource', () => {
    it('maps BIOPSIAS_INGRESOS', () => {
      expect(toLabExamChargeSource('BIOPSIAS_INGRESOS')).toBe(LabExamChargeSource.BIOPSIAS_INGRESOS);
    });
    it('maps PAP_INGRESOS', () => {
      expect(toLabExamChargeSource('PAP_INGRESOS')).toBe(LabExamChargeSource.PAP_INGRESOS);
    });
  });
});
