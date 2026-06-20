import { BALL_RADIUS } from "../constants";
import type { Ball } from "../types";
import type { Renderer } from "./Renderer";

const BALL_FILL = "#f5f5f0";
const BALL_OUTLINE = "#222222";

export function drawBall(renderer: Renderer, ball: Ball): void {
  const { ctx } = renderer;
  const p = renderer.worldToScreen(ball.pos);
  const radiusPx = Math.max(1.5, renderer.metersToPixels(BALL_RADIUS));

  ctx.beginPath();
  ctx.arc(p.x, p.y, radiusPx, 0, Math.PI * 2);
  ctx.fillStyle = BALL_FILL;
  ctx.fill();
  ctx.lineWidth = Math.max(1, radiusPx * 0.25);
  ctx.strokeStyle = BALL_OUTLINE;
  ctx.stroke();
}
