import { AuditEvent } from '../types/events';

export interface LatencyPercentiles {
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  meanMs: number;
  minMs: number;
  maxMs: number;
}

export interface PartnerAnalyticsSummary {
  total: number;
  delivered: number;
  failed: number;
  slaBreaches: number;
  successRatePct: number;
  slaAdherencePct: number;
  percentiles: LatencyPercentiles;
}

export interface OperationalMetricsSummary {
  totalVolume: number;
  delivered: number;
  failed: number;
  rejected: number;
  overallSuccessRatePct: number;
  overallSlaAdherencePct: number;
  latency: LatencyPercentiles;
  partnerBreakdown: Record<string, PartnerAnalyticsSummary>;
}

export class PercentileMetricsCalculator {
  public static calculatePercentiles(values: number[]): LatencyPercentiles {
    if (values.length === 0) {
      return { p50Ms: 0, p95Ms: 0, p99Ms: 0, meanMs: 0, minMs: 0, maxMs: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const getPercentile = (p: number) => {
      const idx = Math.ceil((p / 100) * sorted.length) - 1;
      return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
    };

    const sum = sorted.reduce((acc, v) => acc + v, 0);
    const mean = Number((sum / sorted.length).toFixed(1));

    return {
      p50Ms: getPercentile(50),
      p95Ms: getPercentile(95),
      p99Ms: getPercentile(99),
      meanMs: mean,
      minMs: sorted[0],
      maxMs: sorted[sorted.length - 1]
    };
  }

  public static generateSummary(logs: AuditEvent[]): OperationalMetricsSummary {
    const total = logs.length;
    if (total === 0) {
      return {
        totalVolume: 0,
        delivered: 0,
        failed: 0,
        rejected: 0,
        overallSuccessRatePct: 0,
        overallSlaAdherencePct: 0,
        latency: this.calculatePercentiles([]),
        partnerBreakdown: {}
      };
    }

    const delivered = logs.filter((l) => l.state === 'DELIVERED').length;
    const rejected = logs.filter((l) => l.state === 'REJECTED').length;
    const failed = logs.filter((l) => l.state === 'FAILED_BREACH').length;
    const slaMet = logs.filter((l) => l.slaMet).length;

    const allDurations = logs.map((l) => l.durationMs);
    const overallPercentiles = this.calculatePercentiles(allDurations);

    // Grouping by partner
    const partnerGroups: Record<string, AuditEvent[]> = {};
    for (const log of logs) {
      if (!partnerGroups[log.partner]) {
        partnerGroups[log.partner] = [];
      }
      partnerGroups[log.partner].push(log);
    }

    const partnerBreakdown: Record<string, PartnerAnalyticsSummary> = {};
    for (const [partner, pLogs] of Object.entries(partnerGroups)) {
      const pDelivered = pLogs.filter((l) => l.state === 'DELIVERED').length;
      const pFailed = pLogs.filter((l) => l.state === 'FAILED_BREACH' || l.state === 'REJECTED').length;
      const pSlaMet = pLogs.filter((l) => l.slaMet).length;
      const pDurations = pLogs.map((l) => l.durationMs);

      partnerBreakdown[partner] = {
        total: pLogs.length,
        delivered: pDelivered,
        failed: pFailed,
        slaBreaches: pLogs.length - pSlaMet,
        successRatePct: Number(((pDelivered / pLogs.length) * 100).toFixed(1)),
        slaAdherencePct: Number(((pSlaMet / pLogs.length) * 100).toFixed(1)),
        percentiles: this.calculatePercentiles(pDurations)
      };
    }

    return {
      totalVolume: total,
      delivered,
      failed,
      rejected,
      overallSuccessRatePct: Number(((delivered / total) * 100).toFixed(1)),
      overallSlaAdherencePct: Number(((slaMet / total) * 100).toFixed(1)),
      latency: overallPercentiles,
      partnerBreakdown
    };
  }
}
