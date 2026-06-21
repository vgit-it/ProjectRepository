import type { Spectator } from "../types";
import type { Renderer } from "./Renderer";

// DEV PALETTE: see drawPitch.ts for the scoped CLAUDE.md palette exception note.
const BODY_FILL = "#19a3c4"; // teal shirt, matches the concept sketch
const HEAD_FILL = "#f1d6a8";
const OUTLINE = "#10222b";
const HALO = "rgba(255, 255, 255, 0.5)";

/** The controlled crowd member — the "PLAYER" figure, drawn larger/brighter than
 * the surrounding seats with a subtle halo so it's easy to find. */
export function drawSpectator(renderer: Renderer, spec: Spectator): void {
  const { ctx } = renderer;
  const sp = renderer.project(spec.pos);
  const r = Math.max(3, 1.6 * sp.scale);

  // halo
  ctx.beginPath();
  ctx.arc(sp.x, sp.y, r * 1.5, 0, Math.PI * 2);
  ctx.fillStyle = HALO;
  ctx.fill();

  // shadow
  ctx.beginPath();
  ctx.ellipse(sp.x, sp.y + r * 0.3, r * 0.9, r * 0.4, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fill();

  // body
  ctx.beginPath();
  ctx.arc(sp.x, sp.y, r, 0, Math.PI * 2);
  ctx.fillStyle = BODY_FILL;
  ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.18);
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();

  // head
  ctx.beginPath();
  ctx.arc(sp.x, sp.y - r * 0.7, r * 0.6, 0, Math.PI * 2);
  ctx.fillStyle = HEAD_FILL;
  ctx.fill();
  ctx.stroke();
}
