export interface Vec2 {
  x: number;
  y: number;
}

export type Team = "home" | "away";
export type PlayerRole = "GK" | "DEF" | "MID" | "FWD";
export type PlayerAIState = "HOLD_SHAPE" | "SUPPORT" | "PRESS" | "DUEL" | "DAZED";

export interface MatchPlayer {
  readonly id: string;
  readonly team: Team;
  readonly role: PlayerRole;
  /** index into FORMATION; this player's home-slot template and kickoff lineup spot */
  readonly slotIndex: number;
  pos: Vec2;
  vel: Vec2;
  /** current steering target, recomputed at AI cadence, consumed every physics tick */
  moveTarget: Vec2;
  aiState: PlayerAIState;
  dazedUntilMs: number;
  /** sim time until which the player is fully frozen (e.g. just dispossessed); 0 = active */
  stunnedUntilMs: number;
  /** while held: keep the committed run until this sim time before re-deciding; 0 = re-decide */
  runCommitUntilMs: number;
  /** a queued kick currently winding up (idle-frame hold), or null when not kicking */
  kickKind: "pass" | "shoot" | null;
  /** sim time the queued kick fires (end of the wind-up) */
  kickReleaseAtMs: number;
  /** target point snapshot for the queued kick (receiver pos incl. wobble, or goal aim) */
  kickTarget: Vec2 | null;
  /** baseline ability roll input: used in duels and pass/shot accuracy */
  skill: number;
  hasBall: boolean;
}

export interface GoalkeeperPlayer extends MatchPlayer {
  readonly role: "GK";
  blindedUntilMs: number;
  lineSegment: { a: Vec2; b: Vec2 };
}

/** An in-progress loose-ball tussle: both players (one per team) are frozen over the
 * ball until `resolveAtMs`, when a skill-weighted random roll picks the winner, who
 * surges off along his captured approach direction. */
export interface BallContest {
  aId: string;
  bId: string;
  resolveAtMs: number;
  /** approach/facing directions captured at start (vel is zeroed during the freeze) */
  aDir: Vec2;
  bDir: Vec2;
}

export interface Ball {
  pos: Vec2;
  vel: Vec2;
  /** height above the pitch (m); 0 = grounded. Nonzero only mid-loft. */
  z: number;
  /** vertical velocity (m/s) while airborne, integrated against BALL_GRAVITY */
  vz: number;
  /** entity id of current possessor, or null when loose/in-flight */
  possessedBy: string | null;
  inPlay: boolean;
  /** team of whoever last gained possession; used to award the opponent on a dead ball */
  lastTouchedByTeam: Team | null;
  /** player who must not immediately reclaim a just-lost ball */
  pickupBlockedFor: string | null;
  pickupBlockedUntilMs: number;
  lastDuelAtMs: number;
  /** sim time the ball stays frozen (dead-ball/celebration pause); 0 = not frozen */
  freezeUntilMs: number;
  /** active loose-ball tussle, or null when the ball isn't being contested */
  contest: BallContest | null;
}

export type MatchPhase = "FIRST_HALF" | "HALFTIME" | "SECOND_HALF" | "FULL_TIME";

export interface MatchClock {
  phase: MatchPhase;
  /** elapsed ms within the current phase */
  elapsedMs: number;
  halfLengthMs: number;
  halftimeBreakMs: number;
}

export interface MatchState {
  clock: MatchClock;
  score: { home: number; away: number };
  players: MatchPlayer[];
  ball: Ball;
}

// ---------- stands / seat geometry (M2) ----------

export type StandTier = "front" | "mid" | "upper";

export interface SeatSection {
  readonly id: string;
  readonly tier: StandTier;
  bounds: Vec2[];
  crowdDensity: number;
}

// ---------- spectator / player avatar (M2) ----------

export interface Spectator {
  pos: Vec2;
  facing: number;
  ducking: boolean;
  currentSection: string;
  /** index into the perch ring (buildPerches); the player hops between perches */
  perchIndex: number;
  /** sim time the next perch hop is allowed (auto-repeat throttle) */
  nextStepAtMs: number;
  heldItem: ItemId;
  itemCooldowns: Record<ItemId, number>;
  /** true while THROW is held: aiming/charging a throw */
  aiming: boolean;
  /** world-space landing point the joystick drags around while aiming */
  aimTarget: Vec2;
  /** 0..1 charge built up while aiming; drives the marker pulse */
  charge: number;
}

// ---------- items / throwing (M3) ----------

export type ItemId = "popcorn" | "scarf" | "drink" | "flare";

export interface ItemDef {
  readonly id: ItemId;
  readonly cooldownMs: number;
  readonly stunMs: number;
  readonly range: number;
  readonly speed: number;
  readonly suspicionWeight: number;
  readonly aoeRadius?: number;
  readonly accuracyDebuff?: number;
}

export interface Projectile {
  readonly id: string;
  readonly itemId: ItemId;
  /** launch origin on the pitch; pos interpolates startPos->targetPos over the flight */
  readonly startPos: Vec2;
  pos: Vec2;
  vel: Vec2;
  targetPos: Vec2;
  launchedAtMs: number;
  impactAtMs: number;
}

export interface DazeEffect {
  targetId: string;
  appliedAtMs: number;
  expiresAtMs: number;
  speedMultiplier: number;
  passShotPenalty: number;
  source: ItemId;
}

// ---------- stewards / suspicion (M4) ----------

export type StewardState = "PATROL" | "ALERTED" | "RELOCATING";

export interface Steward {
  readonly id: string;
  pos: Vec2;
  facing: number;
  state: StewardState;
  waypoints: Vec2[];
  waypointIndex: number;
  visionRangeM: number;
  visionConeRad: number;
  lastSeenSpectatorPos: Vec2 | null;
}

export type SuspicionTier = "calm" | "warning" | "relocated" | "ejected";

export interface SuspicionState {
  value: number;
  tier: SuspicionTier;
  ejected: boolean;
}

// ---------- input intent (shared desktop+mobile, M2+) ----------

export interface InputIntent {
  move: Vec2;
  aiming: boolean;
  aimVector: Vec2;
  throwReleased: boolean;
  ducking: boolean;
  selectedItem: ItemId;
}

// ---------- objective / outcome (M3) ----------

/** The player secretly backs one side and sabotages the other. */
export type GameOutcome = "playing" | "won" | "lost" | "draw";

// ---------- top-level world state (composition root) ----------

export interface WorldState {
  match: MatchState;
  spectator: Spectator;
  sections: SeatSection[];
  projectiles: Projectile[];
  activeDazes: DazeEffect[];
  stewards: Steward[];
  suspicion: SuspicionState;
}
