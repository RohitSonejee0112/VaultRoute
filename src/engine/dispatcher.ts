import { randomUUID } from 'crypto';
import { IMessageBroker } from '../broker/messageBroker';
import { DocumentDeliveryRequest, DocumentDeliveryRequestSchema, SlaTier } from '../types/schemas';
import { AuditEvent } from '../types/events';
import { DocumentStateMachine } from './stateMachine';
import { AbacPolicyEngine } from '../security/abacPolicy';
import { HmacSigner } from '../security/hmacSigner';
import { AuditChainLedger } from '../security/auditChain';
import { FullJitterBackoff } from '../resilience/jitterBackoff';
import { CircuitBreaker } from '../resilience/circuitBreaker';
import { IdempotencyKeyGenerator } from '../resilience/idempotency';
import { DeadLetterQueue } from '../resilience/deadLetterQueue';
import { EnterprisePartnerSimulator } from '../partners/partnerSimulator';
import { PARTNER_REGISTRY } from '../partners/partnerRegistry';

export interface DispatcherConfig {
  maxRetries: number;
  baseBackoffMs: number;
  capBackoffMs: number;
  slaBudgetsMs: Record<SlaTier, number>;
  predictiveBurnRatePct: number; // e.g. 75%
}

export class EnterpriseDocumentDispatcher {
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private backoff: FullJitterBackoff;
  public readonly auditLedger: AuditChainLedger = new AuditChainLedger();
  public readonly dlq: DeadLetterQueue = new DeadLetterQueue();

  constructor(
    private readonly partnerSimulator: EnterprisePartnerSimulator,
    private readonly broker: IMessageBroker,
    private readonly config: DispatcherConfig = {
      maxRetries: 3,
      baseBackoffMs: 80,
      capBackoffMs: 1500,
      slaBudgetsMs: { P1: 800, P2: 2000, P3: 4000 },
      predictiveBurnRatePct: 75
    }
  ) {
    this.backoff = new FullJitterBackoff(config.baseBackoffMs, config.capBackoffMs);
    
    // Initialize Circuit Breakers for each registered partner
    for (const [key, def] of Object.entries(PARTNER_REGISTRY)) {
      this.circuitBreakers.set(
        key,
        new CircuitBreaker(key, {
          failureThresholdPercentage: def.circuitBreakerThresholdPct,
          rollingWindowMs: 10000,
          cooldownPeriodMs: 4000,
          minRequestsInWindow: 4
        })
      );
    }
  }

  public getCircuitBreaker(partnerKey: string): CircuitBreaker | undefined {
    return this.circuitBreakers.get(partnerKey);
  }

