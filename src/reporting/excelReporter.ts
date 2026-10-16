import ExcelJS from 'exceljs';
import { AuditEvent, DlqEntry } from '../types/events';
import { OperationalMetricsSummary } from '../analytics/percentileMetrics';
import { ChainVerificationResult } from '../security/auditChain';

export interface ReportGenerationInput {
  logs: AuditEvent[];
  summary: OperationalMetricsSummary;
  verificationResult: ChainVerificationResult;
  dlqEntries: DlqEntry[];
  simulationProfileName: string;
}

/**
 * Enterprise Excel Operational Reporter.
 * Generates styled, multi-tab .xlsx workbooks with percentile metrics (p50/p95/p99),
 * tamper-evident cryptographic validation status, DLQ incident logs, and automated formulas.
 */
export class EnterpriseExcelReporter {
  private workbook: ExcelJS.Workbook;

  constructor() {
    this.workbook = new ExcelJS.Workbook();
    this.workbook.creator = 'Enterprise Operational Reporting & Document Distribution Engine';
    this.workbook.created = new Date();
  }

  public async generateReport(input: ReportGenerationInput, outputPath: string): Promise<string> {
    this.buildExecutiveDashboard(input);
    this.buildPartnerScorecard(input);
    this.buildDlqExceptionsSheet(input.dlqEntries);
    this.buildAuditLedgerSheet(input.logs);

    await this.workbook.xlsx.writeFile(outputPath);
    return outputPath;
  }

  private buildExecutiveDashboard(input: ReportGenerationInput): void {
    const ws = this.workbook.addWorksheet('Executive Dashboard', {
      views: [{ showGridLines: true }]
    });

    // 1. Master Header Banner
    ws.mergeCells('B2:H2');
    const titleCell = ws.getCell('B2');
    titleCell.value = 'OPERATIONAL REPORTING & DOCUMENT DISTRIBUTION DASHBOARD';
    titleCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }; // Slate 900
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(2).height = 36;

    // Subtitle & Metadata
    ws.mergeCells('B3:H3');
    const subCell = ws.getCell('B3');
    subCell.value = `Profile: [${input.simulationProfileName.toUpperCase()}] | Generated: ${new Date().toLocaleString()} | Tamper Verification: ${
      input.verificationResult.isValid ? 'PASSED (Cryptographically Bound)' : 'FAILED'
    }`;
    subCell.font = { name: 'Segoe UI', size: 9, italic: true, color: { argb: 'FF64748B' } };
    subCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(3).height = 20;

