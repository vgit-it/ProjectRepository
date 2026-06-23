import type { PlayerRole } from "./types";

// World units are meters. Pitch sits with (0,0) at the home corner flag.
export const PITCH_WIDTH = 75;
export const PITCH_HEIGHT = 48;
export const GOAL_WIDTH = 9;
export const GOAL_Y_MIN = PITCH_HEIGHT / 2 - GOAL_WIDTH / 2;
export const GOAL_Y_MAX = PITCH_HEIGHT / 2 + GOAL_WIDTH / 2;

export const PLAYER_RADIUS = 1.6;
export const BALL_RADIUS = 1.4;

export const PLAYER_BASE_SPEED = 6.5; // m/s, jogging/chasing pace
export const PLAYER_ACCEL = 25; // m/s^2, how fast velocity tracks the desired seek vector

/** Sprite run-cycle cadence: alternate the two frames every 0.4s while moving. */
export const PLAYER_FRAME_CYCLE_MS = 400;
/** Speed (m/s) above which a player is "running" (animates + updates facing). */
export const PLAYER_RUN_THRESHOLD = 0.6;
/** Drawn sprite size as a multiple of PLAYER_RADIUS; purely visual (shadow, rings,
 * and the PLAYER_RADIUS-based dribble offset in ballPhysics.ts are unaffected). */
export const PLAYER_SPRITE_SCALE = 3;

export const DUEL_RADIUS = 1.6;
export const DUEL_COOLDOWN_MS = 600;
export const DUEL_JITTER = 0.5;
export const PICKUP_RADIUS = 1.1;
export const PICKUP_BLOCK_MS = 400;

export const AI_DECISION_INTERVAL_MS = 300;

export const SHOT_SPEED = 34;
export const PASS_SPEED = 18;
export const BALL_DRAG_PER_SEC = 0.55; // exponential velocity decay coefficient
export const BALL_BOUNDARY_DAMPING = 0.55;

/** Downward acceleration (m/s^2) applied to a lofted ball's height; tuned for snappy
 * arcade arcs rather than realistic 9.8. */
export const BALL_GRAVITY = 22;
/** Passes to a receiver at least this far away (m) are lofted; closer passes stay
 * grounded unless the lane is blocked. */
export const LOFT_MIN_DIST = 18;
/** How long (ms) a player is fully frozen after being dispossessed in a duel. */
export const STEAL_STUN_MS = 1500;

// ---------- loose-ball tussle ----------
// When the two chasers (one per team) both reach a loose ball, they freeze together
// for a beat, then a skill-weighted-but-random winner surges off with it.
/** Both opponents within this distance (m) of a loose ball trigger a tussle. */
export const CONTEST_RADIUS = 2.4;
/** How long (ms) both players hold frozen together over the contested ball. */
export const CONTEST_HOLD_MS = 700;
/** How far (m) the winner surges forward with the ball after winning the tussle. */
export const CONTEST_WIN_BURST_M = 4;
/** How long (ms) the loser is frozen after losing the tussle. */
export const CONTEST_LOSER_STUN_MS = 5000;

// ---------- ball-carrier decisions ----------
// The carrier commits to run/pass/shoot and sticks with it for a few seconds rather
// than re-scoring every AI tick, then winds up briefly before a kick actually fires.
/** How long (ms) a committed "run" decision is held before the carrier re-decides. */
export const CARRIER_DECISION_MS = 3000;
/** Pre-kick wind-up (ms): the carrier freezes on his idle frame, then the kick fires. */
export const KICK_WINDUP_MS = 500;
/** An opponent within this (m) of the carrier counts as "approaching" → favors a pass. */
export const CARRIER_APPROACH_M = 9;
/** An opponent this close (m) breaks a committed run early so the carrier can react. */
export const CARRIER_PANIC_M = 4;
/** Carrier depth past this fraction of the pitch → shooting joins the decision set. */
export const FINAL_THIRD_FRAC = 2 / 3;
/** Lane width (m) toward goal that must be blocker-free to count as "clear space". */
export const GOAL_LANE_WIDTH = 4;

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

/** Discrete crowd "perches" the player hops between, laid out as a ring in the
 * stand band: 4 corners + this many along each horizontal / vertical side. */
export const PERCH_PER_HORIZONTAL = 4;
export const PERCH_PER_VERTICAL = 3;
/** Auto-repeat delay (ms) between perch hops while a direction is held. */
export const PERCH_STEP_MS = 190;

// ---------- camera (M2) ----------

/** Vertical slice of the world (meters) the zoomed camera shows; most of the pitch. */
export const CAMERA_VISIBLE_HEIGHT_M = 40;
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
/** How fast the joystick drags the landing marker across the pitch (m/s). */
export const AIM_MARKER_SPEED = 24;

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

// Spread wide and hold shape: lines pushed apart, lanes widened, and drift roughly
// halved so off-ball players stay in their spots instead of bunching toward the ball
// (only the single nearest per team chases — see PlayerAI.updateOutfieldPlayer).
export const FORMATION: FormationSlot[] = [
  { role: "GK", depth: 0.04, lane: 0.5, depthDrift: 0, laneDrift: 0.05 },
  { role: "DEF", depth: 0.18, lane: 0.22, depthDrift: 0.08, laneDrift: 0.1 },
  { role: "DEF", depth: 0.18, lane: 0.78, depthDrift: 0.08, laneDrift: 0.1 },
  { role: "MID", depth: 0.5, lane: 0.12, depthDrift: 0.12, laneDrift: 0.15 },
  { role: "MID", depth: 0.5, lane: 0.5, depthDrift: 0.12, laneDrift: 0.15 },
  { role: "MID", depth: 0.5, lane: 0.88, depthDrift: 0.12, laneDrift: 0.15 },
  { role: "FWD", depth: 0.82, lane: 0.5, depthDrift: 0.04, laneDrift: 0.1 },
];
