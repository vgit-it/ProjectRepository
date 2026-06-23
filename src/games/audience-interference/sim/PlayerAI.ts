import {
  BALL_GRAVITY,
  CARRIER_APPROACH_M,
  CARRIER_DECISION_MS,
  CARRIER_PANIC_M,
  FINAL_THIRD_FRAC,
  GOAL_LANE_WIDTH,
  GOAL_WIDTH,
  GOAL_Y_MAX,
  GOAL_Y_MIN,
  IMPACT_SHAKE_MS,
  KICK_WINDUP_MS,
  LOFT_MIN_DIST,
  PASS_SPEED,
  PITCH_HEIGHT,
  PITCH_WIDTH,
  SHOT_SPEED,
} from "../constants";
import type { MatchPlayer, MatchState, Team, Vec2 } from "../types";
import { add, distance, length, normalize, scale, sub } from "../vec";
import { bestPassTarget, countBlockers, PASS_LANE_WIDTH, scoreShoot } from "./decisions";
import { attackDirectionX, computeDribbleTarget, computeHomeSlot } from "./movement";

/** A point inside the goal mouth on the half the keeper has vacated, nudged by the
 * shooter's inaccuracy (1 - skill) and clamped just inside the posts. */
function shotTarget(player: MatchPlayer, opponents: MatchPlayer[]): Vec2 {
  const goalX = player.team === "home" ? PITCH_WIDTH : 0;
  const margin = 0.8;
  const gk = opponents.find((o) => o.role === "GK");
  let y: number;
  if (gk) {
    // Aim at the side opposite where the keeper is standing.
    y = gk.pos.y > PITCH_HEIGHT / 2 ? GOAL_Y_MIN + margin : GOAL_Y_MAX - margin;
  } else {
    y = PITCH_HEIGHT / 2;
  }
  y += (Math.random() - 0.5) * (1 - player.skill) * GOAL_WIDTH;
  y = Math.max(GOAL_Y_MIN + margin, Math.min(GOAL_Y_MAX - margin, y));
  return { x: goalX, y };
}

/** Carrier's progress toward the opponent goal, in meters (0 = own goal line). */
function carrierDepth(player: MatchPlayer): number {
  return player.team === "home" ? player.pos.x : PITCH_WIDTH - player.pos.x;
}

function nearestOpponentDist(player: MatchPlayer, opponents: MatchPlayer[]): number {
  let nearest = Infinity;
  for (const o of opponents) nearest = Math.min(nearest, distance(player.pos, o.pos));
  return nearest;
}

type CarrierDecision =
  | { kind: "run" }
  | { kind: "pass"; target: Vec2 }
  | { kind: "shoot"; target: Vec2 };

/** Chooses run / pass / shoot for the carrier with randomness, so a clearer option only
 * gets better odds rather than always winning. Clear space favors running at goal;
 * pressure favors passing; the final third unlocks shooting. */
function chooseCarrierDecision(
  player: MatchPlayer,
  teammates: MatchPlayer[],
  opponents: MatchPlayer[],
): CarrierDecision {
  const goal = { x: player.team === "home" ? PITCH_WIDTH : 0, y: PITCH_HEIGHT / 2 };
  const approaching = nearestOpponentDist(player, opponents) < CARRIER_APPROACH_M;
  const outfield = opponents.filter((o) => o.role !== "GK");
  const laneClear = countBlockers(player.pos, goal, outfield, GOAL_LANE_WIDTH) === 0;
  const inFinalThird = carrierDepth(player) > FINAL_THIRD_FRAC * PITCH_WIDTH;

  // In the final third, maybe shoot — weighted by shot quality, never a certainty.
  if (inFinalThird) {
    const shootProb = Math.max(0, Math.min(0.9, scoreShoot(player, opponents)));
    if (Math.random() < shootProb) {
      return { kind: "shoot", target: shotTarget(player, opponents) };
    }
  }

  // Run vs pass: open space leans toward running, pressure leans toward passing.
  let passProb: number;
  if (approaching && !laneClear) passProb = 0.85;
  else if (approaching) passProb = 0.6;
  else if (laneClear) passProb = 0.2;
  else passProb = 0.7;

  const mate = bestPassTarget(player, teammates, opponents);
  if (mate && Math.random() < passProb) {
    const errorRadius = 3 * (1 - player.skill);
    const wobble = scale({ x: Math.random() - 0.5, y: Math.random() - 0.5 }, errorRadius);
    return { kind: "pass", target: add(mate.pos, wobble) };
  }
  return { kind: "run" };
}

