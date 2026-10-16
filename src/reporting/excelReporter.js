const ExcelJS = require('exceljs');

/**
 * Excel Operational Reporting Engine:
 * Generates structured, multi-sheet Microsoft Excel (.xlsx) workbooks containing:
 * 1. Executive Dashboard (KPI metrics, SLA gauge figures, dynamic formulas)
 * 2. Partner Performance Matrix (Volume, failure rates, SLA breaches)
 * 3. Audit Event Log (Full transaction table with conditional status highlights)
 */
class ExcelOperationalReporter {
  constructor(auditLogs, summaryKpis) {
    this.logs = auditLogs;
    this.kpis = summaryKpis;
    this.workbook = new ExcelJS.Workbook();
    this.workbook.creator = 'Operational Document Distribution System';
    this.workbook.created = new Date();
  }

  async generate(outputPath) {
    this._buildSummarySheet();
    this._buildPartnerSheet();
    this._buildAuditDataSheet();

    await this.workbook.xlsx.writeFile(outputPath);
    return outputPath;
  }

  _buildSummarySheet() {
    const ws = this.workbook.addWorksheet('Executive Dashboard', {
      views: [{ showGridLines: true }]
    });

    // Title Banner
    ws.mergeCells('B2:G2');
    const titleCell = ws.getCell('B2');
    titleCell.value = 'OPERATIONAL REPORTING & DOCUMENT DISTRIBUTION DASHBOARD';
    titleCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' } // Dark Slate
    };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(2).height = 36;

    // Subtitle
    ws.mergeCells('B3:G3');
    const subCell = ws.getCell('B3');
    subCell.value = `Report Generated: ${new Date().toLocaleString()} | Operations Scope: Simulated Multi-Partner Distribution`;
    subCell.font = { name: 'Segoe UI', size: 9, italic: true, color: { argb: 'FF64748B' } };
    subCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // KPI Cards Block (Row 5 & 6)
    const cards = [
      { col: 'B', label: 'TOTAL REQUESTS', val: this.kpis.totalVolume, color: 'FF2563EB' },
      { col: 'C', label: 'DELIVERED', val: this.kpis.delivered, color: 'FF16A34A' },
      { col: 'D', label: 'FAILED / REJECTED', val: this.kpis.failed, color: 'FFDC2626' },
      { col: 'E', label: 'SUCCESS RATE', val: `${this.kpis.successRatePct}%`, color: 'FF0D9488' },
      { col: 'F', label: 'SLA ADHERENCE', val: `${this.kpis.slaAdherencePct}%`, color: 'FF7C3AED' },
      { col: 'G', label: 'AVG DURATION', val: `${this.kpis.avgDeliveryDurationSec}s`, color: 'FFEA580C' }
    ];

    cards.forEach((c) => {
      const topCell = ws.getCell(`${c.col}5`);
      topCell.value = c.label;
      topCell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF475569' } };
      topCell.alignment = { horizontal: 'center', vertical: 'middle' };
      topCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

      const valCell = ws.getCell(`${c.col}6`);
      valCell.value = c.val;
      valCell.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: c.color } };
      valCell.alignment = { horizontal: 'center', vertical: 'middle' };
      valCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };

      // Borders
      const borderStyle = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };
      topCell.border = borderStyle;
      valCell.border = borderStyle;

      ws.getColumn(c.col).width = 22;
    });

    ws.getRow(5).height = 22;
    ws.getRow(6).height = 32;

    // Formula Verification Summary
    ws.getCell('B9').value = 'Automated Verification Checks:';
    ws.getCell('B9').font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FF1E293B' } };

    ws.getCell('B10').value = 'Total Processed (Excel Formula):';
    ws.getCell('C10').value = { formula: "COUNTA('Audit Log'!A2:A1000)" };

    ws.getCell('B11').value = 'SLA Met Count (Excel Formula):';
    ws.getCell('C11').value = { formula: "COUNTIF('Audit Log'!G2:G1000, true)" };

    ws.getCell('B12').value = 'Delivery Failures (Excel Formula):';
    ws.getCell('C12').value = { formula: "COUNTIF('Audit Log'!H2:H1000, \"FAILED_BREACH\") + COUNTIF('Audit Log'!H2:H1000, \"REJECTED\")" };

    ['B10', 'B11', 'B12'].forEach((c) => {
      ws.getCell(c).font = { bold: false, color: { argb: 'FF475569' } };
    });
    ['C10', 'C11', 'C12'].forEach((c) => {
      ws.getCell(c).font = { bold: true, color: { argb: 'FF0F172A' } };
    });
  }

  _buildPartnerSheet() {
    const ws = this.workbook.addWorksheet('Partner Performance');
    ws.columns = [
      { header: 'Partner Key', key: 'partner', width: 30 },
      { header: 'Dispatched Volume', key: 'total', width: 20 },
      { header: 'Delivered', key: 'delivered', width: 16 },
      { header: 'Failed / Drops', key: 'failed', width: 18 },
      { header: 'SLA Breaches', key: 'slaBreaches', width: 18 },
      { header: 'Success Rate (%)', key: 'successRate', width: 20 }
    ];

    ws.getRow(1).height = 24;
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };

    const breakdown = this.kpis.partnerBreakdown;
    for (const [key, stat] of Object.entries(breakdown)) {
      const rate = stat.total > 0 ? ((stat.delivered / stat.total) * 100).toFixed(1) : 0;
      const row = ws.addRow({
        partner: key,
        total: stat.total,
        delivered: stat.delivered,
        failed: stat.failed,
        slaBreaches: stat.slaBreaches,
        successRate: `${rate}%`
      });

      row.alignment = { vertical: 'middle' };
    }
  }

  _buildAuditDataSheet() {
    const ws = this.workbook.addWorksheet('Audit Log');
    ws.columns = [
      { header: 'Request ID', key: 'requestId', width: 22 },
      { header: 'Document ID', key: 'documentId', width: 18 },
      { header: 'Document Type', key: 'documentType', width: 24 },
      { header: 'Priority', key: 'priority', width: 12 },
      { header: 'Target Partner', key: 'partner', width: 28 },
      { header: 'Duration (s)', key: 'durationSec', width: 14 },
      { header: 'SLA Met?', key: 'slaMet', width: 14 },
      { header: 'Final State', key: 'state', width: 16 },
      { header: 'Retries', key: 'retryCount', width: 10 },
      { header: 'Timestamp', key: 'timestamp', width: 26 }
    ];

    ws.getRow(1).height = 24;
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };

    this.logs.forEach((log) => {
      const row = ws.addRow(log);

      if (!log.slaMet || log.state === 'FAILED_BREACH' || log.state === 'REJECTED') {
        row.getCell(7).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFECACA' } // Soft Red
        };
        row.getCell(8).font = { bold: true, color: { argb: 'FFDC2626' } };
      } else {
        row.getCell(7).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFDCFCE7' } // Soft Green
        };
      }
    });
  }
}

module.exports = ExcelOperationalReporter;
