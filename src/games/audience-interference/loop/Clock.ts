import { HALFTIME_BREAK_MS, HALF_LENGTH_MS } from "../constants";
import type { MatchClock } from "../types";

export function createMatchClock(): MatchClock {
  return {
    phase: "FIRST_HALF",
    elapsedMs: 0,
    halfLengthMs: HALF_LENGTH_MS,
    halftimeBreakMs: HALFTIME_BREAK_MS,
  };
}

/** Advances the clock and returns true the tick a phase transition happens. */
export function stepClock(clock: MatchClock, dtMs: number): boolean {
  if (clock.phase === "FULL_TIME") return false;

  clock.elapsedMs += dtMs;

  if (clock.phase === "HALFTIME" && clock.elapsedMs >= clock.halftimeBreakMs) {
    clock.phase = "SECOND_HALF";
    clock.elapsedMs = 0;
    return true;
  }
  if (clock.phase === "FIRST_HALF" && clock.elapsedMs >= clock.halfLengthMs) {
    clock.phase = "HALFTIME";
    clock.elapsedMs = 0;
    return true;
  }
  if (clock.phase === "SECOND_HALF" && clock.elapsedMs >= clock.halfLengthMs) {
    clock.phase = "FULL_TIME";
    clock.elapsedMs = 0;
    return true;
  }
  return false;
}

export function isPlayPaused(clock: MatchClock): boolean {
  return clock.phase === "HALFTIME" || clock.phase === "FULL_TIME";
}