    // Cryptographic Chain Banner
    ws.mergeCells('B4:H4');
    const chainCell = ws.getCell('B4');
    chainCell.value = input.verificationResult.isValid
      ? `🔒 Tamper-Evident Audit Chain: 100% Verified across ${input.verificationResult.totalEntries} entries. Hash chaining intact.`
      : `⚠️ TAMPER WARNING: Hash mismatch at entry ${input.verificationResult.tamperedIndex}. Reason: ${input.verificationResult.reason}`;
    chainCell.font = {
      name: 'Segoe UI',
      size: 9,
      bold: true,
      color: { argb: input.verificationResult.isValid ? 'FF166534' : 'FF991B1B' }
    };
    chainCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: input.verificationResult.isValid ? 'FFDCFCE7' : 'FFFEE2E2' }
    };
    chainCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(4).height = 22;

    // 2. High-Level KPI Cards (Row 6 & 7)
    const cards = [
      { col: 'B', label: 'TOTAL VOLUME', val: input.summary.totalVolume, color: 'FF1D4ED8' },
      { col: 'C', label: 'DELIVERED', val: input.summary.delivered, color: 'FF15803D' },
      { col: 'D', label: 'FAILED / DLQ', val: input.summary.failed, color: 'FFB91C1C' },
      { col: 'E', label: 'REJECTED (ABAC)', val: input.summary.rejected, color: 'FFD97706' },
      { col: 'F', label: 'SUCCESS RATE', val: `${input.summary.overallSuccessRatePct}%`, color: 'FF0F766E' },
      { col: 'G', label: 'SLA ADHERENCE', val: `${input.summary.overallSlaAdherencePct}%`, color: 'FF6D28D9' },
      { col: 'H', label: 'P95 LATENCY', val: `${input.summary.latency.p95Ms} ms`, color: 'FFC2410C' }
    ];

    cards.forEach((c) => {
      const topCell = ws.getCell(`${c.col}6`);
      topCell.value = c.label;
      topCell.font = { name: 'Segoe UI', size: 8, bold: true, color: { argb: 'FF475569' } };
      topCell.alignment = { horizontal: 'center', vertical: 'middle' };
      topCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };

      const valCell = ws.getCell(`${c.col}7`);
      valCell.value = c.val;
      valCell.font = { name: 'Segoe UI', size: 15, bold: true, color: { argb: c.color } };
      valCell.alignment = { horizontal: 'center', vertical: 'middle' };
      valCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };

      const borderStyle = {
        top: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } }
      };
      topCell.border = borderStyle;
      valCell.border = borderStyle;

      ws.getColumn(c.col).width = 20;
    });

    ws.getRow(6).height = 20;
    ws.getRow(7).height = 32;

    // 3. Tail-Latency Distribution Table (Rows 10-15)
    ws.getCell('B10').value = 'Tail Latency Distribution (Milliseconds):';
    ws.getCell('B10').font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FF0F172A' } };

    const latencyMetrics = [
      ['p50 (Median)', `${input.summary.latency.p50Ms} ms`],
      ['p95 Latency', `${input.summary.latency.p95Ms} ms`],
      ['p99 Latency (Tail Spikes)', `${input.summary.latency.p99Ms} ms`],
      ['Mean Average Latency', `${input.summary.latency.meanMs} ms`],
      ['Min / Max Bounds', `${input.summary.latency.minMs} ms / ${input.summary.latency.maxMs} ms`]
    ];

    latencyMetrics.forEach(([metric, val], idx) => {
      const rowNum = 11 + idx;
      ws.getCell(`B${rowNum}`).value = metric;
      ws.getCell(`B${rowNum}`).font = { name: 'Segoe UI', size: 9, color: { argb: 'FF334155' } };
      ws.getCell(`C${rowNum}`).value = val;
      ws.getCell(`C${rowNum}`).font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF0F172A' } };
    });

    // 4. Automated Excel Reconciliation Formulas (Rows 10-14, Columns E-F)
    ws.getCell('E10').value = 'Automated Spreadsheet Formulas:';
    ws.getCell('E10').font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FF0F172A' } };

    ws.getCell('E11').value = 'Total Processed (Excel Formula):';
    ws.getCell('F11').value = { formula: "COUNTA('Audit Log'!A2:A2000)" };

    ws.getCell('E12').value = 'Total Successful Deliveries:';
    ws.getCell('F12').value = { formula: "COUNTIF('Audit Log'!E2:E2000, \"DELIVERED\")" };

    ws.getCell('E13').value = 'SLA Adherence Count:';
    ws.getCell('F13').value = { formula: "COUNTIF('Audit Log'!G2:G2000, true)" };

    ws.getCell('E14').value = 'DLQ Enqueued Breaches:';
    ws.getCell('F14').value = { formula: "COUNTIF('Audit Log'!E2:E2000, \"FAILED_BREACH\")" };

    ['E11', 'E12', 'E13', 'E14'].forEach((cell) => {
      ws.getCell(cell).font = { name: 'Segoe UI', size: 9, color: { argb: 'FF334155' } };
    });
    ['F11', 'F12', 'F13', 'F14'].forEach((cell) => {
      ws.getCell(cell).font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF1D4ED8' } };
    });
  }

  private buildPartnerScorecard(input: ReportGenerationInput): void {
    const ws = this.workbook.addWorksheet('Partner Performance');
    ws.columns = [
      { header: 'Partner Key', key: 'partner', width: 28 },
      { header: 'Total Dispatched', key: 'total', width: 18 },
      { header: 'Delivered', key: 'delivered', width: 14 },
      { header: 'Failed / Drops', key: 'failed', width: 16 },
      { header: 'SLA Breaches', key: 'slaBreaches', width: 16 },
      { header: 'Success %', key: 'successRate', width: 16 },
      { header: 'SLA Met %', key: 'slaAdherence', width: 16 },
      { header: 'p50 (ms)', key: 'p50', width: 12 },
      { header: 'p95 (ms)', key: 'p95', width: 12 },
      { header: 'p99 (ms)', key: 'p99', width: 12 }
    ];

    ws.getRow(1).height = 26;
    ws.getRow(1).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };

    for (const [key, stat] of Object.entries(input.summary.partnerBreakdown)) {
      const row = ws.addRow({
        partner: key,
        total: stat.total,
        delivered: stat.delivered,
        failed: stat.failed,
        slaBreaches: stat.slaBreaches,
        successRate: `${stat.successRatePct}%`,
        slaAdherence: `${stat.slaAdherencePct}%`,
        p50: stat.percentiles.p50Ms,
        p95: stat.percentiles.p95Ms,
        p99: stat.percentiles.p99Ms
      });
      row.alignment = { vertical: 'middle' };
    }
  }

  private buildDlqExceptionsSheet(dlqEntries: DlqEntry[]): void {
    const ws = this.workbook.addWorksheet('DLQ & Exceptions');
    ws.columns = [
      { header: 'DLQ Entry ID', key: 'dlqId', width: 18 },
      { header: 'Request ID', key: 'requestId', width: 20 },
      { header: 'Target Partner', key: 'partner', width: 26 },
      { header: 'Last State', key: 'state', width: 16 },
      { header: 'Retries Attempted', key: 'retries', width: 16 },
      { header: 'Failure Root Cause', key: 'reason', width: 45 },
      { header: 'Replay Status', key: 'replayed', width: 16 },
      { header: 'Failed At Timestamp', key: 'failedAt', width: 24 }
    ];

    ws.getRow(1).height = 26;
    ws.getRow(1).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF991B1B' } }; // Crimson

    if (dlqEntries.length === 0) {
      const emptyRow = ws.addRow({
        dlqId: 'N/A',
        requestId: 'No Failures',
        partner: 'All partners operational',
        state: 'N/A',
        retries: 0,
        reason: 'Zero Dead-Letter Queue incidents recorded.',
        replayed: 'CLEAN',
        failedAt: new Date().toISOString()
      });
      emptyRow.font = { italic: true, color: { argb: 'FF15803D' } };
      return;
    }

    dlqEntries.forEach((entry) => {
      const row = ws.addRow({
        dlqId: entry.dlqId,
        requestId: entry.request?.requestId || 'N/A',
        partner: entry.request?.targetPartner || 'N/A',
        state: entry.lastState,
        retries: entry.retryAttempts,
        reason: entry.failureReason,
        replayed: entry.replayed ? 'REPLAYED' : 'PENDING_RETRY',
        failedAt: entry.failedAt
      });

      row.getCell(7).font = { bold: true, color: { argb: entry.replayed ? 'FF15803D' : 'FFB91C1C' } };
    });
  }

  private buildAuditLedgerSheet(logs: AuditEvent[]): void {
    const ws = this.workbook.addWorksheet('Audit Log');
    ws.columns = [
      { header: 'Event ID', key: 'eventId', width: 16 },
      { header: 'Request ID', key: 'requestId', width: 20 },
      { header: 'Doc ID', key: 'documentId', width: 16 },
      { header: 'Priority', key: 'priority', width: 10 },
      { header: 'Final State', key: 'state', width: 16 },
      { header: 'Duration (ms)', key: 'durationMs', width: 14 },
      { header: 'SLA Met?', key: 'slaMet', width: 12 },
      { header: 'Partner Key', key: 'partner', width: 26 },
      { header: 'Idempotency Key', key: 'idempotencyKey', width: 24 },
      { header: 'HMAC (Sig)', key: 'sig', width: 18 },
      { header: 'Prev Block Hash', key: 'prevHash', width: 18 },
      { header: 'Entry Hash (H_n)', key: 'entryHash', width: 18 },
      { header: 'Timestamp', key: 'timestamp', width: 24 }
    ];

    ws.getRow(1).height = 26;
    ws.getRow(1).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };

    logs.forEach((log) => {
      const row = ws.addRow({
        eventId: log.eventId,
        requestId: log.requestId,
        docId: log.documentId,
        priority: log.priority,
        state: log.state,
        durationMs: log.durationMs,
        slaMet: log.slaMet,
        partner: log.partner,
        idempotencyKey: log.idempotencyKey,
        sig: log.signatureHmac.substring(0, 14) + '...',
        prevHash: log.previousEntryHash.substring(0, 14) + '...',
        entryHash: log.entryHash.substring(0, 14) + '...',
        timestamp: log.timestamp
      });

      // Conditional formatting: Highlight SLA breaches and failures
      if (!log.slaMet || log.state === 'FAILED_BREACH' || log.state === 'REJECTED') {
        row.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFECACA' } }; // Light red
        row.getCell(5).font = { bold: true, color: { argb: 'FFB91C1C' } };
      } else {
        row.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } }; // Light green
      }
    });
  }
}
