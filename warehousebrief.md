# The Warehouse — Design Brief

A personal website to **document and store** my projects. Working name: _The Warehouse_.

---

## 1. Goal & Principles

- A central hub showing all projects at a glance; each project gets its own dedicated page(s).
- Some projects gated by passcode so I control access.
- **Experience > reading** — interaction, motion, reveal; minimal text.
- Cool in _my own way_. Every choice serves the user's experience.
- Interests feeding the work: game design, sketching (Kim Jung Gi influence), UX for phones / smart glasses / smart devices, AI projects.

---

## 2. The Big Idea

- **Shell vs Rooms.** The _shell_ (hub, nav, transitions, my mark) carries my constant signature. Each _room_ (project page) is themed freely inside it. Solves "one identity + per-project variety."
- **Warehouse metaphor.** Projects = crates/boxes in a storage space. Fits "store my projects." Gated projects = sealed crates (lock built into the metaphor).
- **World around a grid.** A clean, scannable grid does the navigating; the warehouse world lives _around and between_ the tiles (not a maze you hunt through).

---

## 3. Site Structure (sitemap)

**1. Landing → Hub** (home)

- Optional ink-draw intro, then the crate gallery.
- Filter tags: All / Games / Sketch / UX / AI.
- My mark (corner) + small About access + contact tucked away.

**2. Project pages** (one themed room each)

- Shell constant, interior themed.
- Public = open on tap. Gated = locked crate → passcode → room.
- Content varies by type:
  - Games → playable / video + breakdown
  - Sketches → big zoomable art + process
  - UX → interactive mockups + problem→solution
  - AI → live demo + what it does

**3. Sub-pages** (only big projects)

- e.g. Game → Overview / Play / Process. Small projects = single page.

**Supporting**

- About (short, can be its own room), Contact / links, passcode popup, a sketchy on-brand 404.

**Navigation**

- Drawn, not corporate. My mark = home, always present. Back control. No big top nav bar.

---

## 4. The Hub

- **Bento crate layout** — mixed-size boxes packed like a crate wall, with slight hand-pinned tilt (±a few degrees). Asymmetric, _not_ a vertical list, but still scannable.
- Keep a rough eye-path (top→down, left→right) so no project is missed.
- Negative space between offset crates = where the world lives (scattered sketches, sprites, warehouse details).
- Ambient motion with **restraint**: small idle loops (swaying lamp, drifting paper plane, blinking eye), things that wake on hover. Never everything moving at once.
- Scattered sketches double as easter eggs.

---

## 5. Crates — Visual Treatment

- **Route A chosen: CSS does the 3D.** I draw _flat_ faces; code tilts them into a small perspective. Flexible, animatable, easy to live with. (Tradeoff: linework gets a _slight_ foreshorten at higher tilt — negligible when gentle.)
- Each crate shows **front + side (+ top lid)**:
  - **Front face** = my hand-drawn crate sketch.
  - **Side face** = the project's representative image, as a taped-on **poster**.
  - **Top** = a thin drawn lid.
- Gentle tilt (~**12–18°** felt right). Keep it a sketchbook, not a 3D render.
- Faces supplied as transparent PNG / SVG, B&W line, paper showing through.
- Poster foreshortening on the side is _correct_ — reads as a real taped poster.

---

## 6. Line Signature (house style)

The unifying thread across the whole site **and** my own sketches:

- Every line is **built up from many overlapping strokes**, each pass slightly off; overlaps darken where they cross.
- **Uneven, overshooting ends** — strokes run past / fall short of endpoints, corners cross or gap. Constructed, hand-inked, very Kim Jung Gi.
- Applied to _everything the site draws_: crate borders, underlines, tags, buttons, dividers, passcode box, doodles. My uploaded art already has it → site + art read as **one hand**.
- Built with **Rough.js** (multi-stroke sketch rendering). Vector, lightweight, scales crisp.

**Three dials = the house style.** Set once, reused everywhere:

- `passes` — buildup density (how many times each line is laid down)
- `roughness` — wobble/looseness of each pass
- `ends` — overshoot / uneven length at endpoints

Current placeholder config (to finalize): `STYLE = { passes: 3, roughness: 1.4, ends: 4 }`. Lives in one place at the top of the script; change it and the whole site updates.

---

## 7. Color & Type

- **Paper** off-white `#ECE6D6`. **Ink** near-black `#191512`.
- **One accent only:** red `#B23A2E`, spent solely on the **sealed/gated stamp**. Pure B&W everywhere else.
- Type (placeholders): hand-lettered display (_Caveat_ / _Kalam_) for titles + my mark; clean sans (_Space Grotesk_) for body = "clean bones, raw strokes."

