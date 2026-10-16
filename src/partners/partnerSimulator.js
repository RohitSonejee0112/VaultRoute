/**
 * Partner Routing Simulator:
 * Emulates asynchronous partner routing, network jitter, intermittent outages,
 * and delivery acknowledgment generation across enterprise partner interfaces.
 */
class PartnerSimulator {
  constructor(partnerConfig) {
    this.partners = partnerConfig;
  }

  /**
   * Dispatches payload to the targeted partner system with simulated network behavior.
   * @param {string} partnerKey
   * @param {object} payload
   * @returns {Promise<{success: boolean, latencyMs: number, ackId?: string, errorDetails?: string}>}
   */
  async dispatch(partnerKey, payload) {
    const partner = this.partners[partnerKey];
    if (!partner) {
      return {
        success: false,
        latencyMs: 10,
        errorDetails: `Unregistered partner interface: ${partnerKey}`
      };
    }

    // Simulate network latency within defined partner boundaries
    const latency = Math.floor(
      Math.random() * (partner.maxLatencyMs - partner.minLatencyMs) + partner.minLatencyMs
    );
    await new Promise((resolve) => setTimeout(resolve, latency));

    // Simulate failure rate probability
    const isFailure = Math.random() < partner.failureRate;
    if (isFailure) {
      return {
        success: false,
        latencyMs: latency,
        errorCode: 'PARTNER_TIMEOUT_OR_DROPPED',
        errorDetails: `Simulated timeout from partner endpoint: ${partner.name}`
      };
    }

    return {
      success: true,
      latencyMs: latency,
      ackId: `ACK-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
      partnerName: partner.name
    };
  }
}

module.exports = PartnerSimulator;
