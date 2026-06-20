import { GOAL_Y_MAX, GOAL_Y_MIN, PITCH_HEIGHT, PITCH_WIDTH } from "../constants";
import type { Renderer } from "./Renderer";

const PITCH_FILL = "#1d6b35";
const LINE_COLOR = "rgba(255, 255, 255, 0.85)";
const GOAL_COLOR = "#e7e7e7";
const LINE_WIDTH_M = 0.12;
const GOAL_DEPTH_M = 2;
const CENTER_CIRCLE_RADIUS_M = 9;

/** DEV PALETTE NOTE: this game page is an explicit, temporary, scoped exception to
 * CLAUDE.md's B&W+red-only rule (see audience-interference.astro frontmatter for the
 * full rationale). Real gameplay colors here are intentional, not an oversight. */
export function drawPitch(renderer: Renderer): void {
  const { ctx } = renderer;
  const topLeft = renderer.worldToScreen({ x: 0, y: 0 });
  const bottomRight = renderer.worldToScreen({ x: PITCH_WIDTH, y: PITCH_HEIGHT });
  const lineWidth = Math.max(1, renderer.metersToPixels(LINE_WIDTH_M));

  ctx.fillStyle = PITCH_FILL;
  ctx.fillRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);

  ctx.strokeStyle = LINE_COLOR;
  ctx.lineWidth = lineWidth;

  // pitch border
  ctx.strokeRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);

  // halfway line
  const halfTop = renderer.worldToScreen({ x: PITCH_WIDTH / 2, y: 0 });
  const halfBottom = renderer.worldToScreen({ x: PITCH_WIDTH / 2, y: PITCH_HEIGHT });
  ctx.beginPath();
  ctx.moveTo(halfTop.x, halfTop.y);
  ctx.lineTo(halfBottom.x, halfBottom.y);
  ctx.stroke();

  // center circle
  const center = renderer.worldToScreen({ x: PITCH_WIDTH / 2, y: PITCH_HEIGHT / 2 });
  ctx.beginPath();
  ctx.arc(center.x, center.y, renderer.metersToPixels(CENTER_CIRCLE_RADIUS_M), 0, Math.PI * 2);
  ctx.stroke();

  drawGoal(renderer, 0, -1);
  drawGoal(renderer, PITCH_WIDTH, 1);
}

function drawGoal(renderer: Renderer, lineX: number, outwardDir: 1 | -1): void {
  const { ctx } = renderer;
  const mouthTop = renderer.worldToScreen({ x: lineX, y: GOAL_Y_MIN });
  const mouthBottom = renderer.worldToScreen({ x: lineX, y: GOAL_Y_MAX });
  const netDepthPx = renderer.metersToPixels(GOAL_DEPTH_M) * outwardDir;

  ctx.strokeStyle = GOAL_COLOR;
  ctx.lineWidth = Math.max(1, renderer.metersToPixels(LINE_WIDTH_M) * 1.5);
  ctx.beginPath();
  ctx.moveTo(mouthTop.x, mouthTop.y);
  ctx.lineTo(mouthTop.x + netDepthPx, mouthTop.y);
  ctx.lineTo(mouthBottom.x + netDepthPx, mouthBottom.y);
  ctx.lineTo(mouthBottom.x, mouthBottom.y);
  ctx.stroke();
}
