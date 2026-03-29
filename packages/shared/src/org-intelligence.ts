export const ORG_PROJECT_STATUSES = ['DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED'] as const;
export type OrgProjectStatus = (typeof ORG_PROJECT_STATUSES)[number];

export const ORG_ENTITY_TYPES = [
  'ORGANIZATION', 'DEPARTMENT', 'ROLE', 'PROCESS', 'ACTIVITY',
  'SYSTEM', 'DOCUMENT_TYPE', 'PROBLEM', 'IMPROVEMENT',
] as const;
export type OrgEntityType = (typeof ORG_ENTITY_TYPES)[number];

export const ORG_RELATION_TYPES = [
  'BELONGS_TO', 'EXECUTES', 'OWNS', 'CONTAINS', 'DEPENDS_ON',
  'USES', 'PRECEDES', 'FOLLOWS', 'TRIGGERS', 'INPUTS', 'OUTPUTS',
] as const;
export type OrgRelationType = (typeof ORG_RELATION_TYPES)[number];

export const PROBLEM_SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
export type ProblemSeverity = (typeof PROBLEM_SEVERITIES)[number];

export const PROCESSING_STATUSES = [
  'PENDING', 'UPLOADED', 'TRANSCRIBING', 'POST_PROCESSING',
  'EXTRACTING', 'RESOLVING_COREFERENCES', 'SUMMARIZING',
  'CHUNKING', 'EMBEDDING', 'COMPLETED', 'FAILED',
] as const;
export type ProcessingStatus = (typeof PROCESSING_STATUSES)[number];

export const ENTITY_TYPE_COLORS: Record<OrgEntityType, string> = {
  ORGANIZATION: 'slate',
  DEPARTMENT: 'blue',
  ROLE: 'indigo',
  PROCESS: 'emerald',
  ACTIVITY: 'teal',
  SYSTEM: 'amber',
  DOCUMENT_TYPE: 'orange',
  PROBLEM: 'red',
  IMPROVEMENT: 'green',
};
