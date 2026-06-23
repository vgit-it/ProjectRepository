import {
  PERCH_PER_HORIZONTAL,
  PERCH_PER_VERTICAL,
  PERCH_STEP_MS,
  PITCH_HEIGHT,
  PITCH_WIDTH,
  STAND_BAND_M,
  STAND_INSET_M,
  THROW_MAX_FLIGHT_MS,
  THROW_MIN_FLIGHT_MS,
} from "../constants";
import type { InputIntent, Projectile, Spectator, Vec2 } from "../types";
import { add, dot, length, scale, sub } from "../vec";
import { ITEM_DEFS } from "./items";

const PITCH_CENTER: Vec2 = { x: PITCH_WIDTH / 2, y: PITCH_HEIGHT / 2 };
const BASE_SCATTER_M = 9; // worst-case landing spread for the loosest item

let nextProjectileId = 0;

// ---------- perch ring ----------

/** Offset (m) outside the touchlines where perches sit: centerline of the band. */
const BAND_MID = (STAND_INSET_M + STAND_BAND_M) / 2;

let perchCache: Vec2[] | null = null;

/** The discrete crowd perches, in clockwise ring order starting at the top-left
 * corner: 4 corners + PERCH_PER_HORIZONTAL along top/bottom + PERCH_PER_VERTICAL
 * along left/right. The player hops between adjacent perches. */
export function buildPerches(): Vec2[] {
  if (perchCache) return perchCache;
  const minX = -BAND_MID;
  const maxX = PITCH_WIDTH + BAND_MID;
  const minY = -BAND_MID;
  const maxY = PITCH_HEIGHT + BAND_MID;
  const ring: Vec2[] = [];

  // top-left corner, then top side (left -> right), then top-right corner
  ring.push({ x: minX, y: minY });
  for (let i = 1; i <= PERCH_PER_HORIZONTAL; i++) {
    ring.push({ x: minX + ((maxX - minX) * i) / (PERCH_PER_HORIZONTAL + 1), y: minY });
  }
  ring.push({ x: maxX, y: minY });
  // right side (top -> bottom)
  for (let i = 1; i <= PERCH_PER_VERTICAL; i++) {
    ring.push({ x: maxX, y: minY + ((maxY - minY) * i) / (PERCH_PER_VERTICAL + 1) });
  }
  // bottom-right corner, then bottom side (right -> left)
  ring.push({ x: maxX, y: maxY });
  for (let i = 1; i <= PERCH_PER_HORIZONTAL; i++) {
    ring.push({ x: maxX - ((maxX - minX) * i) / (PERCH_PER_HORIZONTAL + 1), y: maxY });
  }
  // bottom-left corner, then left side (bottom -> top)
  ring.push({ x: minX, y: maxY });
  for (let i = 1; i <= PERCH_PER_VERTICAL; i++) {
    ring.push({ x: minX, y: maxY - ((maxY - minY) * i) / (PERCH_PER_VERTICAL + 1) });
  }

  perchCache = ring;
  return ring;
}

