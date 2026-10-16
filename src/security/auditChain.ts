import { createHash } from 'crypto';
import { AuditEvent } from '../types/events';

export interface ChainVerificationResult {
  isValid: boolean;
  totalEntries: number;
  tamperedIndex?: number;
  reason?: string;
}

/**
 * Tamper-Evident Audit Ledger (Cryptographic Hash Chaining).
 * Every event H_n is cryptographically bound to H_(n-1):
 * H_n = SHA256(H_(n-1) || Event_n_Canonical)
 * Proves historical SLA and delivery records were not modified before reporting.
 */
export class AuditChainLedger {
  public static readonly GENESIS_HASH = '0'.repeat(64);
  private entries: AuditEvent[] = [];

  public append(eventData: Omit<AuditEvent, 'previousEntryHash' | 'entryHash'>): AuditEvent {
    const previousHash = this.entries.length > 0 
      ? this.entries[this.entries.length - 1].entryHash 
      : AuditChainLedger.GENESIS_HASH;

    const canonicalContent = this.canonicalize({
      ...eventData,
      previousEntryHash: previousHash
    });

    const entryHash = createHash('sha256')
      .update(`${previousHash}|${canonicalContent}`)
      .digest('hex');

    const fullEvent: AuditEvent = {
      ...eventData,
      previousEntryHash: previousHash,
      entryHash
    };

    this.entries.push(fullEvent);
    return fullEvent;
  }

  public getEntries(): AuditEvent[] {
    return [...this.entries];
  }

  public verifyLedger(): ChainVerificationResult {
    let expectedPreviousHash = AuditChainLedger.GENESIS_HASH;

    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i];

      // Verify link to previous entry
      if (entry.previousEntryHash !== expectedPreviousHash) {
        return {
          isValid: false,
          totalEntries: this.entries.length,
          tamperedIndex: i,
          reason: `Broken hash link at index ${i}. Expected prev ${expectedPreviousHash}, found ${entry.previousEntryHash}`
        };
      }

      // Re-verify hash computation
      const { entryHash, ...dataToVerify } = entry;
      const canonicalContent = this.canonicalize(dataToVerify);
      const computedHash = createHash('sha256')
        .update(`${entry.previousEntryHash}|${canonicalContent}`)
        .digest('hex');

      if (computedHash !== entryHash) {
        return {
          isValid: false,
          totalEntries: this.entries.length,
          tamperedIndex: i,
          reason: `Data integrity mismatch at index ${i}. Computed ${computedHash}, stored ${entryHash}`
        };
      }

      expectedPreviousHash = entryHash;
    }

    return {
      isValid: true,
      totalEntries: this.entries.length
    };
  }

  private canonicalize(obj: Record<string, unknown>): string {
    const sortedKeys = Object.keys(obj).sort();
    const sortedObj: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      sortedObj[key] = obj[key];
    }
    return JSON.stringify(sortedObj);
  }
}
