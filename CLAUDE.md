# CLAUDE.md — conventions for The Warehouse

Read this before working in the repo. The design brief is `warehousebrief.md`; this
file captures the rules that keep the build coherent.

## What this is

A personal projects site. **Astro**, static output, deployed to **GitHub Pages**.
Currently at **Pass 1 (scaffolding)** — see README for what's stub vs done.

## Non-negotiable conventions

1. **Shell vs Rooms.** The shell (`src/layouts/Shell.astro`) is the constant
   signature on every page. Project "rooms" theme their interior freely _inside_ it.
   Don't duplicate shell concerns (head, mark, nav) into pages.

2. **One hand.** Every line the site draws — borders, underlines, tags, buttons,
   dividers, the passcode box, doodles — goes through `src/lib/ink.ts`. Don't draw
   sketch-style lines by hand in CSS/SVG; use the `InkPen` so it matches the brief's
   built-up multi-stroke look.

3. **The three dials live in one place.** `src/lib/style.ts` exports
   `STYLE = { passes, roughness, ends }`. Tune there; never hardcode these per
   component. Components may override per-call but should default to `STYLE`.

4. **Red is sacred.** The accent `--accent` (#B23A2E) is used **only** for the
   sealed/gated stamp (`src/components/Seal.astro`). Everything else is pure B&W
   (`--paper` / `--ink`). Do not introduce other colors.

5. **Respect reduced motion, always.** Branch animations on
   `prefersReducedMotion()` from `src/lib/motion.ts` and rely on the global
   `@media (prefers-reduced-motion: reduce)` reset in `global.css`. Reduced = show
   the final state, no animation.

6. **Mobile from the start** (brief §10). Asymmetric desktop scatter must reflow to a
   calmer near-stack with reduced tilt — design both, don't bolt mobile on later.

7. **Gating is casual.** Client-side passcodes (`PasscodePrompt.astro`) keep randoms
   out; they are not security. Anything truly private needs a real backend — flag it,
   don't pretend the passcode protects it.

## Data model

A project = one markdown file in `src/content/projects/`. Schema is in
`src/content.config.ts`. Adding/removing a project should never require code changes —
the hub and `projects/[...slug]` routes derive from the collection.

## Prototype migration (upcoming passes)

The user will provide four study files to migrate into this structure:
`line-study.html` → tune/verify `ink.ts`; `box-study.html` → CSS-3D `Crate` faces;
`hub-inked.html` + `hub-taste.html` → the real hub (bento wall, ambient world, motion,
seal-unravel, draw-in). Migrate into components/pages; keep the conventions above.

## Commands

`npm run dev` · `npm run build` · `npm run preview` · `npm run check` · `npm run format`
