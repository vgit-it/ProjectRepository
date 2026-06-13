/**
 * Motion guards and shared helpers.
 *
 * Brief §8: motion is a signature (ink that draws itself in) but restraint rules,
 * and prefers-reduced-motion must ALWAYS be honored — show the final state, no
 * animation. Every animated effect should branch on `prefersReducedMotion()`.
 */

/** True when the user has asked the OS to minimize motion. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Subscribe to changes in the reduced-motion preference.
 * Returns an unsubscribe function.
 */
export function onReducedMotionChange(cb: (reduced: boolean) => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  const handler = (e: MediaQueryListEvent) => cb(e.matches);
  mq.addEventListener("change", handler);
  return () => mq.removeEventListener("change", handler);
}

/** requestAnimationFrame wrapped as a promise (one frame). */
export function nextFrame(): Promise<number> {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

/** Promise-based delay that resolves to ~0ms under reduced motion. */
export function wait(ms: number): Promise<void> {
  const d = prefersReducedMotion() ? 0 : ms;
  return new Promise((resolve) => setTimeout(resolve, d));
}
