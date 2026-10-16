/**
 * Operational Metrics & KPI Calculator:
 * Aggregates delivery success rates, SLA adherence %, partner breakdowns,
 * and duration statistics.
 */
class KpiCalculator {
  static computeSummary(logs) {
    const total = logs.length;
    if (total === 0) {
      return {
        totalVolume: 0,
        delivered: 0,
        failed: 0,
        successRatePct: 0,
        slaAdherencePct: 0,
        avgDeliveryDurationSec: 0,
        partnerBreakdown: {}
      };
    }

    const delivered = logs.filter((l) => l.state === 'DELIVERED').length;
    const failed = logs.filter((l) => l.state === 'FAILED_BREACH' || l.state === 'REJECTED').length;
    const slaMetCount = logs.filter((l) => l.slaMet).length;

    const successRate = ((delivered / total) * 100).toFixed(1);
    const slaAdherence = ((slaMetCount / total) * 100).toFixed(1);

    const avgDuration = (
      logs.reduce((sum, l) => sum + (l.durationSec || 0), 0) / total
    ).toFixed(3);

    const partnerStats = {};
    for (const log of logs) {
      if (!partnerStats[log.partner]) {
        partnerStats[log.partner] = {
          total: 0,
          delivered: 0,
          failed: 0,
          slaBreaches: 0,
          totalDuration: 0
        };
      }
      const p = partnerStats[log.partner];
      p.total++;
      if (log.state === 'DELIVERED') p.delivered++;
      if (log.state === 'FAILED_BREACH' || log.state === 'REJECTED') p.failed++;
      if (!log.slaMet) p.slaBreaches++;
      p.totalDuration += log.durationSec || 0;
    }

    return {
      totalVolume: total,
      delivered,
      failed,
      successRatePct: parseFloat(successRate),
      slaAdherencePct: parseFloat(slaAdherence),
      avgDeliveryDurationSec: parseFloat(avgDuration),
      partnerBreakdown: partnerStats
    };
  }
}

module.exports = KpiCalculator;
