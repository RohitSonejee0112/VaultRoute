const assert = require('assert');
const SecurityValidator = require('../src/security/checksum');
const KpiCalculator = require('../src/analytics/kpiCalculator');
const DocumentDispatcher = require('../src/engine/dispatcher');
const PartnerSimulator = require('../src/partners/partnerSimulator');

async function runTests() {
  console.log('🧪 Running Unit & Integration Tests...');

  // Test 1: Security Clearance Validation
  assert.strictEqual(
    SecurityValidator.validateClearance('CONFIDENTIAL', 'INTERNAL'),
    true,
    'Clearance should pass when recipient clearance is higher than doc'
  );
  assert.strictEqual(
    SecurityValidator.validateClearance('INTERNAL', 'RESTRICTED'),
    false,
    'Clearance should fail when recipient clearance is lower than doc'
  );
  console.log('  ✔ SecurityValidator clearance logic passed');

  // Test 2: SHA-256 Checksum Verification
  const payload = { test: 123 };
  const hash = SecurityValidator.computeChecksum(payload);
  assert.strictEqual(
    SecurityValidator.verifyIntegrity(payload, hash),
    true,
    'Integrity verification should match'
  );
  console.log('  ✔ SecurityValidator SHA-256 integrity check passed');

  // Test 3: KPI Calculator Aggregation
  const mockLogs = [
    { state: 'DELIVERED', slaMet: true, durationSec: 1.0, partner: 'PARTNER_A' },
    { state: 'DELIVERED', slaMet: true, durationSec: 2.0, partner: 'PARTNER_A' },
    { state: 'FAILED_BREACH', slaMet: false, durationSec: 3.0, partner: 'PARTNER_B' }
  ];
  const kpis = KpiCalculator.computeSummary(mockLogs);
  assert.strictEqual(kpis.totalVolume, 3);
  assert.strictEqual(kpis.delivered, 2);
  assert.strictEqual(kpis.failed, 1);
  assert.strictEqual(kpis.successRatePct, 66.7);
  console.log('  ✔ KpiCalculator summary aggregation passed');

  // Test 4: Dispatcher End-to-End Simulation
  const mockPartners = {
    MOCK_PARTNER: {
      name: 'Test Partner',
      minLatencyMs: 10,
      maxLatencyMs: 20,
      failureRate: 0.0
    }
  };
  const sim = new PartnerSimulator(mockPartners);
  const dispatcher = new DocumentDispatcher(sim, {
    maxRetries: 2,
    slaByPriority: { P1: 2.0 }
  });

  const event = await dispatcher.processRequest({
    requestId: 'REQ-TEST-1',
    documentId: 'DOC-TEST-1',
    documentType: 'TEST_DOC',
    priority: 'P1',
    classification: 'INTERNAL',
    targetPartner: 'MOCK_PARTNER',
    recipient: { entityId: 'E1', requiredClearance: 'CONFIDENTIAL' }
  });

  assert.strictEqual(event.state, 'DELIVERED');
  assert.strictEqual(event.slaMet, true);
  console.log('  ✔ DocumentDispatcher delivery execution passed');

  console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!\n');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
