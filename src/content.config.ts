/**
 * Content model for The Warehouse.
 *
 * Each project is one crate on the hub and one themed "room" behind it.
 * Adding a project later = adding one markdown file under src/content/projects/ —
 * no code changes. The schema below is the crate's data contract (brief §3–§5, §9).
 */
import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const projects = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/projects" }),
  schema: z.object({
    /** display title (hand-lettered on the crate) */
    title: z.string(),
    /** one-line summary; experience > reading, so keep it short (brief §1) */
    summary: z.string().max(160).optional(),

    /** filter tag (brief §3). "All" is the implicit default view, not a value. */
    category: z.enum(["Games", "Sketch", "UX", "AI"]),

    /** bento sizing token — drives how big the crate sits in the wall (brief §4) */
    size: z.enum(["s", "m", "l", "xl"]).default("m"),
    /** gentle CSS-3D tilt in degrees (brief §5: ~12–18 felt right) */
    tilt: z.number().min(0).max(24).default(15),
    /** hand-pinned bento jitter in degrees (brief §4: ±a few) */
    jitter: z.number().min(-6).max(6).default(0),
    /** eye-path ordering: lower sorts earlier (top→down, left→right) */
    order: z.number().default(0),

    /** crate front face — hand-drawn crate sketch (transparent PNG/SVG) */
    frontFace: z.string().optional(),
    /** crate side face — the taped-on project poster image */
    poster: z.string().optional(),
    /** small inked icon id for the front face (controller, eye, glasses…) */
    icon: z.string().optional(),

    /**
     * Casual gating (brief §9). `gated` shows a sealed/stamped crate; the code
     * is a CLIENT-SIDE convenience lock only — keeps randoms out, not a real
     * wall. Truly private projects need a real backend (decided per project).
     */
    gated: z.boolean().default(false),
    passcode: z.string().optional(),

    /** big projects get sub-pages (Overview / Play / Process); small = single */
    hasSubpages: z.boolean().default(false),

    /** hide from the hub without deleting the file */
    draft: z.boolean().default(false),
  }),
});

export const collections = { projects };
