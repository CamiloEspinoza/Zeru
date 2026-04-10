// Re-export Zod schemas from shared for controller validation
export {
  updateMacroscopySchema,
  completeMacroscopySchema,
  registerMacroSignerSchema,
  labReportSearchSchema,
  type UpdateMacroscopySchema,
  type CompleteMacroscopySchema,
  type RegisterMacroSignerSchema,
  type LabReportSearchSchema,
} from '@zeru/shared';
