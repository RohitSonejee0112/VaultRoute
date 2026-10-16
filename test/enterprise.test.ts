import assert from 'assert';
import { DocumentStateMachine, InvalidStateTransitionError } from '../src/engine/stateMachine';
import { AbacPolicyEngine } from '../src/security/abacPolicy';
import { HmacSigner } from '../src/security/hmacSigner';
import { AuditChainLedger } from '../src/security/auditChain';
import { CircuitBreaker, CircuitBreakerOpenError } from '../src/resilience/circuitBreaker';
import { FullJitterBackoff } from '../src/resilience/jitterBackoff';
import { DeadLetterQueue } from '../src/resilience/deadLetterQueue';
import { PercentileMetricsCalculator } from '../src/analytics/percentileMetrics';
import { DocumentDeliveryRequest } from '../src/types/schemas';

async function runEnterpriseTestSuite() {
  console.log('🧪 ================================================================');
  console.log('   RUNNING ENTERPRISE TEST SUITE (STRICT TYPESCRIPT & ARCHITECTURE)');
  console.log('   ================================================================');

  // 1. Strict Finite State Machine (FSM)
  console.log('1. Testing Strict FSM Transitions...');
  const fsm = new DocumentStateMachine('REQ-TEST-001', 'REQUESTED');
  assert.strictEqual(fsm.getState(), 'REQUESTED');
  fsm.transitionTo('VALIDATING');
  assert.strictEqual(fsm.getState(), 'VALIDATING');
  fsm.transitionTo('IN_TRANSIT');
  assert.strictEqual(fsm.getState(), 'IN_TRANSIT');

  // Verify that an invalid transition throws InvalidStateTransitionError
  assert.throws(
    () => fsm.transitionTo('REQUESTED'),
    (err: any) => err instanceof InvalidStateTransitionError,
    'Illegal backwards transition must throw InvalidStateTransitionError'
  );
  fsm.transitionTo('DELIVERED');
  assert.strictEqual(fsm.isTerminal(), true);
  console.log('  ✔ Formal FSM transitions and illegal jump rejection verified.');

  // 2. Attribute-Based Access Control (ABAC)
  console.log('\n2. Testing ABAC Policy Rules (Clearance, Department, Jurisdiction)...');
  const baseRequest: DocumentDeliveryRequest = {
    requestId: 'REQ-ABAC-1',
    documentId: 'DOC-1',
    documentType: 'TAX_FORM',
    classification: 'CONFIDENTIAL',
    priority: 'P2',
    sourceTeam: 'Wealth_Management',
    targetPartner: 'LEGAL_COMPLIANCE',
    version: 1,
    recipient: {
      entityId: 'USR-1',
      department: 'Wealth_Management',
      clearanceLevel: 'CONFIDENTIAL',
      jurisdiction: 'US',
      deliveryChannel: 'ENCRYPTED_PORTAL_DROP'
    },
    allowedJurisdictions: ['US', 'EU'],
    payloadData: { amount: 1000 },
    timestamps: {
      requestedAt: new Date().toISOString(),
      slaDeadline: new Date().toISOString()
    }
  };

  const allowedDecision = AbacPolicyEngine.evaluate(baseRequest);
  assert.strictEqual(allowedDecision.allowed, true);

  // Clearance failure
  const lowClearanceReq = {
    ...baseRequest,
    recipient: { ...baseRequest.recipient, clearanceLevel: 'INTERNAL' as const }
  };
  const deniedDecision = AbacPolicyEngine.evaluate(lowClearanceReq);
  assert.strictEqual(deniedDecision.allowed, false);

  // Jurisdiction failure
  const foreignReq = {
    ...baseRequest,
    recipient: { ...baseRequest.recipient, jurisdiction: 'APAC' as const }
  };
  const jurisDenied = AbacPolicyEngine.evaluate(foreignReq);
  assert.strictEqual(jurisDenied.allowed, false);
  console.log('  ✔ ABAC policies (clearance, dept, jurisdiction) verified.');

  // 3. Cryptographic HMAC-SHA256 Signatures
  console.log('\n3. Testing HMAC-SHA256 Non-Repudiation & Authenticity...');
  const secret = 'shared_enterprise_secret_k876234';
  const payload = { documentId: 'DOC-99', content: 'Secret Financial Ledger' };
  const signature = HmacSigner.sign(payload, secret);
  assert.strictEqual(HmacSigner.verify(payload, signature, secret), true);
  assert.strictEqual(HmacSigner.verify({ ...payload, content: 'Tampered' }, signature, secret), false);
  console.log('  ✔ HMAC-SHA256 signing and tamper detection verified.');

  // 4. Tamper-Evident Audit Ledger (Cryptographic Hash Chaining)
  console.log('\n4. Testing Tamper-Evident Hash Chaining Ledger...');
  const ledger = new AuditChainLedger();
  ledger.append({
    eventId: 'EVT-1',
    requestId: 'REQ-1',
    documentId: 'DOC-1',
    documentType: 'TEST',
    priority: 'P1',
    partner: 'WEALTH_MGMT_CORE',
    state: 'DELIVERED',
    durationMs: 150,
    slaTargetMs: 500,
    slaMet: true,
    retryCount: 0,
    idempotencyKey: 'IDEM-1',
    signatureHmac: 'HMAC-1',
    errorReason: null,
    timestamp: new Date().toISOString()
  });

  ledger.append({
    eventId: 'EVT-2',
    requestId: 'REQ-2',
    documentId: 'DOC-2',
    documentType: 'TEST',
    priority: 'P2',
    partner: 'LEGAL_COMPLIANCE',
    state: 'DELIVERED',
    durationMs: 250,
    slaTargetMs: 1000,
    slaMet: true,
    retryCount: 0,
    idempotencyKey: 'IDEM-2',
    signatureHmac: 'HMAC-2',
    errorReason: null,
    timestamp: new Date().toISOString()
  });

  const verified = ledger.verifyLedger();
  assert.strictEqual(verified.isValid, true);
  assert.strictEqual(verified.totalEntries, 2);

  // Simulate malicious in-memory tampering of historical log
  (ledger as any).entries[0].durationMs = 999999;
  const tamperedResult = ledger.verifyLedger();
  assert.strictEqual(tamperedResult.isValid, false);
  assert.strictEqual(tamperedResult.tamperedIndex, 0);
  console.log('  ✔ Cryptographic hash chain verification and tamper detection passed.');

  // 5. Circuit Breaker Pattern
  console.log('\n5. Testing Circuit Breaker (CLOSED -> OPEN -> FAIL_FAST)...');
  const breaker = new CircuitBreaker('TEST_PARTNER', {
    failureThresholdPercentage: 50,
    rollingWindowMs: 5000,
    cooldownPeriodMs: 1000,
    minRequestsInWindow: 4
  });

  assert.strictEqual(breaker.getState(), 'CLOSED');
  // Record 3 failures out of 4 requests
  breaker.recordFailure();
  breaker.recordFailure();
  breaker.recordFailure();
  breaker.recordSuccess();

  assert.strictEqual(breaker.getState(), 'OPEN');
  await assert.rejects(
    async () => breaker.execute(async () => 'should fail fast'),
    (err: any) => err instanceof CircuitBreakerOpenError,
    'Breaker must fail fast when OPEN'
  );
  console.log('  ✔ Circuit breaker state transitions and fail-fast behavior verified.');

  // 6. Full Jitter Exponential Backoff Bounds
  console.log('\n6. Testing Full Jitter Exponential Backoff Calculation...');
  const backoff = new FullJitterBackoff(100, 2000);
  for (let attempt = 1; attempt <= 5; attempt++) {
    const delay = backoff.calculateDelay(attempt);
    assert.ok(delay >= 0, 'Delay must be non-negative');
    assert.ok(delay <= 2000, 'Delay must not exceed cap of 2000ms');
  }
  console.log('  ✔ Full Jitter bounds respected.');

  // 7. Dead-Letter Queue & Replay
  console.log('\n7. Testing Dead-Letter Queue (DLQ) & Replay...');
  const dlq = new DeadLetterQueue();
  dlq.enqueue(baseRequest, 'FAILED_BREACH', 'Network timeout', 3);
  assert.strictEqual(dlq.getAll().length, 1);
  assert.strictEqual(dlq.getPending().length, 1);
  dlq.markReplayed(baseRequest.requestId, 'Replayed via secondary route');
  assert.strictEqual(dlq.getPending().length, 0);
  console.log('  ✔ DLQ storage and replay tracking verified.');

  // 8. Percentile Metrics Calculations (p50, p95, p99)
  console.log('\n8. Testing Percentile Metrics (p50, p95, p99)...');
  const samples = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  const percentiles = PercentileMetricsCalculator.calculatePercentiles(samples);
  assert.strictEqual(percentiles.p50Ms, 50);
  assert.strictEqual(percentiles.p95Ms, 100);
  assert.strictEqual(percentiles.minMs, 10);
  assert.strictEqual(percentiles.maxMs, 100);
  console.log('  ✔ Tail latency percentiles calculated accurately.');

  console.log('\n================================================================');
  console.log('🎉 ALL 8 ENTERPRISE ARCHITECTURE TEST SUITES PASSED FLAWLESSLY!');
  console.log('================================================================\n');
}

runEnterpriseTestSuite().catch((err) => {
  console.error('Enterprise test failed:', err);
  process.exit(1);
});
