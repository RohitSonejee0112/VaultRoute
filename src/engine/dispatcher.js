const EventEmitter = require('events');
const SecurityValidator = require('../security/checksum');

/**
 * Core Document Dispatcher:
 * Manages document queue transitions, security enforcement, partner routing,
 * retry backoff logic, and immutable audit event collection.
 */
class DocumentDispatcher extends EventEmitter {
  constructor(partnerSimulator, config = {}) {
    super();
    this.partnerSimulator = partnerSimulator;
    this.config = Object.assign(
      {
        maxRetries: 3,
        retryBackoffBaseMs: 100,
        slaByPriority: { P1: 1.5, P2: 3.0, P3: 6.0 }
      },
      config
    );
    this.auditLogs = [];
  }

  /**
   * Processes a single document delivery request through its lifecycle.
   * @param {object} request
   * @returns {Promise<object>} Final audit log event
   */
  async processRequest(request) {
    const startTime = Date.now();
    this.emit('status', { requestId: request.requestId, state: 'INGESTED' });

    // Step 1: Security clearance verification
    const isCleared = SecurityValidator.validateClearance(
      request.recipient?.requiredClearance || 'PUBLIC',
      request.classification || 'INTERNAL'
    );

    if (!isCleared) {
      return this._recordEvent(request, 'REJECTED', startTime, {
        slaMet: false,
        error: 'CLEARANCE_LEVEL_INSUFFICIENT'
      });
    }

    // Step 2: Attempt partner delivery with exponential backoff retries
    let attempts = 0;
    const maxRetries = this.config.maxRetries || 3;
    let delivered = false;
    let lastError = null;
    let totalPartnerLatency = 0;

    while (attempts < maxRetries && !delivered) {
      attempts++;
      this.emit('status', {
        requestId: request.requestId,
        state: 'IN_TRANSIT',
        attempt: attempts
      });

      const response = await this.partnerSimulator.dispatch(
        request.targetPartner,
        request
      );
      totalPartnerLatency += response.latencyMs;

      if (response.success) {
        delivered = true;
      } else {
        lastError = response.errorDetails;
        // Exponential backoff delay
        if (attempts < maxRetries) {
          const backoff = (this.config.retryBackoffBaseMs || 100) * Math.pow(2, attempts - 1);
          await new Promise((r) => setTimeout(r, backoff));
        }
      }
    }

    const durationSec = Number(((Date.now() - startTime) / 1000).toFixed(3));
    const slaTargetSec = this.config.slaByPriority[request.priority] || 3.0;
    const slaMet = delivered && durationSec <= slaTargetSec;

    const finalState = delivered ? 'DELIVERED' : 'FAILED_BREACH';

    return this._recordEvent(request, finalState, startTime, {
      durationSec,
      slaTargetSec,
      slaMet,
      attempts,
      error: lastError,
      totalPartnerLatency
    });
  }

  _recordEvent(request, state, startTime, meta) {
    const event = {
      requestId: request.requestId,
      documentId: request.documentId,
      documentType: request.documentType,
      priority: request.priority,
      partner: request.targetPartner,
      state,
      durationSec: meta.durationSec || 0,
      slaTargetSec: meta.slaTargetSec || 0,
      slaMet: meta.slaMet || false,
      retryCount: Math.max(0, (meta.attempts || 1) - 1),
      errorReason: meta.error || null,
      timestamp: new Date().toISOString()
    };

    this.auditLogs.push(event);
    this.emit('completed', event);
    return event;
  }

  getAuditLogs() {
    return this.auditLogs;
  }
}

module.exports = DocumentDispatcher;
