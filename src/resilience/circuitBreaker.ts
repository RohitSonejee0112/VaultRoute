export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  failureThresholdPercentage: number; // e.g. 50 (50%)
  rollingWindowMs: number;            // e.g. 10000 ms
  cooldownPeriodMs: number;           // e.g. 5000 ms
  minRequestsInWindow: number;        // e.g. 4
}

interface RequestRecord {
  timestamp: number;
  success: boolean;
}

export class CircuitBreakerOpenError extends Error {
  constructor(public readonly partnerKey: string, public readonly retryAfterMs: number) {
    super(`Circuit breaker for partner [${partnerKey}] is OPEN. Requests temporarily halted.`);
    this.name = 'CircuitBreakerOpenError';
  }
}

/**
 * Enterprise Circuit Breaker Pattern implementation for Partner Interfaces.
 * Protects downstream partners from cascading failures and conserves queue resources.
 */
export class CircuitBreaker {
  private state: CircuitBreakerState = 'CLOSED';
  private records: RequestRecord[] = [];
  private lastStateChange: number = Date.now();
  private halfOpenProbeInFlight: boolean = false;

  constructor(
    public readonly partnerKey: string,
    public readonly options: CircuitBreakerOptions = {
      failureThresholdPercentage: 50,
      rollingWindowMs: 10000,
      cooldownPeriodMs: 3000,
      minRequestsInWindow: 4
    }
  ) {}

  public getState(): CircuitBreakerState {
    this.evaluateStateTransitions();
    return this.state;
  }

  public recordSuccess(): void {
    const now = Date.now();
    this.records.push({ timestamp: now, success: true });
    this.pruneRecords(now);

    if (this.state === 'HALF_OPEN') {
      // Successful probe in HALF_OPEN resets breaker to CLOSED
      this.state = 'CLOSED';
      this.lastStateChange = now;
      this.halfOpenProbeInFlight = false;
      return;
    }

    this.checkThreshold();
  }

  public recordFailure(): void {
    const now = Date.now();
    this.records.push({ timestamp: now, success: false });
    this.pruneRecords(now);

    if (this.state === 'HALF_OPEN') {
      // Failed probe in HALF_OPEN immediately trips back to OPEN
      this.state = 'OPEN';
      this.lastStateChange = now;
      this.halfOpenProbeInFlight = false;
      return;
    }

    this.checkThreshold();
  }

  private checkThreshold(): void {
    if (this.state === 'CLOSED') {
      const { failureRate, total } = this.calculateMetrics();
      if (total >= this.options.minRequestsInWindow && failureRate >= this.options.failureThresholdPercentage) {
        this.state = 'OPEN';
        this.lastStateChange = Date.now();
      }
    }
  }

  public async execute<T>(action: () => Promise<T>): Promise<T> {
    this.evaluateStateTransitions();

    if (this.state === 'OPEN') {
      const remainingCooldown = Math.max(0, this.options.cooldownPeriodMs - (Date.now() - this.lastStateChange));
      throw new CircuitBreakerOpenError(this.partnerKey, remainingCooldown);
    }

    if (this.state === 'HALF_OPEN') {
      if (this.halfOpenProbeInFlight) {
        throw new CircuitBreakerOpenError(this.partnerKey, 1000);
      }
      this.halfOpenProbeInFlight = true;
    }

    try {
      const result = await action();
      this.recordSuccess();
      return result;
    } catch (err) {
      this.recordFailure();
      throw err;
    }
  }

  private evaluateStateTransitions(): void {
    const now = Date.now();
    this.pruneRecords(now);

    if (this.state === 'OPEN') {
      const elapsed = now - this.lastStateChange;
      if (elapsed >= this.options.cooldownPeriodMs) {
        this.state = 'HALF_OPEN';
        this.lastStateChange = now;
        this.halfOpenProbeInFlight = false;
      }
    }
  }

  private pruneRecords(now: number): void {
    const cutoff = now - this.options.rollingWindowMs;
    this.records = this.records.filter((r) => r.timestamp >= cutoff);
  }

  public calculateMetrics(): { total: number; failures: number; failureRate: number } {
    const total = this.records.length;
    if (total === 0) return { total: 0, failures: 0, failureRate: 0 };
    const failures = this.records.filter((r) => !r.success).length;
    const failureRate = (failures / total) * 100;
    return { total, failures, failureRate };
  }
}
