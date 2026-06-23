import type { InputIntent, ItemId, Vec2 } from "../types";
import { ITEM_DEFS, ITEM_ORDER } from "../sim/items";
import { clampMagnitude } from "../vec";

export interface ControlsConfig {
  /** container the on-screen D-pad / throw / item buttons are built into */
  root: HTMLElement;
  /** notified when the held item changes, so the HUD can reflect it */
  onItemChange?: (item: ItemId) => void;
}

/** Max throw-joystick deflection (CSS px from the button centre) that maps to full
 * reach. Roughly the button radius, so dragging to the rim is "throw as far as I can". */
const THROW_STICK_RADIUS_PX = 56;

type DirKey = "up" | "down" | "left" | "right";
const DIR_VEC: Record<DirKey, Vec2> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/** Unifies touch and desktop into one InputIntent:
 *  - move: a 4-way D-pad (or arrow keys / WASD) hops between perches; directions are
 *    screen-relative and the sim picks the perch most aligned with them.
 *  - aim/throw: a hold joystick (bottom-right). Press to start aiming, deflect to place
 *    the reticle within reach (deflection maps straight to the landing offset), release
 *    to launch. Pointer events cover both mouse and touch. */
export class InputController {
  private keys = new Set<string>();

  /** directions currently held via the on-screen D-pad (keyboard is folded in at read) */
  private btnDirs = new Set<DirKey>();

  private aiming = false;
  private aimVector: Vec2 = { x: 0, y: 0 };
  private throwPointerId: number | null = null;
  private throwCenter: Vec2 = { x: 0, y: 0 };
  private throwReleased = false;

  private selectedItem: ItemId = "popcorn";

  private itemButtons = new Map<ItemId, HTMLElement>();
  private cleanups: Array<() => void> = [];

  constructor(private readonly cfg: ControlsConfig) {
    this.buildDom();
    this.attachKeyboard();
  }

  read(): InputIntent {
    const released = this.throwReleased;
    this.throwReleased = false;
    return {
      // movement is locked while a throw is being aimed
      moveDir: this.aiming ? { x: 0, y: 0 } : this.combinedMoveDir(),
      aiming: this.aiming,
      aimVector: this.aimVector,
      throwReleased: released,
      ducking: this.keys.has("shift"),
      selectedItem: this.selectedItem,
    };
  }

  dispose(): void {
    this.cleanups.forEach((fn) => fn());
    this.cleanups = [];
  }

  // ---------- move direction ----------

  /** Sum of held D-pad buttons + keyboard directions; opposites cancel. */
  private combinedMoveDir(): Vec2 {
    let x = 0;
    let y = 0;
    for (const d of this.btnDirs) {
      x += DIR_VEC[d].x;
      y += DIR_VEC[d].y;
    }
    if (this.keys.has("arrowleft") || this.keys.has("a")) x -= 1;
    if (this.keys.has("arrowright") || this.keys.has("d")) x += 1;
    if (this.keys.has("arrowup") || this.keys.has("w")) y -= 1;
    if (this.keys.has("arrowdown") || this.keys.has("s")) y += 1;
    return { x, y };
  }

  private selectItem(item: ItemId): void {
    this.selectedItem = item;
    for (const [id, el] of this.itemButtons) el.classList.toggle("is-active", id === item);
    this.cfg.onItemChange?.(item);
  }

  // ---------- DOM controls (D-pad + throw joystick + item buttons) ----------

  private buildDom(): void {
    const dpad = document.createElement("div");
    dpad.className = "ai-dpad";
    dpad.append(
      this.makeDirButton("ai-dpad-up", "▲", "up"),
      this.makeDirButton("ai-dpad-left", "◀", "left"),
      this.makeDirButton("ai-dpad-right", "▶", "right"),
      this.makeDirButton("ai-dpad-down", "▼", "down"),
    );

    const throwBtn = this.makeThrowButton();

    const items = document.createElement("div");
    items.className = "ai-items";
    for (const id of ITEM_ORDER) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ai-item";
      b.dataset.item = id;
      b.textContent = id[0].toUpperCase();
      b.title = `${id} (cd ${Math.round(ITEM_DEFS[id].cooldownMs / 100) / 10}s)`;
      b.addEventListener("click", () => this.selectItem(id));
      this.itemButtons.set(id, b);
      items.appendChild(b);
    }

