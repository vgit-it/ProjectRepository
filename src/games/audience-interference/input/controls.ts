import type { InputIntent, ItemId, Vec2 } from "../types";
import { ITEM_DEFS, ITEM_ORDER } from "../sim/items";

export interface ControlsConfig {
  canvas: HTMLCanvasElement;
  /** container the on-screen joystick / throw / item buttons are built into */
  root: HTMLElement;
  /** current spectator position in CSS pixels, for desktop mouse aiming */
  getSpectatorScreen: () => Vec2;
  /** notified when the held item changes, so the HUD can reflect it */
  onItemChange?: (item: ItemId) => void;
}

/** Unifies touch (virtual joystick + THROW + item buttons) and desktop
 * (WASD/arrows + mouse aim + number keys) into a single InputIntent. */
export class InputController {
  private keys = new Set<string>();

  private joyVec: Vec2 = { x: 0, y: 0 };
  private joyPointer: number | null = null;
  private joyCenter: Vec2 = { x: 0, y: 0 };
  private joyRadius = 50;

  private throwHeld = false; // virtual THROW button
  private mouseAimHeld = false; // desktop mouse aim
  private mouseCss: Vec2 = { x: 0, y: 0 };
  private throwReleased = false;

  private selectedItem: ItemId = "popcorn";

  private knob!: HTMLElement;
  private itemButtons = new Map<ItemId, HTMLElement>();
  private cleanups: Array<() => void> = [];

  constructor(private readonly cfg: ControlsConfig) {
    this.buildDom();
    this.attachKeyboard();
    this.attachMouse();
  }

  read(): InputIntent {
    const aiming = this.throwHeld || this.mouseAimHeld;
    const aimVector = aiming ? this.computeAim() : { x: 0, y: 0 };
    const move = aiming ? { x: 0, y: 0 } : this.combinedMove();
    const released = this.throwReleased;
    this.throwReleased = false;
    return {
      move,
      aiming,
      aimVector,
      throwReleased: released,
      ducking: this.keys.has("shift"),
      selectedItem: this.selectedItem,
    };
  }

  dispose(): void {
    this.cleanups.forEach((fn) => fn());
    this.cleanups = [];
  }

  // ---------- aim / move resolution ----------

  private computeAim(): Vec2 {
    if (this.mouseAimHeld) {
      const s = this.cfg.getSpectatorScreen();
      const dx = this.mouseCss.x - s.x;
      const dy = this.mouseCss.y - s.y;
      return norm({ x: dx, y: dy });
    }
    // touch: joystick steers the aim
    return norm(this.joyVec);
  }

  private combinedMove(): Vec2 {
    let x = this.joyVec.x;
    let y = this.joyVec.y;
    if (this.keys.has("a") || this.keys.has("arrowleft")) x -= 1;
    if (this.keys.has("d") || this.keys.has("arrowright")) x += 1;
    if (this.keys.has("w") || this.keys.has("arrowup")) y -= 1;
    if (this.keys.has("s") || this.keys.has("arrowdown")) y += 1;
    const len = Math.hypot(x, y);
    return len > 1 ? { x: x / len, y: y / len } : { x, y };
  }

  private selectItem(item: ItemId): void {
    this.selectedItem = item;
    for (const [id, el] of this.itemButtons) el.classList.toggle("is-active", id === item);
    this.cfg.onItemChange?.(item);
  }

  // ---------- DOM controls ----------

  private buildDom(): void {
    const joy = document.createElement("div");
    joy.className = "ai-joystick";
    const knob = document.createElement("div");
    knob.className = "ai-knob";
    joy.appendChild(knob);
    this.knob = knob;

    const throwBtn = document.createElement("button");
    throwBtn.type = "button";
    throwBtn.className = "ai-throw";
    throwBtn.textContent = "THROW";

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

    this.cfg.root.append(joy, items, throwBtn);
    this.selectItem("popcorn");

    // joystick pointer handling
    const onJoyDown = (e: PointerEvent) => {
      this.joyPointer = e.pointerId;
      const rect = joy.getBoundingClientRect();
      this.joyCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      this.joyRadius = rect.width / 2;
      joy.setPointerCapture(e.pointerId);
      this.updateJoy(e.clientX, e.clientY);
      e.preventDefault();
    };
    const onJoyMove = (e: PointerEvent) => {
      if (e.pointerId !== this.joyPointer) return;
      this.updateJoy(e.clientX, e.clientY);
    };
    const onJoyUp = (e: PointerEvent) => {
      if (e.pointerId !== this.joyPointer) return;
      this.joyPointer = null;
      this.joyVec = { x: 0, y: 0 };
      this.knob.style.transform = "translate(0px, 0px)";
    };
    joy.addEventListener("pointerdown", onJoyDown);
    joy.addEventListener("pointermove", onJoyMove);
    joy.addEventListener("pointerup", onJoyUp);
    joy.addEventListener("pointercancel", onJoyUp);

    // throw button
    const onThrowDown = (e: PointerEvent) => {
      this.throwHeld = true;
      throwBtn.classList.add("is-held");
      e.preventDefault();
    };
    const onThrowUp = () => {
      if (this.throwHeld) this.throwReleased = true;
      this.throwHeld = false;
      throwBtn.classList.remove("is-held");
    };
    throwBtn.addEventListener("pointerdown", onThrowDown);
    throwBtn.addEventListener("pointerup", onThrowUp);
    throwBtn.addEventListener("pointercancel", onThrowUp);
    throwBtn.addEventListener("pointerleave", onThrowUp);

    this.cleanups.push(() => {
      joy.remove();
      items.remove();
      throwBtn.remove();
    });
  }

  private updateJoy(clientX: number, clientY: number): void {
    const dx = clientX - this.joyCenter.x;
    const dy = clientY - this.joyCenter.y;
    const len = Math.hypot(dx, dy);
    const clamped = Math.min(len, this.joyRadius);
    const ux = len > 0 ? dx / len : 0;
    const uy = len > 0 ? dy / len : 0;
    this.joyVec = { x: (ux * clamped) / this.joyRadius, y: (uy * clamped) / this.joyRadius };
    this.knob.style.transform = `translate(${ux * clamped}px, ${uy * clamped}px)`;
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

  // ---------- desktop mouse aim on the canvas ----------

  private attachMouse(): void {
    const { canvas } = this.cfg;
    const toCss = (e: PointerEvent): Vec2 => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      this.mouseAimHeld = true;
      this.mouseCss = toCss(e);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      this.mouseCss = toCss(e);
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      if (this.mouseAimHeld) this.throwReleased = true;
      this.mouseAimHeld = false;
    };
    canvas.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    this.cleanups.push(() => {
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    });
  }
}

function norm(v: Vec2): Vec2 {
  const len = Math.hypot(v.x, v.y);
  return len > 1e-4 ? { x: v.x / len, y: v.y / len } : { x: 0, y: 0 };
}
