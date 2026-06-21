import { PITCH_HEIGHT, PITCH_WIDTH } from "../constants";
import { prefersReducedMotion } from "@lib/motion";
import type { Spectator, Vec2 } from "../types";
import { ITEM_DEFS } from "../sim/items";
import type { Renderer } from "./Renderer";

// DEV PALETTE: see drawPitch.ts for the scoped CLAUDE.md palette exception note.
const AIM_COLOR = "#ff3db5";
const RANGE_SAMPLES = 36; // polyline segments approximating the range-limit ring

/** The pink "THROW UI": a faint range-limit ring around the player and a landing
 * marker (reticle) that the joystick drags around inside it. */
export function drawAim(renderer: Renderer, spec: Spectator, nowMs: number): void {
  if (!spec.aiming) return;
  const { ctx } = renderer;

  const origin = clampToPitch(spec.pos);
  const range = ITEM_DEFS[spec.heldItem].range;
  const target = clampToPitch(spec.aimTarget);
  const pulse = prefersReducedMotion() ? 1 : 0.8 + 0.2 * Math.sin(nowMs / 120);

  ctx.save();

  // range-limit ring: sample the world circle and project to a perspective polyline
  ctx.globalAlpha = 0.4;
  ctx.strokeStyle = AIM_COLOR;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  for (let i = 0; i <= RANGE_SAMPLES; i++) {
    const a = (i / RANGE_SAMPLES) * Math.PI * 2;
    const wp = { x: origin.x + Math.cos(a) * range, y: origin.y + Math.sin(a) * range };
    const sp = renderer.project(clampToPitch(wp));
    if (i === 0) ctx.moveTo(sp.x, sp.y);
    else ctx.lineTo(sp.x, sp.y);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // thin line from the player to the marker
  const op = renderer.project(origin);
  const tp = renderer.project(target);
  ctx.globalAlpha = 0.55 * pulse;
  ctx.lineWidth = Math.max(1.5, 0.25 * tp.scale);
  ctx.beginPath();
  ctx.moveTo(op.x, op.y);
  ctx.lineTo(tp.x, tp.y);
  ctx.stroke();

  // landing reticle at the marker
  ctx.globalAlpha = pulse;
  const rr = Math.max(6, 2.4 * tp.scale);
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

function clampToPitch(p: Vec2): Vec2 {
  return {
    x: Math.max(0, Math.min(PITCH_WIDTH, p.x)),
    y: Math.max(0, Math.min(PITCH_HEIGHT, p.y)),
  };
}
