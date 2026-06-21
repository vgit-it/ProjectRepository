import { GOAL_Y_MAX, GOAL_Y_MIN, PITCH_HEIGHT, PITCH_WIDTH } from "../constants";
import type { Vec2 } from "../types";
import { lerp } from "../vec";
import type { Renderer } from "./Renderer";

const PITCH_FILL = "#1d6b35";
const PITCH_STRIPE = "#1a6230";
const LINE_COLOR = "rgba(255, 255, 255, 0.85)";
const GOAL_COLOR = "#e7e7e7";
const CENTER_CIRCLE_RADIUS_M = 9;
const STRIPE_COUNT = 10;

/** DEV PALETTE NOTE: this game page is an explicit, temporary, scoped exception to
 * CLAUDE.md's B&W+red-only rule (see audience-interference.astro frontmatter for the
 * full rationale). Real gameplay colors here are intentional, not an oversight. */
export function drawPitch(renderer: Renderer): void {
  const { ctx } = renderer;

  // Mown stripes (each a projected quad spanning the pitch width), bottom→top so
  // the perspective trapezoids layer correctly.
  for (let i = 0; i < STRIPE_COUNT; i++) {
    const y0 = (i / STRIPE_COUNT) * PITCH_HEIGHT;
    const y1 = ((i + 1) / STRIPE_COUNT) * PITCH_HEIGHT;
    fillWorldQuad(
      renderer,
      [
        { x: 0, y: y0 },
        { x: PITCH_WIDTH, y: y0 },
        { x: PITCH_WIDTH, y: y1 },
        { x: 0, y: y1 },
      ],
      i % 2 === 0 ? PITCH_FILL : PITCH_STRIPE,
    );
  }

  const lw = lineWidthPx(renderer);
  ctx.strokeStyle = LINE_COLOR;
  ctx.lineWidth = lw;
  ctx.lineJoin = "round";

  // pitch border
  strokeWorldPolyline(
    renderer,
    [
      { x: 0, y: 0 },
      { x: PITCH_WIDTH, y: 0 },
      { x: PITCH_WIDTH, y: PITCH_HEIGHT },
      { x: 0, y: PITCH_HEIGHT },
      { x: 0, y: 0 },
    ],
    LINE_COLOR,
    lw,
  );

  // halfway line
  strokeWorldPolyline(
    renderer,
    [
      { x: PITCH_WIDTH / 2, y: 0 },
      { x: PITCH_WIDTH / 2, y: PITCH_HEIGHT },
    ],
    LINE_COLOR,
    lw,
  );

  // center circle (sampled)
  strokeWorldPolyline(renderer, circlePoints(PITCH_WIDTH / 2, PITCH_HEIGHT / 2, CENTER_CIRCLE_RADIUS_M), LINE_COLOR, lw);

  drawGoal(renderer, 0, 1, lw);
  drawGoal(renderer, PITCH_WIDTH, -1, lw);
}

function drawGoal(renderer: Renderer, lineX: number, inwardDir: 1 | -1, lw: number): void {
  const depth = 2 * inwardDir;
  strokeWorldPolyline(
    renderer,
    [
      { x: lineX, y: GOAL_Y_MIN },
      { x: lineX - depth, y: GOAL_Y_MIN },
      { x: lineX - depth, y: GOAL_Y_MAX },
      { x: lineX, y: GOAL_Y_MAX },
    ],
    GOAL_COLOR,
    lw * 1.4,
  );
}

// ---------- world-space drawing helpers (sample to keep perspective clean) ----------

const SAMPLES_PER_SEGMENT = 10;

/** Stroke a world-space polyline, subdividing each segment so it follows the
 * camera's perspective rather than cutting straight across screen space. */
export function strokeWorldPolyline(
  renderer: Renderer,
  pts: Vec2[],
  color: string,
  widthPx: number,
): void {
  const { ctx } = renderer;
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = widthPx;
  let started = false;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    for (let s = 0; s <= SAMPLES_PER_SEGMENT; s++) {
      const w = lerp(a, b, s / SAMPLES_PER_SEGMENT);
      const sp = renderer.project(w);
      if (!started) {
        ctx.moveTo(sp.x, sp.y);
        started = true;
      } else {
        ctx.lineTo(sp.x, sp.y);
      }
    }
  }
  ctx.stroke();
}

function fillWorldQuad(renderer: Renderer, pts: Vec2[], color: string): void {
  const { ctx } = renderer;
  ctx.beginPath();
  pts.forEach((w, i) => {
    const sp = renderer.project(w);
    if (i === 0) ctx.moveTo(sp.x, sp.y);
    else ctx.lineTo(sp.x, sp.y);
  });
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function circlePoints(cx: number, cy: number, r: number): Vec2[] {
  const pts: Vec2[] = [];
  const N = 40;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return pts;
}

/** Line width in device px, scaled to the zoom via a center-pitch probe. */
export function lineWidthPx(renderer: Renderer): number {
  const probe = renderer.project({ x: PITCH_WIDTH / 2, y: PITCH_HEIGHT / 2 });
  return Math.max(1.5, 0.14 * probe.scale);
}
