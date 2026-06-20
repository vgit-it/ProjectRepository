import { PITCH_HEIGHT, PITCH_WIDTH } from "../constants";
import type { Vec2 } from "../types";

// Padding (world meters) kept around the pitch so the view doesn't crop right at the
// touchline; this margin is where M2 will place the stands.
const WORLD_MARGIN_M = 8;

/** Owns the canvas, the world(meters)->screen(px) transform, and frame clearing. */
export class Renderer {
  readonly ctx: CanvasRenderingContext2D;
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context unavailable");
    this.ctx = ctx;
  }

  /** Resizes the backing buffer to match the CSS box (in device pixels) and recomputes the transform. */
  resize(widthPx: number, heightPx: number): void {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.max(1, Math.round(widthPx * dpr));
    this.canvas.height = Math.max(1, Math.round(heightPx * dpr));
    this.canvas.style.width = `${widthPx}px`;
    this.canvas.style.height = `${heightPx}px`;

    const worldWidth = PITCH_WIDTH + WORLD_MARGIN_M * 2;
    const worldHeight = PITCH_HEIGHT + WORLD_MARGIN_M * 2;
    this.scale = Math.min(this.canvas.width / worldWidth, this.canvas.height / worldHeight);

    const padX = (this.canvas.width - worldWidth * this.scale) / 2;
    const padY = (this.canvas.height - worldHeight * this.scale) / 2;
    this.offsetX = padX + WORLD_MARGIN_M * this.scale;
    this.offsetY = padY + WORLD_MARGIN_M * this.scale;
  }

  worldToScreen(p: Vec2): Vec2 {
    return { x: p.x * this.scale + this.offsetX, y: p.y * this.scale + this.offsetY };
  }

  metersToPixels(m: number): number {
    return m * this.scale;
  }

  clear(): void {
    this.ctx.fillStyle = "#111317";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
