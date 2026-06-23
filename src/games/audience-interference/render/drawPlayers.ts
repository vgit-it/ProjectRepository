import {
  IMPACT_SHAKE_MS,
  PLAYER_FRAME_CYCLE_MS,
  PLAYER_RADIUS,
  PLAYER_RUN_THRESHOLD,
  PLAYER_SPRITE_SCALE,
} from "../constants";
import { prefersReducedMotion } from "@lib/motion";
import type { GoalkeeperPlayer, MatchPlayer, Team } from "../types";
import { length } from "../vec";
import {
  getPlayerFrame,
  isPlayerSpriteReady,
  playerFrameAspect,
  playerFrameFootFraction,
} from "./playerSprite";
import type { Renderer } from "./Renderer";

// DEV PALETTE: see drawPitch.ts for the scoped CLAUDE.md palette exception note.
const TEAM_FILL: Record<Team, string> = { home: "#3b82f6", away: "#eab308" };
const GK_RING_COLOR = "rgba(255, 255, 255, 0.9)";
const BALL_CARRIER_RING_COLOR = "#ffffff";
const DAZE_COLOR = "#ffd166";

/** Persisted horizontal facing per player (true = facing left) so the sprite keeps
 * its last orientation while idle instead of snapping back to the default. */
const facingLeft = new Map<string, boolean>();

export function drawPlayers(renderer: Renderer, players: MatchPlayer[], nowMs: number): void {
  const { ctx } = renderer;
  const spriteReady = isPlayerSpriteReady();

  // Draw far→near (smaller screen-y first) so nearer players overlap correctly.
  const ordered = [...players].sort((a, b) => a.pos.y - b.pos.y);

  for (const player of ordered) {
    const sp = renderer.project(player.pos);
    if (!renderer.inView(sp)) continue;
    const radiusPx = PLAYER_RADIUS * sp.scale;

    // Brief impact jolt: jitter the whole sprite for a fraction of a second after
    // a tackle / daze / kick. Render-only, decays to nothing; off under reduced motion.
    if (!prefersReducedMotion() && nowMs < player.shakeUntilMs) {
      const t = (player.shakeUntilMs - nowMs) / IMPACT_SHAKE_MS;
      const amp = radiusPx * 0.2 * t;
      sp.x += (Math.random() * 2 - 1) * amp;
      sp.y += (Math.random() * 2 - 1) * amp;
    }

    const running = length(player.vel) > PLAYER_RUN_THRESHOLD;
    if (Math.abs(player.vel.x) > PLAYER_RUN_THRESHOLD) {
      facingLeft.set(player.id, player.vel.x < 0);
    }

    if (spriteReady) {
      // idle -> frame 0; running -> alternate the two frames every 0.4s.
      const frameIndex = running ? ((Math.floor(nowMs / PLAYER_FRAME_CYCLE_MS) % 2) as 0 | 1) : 0;
      const frame = getPlayerFrame(player.team, frameIndex);
      if (frame) {
        const w = radiusPx * 2 * PLAYER_SPRITE_SCALE;
        const h = w / playerFrameAspect();
        ctx.save();
        ctx.translate(sp.x, sp.y);
        if (facingLeft.get(player.id)) ctx.scale(-1, 1);
        // Anchor on the sprite's real feet (ignoring the transparent padding below
        // them) so players sit on the projected ground point instead of floating.
        ctx.drawImage(frame, -w / 2, -h * playerFrameFootFraction() + radiusPx * 0.15, w, h);
        ctx.restore();
      }
    } else {
      // Fallback (sprite asset not yet loaded): the original team-colored dot.
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, radiusPx, 0, Math.PI * 2);
      ctx.fillStyle = TEAM_FILL[player.team];
      ctx.fill();
    }

    if (player.role === "GK") {
      const gk = player as GoalkeeperPlayer;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, radiusPx, 0, Math.PI * 2);
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
