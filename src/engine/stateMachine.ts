import { DocumentState } from '../types/schemas';

export class InvalidStateTransitionError extends Error {
  constructor(public readonly fromState: DocumentState, public readonly toState: DocumentState, requestId: string) {
    super(`Invalid FSM transition attempted for Request [${requestId}]: cannot transition from '${fromState}' to '${toState}'.`);
    this.name = 'InvalidStateTransitionError';
  }
}

/**
 * Strict Finite State Machine for Document Delivery Lifecycle.
 * Prevents illegal state jumps (e.g. REQUESTED -> DELIVERED) and race conditions.
 */
export class DocumentStateMachine {
  private static readonly ALLOWED_TRANSITIONS: Record<DocumentState, readonly DocumentState[]> = {
    REQUESTED: ['VALIDATING', 'REJECTED'],
    VALIDATING: ['IN_TRANSIT', 'REJECTED'],
    IN_TRANSIT: ['DELIVERED', 'RETRY_PENDING', 'FAILED_BREACH'],
    RETRY_PENDING: ['IN_TRANSIT', 'FAILED_BREACH'],
    DELIVERED: [],     // Terminal
    REJECTED: [],      // Terminal
    FAILED_BREACH: []  // Terminal
  };

  private currentState: DocumentState;

  constructor(public readonly requestId: string, initialState: DocumentState = 'REQUESTED') {
    this.currentState = initialState;
  }

  public getState(): DocumentState {
    return this.currentState;
  }

  public isTerminal(): boolean {
    return DocumentStateMachine.ALLOWED_TRANSITIONS[this.currentState].length === 0;
  }

  public transitionTo(nextState: DocumentState): void {
    const allowed = DocumentStateMachine.ALLOWED_TRANSITIONS[this.currentState];
    if (!allowed.includes(nextState)) {
      throw new InvalidStateTransitionError(this.currentState, nextState, this.requestId);
    }
    this.currentState = nextState;
  }
}
