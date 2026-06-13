/**
 * THE house style — the single source of truth for the line signature.
 *
 * Brief §6: "Three dials = the house style. Set once, reused everywhere."
 * Change these numbers and every drawn line on the site updates: crate borders,
 * underlines, tags, buttons, dividers, the passcode box, doodles.
 *
 *   passes    — buildup density: how many times each line is laid down.
 *   roughness — wobble / looseness of each pass (passed through to Rough.js).
 *   ends      — overshoot / uneven length at endpoints, in px.
 *
 * TODO (brief §13): lock the final numbers via the line-study lab.
 */
export interface InkStyle {
  passes: number;
  roughness: number;
  ends: number;
}

export const STYLE: InkStyle = {
  passes: 3,
  roughness: 1.4,
  ends: 4,
};
