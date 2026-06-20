import {
  AI_DECISION_INTERVAL_MS,
  FORMATION,
  GOAL_Y_MAX,
  GOAL_Y_MIN,
  PITCH_HEIGHT,
  PITCH_WIDTH,
} from "../constants";
import { createMatchClock, isPlayPaused, stepClock } from "../loop/Clock";
import type { GoalkeeperPlayer, MatchPlayer, MatchState, Team } from "../types";
import { resolvePickups, stepBallPhysics } from "./ballPhysics";
import { resolveDuels } from "./duel";
import { maybeClearBall, updateGoalkeeper } from "./goalkeeper";
import { applyBallBoundaryEvent, resetForHalfStart } from "./matchRules";
import { stepMovement } from "./movement";
import { findNearestToLooseBall, updateOutfieldPlayer } from "./PlayerAI";

let nextPlayerId = 0;

function createPlayer(team: Team, slotIndex: number): MatchPlayer {
  const slot = FORMATION[slotIndex];
  return {
    id: `${team}-${nextPlayerId++}`,
    team,
    role: slot.role,
    slotIndex,
    pos: { x: 0, y: 0 },
    vel: { x: 0, y: 0 },
    moveTarget: { x: 0, y: 0 },
    aiState: "HOLD_SHAPE",
    dazedUntilMs: 0,
    skill: 0.55 + Math.random() * 0.3,
    hasBall: false,
  };
}

function createGoalkeeper(team: Team, slotIndex: number): GoalkeeperPlayer {
  const lineX = team === "home" ? 0 : PITCH_WIDTH;
  return {
    ...createPlayer(team, slotIndex),
    role: "GK",
    blindedUntilMs: 0,
    lineSegment: { a: { x: lineX, y: GOAL_Y_MIN }, b: { x: lineX, y: GOAL_Y_MAX } },
  };
}

function buildRoster(): MatchPlayer[] {
  const players: MatchPlayer[] = [];
  for (const team of ["home", "away"] as const) {
    FORMATION.forEach((_slot, slotIndex) => {
      players.push(
        slotIndex === 0 ? createGoalkeeper(team, slotIndex) : createPlayer(team, slotIndex),
      );
    });
  }
  return players;
}

/** Orchestrates the full 7v7 sim: owns players + ball, steps AI, physics, and match rules each tick. */
export class MatchSim {
  readonly state: MatchState;
  private simMs = 0;
  private aiAccumulatorMs = 0;

  constructor() {
    this.state = {
      clock: createMatchClock(),
      score: { home: 0, away: 0 },
      players: buildRoster(),
      ball: {
        pos: { x: PITCH_WIDTH / 2, y: PITCH_HEIGHT / 2 },
        vel: { x: 0, y: 0 },
        possessedBy: null,
        inPlay: true,
        lastTouchedByTeam: null,
        pickupBlockedFor: null,
        pickupBlockedUntilMs: 0,
        lastDuelAtMs: 0,
        freezeUntilMs: 0,
      },
    };
    resetForHalfStart(this.state, "home", this.simMs);
  }

  update(dtMs: number): void {
    this.simMs += dtMs;
    const nowMs = this.simMs;

    const phaseChanged = stepClock(this.state.clock, dtMs);
    if (phaseChanged && this.state.clock.phase === "SECOND_HALF") {
      resetForHalfStart(this.state, "away", nowMs);
    }

    if (isPlayPaused(this.state.clock)) return;
    if (nowMs < this.state.ball.freezeUntilMs) return;

    this.aiAccumulatorMs += dtMs;
    if (this.aiAccumulatorMs >= AI_DECISION_INTERVAL_MS) {
      this.aiAccumulatorMs %= AI_DECISION_INTERVAL_MS;
      const nearestToLooseBallId = findNearestToLooseBall(this.state);
      for (const player of this.state.players) {
        if (player.role !== "GK") updateOutfieldPlayer(player, this.state, nearestToLooseBallId);
      }
    }

    for (const player of this.state.players) {
      if (player.role === "GK") {
        const gk = player as GoalkeeperPlayer;
        const teammates = this.state.players.filter((p) => p.team === gk.team && p.id !== gk.id);
        maybeClearBall(gk, this.state);
        updateGoalkeeper(gk, this.state.ball, teammates);
      }
    }

    const dtSec = dtMs / 1000;
    for (const player of this.state.players) {
      const speedMultiplier = nowMs < player.dazedUntilMs ? 0.35 : 1;
      stepMovement(player, dtSec, speedMultiplier);
    }

    const event = stepBallPhysics(this.state, dtSec, nowMs);
    resolveDuels(this.state, nowMs);
    resolvePickups(this.state, nowMs);
    applyBallBoundaryEvent(this.state, event, nowMs);
  }
}
