import {
  AI_DECISION_INTERVAL_MS,
  FORMATION,
  GK_DIVE_SPEED_MULT,
  GOAL_Y_MAX,
  GOAL_Y_MIN,
  PITCH_HEIGHT,
  PITCH_WIDTH,
} from "../constants";
import { createMatchClock, isPlayPaused, stepClock } from "../loop/Clock";
import type { GoalkeeperPlayer, MatchPlayer, MatchState, Team } from "../types";
import { resolvePickups, stepBallPhysics } from "./ballPhysics";
import { resolveContest } from "./contest";
import { resolveDuels } from "./duel";
import {
  distributeFromGoalkeeper,
  isGoalkeeperDiving,
  resolveGoalkeeperSave,
  updateGoalkeeper,
} from "./goalkeeper";
import { applyBallBoundaryEvent, resetForHalfStart } from "./matchRules";
import { stepMovement } from "./movement";
import { findNearestPerTeam, resolveWindups, updateOutfieldPlayer } from "./PlayerAI";

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
    stunnedUntilMs: 0,
    runCommitUntilMs: 0,
    kickKind: null,
    kickReleaseAtMs: 0,
    kickTarget: null,
    skill: 0.55 + Math.random() * 0.3,
    hasBall: false,
    shakeUntilMs: 0,
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

  get nowMs(): number {
    return this.simMs;
  }

  constructor() {
    this.state = {
      clock: createMatchClock(),
      score: { home: 0, away: 0 },
      players: buildRoster(),
      ball: {
        pos: { x: PITCH_WIDTH / 2, y: PITCH_HEIGHT / 2 },
        vel: { x: 0, y: 0 },
        z: 0,
        vz: 0,
        possessedBy: null,
        inPlay: true,
        lastTouchedByTeam: null,
        pickupBlockedFor: null,
        pickupBlockedUntilMs: 0,
        lastDuelAtMs: 0,
        freezeUntilMs: 0,
        contest: null,
        shot: null,
        gkHoldUntilMs: 0,
      },
      events: [],
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
      const nearestPerTeam = findNearestPerTeam(this.state);
      for (const player of this.state.players) {
        // A stunned (just-dispossessed) player makes no decisions until they recover.
        if (nowMs < player.stunnedUntilMs) continue;
        if (player.role !== "GK") updateOutfieldPlayer(player, this.state, nearestPerTeam, nowMs);
      }
    }

    for (const player of this.state.players) {
      if (player.role === "GK") {
        if (nowMs < player.stunnedUntilMs) continue;
        const gk = player as GoalkeeperPlayer;
        const teammates = this.state.players.filter((p) => p.team === gk.team && p.id !== gk.id);
        distributeFromGoalkeeper(gk, this.state, nowMs);
        updateGoalkeeper(gk, this.state.ball, teammates, nowMs);
      }
    }

    const dtSec = dtMs / 1000;
    for (const player of this.state.players) {
      // Full freeze while stunned takes precedence over the item-daze slow; a diving
      // keeper gets a speed boost so it can reach the corners.
      let speedMultiplier =
        nowMs < player.stunnedUntilMs ? 0 : nowMs < player.dazedUntilMs ? 0.35 : 1;
      if (
        player.role === "GK" &&
        isGoalkeeperDiving(player as GoalkeeperPlayer, this.state.ball, nowMs)
      ) {
        speedMultiplier = GK_DIVE_SPEED_MULT;
      }
      stepMovement(player, dtSec, speedMultiplier);
    }

    // Fire any pre-kick wind-ups whose timer elapsed before the ball integrates, so a
    // released pass/shot moves the same frame.
    resolveWindups(this.state, nowMs);

    const event = stepBallPhysics(this.state, dtSec, nowMs);
    resolveDuels(this.state, nowMs);
    // Contest before pickup: a tussle freezes the ball, so resolvePickups no-ops while
    // it's active and the winner is decided by the skill-weighted roll instead.
    resolveContest(this.state, nowMs);
    // A keeper save claims the ball before pickup, and pre-empts a goal on the same tick.
    const saved = resolveGoalkeeperSave(this.state, nowMs);
    resolvePickups(this.state, nowMs);
    if (!saved) applyBallBoundaryEvent(this.state, event, nowMs);
  }
}
