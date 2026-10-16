import { ClearanceLevel, DocumentDeliveryRequest, RecipientContext } from '../types/schemas';

export interface AbacDecision {
  allowed: boolean;
  reasons: string[];
}

/**
 * Attribute-Based Access Control (ABAC) Policy Engine.
 * Evaluates contextual attributes (Clearance, Department, Jurisdiction/Data Sovereignty).
 */
export class AbacPolicyEngine {
  private static readonly CLEARANCE_HIERARCHY: Record<ClearanceLevel, number> = {
    PUBLIC: 1,
    INTERNAL: 2,
    CONFIDENTIAL: 3,
    RESTRICTED: 4
  };

  public static evaluate(request: DocumentDeliveryRequest): AbacDecision {
    const reasons: string[] = [];
    const recipient = request.recipient;

    // Rule 1: Clearance Level Hierarchy Check
    const requiredLevelValue = this.CLEARANCE_HIERARCHY[request.classification];
    const recipientLevelValue = this.CLEARANCE_HIERARCHY[recipient.clearanceLevel];

    if (recipientLevelValue < requiredLevelValue) {
      reasons.push(
        `Insufficient clearance: Recipient [${recipient.clearanceLevel}] cannot access [${request.classification}] document.`
      );
    }

    // Rule 2: Department Isolation Check
    if (request.requiredDepartment && recipient.department !== 'Executive_Office') {
      if (request.requiredDepartment !== recipient.department) {
        reasons.push(
          `Department boundary violation: Required [${request.requiredDepartment}], recipient is in [${recipient.department}].`
        );
      }
    }

    // Rule 3: Geographic / Jurisdiction Data Sovereignty Check
    if (!request.allowedJurisdictions.includes(recipient.jurisdiction) && !request.allowedJurisdictions.includes('GLOBAL')) {
      reasons.push(
        `Jurisdiction export restriction: Document restricted to [${request.allowedJurisdictions.join(', ')}], recipient located in [${recipient.jurisdiction}].`
      );
    }

    return {
      allowed: reasons.length === 0,
      reasons
    };
  }
}
