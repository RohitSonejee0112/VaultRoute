import { HmacSigner } from '../security/hmacSigner';
import { SeededPRNG } from '../analytics/prng';
import { PARTNER_REGISTRY, PartnerDefinition } from './partnerRegistry';

export interface DispatchPayloadWrapper {
  request: unknown;
  idempotencyKey: string;
  signatureHmac: string;
}

export interface PartnerDispatchResult {
  success: boolean;
  latencyMs: number;
  ackId?: string;
  isIdempotentReplay?: boolean;
  errorDetails?: string;
  errorCode?: string;
}

export class EnterprisePartnerSimulator {
  private processedIdempotencyKeys: Map<string, string> = new Map();
  private partners: Record<string, PartnerDefinition>;
  private prng: SeededPRNG;
  private faultOverrides: Record<string, { latencyMultiplier: number; failureRate: number }> = {};

  constructor(prng: SeededPRNG = new SeededPRNG(), partners = PARTNER_REGISTRY) {
    this.prng = prng;
    this.partners = partners;
  }

  public setFaultOverrides(overrides: Record<string, { latencyMultiplier: number; failureRate: number }>): void {
    this.faultOverrides = overrides;
  }

  public async dispatch(partnerKey: string, wrapper: DispatchPayloadWrapper): Promise<PartnerDispatchResult> {
    const partner = this.partners[partnerKey];
    if (!partner) {
      return {
        success: false,
        latencyMs: 5,
        errorCode: 'UNREGISTERED_PARTNER',
        errorDetails: `No registered interface for partner: ${partnerKey}`
      };
    }

    // Step 1: HMAC Signature & Authenticity Verification
    const isAuthentic = HmacSigner.verify(wrapper.request, wrapper.signatureHmac, partner.sharedHmacSecret);
    if (!isAuthentic) {
      return {
        success: false,
        latencyMs: 10,
        errorCode: 'HMAC_AUTHENTICATION_FAILURE',
        errorDetails: `Partner [${partner.name}] rejected payload: HMAC-SHA256 signature mismatch.`
      };
    }

    // Step 2: Idempotency Key Deduplication Check
    if (this.processedIdempotencyKeys.has(wrapper.idempotencyKey)) {
      const cachedAck = this.processedIdempotencyKeys.get(wrapper.idempotencyKey)!;
      return {
        success: true,
        latencyMs: 8,
        ackId: cachedAck,
        isIdempotentReplay: true
      };
    }

    // Step 3: Latency & Failure Calculation
    const fault = this.faultOverrides[partnerKey] || { latencyMultiplier: 1.0, failureRate: partner.failureRate };
    const minLat = Math.floor(partner.minLatencyMs * fault.latencyMultiplier);
    const maxLat = Math.floor(partner.maxLatencyMs * fault.latencyMultiplier);
    const latency = this.prng.nextInt(minLat, Math.max(minLat, maxLat));

    await new Promise((resolve) => setTimeout(resolve, latency));

    // Step 4: Simulated Network / Endpoint Failure Check
    const roll = this.prng.next();
    if (roll < fault.failureRate) {
      return {
        success: false,
        latencyMs: latency,
        errorCode: 'PARTNER_TIMEOUT_OR_DROPOUT',
        errorDetails: `Downstream partner [${partner.name}] service degraded or timed out.`
      };
    }

    // Success: register idempotency key
    const ackId = `ACK-${partnerKey.substring(0, 4)}-${Math.floor(this.prng.next() * 1000000).toString(16).toUpperCase()}`;
    this.processedIdempotencyKeys.set(wrapper.idempotencyKey, ackId);

    return {
      success: true,
      latencyMs: latency,
      ackId,
      isIdempotentReplay: false
    };
  }

  public getPartner(partnerKey: string): PartnerDefinition | undefined {
    return this.partners[partnerKey];
  }
}
