import type { ItemDef, ItemId } from "../types";

/** The four throwables. Distinct feel via cooldown / stun / range / AoE.
 * `blinds` flags items that also blank a goalkeeper they land near. */
export const ITEM_DEFS: Record<ItemId, ItemDef & { blinds: boolean }> = {
  popcorn: {
    id: "popcorn",
    cooldownMs: 700,
    stunMs: 700,
    range: 34,
    speed: 22,
    suspicionWeight: 0.05,
    aoeRadius: 3,
    accuracyDebuff: 0.1,
    blinds: false,
  },
  scarf: {
    id: "scarf",
    cooldownMs: 2200,
    stunMs: 1500,
    range: 22,
    speed: 13,
    suspicionWeight: 0.3,
    aoeRadius: 2.5,
    accuracyDebuff: 0.35,
    blinds: true,
  },
  drink: {
    id: "drink",
    cooldownMs: 1500,
    stunMs: 1300,
    range: 30,
    speed: 20,
    suspicionWeight: 0.5,
    aoeRadius: 1.6,
    accuracyDebuff: 0.2,
    blinds: false,
  },
  flare: {
    id: "flare",
    cooldownMs: 6000,
    stunMs: 1800,
    range: 42,
    speed: 17,
    suspicionWeight: 1,
    aoeRadius: 6,
    accuracyDebuff: 0.5,
    blinds: true,
  },
};

export const ITEM_ORDER: ItemId[] = ["popcorn", "scarf", "drink", "flare"];
