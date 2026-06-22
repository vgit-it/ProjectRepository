import { BALL_RADIUS } from "../constants";
import type { Ball } from "../types";
import type { Renderer } from "./Renderer";

const BALL_FILL = "#f5f5f0";
const BALL_OUTLINE = "#222222";
const SHADOW_COLOR = "rgba(0, 0, 0, 0.28)";

export function drawBall(renderer: Renderer, ball: Ball): void {
  const { ctx } = renderer;
  const sp = renderer.project(ball.pos);
  if (!renderer.inView(sp)) return;
  const radiusPx = Math.max(1.5, BALL_RADIUS * sp.scale);

  // Lofted balls rise off their ground point; the shadow stays planted and shrinks a
  // touch with height to read as depth.
  const liftPx = ball.z * sp.scale;
  const shadowScale = 1 / (1 + ball.z * 0.15);

  ctx.beginPath();
  ctx.ellipse(
    sp.x,
    sp.y + radiusPx * 0.4,
    radiusPx * 1.1 * shadowScale,
    radiusPx * 0.45 * shadowScale,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fillStyle = SHADOW_COLOR;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(sp.x, sp.y - liftPx, radiusPx, 0, Math.PI * 2);
  ctx.fillStyle = BALL_FILL;
  ctx.fill();
  ctx.lineWidth = Math.max(1, radiusPx * 0.25);
  ctx.strokeStyle = BALL_OUTLINE;
  ctx.stroke();
}
