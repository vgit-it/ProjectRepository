# The Warehouse

A personal site to **document and store** my projects. Built with [Astro](https://astro.build),
deployed to GitHub Pages. Design brief: `warehousebrief.md`.

> **Status: Pass 2 — prototypes migrated.** The architecture, design tokens, the
> line-signature engine, and the project data model are in place, and the four study
> prototypes are migrated: the inked bento hub of CSS-3D crates, the ambient world,
> the draw-in motion, and the passcode gate. Still to come: real crate art/posters,
> themed project-room interiors, the signature mark, and page transitions.

## Architecture

**Shell vs Rooms** (brief §2): the _shell_ (`src/layouts/Shell.astro`) carries the
constant signature — the mark (= home), head, transitions. Each _room_ (a project
page) themes its interior freely inside the shell.

```
src/
  styles/        tokens.css (color/type/spacing) + global.css (reset, reduced-motion)
  lib/
    style.ts     THE single STYLE config { passes, roughness, ends } — change once,
                 the whole site updates (brief §6)
    ink.ts       Rough.js wrapper: draw(svg, recipe) builds up passes + draw-in
    doodles.ts   the inked crate icons (game/eye/glass/phone/ai/lock)
    motion.ts    prefers-reduced-motion guard + shared helpers
  content/
    projects/    one .md per project = one crate + one room
  content.config.ts   the crate/project schema (Zod)
  layouts/Shell.astro
  components/    Crate (3D), Seal, PasscodePrompt, Ambient
  pages/         index (hub), projects/[...slug] (room), about, 404
```

## Commands

```sh
npm install      # install deps
npm run dev      # local dev server
npm run build    # static build → dist/
npm run preview  # preview the build
npm run check    # astro type/diagnostics check
npm run format   # prettier write
```

## The line signature

Set the three dials once in `src/lib/style.ts`:

```ts
export const STYLE = { passes: 3, roughness: 1.4, ends: 4 };
```

`passes` = buildup density, `roughness` = wobble, `ends` = endpoint overshoot. Draw
through `src/lib/ink.ts` — `draw(svg, recipe, { animate })` lays a recipe down over
`passes` and (optionally) reveals it stroke-group by stroke-group. A recipe gets an
`InkApi` (`line/rect/circle/ellipse/path`). This keeps the site and the sketches one
hand. Final numbers are still TODO (brief §13).

## Adding a project

Create `src/content/projects/<slug>.md` with frontmatter matching the schema in
`src/content.config.ts` (title, category, icon, cols/rows, tilt/jitter, gated, …).
It appears as a crate on the hub and gets its room at `/projects/<slug>`
automatically — no code changes.

## Gating

`gated: true` shows a sealed crate and a passcode prompt. ⚠️ This is a **casual**
client-side lock only (the code ships in the page) — it keeps randoms out, it is not
real security. Truly private projects need a real backend (brief §9).

## Deploy (GitHub Pages)

`.github/workflows/deploy.yml` builds and publishes on push to the **default** branch.
Scaffolding currently lives on a feature branch, so deploys start after merge.

Before the first deploy: **Settings → Pages → Source: "GitHub Actions"**.

The site is served from a sub-path (`/ProjectRepository`), set as `base` in
`astro.config.mjs`. If a custom domain is added later, set `site` to it and change
`base` back to `/`.
