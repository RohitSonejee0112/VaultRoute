import { randomUUID } from 'crypto';
import { DlqEntry } from '../types/events';
import { DocumentDeliveryRequest, DocumentState } from '../types/schemas';

export class DeadLetterQueue {
  private queue: Map<string, DlqEntry> = new Map();

  public enqueue(
    request: DocumentDeliveryRequest,
    lastState: DocumentState,
    failureReason: string,
    retryAttempts: number
  ): DlqEntry {
    const entry: DlqEntry = {
      dlqId: `DLQ-${randomUUID().substring(0, 8).toUpperCase()}`,
      failedAt: new Date().toISOString(),
      request,
      lastState,
      failureReason,
      retryAttempts,
      replayed: false,
      replayAuditTrail: []
    };

    this.queue.set(request.requestId, entry);
    return entry;
  }

  public get(requestId: string): DlqEntry | undefined {
    return this.queue.get(requestId);
  }

  public getAll(): DlqEntry[] {
    return Array.from(this.queue.values());
  }

  public getPending(): DlqEntry[] {
    return this.getAll().filter((entry) => !entry.replayed);
  }

  public markReplayed(requestId: string, outcome: string): boolean {
    const entry = this.queue.get(requestId);
    if (!entry) return false;

    entry.replayed = true;
    entry.replayAuditTrail.push(`[${new Date().toISOString()}] Replay attempted. Result: ${outcome}`);
    return true;
  }

  public clear(): void {
    this.queue.clear();
  }
}
