import {
  AIM_MARKER_SPEED,
  PERCH_PER_HORIZONTAL,
  PERCH_PER_VERTICAL,
  PERCH_STEP_MS,
  PITCH_HEIGHT,
  PITCH_WIDTH,
  STAND_BAND_M,
  STAND_INSET_M,
  THROW_CHARGE_SEC,
  THROW_MAX_FLIGHT_MS,
  THROW_MIN_FLIGHT_MS,
} from "../constants";
import type { InputIntent, Projectile, Spectator, Vec2 } from "../types";
import { add, length, normalize, scale, sub } from "../vec";
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
  dtSec: number,
): Projectile | null {
  spec.heldItem = intent.selectedItem;
  spec.ducking = intent.ducking;

  const toCenter = sub(PITCH_CENTER, spec.pos);
  spec.facing = Math.atan2(toCenter.y, toCenter.x);
  const forward = normalize(toCenter);
  const origin = clampToPitch(spec.pos);
  const range = ITEM_DEFS[spec.heldItem].range;

  const wasAiming = spec.aiming;
  spec.aiming = intent.aiming;
  if (intent.aiming) {
    // charging a throw: drag the landing marker with the stick, don't hop perches
    spec.charge = Math.min(1, spec.charge + dtSec / THROW_CHARGE_SEC);
    if (!wasAiming) {
      // seed the marker a sensible distance into the pitch in front of the player
      const reach = Math.min(range * 0.55, length(toCenter));
      spec.aimTarget = clampToPitch(add(origin, scale(forward, reach)));
    }
    // translate by the analog stick vector, then clamp to range + pitch
    spec.aimTarget = add(spec.aimTarget, scale(intent.aimVector, AIM_MARKER_SPEED * dtSec));
    spec.aimTarget = clampToRange(spec.aimTarget, origin, range);
    spec.aimTarget = clampToPitch(spec.aimTarget);
  } else {
    stepPerch(spec, intent.move, nowMs);
  }

  if (intent.throwReleased) {
    // throw to wherever the marker sits; a bare tap (no aiming frame) lands in front
    const target = wasAiming
      ? spec.aimTarget
      : clampToPitch(add(origin, scale(forward, range * 0.55)));
    const proj = tryThrow(spec, origin, target, nowMs);
    spec.charge = 0;
    return proj;
  }
  return null;
}

/** Hop to an adjacent ring perch when the input direction lines up with a neighbor. */
function stepPerch(spec: Spectator, move: Vec2, nowMs: number): void {
  if (nowMs < spec.nextStepAtMs) return;
  const mag = length(move);
  if (mag < 0.4) return;

  const perches = buildPerches();
  const n = perches.length;
  const dir = scale(move, 1 / mag);
  const cur = perches[spec.perchIndex];
  const prev = (spec.perchIndex - 1 + n) % n;
  const next = (spec.perchIndex + 1) % n;

  let bestIndex = -1;
  let bestDot = 0.35; // require reasonable alignment to move
  for (const cand of [prev, next]) {
    const toCand = normalize(sub(perches[cand], cur));
    const dot = toCand.x * dir.x + toCand.y * dir.y;
    if (dot > bestDot) {
      bestDot = dot;
      bestIndex = cand;
    }
  }
  if (bestIndex === -1) return;

  spec.perchIndex = bestIndex;
  spec.pos = { ...perches[bestIndex] };
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

/** Pull a point back onto the disc of the given radius around an origin. */
function clampToRange(p: Vec2, origin: Vec2, radius: number): Vec2 {
  const d = sub(p, origin);
  const len = length(d);
  if (len <= radius) return p;
  return add(origin, scale(d, radius / len));
}

function clampToPitch(p: Vec2): Vec2 {
  return {
    x: Math.max(0, Math.min(PITCH_WIDTH, p.x)),
    y: Math.max(0, Math.min(PITCH_HEIGHT, p.y)),
  };
}
