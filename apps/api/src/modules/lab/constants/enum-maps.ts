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
  AdverseSeverity,
} from '@prisma/client';
import type {
  ExamCategoryType,
  DiagnosticReportStatusType,
  SigningRoleType,
  WorkflowEventTypeValue,
  CommunicationCategoryType,
  AttachmentCategoryType,
  PaymentMethodType,
  ChargeStatusType,
  LiquidationStatusType,
  FmSourceType,
  ExamChargeSourceType,
} from '../../filemaker/transformers/types';

// ── ExamCategory ──

const EXAM_CATEGORY_MAP: Record<ExamCategoryType, ExamCategory> = {
  BIOPSY: ExamCategory.BIOPSY,
  PAP: ExamCategory.PAP,
  CYTOLOGY: ExamCategory.CYTOLOGY,
  IMMUNOHISTOCHEMISTRY: ExamCategory.IMMUNOHISTOCHEMISTRY,
  MOLECULAR: ExamCategory.MOLECULAR,
  OTHER: ExamCategory.OTHER_EXAM,
};

export function toExamCategory(val: ExamCategoryType): ExamCategory {
  return EXAM_CATEGORY_MAP[val];
}

// ── DiagnosticReportStatus ──

const DR_STATUS_MAP: Record<DiagnosticReportStatusType, DiagnosticReportStatus> = {
  REGISTERED: DiagnosticReportStatus.REGISTERED,
  IN_TRANSIT: DiagnosticReportStatus.IN_TRANSIT,
  RECEIVED: DiagnosticReportStatus.RECEIVED_STATUS,
  PROCESSING: DiagnosticReportStatus.PROCESSING_STATUS,
  REPORTING: DiagnosticReportStatus.REPORTING,
  PRE_VALIDATED: DiagnosticReportStatus.PRE_VALIDATED,
  VALIDATED: DiagnosticReportStatus.VALIDATED_REPORT,
  SIGNED: DiagnosticReportStatus.SIGNED,
  DELIVERED: DiagnosticReportStatus.DELIVERED,
  DOWNLOADED: DiagnosticReportStatus.DOWNLOADED,
  CANCELLED: DiagnosticReportStatus.CANCELLED_REPORT,
  AMENDED: DiagnosticReportStatus.AMENDED,
};

export function toDiagnosticReportStatus(val: DiagnosticReportStatusType): DiagnosticReportStatus {
  return DR_STATUS_MAP[val];
}

// ── SigningRole ──

const SIGNING_ROLE_MAP: Record<SigningRoleType, SigningRole> = {
  PRIMARY_PATHOLOGIST: SigningRole.PRIMARY_PATHOLOGIST,
  CO_PATHOLOGIST: SigningRole.CO_PATHOLOGIST,
  SUPERVISING_PATHOLOGIST: SigningRole.SUPERVISING_PATHOLOGIST,
  EXTERNAL_CONSULTANT: SigningRole.EXTERNAL_CONSULTANT,
  SCREENING_TECH: SigningRole.SCREENING_TECH,
  SUPERVISING_TECH: SigningRole.SUPERVISING_TECH,
  VISTO_BUENO_TECH: SigningRole.VISTO_BUENO_TECH,
  VALIDATION_CORRECTION: SigningRole.VALIDATION_CORRECTION,
  QC_REVIEWER: SigningRole.QC_REVIEWER,
  OTHER: SigningRole.OTHER_SIGNING,
};

export function toSigningRole(val: SigningRoleType): SigningRole {
  return SIGNING_ROLE_MAP[val];
}

// ── WorkflowEventType ──

