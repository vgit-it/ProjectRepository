import type { GoalkeeperPlayer, MatchState, Projectile, Team } from "../types";
import { distance } from "../vec";
import { ITEM_DEFS } from "./items";

/** Apply a landed projectile's effect: daze (slow) opposing players within its AoE,
 * and blind goalkeepers for blinding items. Only the sabotaged team is affected. */
export function applyItemHit(
  proj: Projectile,
  match: MatchState,
  targetTeam: Team,
  nowMs: number,
): void {
  const def = ITEM_DEFS[proj.itemId];
  const radius = def.aoeRadius ?? 1.2;

  for (const player of match.players) {
    if (player.team !== targetTeam) continue;
    if (distance(player.pos, proj.targetPos) > radius) continue;

    player.dazedUntilMs = Math.max(player.dazedUntilMs, nowMs + def.stunMs);
    if (def.blinds && player.role === "GK") {
      const gk = player as GoalkeeperPlayer;
      gk.blindedUntilMs = Math.max(gk.blindedUntilMs, nowMs + def.stunMs);
    }
  }
}
