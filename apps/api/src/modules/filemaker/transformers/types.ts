// ── Shared DTOs for lab module transformers ──
// These are pure data structures extracted from FM records.
// They do NOT touch the database — the import pipeline consumes them.

export type FmSourceType =
  | 'BIOPSIAS'
  | 'BIOPSIASRESPALDO'
  | 'PAPANICOLAOU'
  | 'PAPANICOLAOUHISTORICO';

export type ExamCategoryType =
  | 'BIOPSY'
  | 'PAP'
  | 'CYTOLOGY'
  | 'IMMUNOHISTOCHEMISTRY'
  | 'MOLECULAR'
  | 'OTHER';

export type SigningRoleType =
  | 'PRIMARY_PATHOLOGIST'
  | 'CO_PATHOLOGIST'
  | 'SUPERVISING_PATHOLOGIST'
  | 'EXTERNAL_CONSULTANT'
  | 'SCREENING_TECH'
  | 'SUPERVISING_TECH'
  | 'VISTO_BUENO_TECH'
  | 'VALIDATION_CORRECTION'
  | 'QC_REVIEWER'
  | 'OTHER';

export type DiagnosticReportStatusType =
  | 'REGISTERED'
  | 'IN_TRANSIT'
  | 'RECEIVED'
  | 'PROCESSING'
  | 'REPORTING'
  | 'PRE_VALIDATED'
  | 'VALIDATED'
  | 'SIGNED'
  | 'DELIVERED'
  | 'DOWNLOADED'
  | 'CANCELLED'
  | 'AMENDED';

export type AttachmentCategoryType =
  | 'REPORT_PDF'
  | 'CRITICAL_NOTIFICATION_PDF'
  | 'MACRO_PHOTO'
  | 'MICRO_PHOTO'
  | 'ENCAPSULATION_PHOTO'
  | 'MACRO_DICTATION'
  | 'DIAGNOSIS_MODIFICATION'
  | 'SCANNER_CARTON'
  | 'REQUEST_DOCUMENT'
  | 'MOLECULAR_CONTAINER'
  | 'ADVERSE_EVENT_PHOTO'
  | 'OTHER';

export type WorkflowEventTypeValue =
  | 'ORIGIN_INTAKE'
  | 'ORIGIN_HANDOFF_TO_COURIER'
  | 'TRANSPORT'
  | 'RECEIVED_AT_LAB'
  | 'MACROSCOPY'
  | 'EMBEDDING'
  | 'CUTTING_STAINING'
  | 'HISTOLOGY_REPORTING'
  | 'VALIDATION'
  | 'APPROVAL'
  | 'DELIVERY'
  | 'INTAKE'
  | 'PROCESSING'
  | 'DIAGNOSIS_TRANSCRIPTION'
  | 'PRE_VALIDATION'
  | 'SECRETARY_VALIDATION'
  | 'PATHOLOGIST_APPROVAL_WEB'
  | 'WEB_VALIDATION'
  | 'PDF_GENERATED'
  | 'WEB_DELIVERY'
  | 'WEB_TRANSPORT'
  | 'WEB_RECEPTION'
  | 'WEB_EXAM_CYTOLOGY'
  | 'WEB_DOWNLOAD'
  | 'WEB_ACKNOWLEDGMENT'
  | 'CLIENT_NOTIFIED'
  | 'CASE_CORRECTION'
  | 'AMENDMENT'
  | 'CRITICAL_NOTIFICATION'
  | 'OTHER';

export type CommunicationCategoryType =
  | 'SAMPLE_QUALITY_ISSUE'
  | 'ADDITIONAL_INFO_REQUEST'
  | 'INTERNAL_QC'
  | 'CRITICAL_RESULT'
  | 'CLIENT_INQUIRY'
  | 'CORRECTION_REQUEST'
  | 'OTHER';

export type ChargeStatusType =
  | 'REGISTERED'
  | 'VALIDATED'
  | 'INVOICED'
  | 'PAID'
  | 'CANCELLED'
  | 'REVERSED';

export type PaymentMethodType =
  | 'CASH'
  | 'BANK_TRANSFER'
  | 'CHECK'
  | 'VOUCHER'
  | 'CREDIT_CARD'
  | 'DEBIT_CARD'
  | 'AGREEMENT'
  | 'PENDING_PAYMENT'
  | 'OTHER';

