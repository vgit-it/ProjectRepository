import type { Vec2 } from "../types";
import { Camera, type Projected } from "./camera";

/** Owns the canvas + device-pixel sizing and delegates the world->screen transform
 * to a zoomed, player-following perspective Camera. */
export class Renderer {
  readonly ctx: CanvasRenderingContext2D;
  readonly camera = new Camera();
  private widthPx = 1;
  private heightPx = 1;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context unavailable");
    this.ctx = ctx;
  }

  /** Resizes the backing buffer to match the CSS box (in device pixels). */
  resize(widthPx: number, heightPx: number): void {
    const dpr = window.devicePixelRatio || 1;
    this.widthPx = Math.max(1, Math.round(widthPx * dpr));
    this.heightPx = Math.max(1, Math.round(heightPx * dpr));
    this.canvas.width = this.widthPx;
    this.canvas.height = this.heightPx;
    this.canvas.style.width = `${widthPx}px`;
    this.canvas.style.height = `${heightPx}px`;
    this.camera.resize(this.widthPx, this.heightPx);
  }

  get width(): number {
    return this.widthPx;
  }
  get height(): number {
    return this.heightPx;
  }

  project(p: Vec2): Projected {
    return this.camera.project(p);
  }

  inView(sp: Projected, marginPx?: number): boolean {
    return this.camera.inView(sp, marginPx);
  }

  worldToScreen(p: Vec2): Vec2 {
    const sp = this.camera.project(p);
    return { x: sp.x, y: sp.y };
  }

  clear(): void {
    this.ctx.fillStyle = "#111317";
    this.ctx.fillRect(0, 0, this.widthPx, this.heightPx);
  }
}
