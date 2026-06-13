/**
 * ink.ts — the drawing engine for the whole site.
 *
 * Every line the site draws goes through here so the page and my own sketches
 * read as "one hand" (brief §6). It wraps Rough.js and adds the two things Rough
 * lacks but the house style needs:
 *
 *   passes — lay each shape down N times (built-up density). Each pass is its own
 *            <g class="pass"> so it can be revealed in sequence (the draw-in).
 *   ends   — push/jitter endpoints so strokes overshoot or fall short, and
 *            corners cross or gap. Very Kim Jung Gi.
 *
 * `roughness` passes straight through to Rough.js. All three come from the single
 * STYLE config (src/lib/style.ts). Ported from the line-study / hub-inked
 * prototypes; the .pass / .pass.show CSS lives in global.css.
 */
import rough from "roughjs";
import type { RoughSVG } from "roughjs/bin/svg";
import { STYLE } from "@lib/style";
import { prefersReducedMotion } from "@lib/motion";

/** The drawing surface handed to a recipe. Coordinates are in the svg's viewBox. */
export interface InkApi {
  line(x1: number, y1: number, x2: number, y2: number): void;
  rect(x: number, y: number, w: number, h: number): void;
  circle(cx: number, cy: number, diameter: number): void;
  ellipse(cx: number, cy: number, w: number, h: number): void;
  path(d: string): void;
}

/** A recipe describes what to draw, independent of passes/animation. */
export type Recipe = (d: InkApi) => void;

export interface DrawOpts {
  /** reveal passes one after another (the load draw-in). Respects reduced motion. */
  animate?: boolean;
  /** stroke color. Defaults to currentColor so it inherits CSS `color`. */
  color?: string;
  /** stagger between passes, ms (only when animate) */
  stagger?: number;
}

const SVGNS = "http://www.w3.org/2000/svg";
const STROKE_WIDTH = 1.3;
const BOWING = 1.4;
const PATH_OPACITY = "0.72";

const seed = () => Math.floor(Math.random() * 99999);

/** Extend/retract each end of a segment along its own direction (the overshoot). */
function stretch(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  over: number,
): [number, number, number, number] {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const a = (Math.random() * 2 - 1) * over;
  const b = (Math.random() * 2 - 1) * over;
  return [x1 - ux * a, y1 - uy * a, x2 + ux * b, y2 + uy * b];
}

/** Build the drawing API for one pass group. */
function makeApi(g: SVGGElement, rc: RoughSVG, color: string): InkApi {
  const o = {
    stroke: color,
    strokeWidth: STROKE_WIDTH,
    roughness: STYLE.roughness,
    bowing: BOWING,
  };
  const rl = (x1: number, y1: number, x2: number, y2: number) => {
    const [a, b, c, d] = stretch(x1, y1, x2, y2, STYLE.ends);
    g.appendChild(rc.line(a, b, c, d, { ...o, seed: seed() }));
  };
  return {
    line: rl,
    rect: (x, y, w, h) => {
      rl(x, y, x + w, y);
      rl(x + w, y, x + w, y + h);
      rl(x + w, y + h, x, y + h);
      rl(x, y + h, x, y);
    },
    circle: (cx, cy, diameter) => {
      g.appendChild(rc.circle(cx, cy, diameter, { ...o, seed: seed() }));
    },
    ellipse: (cx, cy, w, h) => {
      g.appendChild(rc.ellipse(cx, cy, w, h, { ...o, seed: seed() }));
    },
    path: (d) => {
      g.appendChild(rc.path(d, { ...o, seed: seed() }));
    },
  };
}

/** Remove everything previously drawn in an svg. */
export function clear(svg: SVGSVGElement): void {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
}

/**
 * Draw a recipe into an <svg>, built up over STYLE.passes. With `animate`, the
 * passes reveal one after another; under reduced motion everything shows at once.
 */
export function draw(svg: SVGSVGElement, recipe: Recipe, opts: DrawOpts = {}): void {
  const { animate = false, color = "currentColor", stagger = 130 } = opts;
  clear(svg);
  const rc = rough.svg(svg);
  const reduce = prefersReducedMotion();
  const groups: SVGGElement[] = [];
  for (let p = 0; p < STYLE.passes; p++) {
    const g = document.createElementNS(SVGNS, "g");
    g.setAttribute("class", "pass");
    if (!animate || reduce) g.classList.add("show");
    svg.appendChild(g);
    recipe(makeApi(g, rc, color));
    g.querySelectorAll("path").forEach((pa) => pa.setAttribute("opacity", PATH_OPACITY));
    groups.push(g);
  }
  if (animate && !reduce) {
    groups.forEach((g, i) => setTimeout(() => g.classList.add("show"), 90 + i * stagger));
  }
}

/** Size an <svg> to a pixel box (sets viewBox so recipe coords are in px). */
export function size(svg: SVGSVGElement, w: number, h: number): void {
  svg.setAttribute("viewBox", `0 0 ${Math.max(1, w)} ${Math.max(1, h)}`);
}
