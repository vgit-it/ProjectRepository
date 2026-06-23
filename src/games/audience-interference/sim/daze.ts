import {
  AOE_MULTIPLIER,
  DAZE_FREEZE_MAX_MS,
  DAZE_FREEZE_MIN_MS,
  IMPACT_SHAKE_MS,
} from "../constants";
import type { GoalkeeperPlayer, MatchState, Projectile, Team } from "../types";
import { distance } from "../vec";
import { ITEM_DEFS } from "./items";

/** Apply a landed projectile's effect: opposing players within its (doubled) AoE are
 * fully frozen for several seconds (not just slowed), and blinding items also blank a
 * goalkeeper. Only the sabotaged team is affected. Emits a `hit` event on a landed hit. */
export function applyItemHit(
  proj: Projectile,
  match: MatchState,
  targetTeam: Team,
  nowMs: number,
): void {
  const def = ITEM_DEFS[proj.itemId];
  const radius = (def.aoeRadius ?? 1.2) * AOE_MULTIPLIER;

  let hitAnyone = false;
  for (const player of match.players) {
    if (player.team !== targetTeam) continue;
    if (distance(player.pos, proj.targetPos) > radius) continue;

    hitAnyone = true;
    const until =
      nowMs + DAZE_FREEZE_MIN_MS + Math.random() * (DAZE_FREEZE_MAX_MS - DAZE_FREEZE_MIN_MS);
    // Both: stunned freezes movement/decisions; dazed keeps the overhead daze-stars marker.
    player.stunnedUntilMs = Math.max(player.stunnedUntilMs, until);
    player.dazedUntilMs = Math.max(player.dazedUntilMs, until);
    player.shakeUntilMs = nowMs + IMPACT_SHAKE_MS;
    if (def.blinds && player.role === "GK") {
      const gk = player as GoalkeeperPlayer;
      gk.blindedUntilMs = Math.max(gk.blindedUntilMs, until);
    }
  }

  if (hitAnyone) match.events.push({ kind: "hit", pos: { ...proj.targetPos } });
}
