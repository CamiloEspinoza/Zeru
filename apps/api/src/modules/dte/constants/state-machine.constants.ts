import { DteStatus } from '@prisma/client';

export const VALID_TRANSITIONS: Record<DteStatus, DteStatus[]> = {
  DRAFT: ['QUEUED', 'ERROR'],
  QUEUED: ['SIGNED', 'ERROR'],
  SIGNED: ['SENT', 'ERROR'],
  SENT: ['ACCEPTED', 'REJECTED', 'ACCEPTED_WITH_OBJECTION', 'ERROR'],
  ACCEPTED: ['VOIDED'],
  ACCEPTED_WITH_OBJECTION: ['VOIDED'],
  REJECTED: [],
  VOIDED: [],
  ERROR: ['QUEUED'],
};

export const COMMERCIALLY_USABLE_STATES: DteStatus[] = [
  'SIGNED',
  'SENT',
  'ACCEPTED',
  'ACCEPTED_WITH_OBJECTION',
];

export const TERMINAL_STATES: DteStatus[] = ['REJECTED', 'VOIDED'];

export const SII_PENDING_STATES: DteStatus[] = ['SIGNED', 'SENT'];
