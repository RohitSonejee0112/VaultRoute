/**
 * Full Jitter Exponential Backoff Calculator.
 * Prevents thundering herd problems during downstream partner recovery.
 * Formula: T_sleep = random(0, min(T_cap, T_base * 2^attempt))
 */
export class FullJitterBackoff {
  constructor(
    public readonly baseDelayMs: number = 100,
    public readonly capDelayMs: number = 5000,
    private readonly randomFn: () => number = Math.random
  ) {}

  public calculateDelay(attempt: number): number {
    const exponent = Math.max(0, attempt - 1);
    const exponential = this.baseDelayMs * Math.pow(2, exponent);
    const ceiling = Math.min(this.capDelayMs, exponential);
    return Math.floor(this.randomFn() * ceiling);
  }

  public async sleep(attempt: number): Promise<number> {
    const delay = this.calculateDelay(attempt);
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    return delay;
  }
}
