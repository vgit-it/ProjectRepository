import {
  PITCH_HEIGHT,
  PITCH_WIDTH,
  SPECTATOR_ACCEL,
  SPECTATOR_SPEED,
  STAND_BAND_M,
  STAND_INSET_M,
  THROW_CHARGE_SEC,
  THROW_MAX_FLIGHT_MS,
  THROW_MIN_FLIGHT_MS,
} from "../constants";
import type { InputIntent, Projectile, Spectator, Vec2 } from "../types";
import { add, clampMagnitude, length, normalize, scale, sub } from "../vec";
import { ITEM_DEFS } from "./items";

const PITCH_CENTER: Vec2 = { x: PITCH_WIDTH / 2, y: PITCH_HEIGHT / 2 };
const BASE_SCATTER_M = 9; // worst-case landing spread at zero charge

let nextProjectileId = 0;

export function createSpectator(): Spectator {
  return {
    pos: { x: PITCH_WIDTH / 2, y: -STAND_INSET_M - 1.5 }, // top stand, mid
    vel: { x: 0, y: 0 },
    facing: Math.PI / 2,
    ducking: false,
    currentSection: "top",
    heldItem: "popcorn",
    itemCooldowns: { popcorn: 0, scarf: 0, drink: 0, flare: 0 },
    aiming: false,
    aimDir: { x: 0, y: 1 },
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

  spec.aiming = intent.aiming;
  if (intent.aiming) {
    // charging a throw: aim with the stick, build power, don't walk
    spec.charge = Math.min(1, spec.charge + dtSec / THROW_CHARGE_SEC);
    if (length(intent.aimVector) > 0.05) spec.aimDir = normalize(intent.aimVector);
    spec.vel = scale(spec.vel, 0.6);
  } else {
    // walking the stands
    const desired = scale(clampMagnitude(intent.move, 1), SPECTATOR_SPEED);
    const dv = clampMagnitude(sub(desired, spec.vel), SPECTATOR_ACCEL * dtSec);
    spec.vel = add(spec.vel, dv);
  }

  spec.pos = add(spec.pos, scale(spec.vel, dtSec));
  clampToRing(spec.pos);

  if (intent.throwReleased) {
    const proj = tryThrow(spec, forward, nowMs);
    spec.charge = 0;
    return proj;
  }
  return null;
}

function tryThrow(spec: Spectator, forward: Vec2, nowMs: number): Projectile | null {
  const def = ITEM_DEFS[spec.heldItem];
  if (nowMs < spec.itemCooldowns[spec.heldItem]) return null;

  const power = 0.4 + 0.6 * spec.charge;
  const dir = spec.aiming ? spec.aimDir : forward;
  const origin = clampToPitch({ ...spec.pos });
  let target = add(origin, scale(dir, def.range * power));

  // accuracy: tighter with charge, looser with the item's debuff
  const scatter = (1 - spec.charge) * BASE_SCATTER_M + (def.accuracyDebuff ?? 0) * BASE_SCATTER_M;
  target = add(target, {
    x: (Math.random() * 2 - 1) * scatter,
    y: (Math.random() * 2 - 1) * scatter,
  });
  target = clampToPitch(target);

  spec.itemCooldowns[spec.heldItem] = nowMs + def.cooldownMs;

  const dist = length(sub(target, origin));
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
    targetPos: target,
    launchedAtMs: nowMs,
    impactAtMs: nowMs + flightMs,
  };
}

/** Keep a point inside the stands ring: within the outer band, outside the pitch. */
function clampToRing(p: Vec2): void {
  const outMinX = -STAND_BAND_M;
  const outMaxX = PITCH_WIDTH + STAND_BAND_M;
  const outMinY = -STAND_BAND_M;
  const outMaxY = PITCH_HEIGHT + STAND_BAND_M;
  p.x = Math.max(outMinX, Math.min(outMaxX, p.x));
  p.y = Math.max(outMinY, Math.min(outMaxY, p.y));

  // push out of the inner (pitch + inset) rectangle to the nearest edge
  const inMinX = -STAND_INSET_M;
  const inMaxX = PITCH_WIDTH + STAND_INSET_M;
  const inMinY = -STAND_INSET_M;
  const inMaxY = PITCH_HEIGHT + STAND_INSET_M;
  if (p.x > inMinX && p.x < inMaxX && p.y > inMinY && p.y < inMaxY) {
    const dLeft = p.x - inMinX;
    const dRight = inMaxX - p.x;
    const dTop = p.y - inMinY;
    const dBottom = inMaxY - p.y;
    const m = Math.min(dLeft, dRight, dTop, dBottom);
    if (m === dTop) p.y = inMinY;
    else if (m === dBottom) p.y = inMaxY;
    else if (m === dLeft) p.x = inMinX;
    else p.x = inMaxX;
  }
}

function clampToPitch(p: Vec2): Vec2 {
  return {
    x: Math.max(0, Math.min(PITCH_WIDTH, p.x)),
    y: Math.max(0, Math.min(PITCH_HEIGHT, p.y)),
  };
}
