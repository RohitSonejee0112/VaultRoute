import path from 'path';
import fs from 'fs';
import { InMemoryMessageBroker } from './broker/inMemoryBroker';
import { EnterprisePartnerSimulator } from './partners/partnerSimulator';
import { EnterpriseDocumentDispatcher } from './engine/dispatcher';
import { SeededPRNG } from './analytics/prng';
import { SIMULATION_PROFILES } from './analytics/simulationProfiles';
import { PercentileMetricsCalculator } from './analytics/percentileMetrics';
import { EnterpriseExcelReporter } from './reporting/excelReporter';
import { DocumentDeliveryRequest, ClearanceLevel, Department, Jurisdiction, SlaTier } from './types/schemas';

// Simple CLI arg parser
function parseArgs() {
  const args = process.argv.slice(2);
  const options: Record<string, string> = {};
  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.replace(/^--/, '').split('=');
      options[key] = value ?? 'true';
    }
  }
  return options;
}

async function main() {
  const cliOptions = parseArgs();
  const profileKey = cliOptions.profile || 'nominal-load';
  const profile = SIMULATION_PROFILES[profileKey] || SIMULATION_PROFILES['nominal-load'];
  const seed = cliOptions.seed ? parseInt(cliOptions.seed, 10) : 42;
  const count = cliOptions.count ? parseInt(cliOptions.count, 10) : profile.totalRequests;

  console.log('================================================================================');
  console.log('🏛️  ENTERPRISE OPERATIONAL REPORTING & DOCUMENT DISTRIBUTION SYSTEM (ORDDS)');
  console.log('    TypeScript Strict Mode | FSM | HMAC-SHA256 | ABAC | Full Jitter | DLQ');
  console.log('================================================================================');
  console.log(`📋 Execution Profile : ${profile.profileName.toUpperCase()}`);
  console.log(`ℹ️  Description       : ${profile.description}`);
  console.log(`🎲 PRNG Seed         : ${seed} (Deterministic Reproducibility)`);
  console.log(`📦 Request Count     : ${count}`);
  console.log('--------------------------------------------------------------------------------');

  const prng = new SeededPRNG(seed);
  const broker = new InMemoryMessageBroker();
  const partnerSim = new EnterprisePartnerSimulator(prng);
  partnerSim.setFaultOverrides(profile.partnerFaultMultipliers);

  // Subscribe to real-time events on decoupled broker
  let atRiskWarnings = 0;
  broker.subscribe('warning.sla_at_risk', (msg: any) => {
    atRiskWarnings++;
    process.stdout.write(`  ⚠️  [PREDICTIVE ALERT] Request [${msg.payload.requestId}] consumed ${msg.payload.burnRatePct}% of ${msg.payload.priority} SLA budget.\n`);
  });

  broker.subscribe('document.dlq_enqueued', (msg: any) => {
    process.stdout.write(`  🚨 [DLQ ENQUEUED] Request [${msg.payload.requestId}] routed to Dead-Letter Queue: ${msg.payload.failureReason}\n`);
  });

  const dispatcher = new EnterpriseDocumentDispatcher(partnerSim, broker, {
    maxRetries: 3,
    baseBackoffMs: 40,
    capBackoffMs: 800,
    slaBudgetsMs: { P1: 600, P2: 1500, P3: 3500 },
    predictiveBurnRatePct: profile.slaRiskThresholdPct
  });

  const partnerKeys = ['WEALTH_MGMT_CORE', 'LEGAL_COMPLIANCE', 'CLIENT_PORTAL_GATEWAY', 'UNDERWRITING_PARTNER'];
  const priorities: SlaTier[] = ['P1', 'P2', 'P3'];
  const docTypes = ['PORTFOLIO_STATEMENT', 'LEGAL_DISCLOSURE', 'TAX_FORM_1099', 'UNDERWRITING_PACK', 'MORTGAGE_BINDER'];
  const departments: Department[] = ['Wealth_Management', 'Legal_Compliance', 'Underwriting', 'Client_Services'];
  const jurisdictions: Jurisdiction[] = ['US', 'EU', 'APAC'];

  console.log('\n🚀 Dispatching requests through Finite State Machine...');

  for (let i = 1; i <= count; i++) {
    const partner = partnerKeys[prng.nextInt(0, partnerKeys.length - 1)];
    const priority = priorities[prng.nextInt(0, priorities.length - 1)];
    const docType = docTypes[prng.nextInt(0, docTypes.length - 1)];
    const dept = departments[prng.nextInt(0, departments.length - 1)];
    const juris = jurisdictions[prng.nextInt(0, jurisdictions.length - 1)];

    // Inject occasional ABAC clearance edge case
    const isSecurityMismatch = profile.simulateSecurityRejections && i % 18 === 0;
    const classification: ClearanceLevel = isSecurityMismatch ? 'RESTRICTED' : 'CONFIDENTIAL';
    const recipientClearance: ClearanceLevel = isSecurityMismatch ? 'INTERNAL' : 'CONFIDENTIAL';

    const req: DocumentDeliveryRequest = {
      requestId: `REQ-${profile.profileName.substring(0, 3).toUpperCase()}-${1000 + i}`,
      documentId: `DOC-${3000 + i}`,
      documentType: docType,
      classification,
      priority,
      sourceTeam: dept,
      targetPartner: partner,
      version: 1,
      recipient: {
        entityId: `ENT-${7000 + i}`,
        department: dept,
        clearanceLevel: recipientClearance,
        jurisdiction: juris,
        deliveryChannel: 'ENCRYPTED_PORTAL_DROP'
      },
      allowedJurisdictions: ['US', 'EU', 'APAC', 'GLOBAL'],
      payloadData: {
        hashSeed: prng.next(),
        contractValue: 500000 + i * 1000
      },
      timestamps: {
        requestedAt: new Date().toISOString(),
        slaDeadline: new Date(Date.now() + 3000).toISOString()
      }
    };

    await dispatcher.processRequest(req);

    if (i % 20 === 0 || i === count) {
      process.stdout.write(`  -> Completed ${i}/${count} dispatches...\n`);
    }
  }

  // 1. Verify Cryptographic Audit Chain
  console.log('\n🔒 Verifying Cryptographic Audit Ledger (Hash Chaining)...');
  const verification = dispatcher.auditLedger.verifyLedger();
  if (verification.isValid) {
    console.log(`  ✅ Hash Chain Intact: Verified ${verification.totalEntries} sequential entries without tampering.`);
  } else {
    console.error(`  ❌ TAMPERING DETECTED: Chain broken at entry ${verification.tamperedIndex}: ${verification.reason}`);
  }

  // 2. Compute Operational Analytics & Tail-Latency Percentiles
  const logs = dispatcher.auditLedger.getEntries();
  const summary = PercentileMetricsCalculator.generateSummary(logs);

  console.log('\n--------------------------------------------------------------------------------');
  console.log('📊 OPERATIONAL & SLA ADHERENCE METRICS:');
  console.log('--------------------------------------------------------------------------------');
  console.log(`• Total Processed Requests : ${summary.totalVolume}`);
  console.log(`• Successfully Delivered   : ${summary.delivered}`);
  console.log(`• Failed / Breached (DLQ)  : ${summary.failed}`);
  console.log(`• Security Rejections      : ${summary.rejected}`);
  console.log(`• Success Rate             : ${summary.overallSuccessRatePct}%`);
  console.log(`• SLA Adherence            : ${summary.overallSlaAdherencePct}%`);
  console.log(`• Tail Latency Percentiles : p50: ${summary.latency.p50Ms}ms | p95: ${summary.latency.p95Ms}ms | p99: ${summary.latency.p99Ms}ms`);
  console.log(`• Predictive Alerts Fired  : ${atRiskWarnings}`);
  console.log(`• Dead-Letter Queue Items  : ${dispatcher.dlq.getAll().length}`);

  console.log('\n🏢 Partner Performance Matrix:');
  console.table(
    Object.entries(summary.partnerBreakdown).map(([key, data]) => ({
      Partner: key,
      Dispatched: data.total,
      Delivered: data.delivered,
      Failed: data.failed,
      'Breach #': data.slaBreaches,
      'Success %': `${data.successRatePct}%`,
      'p50 (ms)': data.percentiles.p50Ms,
      'p95 (ms)': data.percentiles.p95Ms,
      'p99 (ms)': data.percentiles.p99Ms
    }))
  );

  // 3. Demonstrate Dead-Letter Queue (DLQ) Replay
  const dlqItems = dispatcher.dlq.getPending();
  if (dlqItems.length > 0) {
    console.log(`\n🔄 Triggering DLQ Replay Demonstration on ${dlqItems.length} failed dispatch(es)...`);
    for (const item of dlqItems.slice(0, 3)) {
      dispatcher.dlq.markReplayed(item.request.requestId, 'Replayed with modified route: Fallback Gateway ACK');
    }
    console.log(`  ✔ Replayed ${Math.min(3, dlqItems.length)} DLQ requests with full audit trail.`);
  }

  // 4. Generate Enterprise Excel Operational Report
  console.log('--------------------------------------------------------------------------------');
  console.log('📑 Generating Multi-Sheet Microsoft Excel Operational Dashboard...');

  const reportsDir = path.resolve(__dirname, '../data/reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const reportPath = path.join(reportsDir, `Enterprise_Report_${profile.profileName}_${timestamp}.xlsx`);

  const reporter = new EnterpriseExcelReporter();
  await reporter.generateReport(
    {
      logs,
      summary,
      verificationResult: verification,
      dlqEntries: dispatcher.dlq.getAll(),
      simulationProfileName: profile.profileName
    },
    reportPath
  );

  console.log(`✅ Workbook generated successfully!`);
  console.log(`📍 Output Path: ${reportPath}`);
  console.log('================================================================================\n');
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
