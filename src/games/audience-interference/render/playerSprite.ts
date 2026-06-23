import type { Team } from "../types";

// DEV PALETTE: see drawPitch.ts for the scoped CLAUDE.md palette exception note.
// The kit art is a single light color; we bake a per-team tint so home/away stay
// distinguishable (matches the team colors used elsewhere for the player dots).
const TEAM_TINT: Record<Team, string> = { home: "#3b82f6", away: "#eab308" };

// The supplied sheet is two frames side-by-side: left = idle, right = mid-stride.
const FRAME_COUNT = 2;

// Respect the GitHub Pages base path so the asset resolves both in dev ("/") and
// under "/ProjectRepository". BASE_URL isn't guaranteed to carry a trailing slash
// (it doesn't here), so normalize it the same way Shell.astro does.
const BASE = import.meta.env.BASE_URL;
const SPRITE_URL = `${BASE.endsWith("/") ? BASE : `${BASE}/`}games/audience-interference/players.png`;

/** Pre-baked, team-tinted frames, indexed [team][frameIndex]. Populated on load. */
const baked: Record<Team, HTMLCanvasElement[]> = { home: [], away: [] };
let ready = false;
let frameW = 0;
let frameH = 0;
// Vertical position of the sprite's real feet (bottom-most opaque row) as a fraction
// of frame height. The art has transparent padding below the feet, so anchoring on
// the raw image edge makes players float; we anchor on this instead. 1 = no padding.
let footFraction = 1;

const img = new Image();
img.onload = () => {
  frameW = Math.floor(img.width / FRAME_COUNT);
  frameH = img.height;
  if (frameW <= 0 || frameH <= 0) return;
  for (const team of ["home", "away"] as Team[]) {
    baked[team] = [];
    for (let f = 0; f < FRAME_COUNT; f++) {
      baked[team].push(bakeFrame(img, f, TEAM_TINT[team]));
    }
  }
  footFraction = computeFootFraction(baked.home[0]);
  ready = true;
};
img.src = SPRITE_URL;

/** Finds the bottom-most non-transparent row in a baked frame and returns its
 * position as a fraction of frame height, so callers can drop the empty padding. */
function computeFootFraction(canvas: HTMLCanvasElement | undefined): number {
  if (!canvas) return 1;
  const ctx = canvas.getContext("2d");
  if (!ctx) return 1;
  const { width, height } = canvas;
  if (width <= 0 || height <= 0) return 1;
  const ALPHA_THRESHOLD = 16;
  const data = ctx.getImageData(0, 0, width, height).data;
  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > ALPHA_THRESHOLD) {
        return (y + 1) / height;
      }
    }
  }
  return 1;
}

/** Render one frame onto an offscreen canvas, multiplied by the team color and
 * re-masked to the sprite's own alpha so transparency/dark outlines stay clean. */
function bakeFrame(source: HTMLImageElement, frameIndex: number, tint: string): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = frameW;
  canvas.height = frameH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const sx = frameIndex * frameW;
  ctx.drawImage(source, sx, 0, frameW, frameH, 0, 0, frameW, frameH);

  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, frameW, frameH);

  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(source, sx, 0, frameW, frameH, 0, 0, frameW, frameH);

  ctx.globalCompositeOperation = "source-over";
  return canvas;
}

export function isPlayerSpriteReady(): boolean {
  return ready;
}

export function getPlayerFrame(team: Team, frameIndex: 0 | 1): CanvasImageSource | null {
  return baked[team][frameIndex] ?? null;
}

/** Width-to-height ratio of a single frame; 1 until loaded. */
export function playerFrameAspect(): number {
  return frameH > 0 ? frameW / frameH : 1;
}

/** Fraction of the frame height at which the sprite's feet actually sit (the rest
 * below is transparent padding). 1 until loaded / if there is no padding. */
export function playerFrameFootFraction(): number {
  return footFraction;
}
