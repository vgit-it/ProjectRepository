import { prefersReducedMotion } from "@lib/motion";
import type { GameEvent, Vec2 } from "../types";
import type { Renderer } from "./Renderer";

// DEV PALETTE: see drawPitch.ts for the scoped CLAUDE.md palette exception note. FX live
// inside the game canvas (not the warehouse shell), so they may use color freely.

/** Per-event juice: trauma impulse (0..1, added to the camera shake) plus the impact
 * ring/spark look. Bigger beats (hit, goal) shake harder than minor ones (steal, shot). */
const EVENT_FX: Record<GameEvent["kind"], { trauma: number; color: string; ringM: number; sparks: number }> = {
  hit: { trauma: 0.75, color: "#ffd166", ringM: 7, sparks: 10 },
  goal: { trauma: 0.9, color: "#ffe08a", ringM: 9, sparks: 14 },
  save: { trauma: 0.5, color: "#9fe6ff", ringM: 5, sparks: 8 },
  steal: { trauma: 0.32, color: "#ffffff", ringM: 3.5, sparks: 6 },
  shot: { trauma: 0.2, color: "#ffffff", ringM: 2.5, sparks: 0 },
};

const MAX_SHAKE_PX = 22;
const TRAUMA_DECAY_PER_SEC = 2.2;
const RING_TTL_MS = 420;
const SPARK_TTL_MS = 520;
const SPARK_SPEED_M = 9;

interface Ring {
  pos: Vec2;
  startMs: number;
  color: string;
  maxRadiusM: number;
}

interface Spark {
  pos: Vec2;
  vel: Vec2;
  startMs: number;
  color: string;
}

/** Lightweight screen-shake + impact-FX layer. The sim emits one-shot GameEvents;
 * `consume` turns them into camera trauma and short-lived rings/sparks the renderer
 * draws in world space. Fully disabled under prefers-reduced-motion (CLAUDE.md §5). */
export class Fx {
  private trauma = 0;
  private rings: Ring[] = [];
  private sparks: Spark[] = [];
  private lastMs = 0;
  private offset: Vec2 = { x: 0, y: 0 };

  consume(events: GameEvent[], nowMs: number): void {
    if (prefersReducedMotion()) return;
    for (const ev of events) {
      const fx = EVENT_FX[ev.kind];
      this.trauma = Math.min(1, this.trauma + fx.trauma);
      if (!ev.pos) continue;
      this.rings.push({ pos: { ...ev.pos }, startMs: nowMs, color: fx.color, maxRadiusM: fx.ringM });
      for (let i = 0; i < fx.sparks; i++) {
        const a = (i / fx.sparks) * Math.PI * 2 + Math.random() * 0.5;
        const speed = SPARK_SPEED_M * (0.5 + Math.random() * 0.5);
        this.sparks.push({
          pos: { ...ev.pos },
          vel: { x: Math.cos(a) * speed, y: Math.sin(a) * speed },
          startMs: nowMs,
          color: fx.color,
        });
      }
    }
  }

  update(nowMs: number): void {
    const dtSec = this.lastMs ? Math.max(0, (nowMs - this.lastMs) / 1000) : 0;
    this.lastMs = nowMs;
    this.trauma = Math.max(0, this.trauma - TRAUMA_DECAY_PER_SEC * dtSec);

    this.rings = this.rings.filter((r) => nowMs - r.startMs < RING_TTL_MS);
    this.sparks = this.sparks.filter((s) => nowMs - s.startMs < SPARK_TTL_MS);

    if (prefersReducedMotion() || this.trauma <= 0) {
      this.offset = { x: 0, y: 0 };
      return;
    }
    const shake = this.trauma * this.trauma * MAX_SHAKE_PX;
    this.offset = { x: (Math.random() * 2 - 1) * shake, y: (Math.random() * 2 - 1) * shake };
  }

  /** Current per-frame screen-shake translation in device pixels. */
  cameraOffset(): Vec2 {
    return this.offset;
  }

  draw(renderer: Renderer, nowMs: number): void {
    const { ctx } = renderer;

    for (const ring of this.rings) {
      const t = (nowMs - ring.startMs) / RING_TTL_MS;
      const sp = renderer.project(ring.pos);
      if (!renderer.inView(sp, 60)) continue;
      const r = Math.max(1, ring.maxRadiusM * t * sp.scale);
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = ring.color;
      ctx.globalAlpha = Math.max(0, 1 - t);
      ctx.lineWidth = Math.max(1, 0.4 * sp.scale * (1 - t));
      ctx.stroke();
    }

    for (const spark of this.sparks) {
      const elapsedSec = (nowMs - spark.startMs) / 1000;
      const p = { x: spark.pos.x + spark.vel.x * elapsedSec, y: spark.pos.y + spark.vel.y * elapsedSec };
      const sp = renderer.project(p);
      if (!renderer.inView(sp, 60)) continue;
      const t = (nowMs - spark.startMs) / SPARK_TTL_MS;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, Math.max(1, 0.25 * sp.scale), 0, Math.PI * 2);
      ctx.fillStyle = spark.color;
      ctx.globalAlpha = Math.max(0, 1 - t);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }
}
