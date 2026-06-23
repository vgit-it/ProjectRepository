import {
  CAMERA_DEPTH_M,
  CAMERA_FOLLOW_LERP,
  CAMERA_TILT,
  CAMERA_VISIBLE_HEIGHT_M,
  PITCH_HEIGHT,
  PITCH_WIDTH,
} from "../constants";
import { prefersReducedMotion } from "@lib/motion";
import type { Vec2 } from "../types";

export interface Projected {
  /** screen position in device pixels */
  x: number;
  y: number;
  /** px-per-meter at this point (perspective depth scale for billboarded sprites) */
  scale: number;
}

/**
 * Zoomed, player-following perspective camera. World orientation stays fixed
 * (north-up, like the original top-down view) but the view is zoomed so only a
 * slice of the pitch is visible, pans to follow the spectator, and applies a mild
 * vertical perspective foreshortening so rows higher on screen read as "farther"
 * (the raked, over-the-shoulder feel from the concept sketches).
 *
 * The mapping is intentionally simple and non-projective, so straight pitch lines
 * are sampled into short polylines by the draw modules rather than relying on the
 * projection to keep them straight.
 */
export class Camera {
  /** world-space point the view is centered on */
  private focus: Vec2 = { x: PITCH_WIDTH / 2, y: PITCH_HEIGHT / 2 };
  private pxPerM = 1;
  private widthPx = 1;
  private heightPx = 1;

  resize(widthPx: number, heightPx: number): void {
    this.widthPx = widthPx;
    this.heightPx = heightPx;
    // Zoom so CAMERA_VISIBLE_HEIGHT_M of world fills the canvas height.
    this.pxPerM = heightPx / CAMERA_VISIBLE_HEIGHT_M;
  }

  /** Snap the focus immediately (used on first frame / reset). */
  snapTo(target: Vec2): void {
    this.focus = this.clampFocus(target);
  }

  /** Ease the focus toward target; collapses to instant under reduced motion. */
  follow(target: Vec2): void {
    const clamped = this.clampFocus(target);
    const t = prefersReducedMotion() ? 1 : CAMERA_FOLLOW_LERP;
    this.focus = {
      x: this.focus.x + (clamped.x - this.focus.x) * t,
      y: this.focus.y + (clamped.y - this.focus.y) * t,
    };
  }

  /** Keep the focus inside the pitch + a stand-band margin so the view never
   * scrolls into empty void beyond the world. */
  private clampFocus(target: Vec2): Vec2 {
    const visH = CAMERA_VISIBLE_HEIGHT_M;
    const visW = this.widthPx / this.pxPerM;
    const marginX = 6;
    const marginY = 6;
    const minX = Math.min(PITCH_WIDTH / 2, visW / 2 - marginX);
    const maxX = Math.max(PITCH_WIDTH / 2, PITCH_WIDTH - visW / 2 + marginX);
    const minY = Math.min(PITCH_HEIGHT / 2, visH / 2 - marginY);
    const maxY = Math.max(PITCH_HEIGHT / 2, PITCH_HEIGHT - visH / 2 + marginY);
    return {
      x: Math.max(minX, Math.min(maxX, target.x)),
      y: Math.max(minY, Math.min(maxY, target.y)),
    };
  }

  /** Perspective denominator for a world point. >1 above focus (farther/smaller),
   * <1 below focus (nearer/larger). Guarded to stay positive. */
  private denom(v: number): number {
    return Math.max(0.25, 1 - (CAMERA_TILT * v) / CAMERA_DEPTH_M);
  }

  project(p: Vec2): Projected {
    const u = p.x - this.focus.x;
    const v = p.y - this.focus.y;
    const d = this.denom(v);
    const scale = this.pxPerM / d;
    return {
      x: this.widthPx / 2 + u * scale,
      y: this.heightPx / 2 + v * scale,
      scale,
    };
  }

  /** Inverse of `project`: maps a device-pixel screen point back to a world point.
   * Solves the perspective denominator for `v` first (since y depends on v through
   * `denom`), then recovers `u` at the resulting depth scale. */
  unproject(sxPx: number, syPx: number): Vec2 {
    const dy = syPx - this.heightPx / 2;
    const a = CAMERA_TILT / CAMERA_DEPTH_M;
    // dy = v * pxPerM / (1 - a*v)  =>  v = dy / (pxPerM + a*dy)
    let v = dy / (this.pxPerM + a * dy);
    // Respect the same denominator clamp project() applies, so far-field points
    // (in the flattened region) invert consistently rather than blowing up.
    const d = this.denom(v);
    if (d <= 0.25 + 1e-6) v = dy / this.pxPerM / 0.25;
    const scale = this.pxPerM / this.denom(v);
    const u = (sxPx - this.widthPx / 2) / scale;
    return { x: this.focus.x + u, y: this.focus.y + v };
  }

  /** True when a projected point lies within (a margin around) the viewport. */
  inView(sp: Projected, marginPx = 80): boolean {
    return (
      sp.x >= -marginPx &&
      sp.x <= this.widthPx + marginPx &&
      sp.y >= -marginPx &&
      sp.y <= this.heightPx + marginPx
    );
  }
}
