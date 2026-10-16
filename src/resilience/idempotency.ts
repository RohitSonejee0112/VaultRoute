import { createHash } from 'crypto';

/**
 * Deterministic Idempotency Key Generator.
 * Derives a collision-resistant key from documentId + partnerId + version to guarantee
 * that retries or network duplications are recognized and rejected by downstream partners.
 */
export class IdempotencyKeyGenerator {
  public static generate(documentId: string, partnerId: string, version: number = 1): string {
    const raw = `${documentId}:${partnerId}:v${version}`;
    const hash = createHash('sha256').update(raw).digest('hex').substring(0, 32);
    return `IDEM-${hash.toUpperCase()}`;
  }
}
