import {
  GOAL_WIDTH,
  PASS_SPEED,
  PITCH_HEIGHT,
  PITCH_WIDTH,
  PRESS_RADIUS,
  SHOT_SPEED,
} from "../constants";
import type { MatchPlayer, MatchState, Vec2 } from "../types";
import { add, distance, normalize, scale, sub } from "../vec";
import { decideOnBallAction, type OnBallAction } from "./decisions";
import { computeDribbleTarget, computeHomeSlot } from "./movement";

/** Random point inside the goal mouth, widening with the shooter's inaccuracy (1 - skill). */
function shotTarget(player: MatchPlayer): Vec2 {
  const goalX = player.team === "home" ? PITCH_WIDTH : 0;
  const spread = GOAL_WIDTH + (1 - player.skill) * GOAL_WIDTH * 1.5;
  const y = PITCH_HEIGHT / 2 + (Math.random() - 0.5) * spread;
  return { x: goalX, y };
}

function executeOnBallAction(player: MatchPlayer, action: OnBallAction, state: MatchState): void {
  if (action.kind === "dribble") {
    const opponents = state.players.filter((p) => p.team !== player.team);
    player.moveTarget = computeDribbleTarget(player, opponents);
    return;
  }

  const { ball } = state;
  player.hasBall = false;
  ball.possessedBy = null;
  ball.lastTouchedByTeam = player.team;

  if (action.kind === "shoot") {
    const target = shotTarget(player);
    ball.vel = scale(normalize(sub(target, player.pos)), SHOT_SPEED);
    return;
  }

  const errorRadius = 3 * (1 - player.skill);
  const wobble = scale({ x: Math.random() - 0.5, y: Math.random() - 0.5 }, errorRadius);
  const target = add(action.target.pos, wobble);
  ball.vel = scale(normalize(sub(target, player.pos)), PASS_SPEED);
}

/** Closest player (either team) to a loose ball, or null if the ball is held. Forcing this player
 * into PRESS regardless of PRESS_RADIUS guarantees someone always closes in on a stray ball — the
 * home-slot formation is otherwise a stable equilibrium that can leave a ball sitting forever in a
 * gap nobody's individual press radius reaches. */
export function findNearestToLooseBall(state: MatchState): string | null {
  const { ball } = state;
  if (ball.possessedBy) return null;

  let nearestId: string | null = null;
  let nearestDist = Infinity;
  for (const p of state.players) {
    const d = distance(p.pos, ball.pos);
    if (d < nearestDist) {
      nearestDist = d;
      nearestId = p.id;
    }
  }
  return nearestId;
}

/** Per-player decision tick (~300ms cadence, driven by MatchSim) for the 12 non-GK players. */
export function updateOutfieldPlayer(
  player: MatchPlayer,
  state: MatchState,
  nearestToLooseBallId: string | null,
): void {
  const { ball } = state;

  if (player.hasBall) {
    const teammates = state.players.filter((p) => p.team === player.team && p.id !== player.id);
    const opponents = state.players.filter((p) => p.team !== player.team);
    const action = decideOnBallAction(player, teammates, opponents);
    executeOnBallAction(player, action, state);
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

  if (player.id === nearestToLooseBallId || distance(player.pos, ball.pos) < PRESS_RADIUS) {
    player.aiState = "PRESS";
    player.moveTarget = { ...ball.pos };
    return;
  }

  player.aiState = "HOLD_SHAPE";
  player.moveTarget = computeHomeSlot(player, player.slotIndex, ball);
}
