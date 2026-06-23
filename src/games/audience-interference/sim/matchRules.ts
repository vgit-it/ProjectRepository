import {
  DEAD_BALL_FREEZE_MS,
  FORMATION,
  GOAL_CELEBRATION_FREEZE_MS,
  PITCH_HEIGHT,
  PITCH_WIDTH,
} from "../constants";
import type { MatchPlayer, MatchState, Team } from "../types";
import { distance } from "../vec";
import type { BallBoundaryEvent } from "./ballPhysics";
import { computeHomeSlot } from "./movement";

const KICKOFF_SLOT_INDEX = FORMATION.findIndex((s) => s.role === "MID" && s.lane === 0.5);

function otherTeam(team: Team): Team {
  return team === "home" ? "away" : "home";
}

/** Snaps every player to their formation slot around a centered ball and hands kickoff to one team. */
function resetForKickoff(
  state: MatchState,
  kickoffTeam: Team,
  nowMs: number,
  freezeMs: number,
): void {
  const { ball } = state;
  ball.pos = { x: PITCH_WIDTH / 2, y: PITCH_HEIGHT / 2 };
  ball.vel = { x: 0, y: 0 };
  ball.z = 0;
  ball.vz = 0;
  ball.inPlay = true;
  ball.pickupBlockedFor = null;
  ball.pickupBlockedUntilMs = 0;
  ball.lastDuelAtMs = 0;
  ball.freezeUntilMs = nowMs + freezeMs;
  ball.contest = null;

  for (const player of state.players) {
    player.pos = computeHomeSlot(player, player.slotIndex, ball);
    player.vel = { x: 0, y: 0 };
    player.hasBall = false;
    player.aiState = "HOLD_SHAPE";
    player.stunnedUntilMs = 0;
    player.runCommitUntilMs = 0;
    player.kickKind = null;
    player.kickReleaseAtMs = 0;
    player.kickTarget = null;
  }

  const carrier = state.players.find(
    (p) => p.team === kickoffTeam && p.slotIndex === KICKOFF_SLOT_INDEX,
  );
  if (carrier) {
    carrier.hasBall = true;
    ball.possessedBy = carrier.id;
    ball.lastTouchedByTeam = kickoffTeam;
  } else {
    ball.possessedBy = null;
    ball.lastTouchedByTeam = null;
  }
}

/** Ball left the pitch outside the goal mouth: brief freeze, then hand it to the nearest opponent. */
function awardOutOfBounds(state: MatchState, nowMs: number): void {
  const { ball } = state;
  const awardTeam: Team | null = ball.lastTouchedByTeam ? otherTeam(ball.lastTouchedByTeam) : null;

  let nearest: MatchPlayer | null = null;
  let nearestDist = Infinity;
  for (const p of state.players) {
    if (awardTeam && p.team !== awardTeam) continue;
    const d = distance(p.pos, ball.pos);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = p;
    }
  }

  ball.vel = { x: 0, y: 0 };
  ball.z = 0;
  ball.vz = 0;
  ball.pickupBlockedFor = null;
  ball.pickupBlockedUntilMs = 0;
  ball.freezeUntilMs = nowMs + DEAD_BALL_FREEZE_MS;
  ball.contest = null;

  if (nearest) {
    nearest.hasBall = true;
    ball.possessedBy = nearest.id;
    ball.lastTouchedByTeam = nearest.team;
  } else {
    ball.possessedBy = null;
  }
}

/** Turns a raw boundary-crossing event from ballPhysics into score/freeze/possession consequences. */
export function applyBallBoundaryEvent(
  state: MatchState,
  event: BallBoundaryEvent,
  nowMs: number,
): void {
  if (!event) return;

  if (event === "goal-home" || event === "goal-away") {
    const scoringTeam: Team = event === "goal-home" ? "home" : "away";
    state.score[scoringTeam] += 1;
    resetForKickoff(state, otherTeam(scoringTeam), nowMs, GOAL_CELEBRATION_FREEZE_MS);
    return;
  }

  awardOutOfBounds(state, nowMs);
}

/** Initial lineup for the start of a half: identical to a kickoff reset, home always restarts play. */
export function resetForHalfStart(state: MatchState, kickoffTeam: Team, nowMs: number): void {
  resetForKickoff(state, kickoffTeam, nowMs, 0);
}
