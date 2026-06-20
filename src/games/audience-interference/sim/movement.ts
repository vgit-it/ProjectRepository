import {
  FORMATION,
  PITCH_HEIGHT,
  PITCH_WIDTH,
  PLAYER_ACCEL,
  PLAYER_BASE_SPEED,
} from "../constants";
import type { Ball, MatchPlayer, Team, Vec2 } from "../types";
import { add, clampMagnitude, distance, length, normalize, scale, sub } from "../vec";

/** Home attacks toward x = PITCH_WIDTH, away attacks toward x = 0. */
export function attackDirectionX(team: Team): 1 | -1 {
  return team === "home" ? 1 : -1;
}

function depthToWorldX(team: Team, depth: number): number {
  return team === "home" ? depth * PITCH_WIDTH : (1 - depth) * PITCH_WIDTH;
}

/**
 * The player's formation anchor, pulled toward the ball's current depth/lane by
 * a per-role drift coefficient (defenders shift more, forwards stay high).
 */
export function computeHomeSlot(player: MatchPlayer, slotIndex: number, ball: Ball): Vec2 {
  const slot = FORMATION[slotIndex];
  const ballDepthFrac =
    player.team === "home" ? ball.pos.x / PITCH_WIDTH : 1 - ball.pos.x / PITCH_WIDTH;
  const ballLaneFrac = ball.pos.y / PITCH_HEIGHT;

  const depth = slot.depth + (ballDepthFrac - slot.depth) * slot.depthDrift;
  const lane = slot.lane + (ballLaneFrac - slot.lane) * slot.laneDrift;

  return {
    x: depthToWorldX(player.team, Math.min(0.97, Math.max(0.03, depth))),
    y: Math.min(0.96, Math.max(0.04, lane)) * PITCH_HEIGHT,
  };
}

/** Steers a dribbling carrier toward goal while nudging away from the nearest opponent. */
export function computeDribbleTarget(player: MatchPlayer, opponents: MatchPlayer[]): Vec2 {
  const goalX = player.team === "home" ? PITCH_WIDTH : 0;
  const goalTarget: Vec2 = { x: goalX, y: PITCH_HEIGHT / 2 };
  const towardGoal = normalize(sub(goalTarget, player.pos));

  let nearest: MatchPlayer | null = null;
  let nearestDist = Infinity;
  for (const opp of opponents) {
    const d = distance(player.pos, opp.pos);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = opp;
    }
  }

  let repulsion: Vec2 = { x: 0, y: 0 };
  if (nearest && nearestDist < 6) {
    const away = normalize(sub(player.pos, nearest.pos));
    repulsion = scale(away, (6 - nearestDist) / 6);
  }

  // When repulsion nearly cancels the goal direction (an opponent standing square in the
  // lane), normalize() of the combined vector degenerates toward zero; deflect perpendicular
  // instead of letting the carrier freeze in place.
  const combined = add(towardGoal, scale(repulsion, 1.4));
  const steer =
    length(combined) > 0.05 ? normalize(combined) : { x: -towardGoal.y, y: towardGoal.x };
  return add(player.pos, scale(steer, 6));
}

/** Seeks toward moveTarget with a simple acceleration cap, then integrates position. */
export function stepMovement(player: MatchPlayer, dtSec: number, speedMultiplier = 1): void {
  const maxSpeed = PLAYER_BASE_SPEED * speedMultiplier;
  const toTarget = sub(player.moveTarget, player.pos);
  const dist = distance(player.pos, player.moveTarget);
  const desired = dist > 0.15 ? scale(normalize(toTarget), maxSpeed) : { x: 0, y: 0 };

  const velDelta = clampMagnitude(sub(desired, player.vel), PLAYER_ACCEL * dtSec);
  player.vel = add(player.vel, velDelta);
  player.vel = clampMagnitude(player.vel, maxSpeed);
  player.pos = add(player.pos, scale(player.vel, dtSec));
}