/** Perch nearest a world point (used to pick the spawn perch). */
function nearestPerchIndex(p: Vec2): number {
  const perches = buildPerches();
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < perches.length; i++) {
    const d = length(sub(perches[i], p));
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

export function createSpectator(): Spectator {
  const startIndex = nearestPerchIndex({ x: PITCH_WIDTH / 2, y: -BAND_MID });
  const start = buildPerches()[startIndex];
  return {
    pos: { ...start },
    facing: Math.PI / 2,
    ducking: false,
    currentSection: "top",
    perchIndex: startIndex,
    nextStepAtMs: 0,
    heldItem: "popcorn",
    itemCooldowns: { popcorn: 0, scarf: 0, drink: 0, flare: 0 },
    aiming: false,
    aimTarget: { ...PITCH_CENTER },
    charge: 0,
  };
}

/** Advances the spectator from input. Returns a Projectile to spawn on throw, else null. */
export function updateSpectator(
  spec: Spectator,
  intent: InputIntent,
  nowMs: number,
): Projectile | null {
  spec.heldItem = intent.selectedItem;
  spec.ducking = intent.ducking;

  const toCenter = sub(PITCH_CENTER, spec.pos);
  spec.facing = Math.atan2(toCenter.y, toCenter.x);
  const origin = clampToPitch(spec.pos);
  const range = ITEM_DEFS[spec.heldItem].range;

  spec.aiming = intent.aiming;
  if (intent.aiming) {
    // Throw joystick: deflection (already a unit vector in [-1,1] per axis) maps
    // straight to a landing offset, scaled by the item's reach and clamped to the
    // pitch. No drift — the reticle sits exactly where the stick points.
    spec.aimTarget = clampToPitch(add(origin, scale(intent.aimVector, range)));
    // Power == stick deflection magnitude, 0..1; drives the power-band visual.
    spec.charge = Math.min(1, length(intent.aimVector));
  } else {
    // Movement is locked while aiming (this branch isn't reached then).
    stepRing(spec, intent.moveDir, nowMs);
  }

  if (intent.throwReleased) {
    const proj = tryThrow(spec, origin, spec.aimTarget, nowMs);
    spec.charge = 0;
    return proj;
  }
  return null;
}

/** Hop to the neighbouring perch most aligned with the requested screen direction,
 * throttled to one hop per `PERCH_STEP_MS`. Screen-relative: left/right walk the
 * top & bottom stands, up/down walk the sides, and corners turn onto the next edge. */
function stepRing(spec: Spectator, dir: Vec2, nowMs: number): void {
  if ((dir.x === 0 && dir.y === 0) || nowMs < spec.nextStepAtMs) return;
  const perches = buildPerches();
  const n = perches.length;
  const cur = perches[spec.perchIndex];
  const prevIdx = (spec.perchIndex - 1 + n) % n;
  const nextIdx = (spec.perchIndex + 1) % n;
  const dotPrev = dot(sub(perches[prevIdx], cur), dir);
  const dotNext = dot(sub(perches[nextIdx], cur), dir);
  if (dotPrev <= 0 && dotNext <= 0) return; // no neighbour lies that way
  spec.perchIndex = dotNext >= dotPrev ? nextIdx : prevIdx;
  spec.pos = { ...perches[spec.perchIndex] };
  spec.nextStepAtMs = nowMs + PERCH_STEP_MS;
}

function tryThrow(spec: Spectator, origin: Vec2, target: Vec2, nowMs: number): Projectile | null {
  const def = ITEM_DEFS[spec.heldItem];
  if (nowMs < spec.itemCooldowns[spec.heldItem]) return null;

  // the player places the marker directly; only the item's own debuff scatters it
  const scatter = (def.accuracyDebuff ?? 0) * BASE_SCATTER_M;
  let landing = add(target, {
    x: (Math.random() * 2 - 1) * scatter,
    y: (Math.random() * 2 - 1) * scatter,
  });
  landing = clampToPitch(landing);

  spec.itemCooldowns[spec.heldItem] = nowMs + def.cooldownMs;

  const dist = length(sub(landing, origin));
  const flightMs = Math.max(
    THROW_MIN_FLIGHT_MS,
    Math.min(THROW_MAX_FLIGHT_MS, (dist / def.speed) * 1000),
  );
  return {
    id: `proj-${nextProjectileId++}`,
    itemId: spec.heldItem,
    startPos: { ...origin },
    pos: { ...origin },
    vel: { x: 0, y: 0 },
    targetPos: landing,
    launchedAtMs: nowMs,
    impactAtMs: nowMs + flightMs,
  };
}

function clampToPitch(p: Vec2): Vec2 {
  return {
    x: Math.max(0, Math.min(PITCH_WIDTH, p.x)),
    y: Math.max(0, Math.min(PITCH_HEIGHT, p.y)),
  };
}
