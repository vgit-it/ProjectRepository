import type { PlayerRole } from "./types";

// World units are meters. Pitch sits with (0,0) at the home corner flag.
export const PITCH_WIDTH = 75;
export const PITCH_HEIGHT = 48;
export const GOAL_WIDTH = 9;
export const GOAL_Y_MIN = PITCH_HEIGHT / 2 - GOAL_WIDTH / 2;
export const GOAL_Y_MAX = PITCH_HEIGHT / 2 + GOAL_WIDTH / 2;

export const PLAYER_RADIUS = 1.6;
export const BALL_RADIUS = 0.85;

export const PLAYER_BASE_SPEED = 6.5; // m/s, jogging/chasing pace
export const PLAYER_ACCEL = 25; // m/s^2, how fast velocity tracks the desired seek vector

export const PRESS_RADIUS = 10;
export const DUEL_RADIUS = 1.6;
export const DUEL_COOLDOWN_MS = 600;
export const DUEL_JITTER = 0.5;
export const PICKUP_RADIUS = 1.1;
export const PICKUP_BLOCK_MS = 400;

export const AI_DECISION_INTERVAL_MS = 300;

export const SHOT_SPEED = 28;
export const PASS_SPEED = 18;
export const BALL_DRAG_PER_SEC = 0.55; // exponential velocity decay coefficient
export const BALL_BOUNDARY_DAMPING = 0.55;

export const DEAD_BALL_FREEZE_MS = 700;
export const GOAL_CELEBRATION_FREEZE_MS = 2200;

export const HALF_LENGTH_MS = 4 * 60 * 1000;
export const HALFTIME_BREAK_MS = 8000;

// ---------- stands / spectator (M2) ----------

/** Width (world meters) of the walkable crowd band wrapping the pitch. Mirrors the
 * WORLD_MARGIN reserved in Renderer for the stands. */
export const STAND_BAND_M = 5.25;
/** How far outside the touchlines the spectator can roam (kept inside the stand band). */
export const STAND_INSET_M = 1.125;
export const SPECTATOR_SPEED = 12; // m/s walking along the stands
export const SPECTATOR_ACCEL = 40;

// ---------- camera (M2) ----------

/** Vertical slice of the world (meters) the zoomed camera shows; ~half the pitch. */
export const CAMERA_VISIBLE_HEIGHT_M = 28.5;
/** Perspective strength: 0 = flat zoom, higher = more foreshortening up the screen. */
export const CAMERA_TILT = 0.55;
/** Virtual camera depth (meters) for the perspective denominator. */
export const CAMERA_DEPTH_M = 70;
/** Smoothing for the follow-cam focus (fraction toward target per 60fps tick). */
export const CAMERA_FOLLOW_LERP = 0.12;
/** How far ahead of the spectator (into the pitch) the camera looks. */
export const CAMERA_LOOK_AHEAD_M = 12;

// ---------- throwing (M3) ----------

/** Seconds to reach full charge (max power/accuracy) while holding THROW. */
export const THROW_CHARGE_SEC = 0.9;
/** Flight time scales with distance; clamps keep arcs readable. */
export const THROW_MIN_FLIGHT_MS = 350;
export const THROW_MAX_FLIGHT_MS = 1100;

// Off-ball "home slot" formation: depth (0 = own goal line, 1 = opponent goal line)
// and lane fraction (0..1 across the pitch height), plus how strongly each role
// drifts its depth/lane toward the ball's actual position.
export interface FormationSlot {
  role: PlayerRole;
  depth: number;
  lane: number;
  depthDrift: number;
  laneDrift: number;
}

export const FORMATION: FormationSlot[] = [
  { role: "GK", depth: 0.04, lane: 0.5, depthDrift: 0, laneDrift: 0.05 },
  { role: "DEF", depth: 0.22, lane: 0.32, depthDrift: 0.15, laneDrift: 0.2 },
  { role: "DEF", depth: 0.22, lane: 0.68, depthDrift: 0.15, laneDrift: 0.2 },
  { role: "MID", depth: 0.48, lane: 0.2, depthDrift: 0.25, laneDrift: 0.3 },
  { role: "MID", depth: 0.48, lane: 0.5, depthDrift: 0.25, laneDrift: 0.3 },
  { role: "MID", depth: 0.48, lane: 0.8, depthDrift: 0.25, laneDrift: 0.3 },
  { role: "FWD", depth: 0.78, lane: 0.5, depthDrift: 0.05, laneDrift: 0.15 },
];
