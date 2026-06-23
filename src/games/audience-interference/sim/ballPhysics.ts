import {
  BALL_BOUNDARY_DAMPING,
  BALL_DRAG_PER_SEC,
  BALL_GRAVITY,
  GOAL_Y_MAX,
  GOAL_Y_MIN,
  PICKUP_RADIUS,
  PITCH_HEIGHT,
  PITCH_WIDTH,
  PLAYER_RADIUS,
} from "../constants";
import type { Ball, MatchPlayer, MatchState } from "../types";
import { add, distance, normalize, scale } from "../vec";
import { attackDirectionX } from "./movement";

const DRIBBLE_OFFSET = PLAYER_RADIUS + 0.3;
/** Height (m) below which a falling ball is treated as back on the deck and collectable. */
const GROUND_PICKUP_HEIGHT = 0.6;

export type BallBoundaryEvent = "goal-home" | "goal-away" | "touchline" | "byline" | null;

function withinGoalMouth(y: number): boolean {
  return y >= GOAL_Y_MIN && y <= GOAL_Y_MAX;
}

function followCarrier(ball: Ball, carrier: MatchPlayer): void {
  const speed = Math.hypot(carrier.vel.x, carrier.vel.y);
  const dir = speed > 0.2 ? normalize(carrier.vel) : { x: attackDirectionX(carrier.team), y: 0 };
  ball.pos = add(carrier.pos, scale(dir, DRIBBLE_OFFSET));
  ball.vel = carrier.vel;
  // A dribbled ball stays on the deck.
  ball.z = 0;
  ball.vz = 0;
}

/** Integrates the loose ball, applies drag, and reflects/classifies boundary crossings. */
function integrateLoose(ball: Ball, dtSec: number): BallBoundaryEvent {
  ball.pos = add(ball.pos, scale(ball.vel, dtSec));
  ball.vel = scale(ball.vel, Math.exp(-BALL_DRAG_PER_SEC * dtSec));

  // Vertical arc for lofted balls; horizontal drag/bounce below is unchanged. Once the
  // ball lands it rolls out on the ground under the existing drag.
  if (ball.z > 0 || ball.vz !== 0) {
    ball.z += ball.vz * dtSec;
    ball.vz -= BALL_GRAVITY * dtSec;
    if (ball.z <= 0) {
      ball.z = 0;
      ball.vz = 0;
    }
  }

  if (ball.pos.x >= PITCH_WIDTH && withinGoalMouth(ball.pos.y)) return "goal-home";
  if (ball.pos.x <= 0 && withinGoalMouth(ball.pos.y)) return "goal-away";

  if (ball.pos.y < 0 || ball.pos.y > PITCH_HEIGHT) {
    ball.pos.y = Math.max(0, Math.min(PITCH_HEIGHT, ball.pos.y));
    ball.vel.y = -ball.vel.y * BALL_BOUNDARY_DAMPING;
    return "touchline";
  }
  if (ball.pos.x < 0 || ball.pos.x > PITCH_WIDTH) {
    ball.pos.x = Math.max(0, Math.min(PITCH_WIDTH, ball.pos.x));
    ball.vel.x = -ball.vel.x * BALL_BOUNDARY_DAMPING;
    return "byline";
  }
  return null;
}

/** Advances ball kinematics: follows the carrier while held, else free-flies with drag and wall bounce. */
export function stepBallPhysics(
  state: MatchState,
  dtSec: number,
  nowMs: number,
): BallBoundaryEvent {
  const { ball } = state;
  if (nowMs < ball.freezeUntilMs) return null;

  if (ball.possessedBy) {
    const carrier = state.players.find((p) => p.id === ball.possessedBy);
    if (carrier) followCarrier(ball, carrier);
    return null;
  }

  if (!ball.inPlay) return null;
  return integrateLoose(ball, dtSec);
}

/** Hands a loose, unfrozen ball to the nearest eligible player within pickup range. */
export function resolvePickups(state: MatchState, nowMs: number): void {
  const { ball } = state;
  if (ball.possessedBy || !ball.inPlay) return;
  if (nowMs < ball.freezeUntilMs) return;
  // A lofted ball flies over players' heads until it drops near the deck.
  if (ball.z > GROUND_PICKUP_HEIGHT) return;

  let nearest: MatchPlayer | null = null;
  let nearestDist = Infinity;
  for (const p of state.players) {
    if (ball.pickupBlockedFor === p.id && nowMs < ball.pickupBlockedUntilMs) continue;
    // A frozen player (just-beaten tussle loser / dispossessed carrier) can't acquire
    // the ball by any path — including snatching the loose ball that popped off next
    // to them. Mirrors the same guard in contest.ts and duel.ts.
    if (nowMs < p.stunnedUntilMs) continue;
    const d = distance(p.pos, ball.pos);
    if (d < PICKUP_RADIUS && d < nearestDist) {
      nearestDist = d;
      nearest = p;
    }
  }
  if (!nearest) return;

  nearest.hasBall = true;
  ball.possessedBy = nearest.id;
  ball.lastTouchedByTeam = nearest.team;
  ball.vel = { x: 0, y: 0 };
}
