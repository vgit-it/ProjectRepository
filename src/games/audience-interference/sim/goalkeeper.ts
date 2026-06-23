import {
  BALL_GRAVITY,
  GK_CATCH_PROB,
  GK_CATCH_RADIUS,
  GK_HOLD_MS,
  GK_REACTION_MS,
  LOFT_MIN_DIST,
  PASS_SPEED,
  PITCH_HEIGHT,
  SHOT_ACTIVE_MAX_MS,
} from "../constants";
import type { Ball, GoalkeeperPlayer, MatchPlayer, MatchState } from "../types";
import { distance, length, normalize, scale, sub } from "../vec";
import { bestPassTarget } from "./decisions";
import { attackDirectionX, computeHomeSlot } from "./movement";

const ENGAGE_RANGE = 18;
const COVER_RADIUS = 9;
const MAX_COME_OFF = 8;
const PARRY_SPEED = 8;

/** True while the keeper is actively diving for a live shot at its goal (reacted, not
 * blinded, not frozen). Shared by movement (dive speed) and updateGoalkeeper (target). */
export function isGoalkeeperDiving(gk: GoalkeeperPlayer, ball: Ball, nowMs: number): boolean {
  const shot = ball.shot;
  return (
    !!shot &&
    shot.team !== gk.team &&
    nowMs >= shot.atMs + GK_REACTION_MS &&
    nowMs >= gk.blindedUntilMs &&
    nowMs >= gk.stunnedUntilMs
  );
}

/** Scripted GK behavior: dive to the shot's target on a live shot; otherwise clamp to
 * the goal line on ball-y, stepping off only when the ball is close and undefended. */
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

  // React to a live shot: slide along the line toward where it's aimed.
  if (isGoalkeeperDiving(gk, ball, nowMs) && ball.shot) {
    gk.moveTarget = { x: lineX, y: Math.max(yMin, Math.min(yMax, ball.shot.targetY)) };
    return;
  }

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

/**
 * Resolves a save attempt against a live shot. A reacting keeper gets a single random
 * roll once the ball is within catch range: success catches the ball (and triggers the
 * post-save restart), failure parries it back out as a rebound. Returns true on a catch
 * so the caller can suppress a goal scored on the same tick.
 */
export function resolveGoalkeeperSave(state: MatchState, nowMs: number): boolean {
  const { ball } = state;
  const shot = ball.shot;
  if (!shot) return false;

  // No longer a live save situation: drop the shot tracking.
  if (ball.possessedBy || !ball.inPlay || nowMs - shot.atMs > SHOT_ACTIVE_MAX_MS) {
    ball.shot = null;
    return false;
  }

  const defendingTeam = shot.team === "home" ? "away" : "home";
  const gk = state.players.find((p) => p.role === "GK" && p.team === defendingTeam) as
    | GoalkeeperPlayer
    | undefined;
  if (!gk || !isGoalkeeperDiving(gk, ball, nowMs)) return false;
  if (shot.attempted || distance(gk.pos, ball.pos) > GK_CATCH_RADIUS) return false;

  // One save roll — reaching the ball doesn't guarantee a clean catch.
  shot.attempted = true;
  if (Math.random() >= GK_CATCH_PROB) {
    // Fumble: parry the ball back upfield with a random vertical wobble (a rebound).
    const dir = normalize({ x: attackDirectionX(gk.team), y: (Math.random() - 0.5) * 1.2 });
    ball.vel = scale(dir, PARRY_SPEED);
    ball.z = 0;
    ball.vz = 0;
    return false;
  }

  // Clean catch: keeper claims it, everyone resets, the keeper holds before distributing.
  gk.hasBall = true;
  ball.possessedBy = gk.id;
  ball.lastTouchedByTeam = gk.team;
  ball.vel = { x: 0, y: 0 };
  ball.z = 0;
  ball.vz = 0;
  ball.shot = null;
  ball.gkHoldUntilMs = nowMs + GK_HOLD_MS;
  for (const p of state.players) {
    p.moveTarget = computeHomeSlot(p, p.slotIndex, ball);
  }
  state.events.push({ kind: "save", pos: { ...gk.pos } });
  return true;
}

/** Forward depth (m) of a player toward the opponent goal — used to find an outlet. */
function forwardDepth(p: MatchPlayer, gk: GoalkeeperPlayer): number {
  const dir = attackDirectionX(gk.team);
  return dir > 0 ? p.pos.x : -p.pos.x;
}

/** GK on-ball action: after the post-catch hold elapses, distribute by either passing
 * to a sensible teammate or lobbing long downfield. Also fires for any other GK touch
 * (no hold pending → distributes immediately). */
export function distributeFromGoalkeeper(gk: GoalkeeperPlayer, state: MatchState, nowMs: number): void {
  if (!gk.hasBall) return;
  const { ball } = state;
  if (nowMs < ball.gkHoldUntilMs) return; // still holding after a save

  const teammates = state.players.filter(
    (p) => p.team === gk.team && p.id !== gk.id && p.role !== "GK",
  );
  const opponents = state.players.filter((p) => p.team !== gk.team);

  gk.hasBall = false;
  ball.possessedBy = null;
  ball.lastTouchedByTeam = gk.team;
  ball.gkHoldUntilMs = 0;
  ball.z = 0;
  ball.vz = 0;

  // ~40% lob long to the furthest-forward teammate; otherwise a measured pass.
  const lob = Math.random() < 0.4;
  let targetPos;
  if (lob) {
    const forward = teammates.reduce<MatchPlayer | null>(
      (best, p) => (!best || forwardDepth(p, gk) > forwardDepth(best, gk) ? p : best),
      null,
    );
    targetPos = forward
      ? forward.pos
      : { x: gk.pos.x + attackDirectionX(gk.team) * 50, y: PITCH_HEIGHT / 2 };
  } else {
    const mate = bestPassTarget(gk, teammates, opponents);
    targetPos = mate ? mate.pos : { x: gk.pos.x + attackDirectionX(gk.team) * 25, y: gk.pos.y };
  }

  const to = sub(targetPos, gk.pos);
  const dist = length(to);
  ball.vel = scale(normalize(to), PASS_SPEED);
  if (lob || dist >= LOFT_MIN_DIST) {
    ball.vz = 0.5 * BALL_GRAVITY * (dist / PASS_SPEED);
  }
}
