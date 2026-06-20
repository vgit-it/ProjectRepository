import { PITCH_HEIGHT, PITCH_WIDTH } from "../constants";
import type { MatchPlayer, Vec2 } from "../types";
import { distanceToSegment, length, sub } from "../vec";

const SHOT_LANE_WIDTH = 3;
const PASS_LANE_WIDTH = 2.5;
const DRIBBLE_BASE_SCORE = 0.35;

function goalCenter(player: MatchPlayer): Vec2 {
  return { x: player.team === "home" ? PITCH_WIDTH : 0, y: PITCH_HEIGHT / 2 };
}

function depthOf(player: MatchPlayer): number {
  return player.team === "home" ? player.pos.x : PITCH_WIDTH - player.pos.x;
}

function countBlockers(from: Vec2, to: Vec2, opponents: MatchPlayer[], laneWidth: number): number {
  let count = 0;
  for (const opp of opponents) {
    if (distanceToSegment(opp.pos, from, to) < laneWidth) count++;
  }
  return count;
}

export function scoreShoot(player: MatchPlayer, opponents: MatchPlayer[]): number {
  const goal = goalCenter(player);
  const dist = length(sub(goal, player.pos));
  const proximity = Math.max(0, Math.min(1, 1 - dist / 40));
  const angle = Math.max(0, 1 - Math.abs(player.pos.y - PITCH_HEIGHT / 2) / (PITCH_HEIGHT / 2));
  // The opposing GK stands right on the line to goal by definition — counting them as a lane
  // "blocker" alongside outfield defenders would tank every shot's score on the keeper's mere
  // presence; only outfield defenders represent a deflection risk worth discouraging a shot for.
  const outfieldOpponents = opponents.filter((o) => o.role !== "GK");
  const blockers = countBlockers(player.pos, goal, outfieldOpponents, SHOT_LANE_WIDTH);
  return Math.max(0, proximity * 0.5 + angle * 0.3 - blockers * 0.25);
}

export function scorePass(
  player: MatchPlayer,
  teammate: MatchPlayer,
  opponents: MatchPlayer[],
): number {
  const blockers = countBlockers(player.pos, teammate.pos, opponents, PASS_LANE_WIDTH);
  const laneOpenness = Math.max(0, 1 - blockers * 0.3);
  const progress = Math.max(-1, Math.min(1, (depthOf(teammate) - depthOf(player)) / 30));
  const forwardProgress = 0.5 + 0.5 * progress;
  const dist = length(sub(teammate.pos, player.pos));
  const distScore = Math.max(0, 1 - Math.abs(dist - 20) / 30);
  return laneOpenness * 0.45 + forwardProgress * 0.35 + distScore * 0.2;
}

export function scoreDribble(): number {
  return DRIBBLE_BASE_SCORE;
}

export type OnBallAction =
  | { kind: "shoot" }
  | { kind: "pass"; target: MatchPlayer }
  | { kind: "dribble" };

export function decideOnBallAction(
  player: MatchPlayer,
  teammates: MatchPlayer[],
  opponents: MatchPlayer[],
): OnBallAction {
  const shotScore = scoreShoot(player, opponents);

  let bestPassScore = -Infinity;
  let bestPassTarget: MatchPlayer | null = null;
  for (const mate of teammates) {
    const s = scorePass(player, mate, opponents);
    if (s > bestPassScore) {
      bestPassScore = s;
      bestPassTarget = mate;
    }
  }

  const dribbleScore = scoreDribble();

  if (shotScore >= bestPassScore && shotScore >= dribbleScore) {
    return { kind: "shoot" };
  }
  if (bestPassTarget && bestPassScore >= dribbleScore) {
    return { kind: "pass", target: bestPassTarget };
  }
  return { kind: "dribble" };
}
