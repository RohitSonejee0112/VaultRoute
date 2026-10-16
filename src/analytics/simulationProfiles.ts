export interface SimulationProfileConfig {
  profileName: string;
  description: string;
  totalRequests: number;
  partnerFaultMultipliers: Record<string, { latencyMultiplier: number; failureRate: number }>;
  simulateSecurityRejections: boolean;
  slaRiskThresholdPct: number; // e.g. 75%
}

export const SIMULATION_PROFILES: Record<string, SimulationProfileConfig> = {
  'nominal-load': {
    profileName: 'nominal-load',
    description: 'Normal operations with healthy partners, low latency, and >98% SLA compliance.',
    totalRequests: 60,
    partnerFaultMultipliers: {
      WEALTH_MGMT_CORE: { latencyMultiplier: 1.0, failureRate: 0.01 },
      LEGAL_COMPLIANCE: { latencyMultiplier: 1.0, failureRate: 0.02 },
      CLIENT_PORTAL_GATEWAY: { latencyMultiplier: 1.0, failureRate: 0.01 },
      UNDERWRITING_PARTNER: { latencyMultiplier: 1.0, failureRate: 0.03 }
    },
    simulateSecurityRejections: true,
    slaRiskThresholdPct: 75
  },
  'partner-degradation': {
    profileName: 'partner-degradation',
    description: 'Partner network jitter and elevated Underwriting latency causing p99 spikes.',
    totalRequests: 80,
    partnerFaultMultipliers: {
      WEALTH_MGMT_CORE: { latencyMultiplier: 1.2, failureRate: 0.03 },
      LEGAL_COMPLIANCE: { latencyMultiplier: 1.5, failureRate: 0.05 },
      CLIENT_PORTAL_GATEWAY: { latencyMultiplier: 1.1, failureRate: 0.02 },
      UNDERWRITING_PARTNER: { latencyMultiplier: 3.5, failureRate: 0.25 }
    },
    simulateSecurityRejections: true,
    slaRiskThresholdPct: 75
  },
  'black-swan-outage': {
    profileName: 'black-swan-outage',
    description: 'Severe Underwriting partner outage tripping Circuit Breaker to OPEN and engaging DLQ.',
    totalRequests: 100,
    partnerFaultMultipliers: {
      WEALTH_MGMT_CORE: { latencyMultiplier: 1.1, failureRate: 0.02 },
      LEGAL_COMPLIANCE: { latencyMultiplier: 1.3, failureRate: 0.05 },
      CLIENT_PORTAL_GATEWAY: { latencyMultiplier: 1.0, failureRate: 0.02 },
      UNDERWRITING_PARTNER: { latencyMultiplier: 5.0, failureRate: 0.85 }
    },
    simulateSecurityRejections: true,
    slaRiskThresholdPct: 75
  }
};
