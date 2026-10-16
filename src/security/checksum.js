const crypto = require('crypto');

/**
 * Validates document payload integrity (SHA-256) and security clearance.
 */
class SecurityValidator {
  /**
   * Computes a SHA-256 hash for document payload verification.
   * @param {string|object} payload
   * @returns {string} Hex hash
   */
  static computeChecksum(payload) {
    const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  /**
   * Validates if document integrity matches expected hash.
   * @param {string|object} payload
   * @param {string} expectedHash
   * @returns {boolean}
   */
  static verifyIntegrity(payload, expectedHash) {
    if (!expectedHash) return false;
    const computed = this.computeChecksum(payload);
    return computed.toLowerCase() === expectedHash.toLowerCase();
  }

  /**
   * Ensures recipient clearance matches or exceeds document classification.
   * @param {string} recipientClearance
   * @param {string} documentClassification
   * @returns {boolean}
   */
  static validateClearance(recipientClearance, documentClassification) {
    const levels = {
      PUBLIC: 1,
      INTERNAL: 2,
      CONFIDENTIAL: 3,
      RESTRICTED: 4
    };

    const docLevel = levels[documentClassification] || 2;
    const recipientLevel = levels[recipientClearance] || 1;

    return recipientLevel >= docLevel;
  }
}

module.exports = SecurityValidator;