export type ExamChargeSourceType = 'BIOPSIAS_INGRESOS' | 'PAP_INGRESOS';

export type LiquidationStatusType =
  | 'DRAFT'
  | 'CONFIRMED'
  | 'INVOICED'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'OVERDUE'
  | 'CANCELLED';

// ── Extracted DTOs ──

export interface ExtractedSigner {
  codeSnapshot: string;
  nameSnapshot: string;
  role: SigningRoleType;
  signatureOrder: number;
  signedAt: Date | null;
  isActive: boolean;
  supersededBy: string | null;
  correctionReason: string | null;
}

export interface ExtractedAttachmentRef {
  category: AttachmentCategoryType;
  label: string | null;
  sequenceOrder: number | null;
  s3Key: string;
  contentType: string;
  fmSourceField: string;
  fmContainerUrlOriginal: string | null;
  citolabS3KeyOriginal: string | null;
}

/**
 * Unified DTO for both biopsies and PAPs.
 * Both BiopsyTransformer and PapTransformer produce this interface.
 */
export interface ExtractedExam {
  fmInformeNumber: number;
  fmSource: FmSourceType;
  fmRecordId: string;

  // Patient snapshot
  subjectFirstName: string;
  subjectPaternalLastName: string;
  subjectMaternalLastName: string | null;
  subjectRut: string | null;
  subjectAge: number | null;
  subjectGender: 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN' | null;

  // ServiceRequest
  category: ExamCategoryType;
  subcategory: string | null;
  isUrgent: boolean;
  requestingPhysicianName: string | null;
  labOriginCode: string;
  anatomicalSite: string | null;
  clinicalHistory: string | null;
  sampleCollectedAt: Date | null;
  receivedAt: Date | null;
  requestedAt: Date | null;

  // DiagnosticReport
  status: DiagnosticReportStatusType;
  conclusion: string | null;
  fullText: string | null;
  microscopicDescription: string | null;
  macroscopicDescription: string | null;
  isAlteredOrCritical: boolean;
  validatedAt: Date | null;
  issuedAt: Date | null;

  // Signers
  signers: ExtractedSigner[];

  // Attachment references (not the binary — just metadata + keys)
  attachmentRefs: ExtractedAttachmentRef[];
}

export interface ExtractedExamCharge {
  fmRecordPk: number;
  fmSource: ExamChargeSourceType;
  fkInformeNumber: number;
  paymentMethod: PaymentMethodType;
  paymentMethodRaw: string;
  amount: number;
  feeCodesText: string | null;
  feeCodes: string[];
  status: ChargeStatusType;
  statusRaw: string;
  labOriginCodeSnapshot: string;
  enteredAt: Date | null;
  enteredByNameSnapshot: string;
  pointOfEntry: string | null;
  fkLiquidacion: string | null;
  fkRendicion: string | null;
}

export interface ExtractedLiquidation {
  fmPk: number;
  labOriginCode: string;
  period: Date | null;
  periodLabel: string;
  status: LiquidationStatusType;
  statusRaw: string;
  totalAmount: number;
  biopsyAmount: number;
  papAmount: number;
  cytologyAmount: number;
  immunoAmount: number;
  biopsyCount: number;
  papCount: number;
  cytologyCount: number;
  immunoCount: number;
  previousDebt: number;
  creditBalance: number;
  confirmedAt: Date | null;
  confirmedByNameSnapshot: string | null;
  invoiceNumber: string | null;
  invoiceDate: Date | null;
  paymentAmount: number | null;
  paymentDate: Date | null;
  paymentMethodText: string | null;
  notes: string | null;
}

export interface ExtractedWorkflowEvent {
  eventType: WorkflowEventTypeValue;
  sequenceOrder: number;
  occurredAt: Date;
  performedByNameSnapshot: string;
  sourceField: string;
}

export interface ExtractedCommunication {
  fkInformeNumber: number;
  reason: string | null;
  content: string;
  response: string | null;
  loggedAt: Date | null;
  loggedByNameSnapshot: string;
  category: CommunicationCategoryType | null;
}