  public async processRequest(rawRequest: unknown): Promise<AuditEvent> {
    const startTime = Date.now();

    // Step 1: Runtime Schema Validation (Zod)
    const parseResult = DocumentDeliveryRequestSchema.safeParse(rawRequest);
    if (!parseResult.success) {
      const errorMsg = `Payload contract invalid: ${parseResult.error.issues.map((i) => i.message).join('; ')}`;
      return this.recordTerminalEvent(
        (rawRequest as any)?.requestId || `UNKNOWN-${randomUUID()}`,
        (rawRequest as any)?.documentId || 'UNKNOWN',
        'UNKNOWN',
        'P3',
        'UNKNOWN',
        'REJECTED',
        startTime,
        { slaMet: false, error: errorMsg, attempts: 1, idempotencyKey: 'N/A', signatureHmac: 'N/A' }
      );
    }

    const request = parseResult.data;
    const fsm = new DocumentStateMachine(request.requestId, 'REQUESTED');
    await this.broker.publish('document.requested', { requestId: request.requestId, request });

    // Step 2: Attribute-Based Access Control (ABAC) Validation
    fsm.transitionTo('VALIDATING');
    await this.broker.publish('document.validating', { requestId: request.requestId });

    const abacResult = AbacPolicyEngine.evaluate(request);
    if (!abacResult.allowed) {
      fsm.transitionTo('REJECTED');
      const rejectionReason = abacResult.reasons.join(' | ');
      await this.broker.publish('document.rejected', { requestId: request.requestId, reason: rejectionReason });

      return this.recordTerminalEvent(
        request.requestId,
        request.documentId,
        request.documentType,
        request.priority,
        request.targetPartner,
        'REJECTED',
        startTime,
        {
          slaMet: false,
          error: rejectionReason,
          attempts: 1,
          idempotencyKey: 'N/A',
          signatureHmac: 'N/A'
        }
      );
    }

    // Step 3: Cryptographic HMAC Signature & Idempotency Key
    const partnerDef = PARTNER_REGISTRY[request.targetPartner];
    const secretKey = partnerDef?.sharedHmacSecret || 'fallback_ephemeral_key';
    const signatureHmac = HmacSigner.sign(request, secretKey);
    const idempotencyKey = IdempotencyKeyGenerator.generate(request.documentId, request.targetPartner, request.version);

    // Step 4: Dispatch Loop with Circuit Breaker, Full Jitter, and Predictive SLA Burn Monitoring
    fsm.transitionTo('IN_TRANSIT');
    await this.broker.publish('document.in_transit', { requestId: request.requestId, targetPartner: request.targetPartner });

    let attempts = 0;
    let delivered = false;
    let lastError: string | null = null;
    const breaker = this.circuitBreakers.get(request.targetPartner);
    const slaBudgetMs = this.config.slaBudgetsMs[request.priority] || 2000;
    const riskThresholdMs = (this.config.predictiveBurnRatePct / 100) * slaBudgetMs;
    let burnRateWarningEmitted = false;

    while (attempts < this.config.maxRetries && !delivered) {
      attempts++;

      // Check predictive SLA burn-rate alert
      const currentElapsed = Date.now() - startTime;
      if (!burnRateWarningEmitted && currentElapsed >= riskThresholdMs) {
        burnRateWarningEmitted = true;
        await this.broker.publish('warning.sla_at_risk', {
          requestId: request.requestId,
          priority: request.priority,
          elapsedMs: currentElapsed,
          slaBudgetMs,
          burnRatePct: Math.round((currentElapsed / slaBudgetMs) * 100)
        });
      }

      try {
        if (breaker && breaker.getState() === 'OPEN') {
          throw new Error(`Circuit Breaker is OPEN for partner [${request.targetPartner}]. Fail-fast engaged.`);
        }

        const dispatchResult = await this.partnerSimulator.dispatch(request.targetPartner, {
          request,
          idempotencyKey,
          signatureHmac
        });

        if (dispatchResult.success) {
          breaker?.recordSuccess();
          delivered = true;
        } else {
          breaker?.recordFailure();
          lastError = dispatchResult.errorDetails || 'Partner dispatch failed.';
          
          if (attempts < this.config.maxRetries) {
            fsm.transitionTo('RETRY_PENDING');
            await this.broker.publish('document.retry_pending', {
              requestId: request.requestId,
              attempt: attempts,
              error: lastError
            });

            // Exponential backoff with full jitter
            await this.backoff.sleep(attempts);
            fsm.transitionTo('IN_TRANSIT');
          }
        }
      } catch (err: any) {
        breaker?.recordFailure();
        lastError = err.message || 'Execution error';
        if (attempts < this.config.maxRetries) {
          fsm.transitionTo('RETRY_PENDING');
          await this.backoff.sleep(attempts);
          fsm.transitionTo('IN_TRANSIT');
        }
      }
    }

    // Step 5: Final State Transition & SLA Evaluation
    const durationMs = Date.now() - startTime;
    const slaMet = delivered && durationMs <= slaBudgetMs;
    const finalState = delivered ? 'DELIVERED' : 'FAILED_BREACH';
    fsm.transitionTo(finalState);

    if (finalState === 'FAILED_BREACH') {
      // Enqueue to Dead-Letter Queue (DLQ)
      this.dlq.enqueue(request, finalState, lastError || 'Max retries exhausted / SLA breach', attempts);
      await this.broker.publish('document.dlq_enqueued', {
        requestId: request.requestId,
        failureReason: lastError,
        attempts
      });
    }

    return this.recordTerminalEvent(
      request.requestId,
      request.documentId,
      request.documentType,
      request.priority,
      request.targetPartner,
      finalState,
      startTime,
      {
        durationMs,
        slaTargetMs: slaBudgetMs,
        slaMet,
        attempts,
        error: lastError,
        idempotencyKey,
        signatureHmac
      }
    );
  }

  private recordTerminalEvent(
    requestId: string,
    documentId: string,
    documentType: string,
    priority: SlaTier,
    partner: string,
    state: any,
    startTime: number,
    meta: {
      durationMs?: number;
      slaTargetMs?: number;
      slaMet: boolean;
      attempts: number;
      error: string | null;
      idempotencyKey: string;
      signatureHmac: string;
    }
  ): AuditEvent {
    const durationMs = meta.durationMs ?? (Date.now() - startTime);
    const slaTargetMs = meta.slaTargetMs ?? (this.config.slaBudgetsMs[priority] || 2000);

    const event = this.auditLedger.append({
      eventId: `EVT-${randomUUID().substring(0, 8).toUpperCase()}`,
      requestId,
      documentId,
      documentType,
      priority,
      partner,
      state,
      durationMs,
      slaTargetMs,
      slaMet: meta.slaMet,
      retryCount: Math.max(0, meta.attempts - 1),
      idempotencyKey: meta.idempotencyKey,
      signatureHmac: meta.signatureHmac,
      errorReason: meta.error,
      timestamp: new Date().toISOString()
    });

    this.broker.publish('document.completed', event);
    return event;
  }
}
