import { PASS_SPEED } from "../constants";
import type { Ball, GoalkeeperPlayer, MatchPlayer, MatchState } from "../types";
import { distance, normalize, scale, sub } from "../vec";
import { attackDirectionX } from "./movement";

const ENGAGE_RANGE = 18;
const COVER_RADIUS = 9;
const MAX_COME_OFF = 8;

/** Scripted GK behavior: clamp to the goal line on ball-y, step off the line only
 * when the ball is close and no defender is between it and goal. */
export function updateGoalkeeper(
  gk: GoalkeeperPlayer,
  ball: Ball,
  teammates: MatchPlayer[],
  nowMs: number,
): void {
  // Blinded by a flare/scarf: freeze on the spot, stop tracking the ball.
  if (nowMs < gk.blindedUntilMs) {
    gk.moveTarget = { ...gk.pos };
    return;
  }
  const lineX = gk.lineSegment.a.x;
  const yMin = Math.min(gk.lineSegment.a.y, gk.lineSegment.b.y);
  const yMax = Math.max(gk.lineSegment.a.y, gk.lineSegment.b.y);
  const targetY = Math.max(yMin, Math.min(yMax, ball.pos.y));

  const goalCenter = { x: lineX, y: (yMin + yMax) / 2 };
  const ballDist = distance(ball.pos, goalCenter);
  const undefended = !teammates.some((t) => distance(t.pos, ball.pos) < COVER_RADIUS);

  let targetX = lineX;
  if (ballDist < ENGAGE_RANGE && undefended) {
    const comeOff = Math.max(0, 1 - ballDist / ENGAGE_RANGE) * MAX_COME_OFF;
    targetX = lineX + attackDirectionX(gk.team) * comeOff;
  }

  gk.moveTarget = { x: targetX, y: targetY };
}

/** Scripted GK on-ball action: no shoot/pass/dribble scoring, just an immediate upfield clearance. */
export function maybeClearBall(gk: GoalkeeperPlayer, state: MatchState): void {
  if (!gk.hasBall) return;
  const { ball } = state;
  const forward = state.players.find((p) => p.team === gk.team && p.role === "FWD");
  const targetPos = forward
    ? forward.pos
    : { x: gk.pos.x + attackDirectionX(gk.team) * 40, y: gk.pos.y };

  gk.hasBall = false;
  ball.possessedBy = null;
  ball.lastTouchedByTeam = gk.team;
  ball.vel = scale(normalize(sub(targetPos, gk.pos)), PASS_SPEED);
}
