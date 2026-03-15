export class RateLimiter {
  private lastRequest = 0;

  constructor(private minIntervalMs: number = 2000) {}

  async acquire(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequest;
    if (elapsed < this.minIntervalMs) {
      await new Promise((r) => setTimeout(r, this.minIntervalMs - elapsed));
    }
    this.lastRequest = Date.now();
  }
}
