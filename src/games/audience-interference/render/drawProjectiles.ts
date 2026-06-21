import type { ItemId, Projectile } from "../types";
import { projectileArcHeight } from "../sim/projectiles";
import type { Renderer } from "./Renderer";

// DEV PALETTE: see drawPitch.ts for the scoped CLAUDE.md palette exception note.
const ITEM_COLOR: Record<ItemId, string> = {
  popcorn: "#f6d97a",
  scarf: "#d6453f",
  drink: "#5ec0e8",
  flare: "#ff5a36",
};

/** In-flight items: a ground shadow at the landing track + the item lofted along a
 * parabolic arc above it. */
export function drawProjectiles(
  renderer: Renderer,
  projectiles: Projectile[],
  nowMs: number,
): void {
  const { ctx } = renderer;
  for (const proj of projectiles) {
    const ground = renderer.project(proj.pos);
    if (!renderer.inView(ground, 40)) continue;
    const h = projectileArcHeight(proj, nowMs);
    const r = Math.max(2, 0.6 * ground.scale);

    // shadow on the ground
    ctx.beginPath();
    ctx.ellipse(ground.x, ground.y, r, r * 0.45, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fill();

    // lofted item (shift up by arc height in screen px)
    const y = ground.y - h * ground.scale;
    ctx.beginPath();
    ctx.arc(ground.x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = ITEM_COLOR[proj.itemId];
    ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.2);
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.stroke();

    if (proj.itemId === "flare") {
      ctx.beginPath();
      ctx.arc(ground.x, y, r * 1.8, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,90,54,0.4)";
      ctx.lineWidth = Math.max(1, r * 0.4);
      ctx.stroke();
    }
  }
}