const WORKFLOW_EVENT_MAP: Record<WorkflowEventTypeValue, WorkflowEventType> = {
  ORIGIN_INTAKE: WorkflowEventType.ORIGIN_INTAKE,
  ORIGIN_HANDOFF_TO_COURIER: WorkflowEventType.ORIGIN_HANDOFF_TO_COURIER,
  TRANSPORT: WorkflowEventType.TRANSPORT,
  RECEIVED_AT_LAB: WorkflowEventType.RECEIVED_AT_LAB,
  MACROSCOPY: WorkflowEventType.MACROSCOPY,
  EMBEDDING: WorkflowEventType.EMBEDDING,
  CUTTING_STAINING: WorkflowEventType.CUTTING_STAINING,
  HISTOLOGY_REPORTING: WorkflowEventType.HISTOLOGY_REPORTING,
  VALIDATION: WorkflowEventType.VALIDATION,
  APPROVAL: WorkflowEventType.APPROVAL,
  DELIVERY: WorkflowEventType.DELIVERY,
  INTAKE: WorkflowEventType.INTAKE,
  PROCESSING: WorkflowEventType.PROCESSING_EVENT,
  DIAGNOSIS_TRANSCRIPTION: WorkflowEventType.DIAGNOSIS_TRANSCRIPTION,
  PRE_VALIDATION: WorkflowEventType.PRE_VALIDATION,
  SECRETARY_VALIDATION: WorkflowEventType.SECRETARY_VALIDATION,
  PATHOLOGIST_APPROVAL_WEB: WorkflowEventType.PATHOLOGIST_APPROVAL_WEB,
  WEB_VALIDATION: WorkflowEventType.WEB_VALIDATION,
  PDF_GENERATED: WorkflowEventType.PDF_GENERATED,
  WEB_DELIVERY: WorkflowEventType.WEB_DELIVERY,
  WEB_TRANSPORT: WorkflowEventType.WEB_TRANSPORT,
  WEB_RECEPTION: WorkflowEventType.WEB_RECEPTION,
  WEB_EXAM_CYTOLOGY: WorkflowEventType.WEB_EXAM_CYTOLOGY,
  WEB_DOWNLOAD: WorkflowEventType.WEB_DOWNLOAD,
  WEB_ACKNOWLEDGMENT: WorkflowEventType.WEB_ACKNOWLEDGMENT,
  CLIENT_NOTIFIED: WorkflowEventType.CLIENT_NOTIFIED,
  CASE_CORRECTION: WorkflowEventType.CASE_CORRECTION,
  AMENDMENT: WorkflowEventType.AMENDMENT,
  CRITICAL_NOTIFICATION: WorkflowEventType.CRITICAL_NOTIFICATION,
  OTHER: WorkflowEventType.OTHER_EVENT,
};

export function toWorkflowEventType(val: WorkflowEventTypeValue): WorkflowEventType {
  return WORKFLOW_EVENT_MAP[val];
}

// ── CommunicationCategory ──

const COMM_CATEGORY_MAP: Record<CommunicationCategoryType, CommunicationCategory> = {
  SAMPLE_QUALITY_ISSUE: CommunicationCategory.SAMPLE_QUALITY_ISSUE,
  ADDITIONAL_INFO_REQUEST: CommunicationCategory.ADDITIONAL_INFO_REQUEST,
  INTERNAL_QC: CommunicationCategory.INTERNAL_QC,
  CRITICAL_RESULT: CommunicationCategory.CRITICAL_RESULT,
  CLIENT_INQUIRY: CommunicationCategory.CLIENT_INQUIRY,
  CORRECTION_REQUEST: CommunicationCategory.CORRECTION_REQUEST,
  OTHER: CommunicationCategory.OTHER_COMM,
};

export function toCommunicationCategory(val: CommunicationCategoryType): CommunicationCategory {
  return COMM_CATEGORY_MAP[val];
}

// ── AttachmentCategory ──

