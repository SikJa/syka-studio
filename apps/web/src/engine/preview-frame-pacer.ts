/** Keep idle previews fresh without running every editor system at display Hz. */
export class PreviewFramePacer {
  private lastTick = -Infinity;
  private fastUntil = -Infinity;

  constructor(private readonly idleIntervalMs = 50, private readonly interactionTailMs = 800) {}

  wake(now: number): void { this.fastUntil = Math.max(this.fastUntil, now + this.interactionTailMs); }
  reset(): void { this.lastTick = -Infinity; this.fastUntil = -Infinity; }

  shouldTick(now: number, continuous: boolean): boolean {
    if (continuous) this.wake(now);
    if (now < this.fastUntil || now - this.lastTick + 0.1 >= this.idleIntervalMs) {
      this.lastTick = now;
      return true;
    }
    return false;
  }
}
