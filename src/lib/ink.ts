/**
 * ink.ts — the drawing engine for the whole site.
 *
 * Every line the site draws should go through here so the page and my own
 * sketches read as "one hand" (brief §6). It wraps Rough.js and adds the two
 * things Rough lacks but the house style needs:
 *
 *   passes — lay each shape down N times (built-up density), each pass reseeded
 *            so the overlaps drift and darken where they cross.
 *   ends   — push/jitter endpoints so strokes overshoot or fall short, and
 *            corners cross or gap. Constructed, hand-inked, very Kim Jung Gi.
 *
 * `roughness` passes straight through to Rough.js. All three defaults come from
 * the single STYLE config (src/lib/style.ts).
 *
 * Output is SVG (vector, scales crisp). Mount via the <InkCanvas> component or
 * call these helpers directly against an <svg> element.
 */
import rough from "roughjs";
import type { RoughSVG } from "roughjs/bin/svg";
import type { Options } from "roughjs/bin/core";
import { STYLE, type InkStyle } from "@lib/style";
import { prefersReducedMotion, nextFrame } from "@lib/motion";

export interface InkOptions extends Partial<InkStyle> {
  /** stroke color — defaults to the ink token via currentColor */
  stroke?: string;
  strokeWidth?: number;
  /** extra Rough.js options merged last (escape hatch) */
  rough?: Options;
}

export interface Point {
  x: number;
  y: number;
}

const SVG_NS = "http://www.w3.org/2000/svg";

/** Resolve per-call options against the global STYLE. */
function resolve(opts: InkOptions = {}) {
  return {
    passes: opts.passes ?? STYLE.passes,
    roughness: opts.roughness ?? STYLE.roughness,
    ends: opts.ends ?? STYLE.ends,
    stroke: opts.stroke ?? "currentColor",
    strokeWidth: opts.strokeWidth ?? 1.4,
    rough: opts.rough ?? {},
  };
}

/** A small symmetric random jitter in [-amount, amount]. */
function jitter(amount: number): number {
  return (Math.random() * 2 - 1) * amount;
}

/** Extend a segment past both endpoints by up to `ends` px (overshoot/undershoot). */
function overshoot(a: Point, b: Point, ends: number): [Point, Point] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const oa = jitter(ends);
  const ob = jitter(ends);
  return [
    { x: a.x - ux * oa, y: a.y - uy * oa },
    { x: b.x + ux * ob, y: b.y + uy * ob },
  ];
}

/**
 * A pen bound to one <svg> element. Reuse it to draw many shapes in the same
 * coordinate space.
 */
export class InkPen {
  readonly svg: SVGSVGElement;
  private rc: RoughSVG;

  constructor(svg: SVGSVGElement) {
    this.svg = svg;
    this.rc = rough.svg(svg);
  }

  private baseOptions(r: ReturnType<typeof resolve>, seed: number): Options {
    return {
      roughness: r.roughness,
      stroke: r.stroke,
      strokeWidth: r.strokeWidth,
      seed,
      ...r.rough,
    };
  }

  private append(node: SVGGElement): SVGGElement {
    this.svg.appendChild(node);
    return node;
  }

  /** A straight line, built up over `passes` with overshooting ends. */
  line(a: Point, b: Point, opts: InkOptions = {}): SVGGElement[] {
    const r = resolve(opts);
    const nodes: SVGGElement[] = [];
    for (let p = 0; p < r.passes; p++) {
      const [from, to] = overshoot(a, b, r.ends);
      nodes.push(this.append(this.rc.line(from.x, from.y, to.x, to.y, this.baseOptions(r, p + 1))));
    }
    return nodes;
  }

  /**
   * A rectangle drawn as four independent overshooting lines so corners cross
   * or gap — the signature look. Built up over `passes`.
   */
  rect(x: number, y: number, w: number, h: number, opts: InkOptions = {}): SVGGElement[] {
    const tl = { x, y };
    const tr = { x: x + w, y };
    const br = { x: x + w, y: y + h };
    const bl = { x, y: y + h };
    return [
      ...this.line(tl, tr, opts),
      ...this.line(tr, br, opts),
      ...this.line(br, bl, opts),
      ...this.line(bl, tl, opts),
    ];
  }

  /** An open polyline through points, built up over `passes`. */
  path(points: Point[], opts: InkOptions = {}): SVGGElement[] {
    if (points.length < 2) return [];
    const nodes: SVGGElement[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      nodes.push(...this.line(points[i]!, points[i + 1]!, opts));
    }
    return nodes;
  }

  /** Remove everything this pen has drawn. */
  clear(): void {
    while (this.svg.firstChild) this.svg.removeChild(this.svg.firstChild);
  }
}

/**
 * Draw a set of nodes "in", one after another (the signature load motif).
 * Honors prefers-reduced-motion: when reduced, everything is shown at once.
 *
 * NOTE: this is a stub reveal (fade/opacity per node). The final stroke-tracing
 * draw-in (stroke-dasharray along each path) lands when the line-study prototype
 * is migrated.
 */
export async function drawIn(nodes: SVGGElement[], perStrokeMs = 90): Promise<void> {
  if (prefersReducedMotion()) {
    for (const n of nodes) n.style.opacity = "1";
    return;
  }
  for (const n of nodes) n.style.opacity = "0";
  for (const n of nodes) {
    n.style.transition = "opacity 160ms linear";
    n.style.opacity = "1";
    await nextFrame();
    await new Promise((res) => setTimeout(res, perStrokeMs));
  }
}

/** Convenience: make a pen for an existing <svg>. */
export function inkOn(svg: SVGSVGElement): InkPen {
  return new InkPen(svg);
}

/** Convenience: create a fresh, responsive <svg> sized to a host element. */
export function createInkSvg(width: number, height: number): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.setAttribute("preserveAspectRatio", "none");
  return svg;
}
