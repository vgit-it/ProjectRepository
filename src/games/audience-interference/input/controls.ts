import type { InputIntent, ItemId, Vec2 } from "../types";
import { ITEM_DEFS, ITEM_ORDER } from "../sim/items";

export interface ControlsConfig {
  canvas: HTMLCanvasElement;
  /** container the on-screen move / item buttons are built into */
  root: HTMLElement;
  /** maps a CSS-pixel pointer position (relative to the canvas) to a world point */
  screenToWorld: (css: Vec2) => Vec2;
  /** notified when the held item changes, so the HUD can reflect it */
  onItemChange?: (item: ItemId) => void;
}

/** Lift the reticle this many CSS px above a touch point so the fingertip doesn't
 * cover it. Mouse aiming is exact (cursor is a point) and gets no offset. */
const TOUCH_AIM_OFFSET_PX = 60;

/** Unifies touch and desktop into one InputIntent:
 *  - move: on-screen ◀ ▶ buttons or ←/→ + A/D hop around the perch ring
 *  - aim/throw: a single slingshot drag anywhere on the pitch (pointer events cover
 *    both mouse and touch) — press to aim, drag to point, release to launch. */
export class InputController {
  private keys = new Set<string>();

  /** ring direction held via the on-screen buttons (keyboard is folded in at read()) */
  private btnDir: -1 | 0 | 1 = 0;

  private aiming = false;
  private aimPoint: Vec2 = { x: 0, y: 0 };
  private aimPointerId: number | null = null;
  private throwReleased = false;

  private selectedItem: ItemId = "popcorn";

  private itemButtons = new Map<ItemId, HTMLElement>();
  private cleanups: Array<() => void> = [];

  constructor(private readonly cfg: ControlsConfig) {
    this.buildDom();
    this.attachKeyboard();
    this.attachAim();
  }

  read(): InputIntent {
    const moveDir = this.aiming ? 0 : this.combinedMoveDir();
    const released = this.throwReleased;
    this.throwReleased = false;
    return {
      moveDir,
      aiming: this.aiming,
      aimPoint: this.aimPoint,
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

  private combinedMoveDir(): -1 | 0 | 1 {
    if (this.btnDir !== 0) return this.btnDir;
    const left = this.keys.has("arrowleft") || this.keys.has("a");
    const right = this.keys.has("arrowright") || this.keys.has("d");
    if (left === right) return 0; // none or both -> hold
    return left ? -1 : 1;
  }

  private selectItem(item: ItemId): void {
    this.selectedItem = item;
    for (const [id, el] of this.itemButtons) el.classList.toggle("is-active", id === item);
    this.cfg.onItemChange?.(item);
  }

  // ---------- DOM controls (move + item buttons) ----------

  private buildDom(): void {
    const left = this.makeMoveButton("ai-move-left", "◀", -1);
    const right = this.makeMoveButton("ai-move-right", "▶", 1);

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

    this.cfg.root.append(left, right, items);
    this.selectItem("popcorn");

    this.cleanups.push(() => {
      left.remove();
      right.remove();
      items.remove();
    });
  }

  /** A press-and-hold ring-hop button. Holding repeats via the sim's PERCH_STEP_MS. */
  private makeMoveButton(className: string, glyph: string, dir: -1 | 1): HTMLElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = className;
    btn.textContent = glyph;
    const press = (e: PointerEvent) => {
      this.btnDir = dir;
      btn.classList.add("is-held");
      btn.setPointerCapture(e.pointerId);
      e.preventDefault();
    };
    const release = () => {
      if (this.btnDir === dir) this.btnDir = 0;
      btn.classList.remove("is-held");
    };
    btn.addEventListener("pointerdown", press);
    btn.addEventListener("pointerup", release);
    btn.addEventListener("pointercancel", release);
    btn.addEventListener("pointerleave", release);
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

  // ---------- slingshot aim on the canvas (mouse + touch via pointer events) ----------

  private attachAim(): void {
    const { canvas } = this.cfg;

    const toWorld = (e: PointerEvent): Vec2 => {
      const rect = canvas.getBoundingClientRect();
      const offsetY = e.pointerType === "mouse" ? 0 : TOUCH_AIM_OFFSET_PX;
      return this.cfg.screenToWorld({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top - offsetY,
      });
    };

    const onDown = (e: PointerEvent) => {
      if (this.aimPointerId !== null) return; // ignore extra fingers mid-drag
      this.aimPointerId = e.pointerId;
      this.aiming = true;
      this.aimPoint = toWorld(e);
      canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== this.aimPointerId) return;
      this.aimPoint = toWorld(e);
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== this.aimPointerId) return;
      this.aimPoint = toWorld(e);
      this.aimPointerId = null;
      this.aiming = false;
      this.throwReleased = true;
    };
    const onCancel = (e: PointerEvent) => {
      if (e.pointerId !== this.aimPointerId) return;
      this.aimPointerId = null;
      this.aiming = false; // no throw on a cancelled gesture
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onCancel);
    this.cleanups.push(() => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onCancel);
    });
  }
}