/** Releases the ball for a queued pass/shot. Passes loft over a crowded/long lane. */
function executeKick(player: MatchPlayer, state: MatchState, nowMs: number): void {
  const { ball } = state;
  const target = player.kickTarget;
  const kind = player.kickKind;
  if (!target || !kind) return;

  // Kicking is an impact moment — give the kicker a brief sprite jolt.
  player.shakeUntilMs = nowMs + IMPACT_SHAKE_MS;

  player.hasBall = false;
  ball.possessedBy = null;
  ball.lastTouchedByTeam = player.team;
  // A kick always launches from the ground; loft (vz) is set per-pass below.
  ball.z = 0;
  ball.vz = 0;

  const toTarget = sub(target, player.pos);
  const dist = length(toTarget);
  const dir = dist > 0.001 ? normalize(toTarget) : { x: attackDirectionX(player.team), y: 0 };

  if (kind === "shoot") {
    ball.vel = scale(dir, SHOT_SPEED);
    // Flag the shot so the defending keeper can react (and emit juice).
    ball.shot = { team: player.team, targetY: target.y, atMs: nowMs, attempted: false };
    state.events.push({ kind: "shot", pos: { ...player.pos } });
    return;
  }

  ball.vel = scale(dir, PASS_SPEED);
  const opponents = state.players.filter((p) => p.team !== player.team);
  const laneBlocked = countBlockers(player.pos, target, opponents, PASS_LANE_WIDTH) > 0;
  if (laneBlocked || dist >= LOFT_MIN_DIST) {
    // Pick a vz whose up-then-down arc lands as the ball reaches the receiver.
    ball.vz = 0.5 * BALL_GRAVITY * (dist / PASS_SPEED);
  }
}

/** Carrier behavior: hold a committed run for a few seconds, or wind up a pass/shot.
 * The decision is made at most once per CARRIER_DECISION_MS (a committed run is only
 * cut short if an opponent gets dangerously close). */
function updateCarrier(player: MatchPlayer, state: MatchState, nowMs: number): void {
  // A kick is already queued: stay put on the idle frame until resolveWindups fires it.
  if (player.kickKind) return;

  const opponents = state.players.filter((p) => p.team !== player.team);

  // Stick with the committed run unless an opponent closes into panic range.
  if (nowMs < player.runCommitUntilMs) {
    if (nearestOpponentDist(player, opponents) >= CARRIER_PANIC_M) {
      player.moveTarget = computeDribbleTarget(player, opponents);
      return;
    }
  }

  const teammates = state.players.filter((p) => p.team === player.team && p.id !== player.id);
  const decision = chooseCarrierDecision(player, teammates, opponents);

  if (decision.kind === "run") {
    player.runCommitUntilMs = nowMs + CARRIER_DECISION_MS;
    player.moveTarget = computeDribbleTarget(player, opponents);
    return;
  }

  // Pass or shoot: begin the pre-kick wind-up — freeze on the idle frame, then fire.
  player.kickKind = decision.kind;
  player.kickTarget = decision.target;
  player.kickReleaseAtMs = nowMs + KICK_WINDUP_MS;
  player.stunnedUntilMs = player.kickReleaseAtMs;
  player.vel = { x: 0, y: 0 };
  player.runCommitUntilMs = 0;
}

/** Fires any queued kicks whose wind-up has elapsed; cancels a wind-up if the carrier
 * was robbed mid-freeze (the kick simply never happens). Runs every frame, independent
 * of the AI decision cadence, so releases are frame-accurate. */
export function resolveWindups(state: MatchState, nowMs: number): void {
  for (const player of state.players) {
    if (!player.kickKind) continue;
    if (state.ball.possessedBy !== player.id) {
      // Interrupted: lost the ball during the wind-up.
      player.kickKind = null;
      player.kickTarget = null;
      continue;
    }
    if (nowMs >= player.kickReleaseAtMs) {
      executeKick(player, state, nowMs);
      player.kickKind = null;
      player.kickTarget = null;
    }
  }
}

/** Per-team nearest outfield (non-GK) player to the ball, regardless of possession.
 * Exactly one player per team chases the ball; everyone else holds shape, so the pitch
 * stays spread out and a loose ball draws just one challenger from each side (which sets
 * up the one-v-one tussle in contest.ts). Computed even while the ball is held so the
 * defending team always has a designated presser closing on the carrier. */
export function findNearestPerTeam(state: MatchState): Record<Team, string | null> {
  const { ball } = state;
  const nearest: Record<Team, string | null> = { home: null, away: null };
  const nearestDist: Record<Team, number> = { home: Infinity, away: Infinity };
  for (const p of state.players) {
    if (p.role === "GK") continue;
    const d = distance(p.pos, ball.pos);
    if (d < nearestDist[p.team]) {
      nearestDist[p.team] = d;
      nearest[p.team] = p.id;
    }
  }
  return nearest;
}

/** Per-player decision tick (~300ms cadence, driven by MatchSim) for the 12 non-GK players. */
export function updateOutfieldPlayer(
  player: MatchPlayer,
  state: MatchState,
  nearestPerTeam: Record<Team, string | null>,
  nowMs: number,
): void {
  const { ball } = state;

  // Post-save restart: while the keeper holds the ball, everyone trots back to shape.
  if (nowMs < ball.gkHoldUntilMs) {
    player.aiState = "HOLD_SHAPE";
    player.moveTarget = computeHomeSlot(player, player.slotIndex, ball);
    return;
  }

  if (player.hasBall) {
    updateCarrier(player, state, nowMs);
    return;
  }

  if (ball.possessedBy) {
    const carrier = state.players.find((p) => p.id === ball.possessedBy);
    if (carrier && carrier.team === player.team) {
      player.aiState = "SUPPORT";
      player.moveTarget = computeHomeSlot(player, player.slotIndex, ball);
      return;
    }
  }

  // Only this team's single closest player breaks toward the ball; the rest hold shape.
  if (player.id === nearestPerTeam[player.team]) {
    player.aiState = "PRESS";
    player.moveTarget = { ...ball.pos };
    return;
  }

  player.aiState = "HOLD_SHAPE";
  player.moveTarget = computeHomeSlot(player, player.slotIndex, ball);
}
