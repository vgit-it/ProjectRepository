import { PLAYER_RADIUS } from "../constants";
import type { MatchPlayer, Team } from "../types";
import type { Renderer } from "./Renderer";

// DEV PALETTE: see drawPitch.ts for the scoped CLAUDE.md palette exception note.
const TEAM_FILL: Record<Team, string> = { home: "#3b82f6", away: "#eab308" };
const GK_RING_COLOR = "rgba(255, 255, 255, 0.9)";
const BALL_CARRIER_RING_COLOR = "#ffffff";

export function drawPlayers(renderer: Renderer, players: MatchPlayer[]): void {
  const { ctx } = renderer;
  const radiusPx = renderer.metersToPixels(PLAYER_RADIUS);

  for (const player of players) {
    const p = renderer.worldToScreen(player.pos);

    ctx.beginPath();
    ctx.arc(p.x, p.y, radiusPx, 0, Math.PI * 2);
    ctx.fillStyle = TEAM_FILL[player.team];
    ctx.fill();

    if (player.role === "GK") {
      ctx.lineWidth = Math.max(1, radiusPx * 0.25);
      ctx.strokeStyle = GK_RING_COLOR;
      ctx.stroke();
    }

    if (player.hasBall) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, radiusPx * 1.5, 0, Math.PI * 2);
      ctx.lineWidth = Math.max(1, radiusPx * 0.2);
      ctx.strokeStyle = BALL_CARRIER_RING_COLOR;
      ctx.stroke();
    }
  }
}
