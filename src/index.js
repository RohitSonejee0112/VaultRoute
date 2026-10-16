const path = require('path');
const fs = require('fs');
const DocumentDispatcher = require('./engine/dispatcher');
const PartnerSimulator = require('./partners/partnerSimulator');
const KpiCalculator = require('./analytics/kpiCalculator');
const ExcelOperationalReporter = require('./reporting/excelReporter');

// Load configurations
const partnerConfig = require('../config/partners.json');
const defaultConfig = require('../config/default.json');

async function main() {
  console.log('================================================================');
  console.log('🚀 OPERATIONAL REPORTING & DOCUMENT DISTRIBUTION SYSTEM (ORDDS)');
  console.log('================================================================');

  const partnerSimulator = new PartnerSimulator(partnerConfig);
  const dispatcher = new DocumentDispatcher(partnerSimulator, {
    maxRetries: defaultConfig.operations.maxRetries,
    retryBackoffBaseMs: defaultConfig.operations.retryBackoffBaseMs,
    slaByPriority: defaultConfig.operations.slaThresholdsSec
  });

  const partnerKeys = Object.keys(partnerConfig);
  const priorities = ['P1', 'P2', 'P3'];
  const docTypes = [
    'PORTFOLIO_STATEMENT',
    'REGULATORY_DISCLOSURE',
    'POLICY_PACK_UNDERWRITING',
    'TAX_FORM_1099',
    'ACCOUNT_AUDIT_REPORT'
  ];

  const totalSimulated = 60;
  console.log(`\n📦 Ingesting and simulating ${totalSimulated} secure document delivery requests...`);

  let count = 0;
  for (let i = 1; i <= totalSimulated; i++) {
    const partner = partnerKeys[Math.floor(Math.random() * partnerKeys.length)];
    const priority = priorities[Math.floor(Math.random() * priorities.length)];
    const docType = docTypes[Math.floor(Math.random() * docTypes.length)];

    // Simulate occasional security clearance edge-case for audit realism
    const docClassification = i % 15 === 0 ? 'RESTRICTED' : 'CONFIDENTIAL';
    const recipientClearance = i === 15 ? 'INTERNAL' : 'CONFIDENTIAL';

    await dispatcher.processRequest({
      requestId: `REQ-2024-${1000 + i}`,
      documentId: `DOC-${2000 + i}`,
      documentType: docType,
      classification: docClassification,
      priority,
      targetPartner: partner,
      recipient: {
        entityId: `ENTITY-US-${4000 + i}`,
        requiredClearance: recipientClearance
      }
    });

    count++;
    if (count % 15 === 0 || count === totalSimulated) {
      process.stdout.write(`  -> Processed ${count}/${totalSimulated} documents...\n`);
    }
  }

  const logs = dispatcher.getAuditLogs();
  const kpis = KpiCalculator.computeSummary(logs);

  console.log('\n----------------------------------------------------------------');
  console.log('📊 OPERATIONAL SERVICE METRICS & SLA SUMMARY');
  console.log('----------------------------------------------------------------');
  console.log(`• Total Processed Requests : ${kpis.totalVolume}`);
  console.log(`• Successfully Delivered   : ${kpis.delivered}`);
  console.log(`• Failed / Breached / Rej  : ${kpis.failed}`);
  console.log(`• Delivery Success Rate    : ${kpis.successRatePct}%`);
  console.log(`• SLA Adherence Rate       : ${kpis.slaAdherencePct}%`);
  console.log(`• Avg Delivery Duration    : ${kpis.avgDeliveryDurationSec} seconds`);

  console.log('\n🏢 Partner Team Breakdown:');
  console.table(
    Object.entries(kpis.partnerBreakdown).map(([partner, data]) => ({
      Partner: partner,
      Total: data.total,
      Delivered: data.delivered,
      Failed: data.failed,
      'SLA Breaches': data.slaBreaches,
      'Success %': data.total > 0 ? `${((data.delivered / data.total) * 100).toFixed(1)}%` : '0%'
    }))
  );

  // Generate Excel Operational Workbook
  const reportsDir = path.resolve(__dirname, '../data/reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const reportFile = path.join(reportsDir, `Operational_Report_${timestamp}.xlsx`);

  console.log('----------------------------------------------------------------');
  console.log('📑 Generating Microsoft Excel Operational Reporting Dashboard...');
  const reporter = new ExcelOperationalReporter(logs, kpis);
  await reporter.generate(reportFile);

  console.log(`✅ Workbook generated successfully!`);
  console.log(`📍 File path: ${reportFile}`);
  console.log('================================================================\n');
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
