import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Enterprise HMAC-SHA256 Signer.
 * Guarantees payload authenticity and non-repudiation between the dispatcher and partner systems.
 */
export class HmacSigner {
  public static sign(payload: unknown, secretKey: string): string {
    const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return createHmac('sha256', secretKey).update(serialized).digest('hex');
  }

  public static verify(payload: unknown, signature: string, secretKey: string): boolean {
    if (!signature || !secretKey) return false;
    const computedSignature = this.sign(payload, secretKey);

    const sigBuf = Buffer.from(signature, 'hex');
    const compBuf = Buffer.from(computedSignature, 'hex');

    if (sigBuf.length !== compBuf.length) {
      return false;
    }

    return timingSafeEqual(sigBuf, compBuf);
  }
}
