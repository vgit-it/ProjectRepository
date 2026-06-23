import {
  DUEL_COOLDOWN_MS,
  DUEL_JITTER,
  DUEL_RADIUS,
  PICKUP_BLOCK_MS,
  STEAL_STUN_MS,
} from "../constants";
import type { MatchPlayer, MatchState } from "../types";
import { distance, normalize, scale } from "../vec";

const POP_OFF_MIN_SPEED = 1.5;
const POP_OFF_MAX_SPEED = 3;

/** Resolves a single tackle attempt against the current ball carrier, if any opponent is close enough. */
export function resolveDuels(state: MatchState, nowMs: number): void {
  const { ball } = state;
  if (!ball.possessedBy) return;
  if (nowMs - ball.lastDuelAtMs < DUEL_COOLDOWN_MS) return;

  const carrier = state.players.find((p) => p.id === ball.possessedBy);
  if (!carrier) return;

  let challenger: MatchPlayer | null = null;
  let challengerDist = Infinity;
  for (const opp of state.players) {
    if (opp.team === carrier.team) continue;
    const d = distance(opp.pos, carrier.pos);
    if (d < DUEL_RADIUS && d < challengerDist) {
      challengerDist = d;
      challenger = opp;
    }
  }
  if (!challenger) return;

  ball.lastDuelAtMs = nowMs;

  const carrierRoll = carrier.skill + (Math.random() - 0.5) * DUEL_JITTER;
  const challengerRoll = challenger.skill + (Math.random() - 0.5) * DUEL_JITTER;
  if (challengerRoll <= carrierRoll) return;

  carrier.hasBall = false;
  ball.possessedBy = null;
  ball.pickupBlockedFor = carrier.id;
  ball.pickupBlockedUntilMs = nowMs + PICKUP_BLOCK_MS;

  // The dispossessed player is briefly frozen (no movement, no decisions) — arcade
  // "you got robbed" beat. Hard-stop their momentum and cancel any queued kick/run.
  carrier.stunnedUntilMs = nowMs + STEAL_STUN_MS;
  carrier.vel = { x: 0, y: 0 };
  carrier.kickKind = null;
  carrier.kickTarget = null;
  carrier.runCommitUntilMs = 0;

  const popOffDir = normalize({ x: Math.random() - 0.5, y: Math.random() - 0.5 });
  const popOffSpeed = POP_OFF_MIN_SPEED + Math.random() * (POP_OFF_MAX_SPEED - POP_OFF_MIN_SPEED);
  ball.vel = scale(popOffDir, popOffSpeed);
}