    this.cfg.root.append(dpad, throwBtn, items);
    this.selectItem("popcorn");

    this.cleanups.push(() => {
      dpad.remove();
      throwBtn.remove();
      items.remove();
    });
  }

  /** A press-and-hold D-pad button. Holding repeats via the sim's PERCH_STEP_MS. */
  private makeDirButton(className: string, glyph: string, dir: DirKey): HTMLElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = className;
    btn.textContent = glyph;
    const press = (e: PointerEvent) => {
      this.btnDirs.add(dir);
      btn.classList.add("is-held");
      btn.setPointerCapture(e.pointerId);
      e.preventDefault();
    };
    const release = () => {
      this.btnDirs.delete(dir);
      btn.classList.remove("is-held");
    };
    btn.addEventListener("pointerdown", press);
    btn.addEventListener("pointerup", release);
    btn.addEventListener("pointercancel", release);
    btn.addEventListener("pointerleave", release);
    return btn;
  }

  /** The hold-to-aim throw joystick. Press → aim; deflect → place reticle (deflection
   * maps to the landing offset, clamped to the rim); release → launch. */
  private makeThrowButton(): HTMLElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ai-throw";
    const knob = document.createElement("span");
    knob.className = "ai-throw-knob";
    btn.appendChild(knob);

    const recenter = (): void => {
      this.aimVector = { x: 0, y: 0 };
      knob.style.transform = "translate(-50%, -50%)";
    };

    const updateFrom = (e: PointerEvent): void => {
      const v = clampMagnitude(
        {
          x: (e.clientX - this.throwCenter.x) / THROW_STICK_RADIUS_PX,
          y: (e.clientY - this.throwCenter.y) / THROW_STICK_RADIUS_PX,
        },
        1,
      );
      this.aimVector = v;
      // visual knob follows the deflection within the button
      knob.style.transform = `translate(calc(-50% + ${v.x * THROW_STICK_RADIUS_PX}px), calc(-50% + ${v.y * THROW_STICK_RADIUS_PX}px))`;
    };

    const onDown = (e: PointerEvent) => {
      if (this.throwPointerId !== null) return; // ignore extra fingers
      this.throwPointerId = e.pointerId;
      const rect = btn.getBoundingClientRect();
      this.throwCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      this.aiming = true;
      btn.classList.add("is-held");
      btn.setPointerCapture(e.pointerId);
      updateFrom(e);
      e.preventDefault();
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== this.throwPointerId) return;
      updateFrom(e);
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== this.throwPointerId) return;
      this.throwPointerId = null;
      this.aiming = false;
      this.throwReleased = true; // launch toward the current reticle
      btn.classList.remove("is-held");
      recenter();
    };
    const onCancel = (e: PointerEvent) => {
      if (e.pointerId !== this.throwPointerId) return;
      this.throwPointerId = null;
      this.aiming = false; // no throw on a cancelled gesture
      btn.classList.remove("is-held");
      recenter();
    };

    btn.addEventListener("pointerdown", onDown);
    btn.addEventListener("pointermove", onMove);
    btn.addEventListener("pointerup", onUp);
    btn.addEventListener("pointercancel", onCancel);
    return btn;
  }

  // ---------- keyboard ----------

  private attachKeyboard(): void {
    const onDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      this.keys.add(k);
      if (k >= "1" && k <= "4") {
        const idx = Number(k) - 1;
        if (ITEM_ORDER[idx]) this.selectItem(ITEM_ORDER[idx]);
      }
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
    };
    const onUp = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    this.cleanups.push(() => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    });
  }
}
