export interface PartnerDefinition {
  key: string;
  name: string;
  sharedHmacSecret: string;
  minLatencyMs: number;
  maxLatencyMs: number;
  failureRate: number;
  circuitBreakerThresholdPct: number;
}

export const PARTNER_REGISTRY: Record<string, PartnerDefinition> = {
  WEALTH_MGMT_CORE: {
    key: 'WEALTH_MGMT_CORE',
    name: 'Wealth Management Core Engine',
    sharedHmacSecret: 'secret_wm_core_k98234j234klj234',
    minLatencyMs: 25,
    maxLatencyMs: 90,
    failureRate: 0.02,
    circuitBreakerThresholdPct: 50
  },
  LEGAL_COMPLIANCE: {
    key: 'LEGAL_COMPLIANCE',
    name: 'Legal & Regulatory Archive Node',
    sharedHmacSecret: 'secret_compliance_m90234i09234km2',
    minLatencyMs: 40,
    maxLatencyMs: 140,
    failureRate: 0.04,
    circuitBreakerThresholdPct: 50
  },
  CLIENT_PORTAL_GATEWAY: {
    key: 'CLIENT_PORTAL_GATEWAY',
    name: 'Secure Web Client Portal Gateway',
    sharedHmacSecret: 'secret_client_portal_a897234mn234',
    minLatencyMs: 20,
    maxLatencyMs: 70,
    failureRate: 0.01,
    circuitBreakerThresholdPct: 50
  },
  UNDERWRITING_PARTNER: {
    key: 'UNDERWRITING_PARTNER',
    name: 'Underwriting Services Exchange',
    sharedHmacSecret: 'secret_underwriting_p876234bmn23',
    minLatencyMs: 60,
    maxLatencyMs: 200,
    failureRate: 0.08,
    circuitBreakerThresholdPct: 50
  }
};
