import { DocumentState, SlaTier } from './schemas';

export interface AuditEvent {
  eventId: string;
  requestId: string;
  documentId: string;
  documentType: string;
  priority: SlaTier;
  partner: string;
  state: DocumentState;
  durationMs: number;
  slaTargetMs: number;
  slaMet: boolean;
  retryCount: number;
  idempotencyKey: string;
  signatureHmac: string;
  errorReason: string | null;
  previousEntryHash: string;
  entryHash: string;
  timestamp: string;
}

export interface DlqEntry {
  dlqId: string;
  failedAt: string;
  request: any;
  lastState: DocumentState;
  failureReason: string;
  retryAttempts: number;
  replayed: boolean;
  replayAuditTrail: string[];
}