const ATTACHMENT_CATEGORY_MAP: Record<AttachmentCategoryType, AttachmentCategory> = {
  REPORT_PDF: AttachmentCategory.REPORT_PDF,
  CRITICAL_NOTIFICATION_PDF: AttachmentCategory.CRITICAL_NOTIFICATION_PDF,
  MACRO_PHOTO: AttachmentCategory.MACRO_PHOTO,
  MICRO_PHOTO: AttachmentCategory.MICRO_PHOTO,
  ENCAPSULATION_PHOTO: AttachmentCategory.ENCAPSULATION_PHOTO,
  MACRO_DICTATION: AttachmentCategory.MACRO_DICTATION,
  DIAGNOSIS_MODIFICATION: AttachmentCategory.DIAGNOSIS_MODIFICATION,
  SCANNER_CARTON: AttachmentCategory.SCANNER_CARTON,
  REQUEST_DOCUMENT: AttachmentCategory.REQUEST_DOCUMENT,
  MOLECULAR_CONTAINER: AttachmentCategory.MOLECULAR_CONTAINER,
  ADVERSE_EVENT_PHOTO: AttachmentCategory.ADVERSE_EVENT_PHOTO,
  OTHER: AttachmentCategory.OTHER_ATTACHMENT,
};

export function toAttachmentCategory(val: AttachmentCategoryType): AttachmentCategory {
  return ATTACHMENT_CATEGORY_MAP[val];
}

// ── LabPaymentMethod ──

const PAYMENT_METHOD_MAP: Record<PaymentMethodType, LabPaymentMethod> = {
  CASH: LabPaymentMethod.LAB_CASH,
  BANK_TRANSFER: LabPaymentMethod.LAB_BANK_TRANSFER,
  CHECK: LabPaymentMethod.LAB_CHECK,
  VOUCHER: LabPaymentMethod.LAB_VOUCHER,
  CREDIT_CARD: LabPaymentMethod.LAB_CREDIT_CARD,
  DEBIT_CARD: LabPaymentMethod.LAB_DEBIT_CARD,
  AGREEMENT: LabPaymentMethod.LAB_AGREEMENT,
  PENDING_PAYMENT: LabPaymentMethod.LAB_PENDING_PAYMENT,
  OTHER: LabPaymentMethod.OTHER_PAYMENT,
};

export function toLabPaymentMethod(val: PaymentMethodType): LabPaymentMethod {
  return PAYMENT_METHOD_MAP[val];
}

// ── LabChargeStatus ──

const CHARGE_STATUS_MAP: Record<ChargeStatusType, LabChargeStatus> = {
  REGISTERED: LabChargeStatus.REGISTERED_CHARGE,
  VALIDATED: LabChargeStatus.VALIDATED_CHARGE,
  INVOICED: LabChargeStatus.INVOICED_CHARGE,
  PAID: LabChargeStatus.PAID_CHARGE,
  CANCELLED: LabChargeStatus.CANCELLED_CHARGE,
  REVERSED: LabChargeStatus.REVERSED,
};

export function toLabChargeStatus(val: ChargeStatusType): LabChargeStatus {
  return CHARGE_STATUS_MAP[val];
}

// ── LiquidationStatus ──

const LIQ_STATUS_MAP: Record<LiquidationStatusType, LiquidationStatus> = {
  DRAFT: LiquidationStatus.DRAFT_LIQ,
  CONFIRMED: LiquidationStatus.CONFIRMED,
  INVOICED: LiquidationStatus.INVOICED_LIQ,
  PARTIALLY_PAID: LiquidationStatus.PARTIALLY_PAID,
  PAID: LiquidationStatus.PAID_LIQ,
  OVERDUE: LiquidationStatus.OVERDUE,
  CANCELLED: LiquidationStatus.CANCELLED_LIQ,
};

export function toLiquidationStatus(val: LiquidationStatusType): LiquidationStatus {
  return LIQ_STATUS_MAP[val];
}

// ── FmSource (identical values) ──

export function toFmSource(val: FmSourceType): FmSource {
  return val as FmSource;
}

// ── Gender ──

export function toGender(val: 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN' | null): Gender | null {
  if (val === null) return null;
  if (val === 'OTHER') return Gender.OTHER_GENDER;
  return val as Gender;
}

// ── LabExamChargeSource ──

export function toLabExamChargeSource(val: ExamChargeSourceType): LabExamChargeSource {
  return val as LabExamChargeSource;
}

// ── Reverse maps (Prisma -> FM string for write-back) ──

