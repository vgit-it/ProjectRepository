import type { GameOutcome, InputIntent, Projectile, Spectator, Team } from "../types";
import { MatchSim } from "./MatchSim";
import { stepProjectiles } from "./projectiles";
import { createSpectator, updateSpectator } from "./spectator";

/** Top-level sim: drives the AI match (M1) plus the spectator/throw layer (M2+M3).
 * The player secretly backs one team and sabotages the other. */
export class WorldSim {
  readonly match = new MatchSim();
  readonly spectator: Spectator = createSpectator();
  projectiles: Projectile[] = [];
  /** the side the player wants to win */
  readonly backedTeam: Team = "home";
  outcome: GameOutcome = "playing";

  get nowMs(): number {
    return this.match.nowMs;
  }

  /** Team the player is sabotaging (throws only daze this side). */
  get targetTeam(): Team {
    return this.backedTeam === "home" ? "away" : "home";
  }

  update(intent: InputIntent, dtMs: number): void {
    this.match.update(dtMs);
    const now = this.match.nowMs;
    const dtSec = dtMs / 1000;

    const launched = updateSpectator(this.spectator, intent, now, dtSec);
    if (launched) this.projectiles.push(launched);

    this.projectiles = stepProjectiles(this.projectiles, this.match.state, this.targetTeam, now);

    if (this.outcome === "playing" && this.match.state.clock.phase === "FULL_TIME") {
      const { home, away } = this.match.state.score;
      const mine = this.backedTeam === "home" ? home : away;
      const theirs = this.backedTeam === "home" ? away : home;
      this.outcome = mine > theirs ? "won" : mine < theirs ? "lost" : "draw";
    }
  }
}
