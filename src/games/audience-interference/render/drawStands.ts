import { PITCH_HEIGHT, PITCH_WIDTH, STAND_BAND_M, STAND_INSET_M } from "../constants";
import type { Vec2 } from "../types";
import type { Renderer } from "./Renderer";

// DEV PALETTE: see drawPitch.ts for the scoped CLAUDE.md palette exception note.
const TERRACE_FILL = "#2a2d33";
const CROWD_COLORS = ["#6b7280", "#9ca3af", "#7c8aa0", "#8a7c6b", "#b0938a"];

interface Seat {
  pos: Vec2;
  color: string;
  bob: number;
}

let seats: Seat[] | null = null;

/** A stable scattering of crowd "heads" filling the stand band around the pitch. */
function buildSeats(): Seat[] {
  const out: Seat[] = [];
  const outerMinX = -STAND_BAND_M;
  const outerMaxX = PITCH_WIDTH + STAND_BAND_M;
  const outerMinY = -STAND_BAND_M;
  const outerMaxY = PITCH_HEIGHT + STAND_BAND_M;
  const inMinX = -STAND_INSET_M;
  const inMaxX = PITCH_WIDTH + STAND_INSET_M;
  const inMinY = -STAND_INSET_M;
  const inMaxY = PITCH_HEIGHT + STAND_INSET_M;
  const step = 2.2;
  let i = 0;
  for (let x = outerMinX; x <= outerMaxX; x += step) {
    for (let y = outerMinY; y <= outerMaxY; y += step) {
      const inPitch = x > inMinX && x < inMaxX && y > inMinY && y < inMaxY;
      if (inPitch) continue;
      const jx = (pseudo(i * 2 + 1) - 0.5) * step * 0.6;
      const jy = (pseudo(i * 2 + 7) - 0.5) * step * 0.6;
      out.push({
        pos: { x: x + jx, y: y + jy },
        color: CROWD_COLORS[i % CROWD_COLORS.length],
        bob: pseudo(i * 3 + 2) * Math.PI * 2,
      });
      i++;
    }
  }
  return out;
}

function pseudo(n: number): number {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

export function drawStands(renderer: Renderer, nowMs: number): void {
  const { ctx } = renderer;

  // terrace floor: the band quads (drawn as one big outer ring of fills)
  fillQuad(
    renderer,
    { x: -STAND_BAND_M, y: -STAND_BAND_M },
    { x: PITCH_WIDTH + STAND_BAND_M, y: -STAND_INSET_M },
    TERRACE_FILL,
  ); // top
  fillQuad(
    renderer,
    { x: -STAND_BAND_M, y: PITCH_HEIGHT + STAND_INSET_M },
    { x: PITCH_WIDTH + STAND_BAND_M, y: PITCH_HEIGHT + STAND_BAND_M },
    TERRACE_FILL,
  ); // bottom
  fillQuad(
    renderer,
    { x: -STAND_BAND_M, y: -STAND_INSET_M },
    { x: -STAND_INSET_M, y: PITCH_HEIGHT + STAND_INSET_M },
    TERRACE_FILL,
  ); // left
  fillQuad(
    renderer,
    { x: PITCH_WIDTH + STAND_INSET_M, y: -STAND_INSET_M },
    { x: PITCH_WIDTH + STAND_BAND_M, y: PITCH_HEIGHT + STAND_INSET_M },
    TERRACE_FILL,
  ); // right

  if (!seats) seats = buildSeats();

  for (const seat of seats) {
    const sp = renderer.project(seat.pos);
    if (!renderer.inView(sp, 20)) continue;
    const r = Math.max(1, 0.7 * sp.scale);
    const bobY = Math.sin(nowMs / 600 + seat.bob) * r * 0.25;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y + bobY, r, 0, Math.PI * 2);
    ctx.fillStyle = seat.color;
    ctx.fill();
  }
}

function fillQuad(renderer: Renderer, a: Vec2, c: Vec2, color: string): void {
  const { ctx } = renderer;
  const corners: Vec2[] = [
    { x: a.x, y: a.y },
    { x: c.x, y: a.y },
    { x: c.x, y: c.y },
    { x: a.x, y: c.y },
  ];
  ctx.beginPath();
  corners.forEach((w, i) => {
    const sp = renderer.project(w);
    if (i === 0) ctx.moveTo(sp.x, sp.y);
    else ctx.lineTo(sp.x, sp.y);
  });
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}