const REVERSE_PAYMENT_METHOD_MAP: Record<LabPaymentMethod, string> = {
  [LabPaymentMethod.LAB_CASH]: 'Efectivo',
  [LabPaymentMethod.LAB_BANK_TRANSFER]: 'Transferencia',
  [LabPaymentMethod.LAB_CHECK]: 'Cheque',
  [LabPaymentMethod.LAB_VOUCHER]: 'Bono',
  [LabPaymentMethod.LAB_CREDIT_CARD]: 'Tarjeta Crédito',
  [LabPaymentMethod.LAB_DEBIT_CARD]: 'Tarjeta Débito',
  [LabPaymentMethod.LAB_AGREEMENT]: 'Convenio',
  [LabPaymentMethod.LAB_PENDING_PAYMENT]: 'Pendiente',
  [LabPaymentMethod.OTHER_PAYMENT]: 'Otro',
};

export function fromLabPaymentMethod(val: LabPaymentMethod): string {
  return REVERSE_PAYMENT_METHOD_MAP[val];
}

const REVERSE_CHARGE_STATUS_MAP: Record<LabChargeStatus, string> = {
  [LabChargeStatus.REGISTERED_CHARGE]: 'Registrado',
  [LabChargeStatus.VALIDATED_CHARGE]: 'Validado',
  [LabChargeStatus.INVOICED_CHARGE]: 'Facturado',
  [LabChargeStatus.PAID_CHARGE]: 'Pagado',
  [LabChargeStatus.CANCELLED_CHARGE]: 'Cancelado',
  [LabChargeStatus.REVERSED]: 'Reversado',
};

export function fromLabChargeStatus(val: LabChargeStatus): string {
  return REVERSE_CHARGE_STATUS_MAP[val];
}

const REVERSE_LIQ_STATUS_MAP: Record<LiquidationStatus, string> = {
  [LiquidationStatus.DRAFT_LIQ]: 'Borrador',
  [LiquidationStatus.CONFIRMED]: 'Confirmado',
  [LiquidationStatus.INVOICED_LIQ]: 'Facturado',
  [LiquidationStatus.PARTIALLY_PAID]: 'Pago Parcial',
  [LiquidationStatus.PAID_LIQ]: 'Cancelado Total',
  [LiquidationStatus.OVERDUE]: 'Vencido',
  [LiquidationStatus.CANCELLED_LIQ]: 'Anulado',
};

export function fromLiquidationStatus(val: LiquidationStatus): string {
  return REVERSE_LIQ_STATUS_MAP[val];
}

const REVERSE_EXAM_CHARGE_SOURCE_MAP: Record<LabExamChargeSource, string> = {
  [LabExamChargeSource.BIOPSIAS_INGRESOS]: 'BIOPSIAS_INGRESOS',
  [LabExamChargeSource.PAP_INGRESOS]: 'PAP_INGRESOS',
};

export function fromLabExamChargeSource(val: LabExamChargeSource): string {
  return REVERSE_EXAM_CHARGE_SOURCE_MAP[val];
}

// ── AdverseSeverity ──

const ADVERSE_SEVERITY_MAP: Record<string, AdverseSeverity> = {
  MINOR: AdverseSeverity.MINOR_SEV,
  MODERATE: AdverseSeverity.MODERATE_SEV,
  MAJOR: AdverseSeverity.MAJOR_SEV,
  CRITICAL: AdverseSeverity.CRITICAL_SEV,
};

export function toAdverseSeverity(val: string): AdverseSeverity {
  return ADVERSE_SEVERITY_MAP[val] ?? AdverseSeverity.MINOR_SEV;
}

const REVERSE_ADVERSE_SEVERITY_MAP: Record<AdverseSeverity, string> = {
  [AdverseSeverity.MINOR_SEV]: 'MINOR',
  [AdverseSeverity.MODERATE_SEV]: 'MODERATE',
  [AdverseSeverity.MAJOR_SEV]: 'MAJOR',
  [AdverseSeverity.CRITICAL_SEV]: 'CRITICAL',
};

export function fromAdverseSeverity(val: AdverseSeverity): string {
  return REVERSE_ADVERSE_SEVERITY_MAP[val];
}
