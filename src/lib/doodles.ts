/**
 * Doodle recipes — the little inked icons on each crate face.
 * Ported from the hub-inked prototype's DOOD set. Each is an ink Recipe drawn in
 * its own small viewBox; keyed by the `icon` field on a project (content schema).
 */
import type { Recipe } from "@lib/ink";

export const DOODLES: Record<string, Recipe> = {
  // game controller — viewBox ~ 0 0 54 38
  game: (d) => {
    d.rect(2, 12, 46, 20);
    d.line(12, 18, 12, 26);
    d.line(8, 22, 16, 22);
    d.circle(36, 18, 6);
    d.circle(44, 25, 6);
  },
  // an eye — viewBox ~ 0 0 56 36
  eye: (d) => {
    d.path("M4 18 Q28 2 52 18 Q28 34 4 18 Z");
    d.circle(28, 18, 13);
    d.circle(28, 18, 4);
  },
  // smart glasses — viewBox ~ 0 0 60 32
  glass: (d) => {
    d.circle(15, 16, 22);
    d.circle(45, 16, 22);
    d.line(26, 13, 34, 13);
  },
  // a phone — viewBox ~ 0 0 30 38
  phone: (d) => {
    d.rect(4, 2, 22, 32);
    d.line(11, 30, 19, 30);
  },
  // an AI spark/head — viewBox ~ 0 0 44 40
  ai: (d) => {
    d.path("M22 4 Q8 4 8 18 Q4 22 8 26 Q8 36 22 36 Q36 36 36 26 Q40 22 36 18 Q36 4 22 4 Z");
    d.line(22, 14, 22, 26);
    d.line(16, 20, 28, 20);
  },
  // a padlock — viewBox ~ 0 0 34 38
  lock: (d) => {
    d.rect(5, 16, 24, 20);
    d.path("M10 16 V10 a7 7 0 0 1 14 0 V16");
  },
};

/** viewBox dimensions matched to each recipe above, for sizing the host svg. */
export const DOODLE_BOX: Record<string, [number, number]> = {
  game: [54, 38],
  eye: [56, 36],
  glass: [60, 32],
  phone: [30, 38],
  ai: [44, 40],
  lock: [34, 38],
};
