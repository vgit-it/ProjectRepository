import { PITCH_HEIGHT, PITCH_WIDTH } from "../constants";
import { prefersReducedMotion } from "@lib/motion";
import type { Spectator, Vec2 } from "../types";
import { add, normalize, scale } from "../vec";
import { ITEM_DEFS } from "../sim/items";
import type { Renderer } from "./Renderer";

// DEV PALETTE: see drawPitch.ts for the scoped CLAUDE.md palette exception note.
const AIM_COLOR = "#ff3db5";
const MAX_SPREAD_RAD = 0.5; // half-angle of the fan at zero charge

/** The pink "THROW UI": a fan from the spectator that narrows as the throw charges,
 * plus a landing reticle. Wide while loose, a single committed arrow at full charge. */
export function drawAim(renderer: Renderer, spec: Spectator, nowMs: number): void {
  if (!spec.aiming) return;
  const { ctx } = renderer;

  const def = ITEM_DEFS[spec.heldItem];
  const power = 0.4 + 0.6 * spec.charge;
  const dir = normalize(spec.aimDir);
  const origin = clampToPitch(spec.pos);
  const reach = def.range * power;
  const target = clampToPitch(add(origin, scale(dir, reach)));

  const spread = MAX_SPREAD_RAD * (1 - spec.charge);
  const baseAngle = Math.atan2(dir.y, dir.x);
  const pulse = prefersReducedMotion() ? 1 : 0.85 + 0.15 * Math.sin(nowMs / 120);

  ctx.save();
  ctx.globalAlpha = pulse;
  // fan edges + center arrow
  const angles = spread < 0.02 ? [0] : [-spread, 0, spread];
  for (const da of angles) {
    const a = baseAngle + da;
    const end = clampToPitch(add(origin, { x: Math.cos(a) * reach, y: Math.sin(a) * reach }));
    drawArrow(renderer, origin, end, da === 0 ? 1 : 0.55);
  }

  // landing reticle
  const tp = renderer.project(target);
  const rr = Math.max(6, 2.4 * tp.scale);
  ctx.strokeStyle = AIM_COLOR;
  ctx.lineWidth = Math.max(2, 0.35 * tp.scale);
  ctx.beginPath();
  ctx.ellipse(tp.x, tp.y, rr, rr * 0.5, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(tp.x - rr, tp.y);
  ctx.lineTo(tp.x + rr, tp.y);
  ctx.moveTo(tp.x, tp.y - rr * 0.5);
  ctx.lineTo(tp.x, tp.y + rr * 0.5);
  ctx.stroke();
  ctx.restore();
}

function drawArrow(renderer: Renderer, from: Vec2, to: Vec2, weight: number): void {
  const { ctx } = renderer;
  const a = renderer.project(from);
  const b = renderer.project(to);
  ctx.strokeStyle = AIM_COLOR;
  ctx.fillStyle = AIM_COLOR;
  ctx.lineWidth = Math.max(2, 0.5 * b.scale * weight);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();

  // arrowhead
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  const head = Math.max(6, 1.4 * b.scale * weight);
  ctx.beginPath();
  ctx.moveTo(b.x, b.y);
  ctx.lineTo(b.x - Math.cos(ang - 0.4) * head, b.y - Math.sin(ang - 0.4) * head);
  ctx.lineTo(b.x - Math.cos(ang + 0.4) * head, b.y - Math.sin(ang + 0.4) * head);
  ctx.closePath();
  ctx.fill();
}

function clampToPitch(p: Vec2): Vec2 {
  return {
    x: Math.max(0, Math.min(PITCH_WIDTH, p.x)),
    y: Math.max(0, Math.min(PITCH_HEIGHT, p.y)),
  };
}
