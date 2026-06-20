const FIXED_DT_MS = 1000 / 60;
const MAX_FRAME_MS = 250; // clamp tab-backgrounded gaps so the accumulator can't explode

export class GameLoop {
  private accumulatorMs = 0;
  private lastTimeMs = 0;
  private rafId = 0;
  private running = false;

  constructor(
    private readonly update: (dtMs: number) => void,
    private readonly render: (interpAlpha: number) => void,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTimeMs = performance.now();
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private tick = (now: number): void => {
    if (!this.running) return;
    const frameMs = Math.min(now - this.lastTimeMs, MAX_FRAME_MS);
    this.lastTimeMs = now;
    this.accumulatorMs += frameMs;

    while (this.accumulatorMs >= FIXED_DT_MS) {
      this.update(FIXED_DT_MS);
      this.accumulatorMs -= FIXED_DT_MS;
    }

    this.render(this.accumulatorMs / FIXED_DT_MS);
    this.rafId = requestAnimationFrame(this.tick);
  };
}