---

## 8. Motion

- **Signature motif:** ink that **draws itself in** on load (stroke after stroke).
- Restraint over spectacle: subtle idle loops, hover wakes elements, light parallax for depth.
- Page transitions = a line wipes across and reveals the next page.
- Always respect `prefers-reduced-motion` (show final state, no animation).

---

## 9. Gating

- Gated projects stay **visible but sealed** (taped / stamped crate) — curiosity, not a wall.
- Tap → **hand-drawn passcode prompt** (looks sketched, not a system box). Correct code = seal unravels in ink (small reward). Per-project codes.
- ⚠️ **Security reality:** simple built-in passcodes = _casual_ gating only; technical visitors can bypass. Fine for "keep randoms out." Truly private/sensitive projects need real login + a backend (bigger build). Decide per project: casual lock vs real lock.

---

## 10. Mobile

- Asymmetric desktop scatter must **reflow to a calmer near-stack**.
- Reduce tilt/rotation; same soul, quieter layout. Design both from the start.

---

## 11. Prototypes built so far

- **hub-taste.html** — first clickable hub: bento crates, ink draw-in, filter tags, sealed crate + passcode demo, ambient sketches.
- **box-study.html** — Route A perspective crates (front sketch + side poster + lid) with a live **tilt slider** and hover rotate.
- **line-study.html** — the line signature lab: live **passes / roughness / ends** sliders, built-up vs flat comparison, draw-in.
- **hub-inked.html** — the hub rebuilt so all lines (borders, doodles, tags, seal, passcode) use the line signature via the single `STYLE` config.

---

## 12. Image-Generation Prompts (visual exploration)

**Main (hub):**

> Black ink line-art concept for a personal-projects website homepage, drawn in the style of Kim Jung Gi: dense, confident hand-drawn linework where every line is built up from many overlapping strokes with slightly uneven, overshooting ends. A warehouse interior on warm off-white sketch paper (#ECE6D6). Cardboard project crates of varying sizes stacked in an asymmetric, slightly tilted bento arrangement, each in light perspective so its front face and one side show. Front faces carry small inked icons (game controller, an eye, smart glasses, a phone, a spark); side faces have project posters taped on. One crate is sealed with tape and a single red wax stamp — the ONLY color in an otherwise pure black-and-white image. Faint warehouse shelf lines, a hanging bulb, loose scattered sketches and paper scraps in the negative space. Minimal hand-lettered labels. Raw, sketchy, alive — a page from an artist's sketchbook, not a clean vector or 3D render. Spacious web homepage composition.

**Compact:**

> B&W Kim Jung Gi-style ink portfolio homepage on warm off-white paper. Every line built up from overlapping strokes with uneven, overshooting ends. A warehouse of cardboard project crates in an asymmetric tilted bento layout, light perspective showing front + side faces, taped-on posters, one sealed crate with a single red wax stamp (the only color). Faint shelf lines, hanging bulb, scattered loose sketches. Raw sketchbook feel, not vector or 3D. `--ar 16:9 --style raw`

**UI-screenshot:**

> Screenshot of a personal-projects website homepage, full-bleed, no browser chrome, flat front-on view. Hand-drawn black ink aesthetic on warm off-white paper (#ECE6D6): a grid of project "crates" in an asymmetric bento layout with slight perspective tilt, each outlined in built-up multi-stroke linework with uneven ends, small inked icons, taped posters, hand-lettered titles. A row of sketchy filter tabs (All / Games / Sketch / UX / AI) near the top, a small monogram logo top-left, one sealed crate with a red stamp. Minimal text, lots of whitespace, clean scannable layout. Looks like a real responsive web UI rendered as an ink sketch. `--ar 16:9`

**Variations** (keep the style sentence, change the subject): single crate in 3/4 perspective · the interior of one project room · the sealed/gated crate close-up.

**Tips:** keep "red stamp = only color"; hub `--ar 16:9`, crate `--ar 4:5`, mobile `--ar 9:16` + "single-column stacked crates"; the words "screenshot / UI mockup / flat front-on" stop drift into a 3D scene; generate 4–6, then remix the closest.

---

## 13. Open Questions & Next Steps

- [ ] Lock the final `passes / roughness / ends` numbers.
- [ ] Swap placeholder names + doodles for real crate sketches + project posters.
- [ ] Design what's _inside_ a project page (the first themed room).
- [ ] Design the About room, contact, and the 404.
- [ ] Create my signature **mark / logo**.
- [ ] Decide which projects are _truly_ private (casual lock vs real login + backend).
- [ ] Run the image prompts to explore mood, then converge on the final look.
