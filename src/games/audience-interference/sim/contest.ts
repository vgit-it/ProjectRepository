import {
  CONTEST_HOLD_MS,
  CONTEST_LOSER_STUN_MS,
  CONTEST_RADIUS,
  CONTEST_WIN_BURST_M,
  DUEL_COOLDOWN_MS,
  PICKUP_BLOCK_MS,
} from "../constants";
import type { MatchPlayer, MatchState, Team, Vec2 } from "../types";
import { add, distance, length, normalize, scale } from "../vec";
import { attackDirectionX } from "./movement";

/** Height (m) below which a falling ball is on the deck and contestable (mirrors
 * ballPhysics' GROUND_PICKUP_HEIGHT). */
const GROUND_HEIGHT = 0.6;
/** Initial speed (m/s) given to the winner so the carried ball immediately leads in
 * the surge direction before steering toward the burst target takes over. */
const BURST_SPEED = 4;

/** Nearest outfield player on a team to the ball, with its distance. */
function nearestOutfield(
  state: MatchState,
  team: Team,
): { player: MatchPlayer | null; dist: number } {
  let player: MatchPlayer | null = null;
  let dist = Infinity;
  for (const p of state.players) {
    if (p.role === "GK" || p.team !== team) continue;
    const d = distance(p.pos, state.ball.pos);
    if (d < dist) {
      dist = d;
      player = p;
    }
  }
  return { player, dist };
}

/** The direction a player is "facing" as they reach the ball: their travel direction,
 * falling back to the line toward the ball, then to their attacking direction. */
function approachDir(player: MatchPlayer, ballPos: Vec2): Vec2 {
  if (length(player.vel) > 0.2) return normalize(player.vel);
  const toBall = { x: ballPos.x - player.pos.x, y: ballPos.y - player.pos.y };
  if (length(toBall) > 0.05) return normalize(toBall);
  return { x: attackDirectionX(player.team), y: 0 };
}

/**
 * Resolves the loose-ball tussle. When the two nearest opponents both reach a loose
 * ball they freeze together for CONTEST_HOLD_MS; then a skill-weighted random roll
 * (stronger player favored, never guaranteed) picks the winner, who surges off with
 * the ball along his captured approach direction while the loser is briefly frozen.
 */
export function resolveContest(state: MatchState, nowMs: number): void {
  const { ball } = state;

  // --- An active tussle: hold, then resolve once the timer elapses. ---
  if (ball.contest) {
    if (nowMs < ball.contest.resolveAtMs) return; // still holding the frame; both frozen

    const a = state.players.find((p) => p.id === ball.contest?.aId);
    const b = state.players.find((p) => p.id === ball.contest?.bId);
    const { aDir, bDir } = ball.contest;
    ball.contest = null;
    if (!a || !b) return;

    // Skill-weighted but always random: stronger player gets better odds, not a win.
    const pAWins = a.skill / (a.skill + b.skill);
    const aWins = Math.random() < pAWins;
    const winner = aWins ? a : b;
    const loser = aWins ? b : a;
    const winnerDir = aWins ? aDir : bDir;

    winner.hasBall = true;
    winner.stunnedUntilMs = 0;
    winner.vel = scale(winnerDir, BURST_SPEED);
    winner.moveTarget = add(winner.pos, scale(winnerDir, CONTEST_WIN_BURST_M));

    loser.vel = { x: 0, y: 0 };
    loser.stunnedUntilMs = nowMs + CONTEST_LOSER_STUN_MS;

    ball.possessedBy = winner.id;
    ball.lastTouchedByTeam = winner.team;
    ball.vel = { x: 0, y: 0 };
    ball.z = 0;
    ball.vz = 0;
    // Keep the loser from instantly snatching it back, and gate the next duel.
    ball.pickupBlockedFor = loser.id;
    ball.pickupBlockedUntilMs = nowMs + PICKUP_BLOCK_MS;
    ball.lastDuelAtMs = nowMs + DUEL_COOLDOWN_MS;
    return;
  }

  // --- No tussle yet: start one if both teams' chasers are on a grounded loose ball. ---
  if (ball.possessedBy || !ball.inPlay) return;
  if (nowMs < ball.freezeUntilMs) return;
  if (ball.z > GROUND_HEIGHT) return; // a lofted ball isn't contestable until it drops

  const home = nearestOutfield(state, "home");
  const away = nearestOutfield(state, "away");
  if (!home.player || !away.player) return;
  if (home.dist > CONTEST_RADIUS || away.dist > CONTEST_RADIUS) return;

  const resolveAtMs = nowMs + CONTEST_HOLD_MS;
  // Freeze both players (no movement, no decisions) and the ball for the hold.
  home.player.vel = { x: 0, y: 0 };
  away.player.vel = { x: 0, y: 0 };
  home.player.stunnedUntilMs = resolveAtMs;
  away.player.stunnedUntilMs = resolveAtMs;
  ball.vel = { x: 0, y: 0 };
  ball.freezeUntilMs = resolveAtMs;
  ball.contest = {
    aId: home.player.id,
    bId: away.player.id,
    resolveAtMs,
    aDir: approachDir(home.player, ball.pos),
    bDir: approachDir(away.player, ball.pos),
  };
}
