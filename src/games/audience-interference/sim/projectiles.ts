import type { MatchState, Projectile, Team } from "../types";
import { lerp } from "../vec";
import { applyItemHit } from "./daze";

/** Advance in-flight projectiles; on impact apply the item effect and drop them.
 * Mutates `projectiles` in place and returns the surviving list. */
export function stepProjectiles(
  projectiles: Projectile[],
  match: MatchState,
  targetTeam: Team,
  nowMs: number,
): Projectile[] {
  const survivors: Projectile[] = [];
  for (const proj of projectiles) {
    const span = proj.impactAtMs - proj.launchedAtMs;
    const t = span <= 0 ? 1 : (nowMs - proj.launchedAtMs) / span;
    if (t >= 1) {
      proj.pos = { ...proj.targetPos };
      applyItemHit(proj, match, targetTeam, nowMs);
      continue;
    }
    proj.pos = lerp(proj.startPos, proj.targetPos, t);
    survivors.push(proj);
  }
  return survivors;
}

/** Parabolic visual height (meters) of a projectile at the given sim time. */
export function projectileArcHeight(proj: Projectile, nowMs: number): number {
  const span = proj.impactAtMs - proj.launchedAtMs;
  const t = span <= 0 ? 1 : Math.max(0, Math.min(1, (nowMs - proj.launchedAtMs) / span));
  const peak = Math.min(10, span / 90); // taller for longer throws
  return Math.sin(t * Math.PI) * peak;
}
