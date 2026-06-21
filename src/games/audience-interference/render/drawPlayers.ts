import { PLAYER_RADIUS } from "../constants";
import type { GoalkeeperPlayer, MatchPlayer, Team } from "../types";
import type { Renderer } from "./Renderer";

// DEV PALETTE: see drawPitch.ts for the scoped CLAUDE.md palette exception note.
const TEAM_FILL: Record<Team, string> = { home: "#3b82f6", away: "#eab308" };
const GK_RING_COLOR = "rgba(255, 255, 255, 0.9)";
const BALL_CARRIER_RING_COLOR = "#ffffff";
const SHADOW_COLOR = "rgba(0, 0, 0, 0.28)";
const DAZE_COLOR = "#ffd166";

export function drawPlayers(renderer: Renderer, players: MatchPlayer[], nowMs: number): void {
  const { ctx } = renderer;

  // Draw far→near (smaller screen-y first) so nearer players overlap correctly.
  const ordered = [...players].sort((a, b) => a.pos.y - b.pos.y);

  for (const player of ordered) {
    const sp = renderer.project(player.pos);
    if (!renderer.inView(sp)) continue;
    const radiusPx = PLAYER_RADIUS * sp.scale;

    // ground shadow
    ctx.beginPath();
    ctx.ellipse(sp.x, sp.y + radiusPx * 0.15, radiusPx * 0.95, radiusPx * 0.4, 0, 0, Math.PI * 2);
    ctx.fillStyle = SHADOW_COLOR;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(sp.x, sp.y, radiusPx, 0, Math.PI * 2);
    ctx.fillStyle = TEAM_FILL[player.team];
    ctx.fill();

    if (player.role === "GK") {
      const gk = player as GoalkeeperPlayer;
      ctx.lineWidth = Math.max(1, radiusPx * 0.25);
      ctx.strokeStyle = nowMs < gk.blindedUntilMs ? DAZE_COLOR : GK_RING_COLOR;
      ctx.stroke();
    }

    if (player.hasBall) {
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, radiusPx * 1.5, 0, Math.PI * 2);
      ctx.lineWidth = Math.max(1, radiusPx * 0.2);
      ctx.strokeStyle = BALL_CARRIER_RING_COLOR;
      ctx.stroke();
    }

    // dazed: little spinning marks above the head
    if (nowMs < player.dazedUntilMs) {
      drawDazeStars(ctx, sp.x, sp.y - radiusPx * 1.6, radiusPx, nowMs);
    }
  }
}

function drawDazeStars(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  nowMs: number,
): void {
  const spin = (nowMs / 400) % (Math.PI * 2);
  ctx.fillStyle = DAZE_COLOR;
  for (let i = 0; i < 3; i++) {
    const a = spin + (i / 3) * Math.PI * 2;
    const x = cx + Math.cos(a) * r * 0.7;
    const y = cy + Math.sin(a) * r * 0.3;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1, r * 0.16), 0, Math.PI * 2);
    ctx.fill();
  }
}
