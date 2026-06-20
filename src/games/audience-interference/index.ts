import { GameLoop } from "./loop/GameLoop";
import { drawBall } from "./render/drawBall";
import { drawPitch } from "./render/drawPitch";
import { drawPlayers } from "./render/drawPlayers";
import { Renderer } from "./render/Renderer";
import { MatchSim } from "./sim/MatchSim";
import type { MatchState } from "./types";

export interface BootHandle {
  stop: () => void;
}

function formatClock(elapsedMs: number): string {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

/** Temporary on-canvas readout for M1 playtesting; the real DOM HUD lands in M5. */
function drawDebugHud(renderer: Renderer, state: MatchState): void {
  const { ctx } = renderer;
  ctx.fillStyle = "#f5f5f0";
  ctx.font = "16px monospace";
  ctx.textBaseline = "top";
  ctx.fillText(`HOME ${state.score.home} - ${state.score.away} AWAY`, 12, 10);
  ctx.fillText(`${state.clock.phase}  ${formatClock(state.clock.elapsedMs)}`, 12, 30);
}

/** Public entry point: wires a MatchSim to a canvas via a fixed-timestep GameLoop. */
export function boot(canvas: HTMLCanvasElement): BootHandle {
  const renderer = new Renderer(canvas);
  const sim = new MatchSim();

  const resize = (): void => {
    const rect = canvas.getBoundingClientRect();
    renderer.resize(rect.width, rect.height);
  };
  resize();
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);

  function render(): void {
    renderer.clear();
    drawPitch(renderer);
    drawPlayers(renderer, sim.state.players);
    drawBall(renderer, sim.state.ball);
    drawDebugHud(renderer, sim.state);
  }

  const loop = new GameLoop(
    (dtMs) => sim.update(dtMs),
    () => render(),
  );
  loop.start();

  return {
    stop: () => {
      loop.stop();
      resizeObserver.disconnect();
    },
  };
}
