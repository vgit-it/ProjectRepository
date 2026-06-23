import { CAMERA_LOOK_AHEAD_M } from "./constants";
import { InputController } from "./input/controls";
import { GameLoop } from "./loop/GameLoop";
import { drawAim } from "./render/drawAim";
import { drawBall } from "./render/drawBall";
import { drawPitch } from "./render/drawPitch";
import { drawPlayers } from "./render/drawPlayers";
import { drawProjectiles } from "./render/drawProjectiles";
import { drawSpectator } from "./render/drawSpectator";
import { drawStands } from "./render/drawStands";
import { Fx } from "./render/fx";
import { Renderer } from "./render/Renderer";
import { ITEM_DEFS, ITEM_ORDER } from "./sim/items";
import { WorldSim } from "./sim/WorldSim";
import type { GameOutcome, ItemId, Team, Vec2 } from "./types";

export interface HudState {
  home: number;
  away: number;
  phase: string;
  clock: string;
  outcome: GameOutcome;
  backedTeam: Team;
  selectedItem: ItemId;
  /** per-item readiness, 0 (just thrown) .. 1 (ready) */
  cooldowns: Record<ItemId, number>;
}

export interface BootOptions {
  /** container to mount the on-screen D-pad + throw joystick + item buttons into */
  controlsRoot?: HTMLElement;
  /** called every frame with the current HUD snapshot */
  onHud?: (hud: HudState) => void;
}

export interface BootHandle {
  stop: () => void;
  /** Reset the match, spectator, and outcome to kick off a fresh game. */
  restart: () => void;
}

function formatClock(elapsedMs: number): string {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

/** Public entry point: wires the WorldSim (match + spectator + throwing) to a canvas
 * via a fixed-timestep GameLoop, a follow camera, and unified input. */
export function boot(canvas: HTMLCanvasElement, options: BootOptions = {}): BootHandle {
  const renderer = new Renderer(canvas);
  let sim = new WorldSim();
  const fx = new Fx();

  const resize = (): void => {
    const rect = canvas.getBoundingClientRect();
    renderer.resize(rect.width, rect.height);
  };
  resize();
  // Observe the stage (the canvas's sized parent) rather than the canvas: the
  // canvas now flexes via CSS, so watching the element that actually drives the
  // box keeps the backing buffer in sync across the fullscreen maximize/restore.
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas.parentElement ?? canvas);

  // focus the camera between the spectator and the pitch they're facing
  const focusTarget = (): Vec2 => {
    const { spectator } = sim;
    return {
      x: spectator.pos.x + Math.cos(spectator.facing) * CAMERA_LOOK_AHEAD_M,
      y: spectator.pos.y + Math.sin(spectator.facing) * CAMERA_LOOK_AHEAD_M,
    };
  };
  renderer.camera.snapTo(focusTarget());

  const input = options.controlsRoot
    ? new InputController({ root: options.controlsRoot })
    : null;

  function emitHud(): void {
    if (!options.onHud) return;
    const now = sim.nowMs;
    const cooldowns = {} as Record<ItemId, number>;
    for (const id of ITEM_ORDER) {
      const end = sim.spectator.itemCooldowns[id];
      const cd = ITEM_DEFS[id].cooldownMs;
      cooldowns[id] = Math.max(0, Math.min(1, 1 - (end - now) / cd));
    }
    options.onHud({
      home: sim.match.state.score.home,
      away: sim.match.state.score.away,
      phase: sim.match.state.clock.phase,
      clock: formatClock(sim.match.state.clock.elapsedMs),
      outcome: sim.outcome,
      backedTeam: sim.backedTeam,
      selectedItem: sim.spectator.heldItem,
      cooldowns,
    });
  }

  function render(): void {
    renderer.camera.follow(focusTarget());
    const now = sim.nowMs;

    // Drain one-shot sim events into the juice layer, then advance the shake/FX.
    fx.consume(sim.match.state.events, now);
    sim.match.state.events.length = 0;
    fx.update(now);

    renderer.clear();
    const { ctx } = renderer;
    const offset = fx.cameraOffset();
    ctx.save();
    ctx.translate(offset.x, offset.y);
    drawStands(renderer, now);
    drawPitch(renderer);
    drawPlayers(renderer, sim.match.state.players, now);
    drawBall(renderer, sim.match.state.ball);
    drawProjectiles(renderer, sim.projectiles, now);
    drawSpectator(renderer, sim.spectator);
    drawAim(renderer, sim.spectator, now);
    fx.draw(renderer, now);
    ctx.restore();
    emitHud();
  }

  const loop = new GameLoop(
    (dtMs) => sim.update(input ? input.read() : EMPTY_INTENT, dtMs),
    () => render(),
  );
  loop.start();

  return {
    stop: () => {
      loop.stop();
      resizeObserver.disconnect();
      input?.dispose();
    },
    restart: () => {
      sim = new WorldSim();
      renderer.camera.snapTo(focusTarget());
    },
  };
}

const EMPTY_INTENT = {
  moveDir: { x: 0, y: 0 },
  aiming: false,
  aimVector: { x: 0, y: 0 },
  throwReleased: false,
  ducking: false,
  selectedItem: "popcorn" as ItemId,
};
