import { useEffect, useState } from "react";

const REDUCED = "(prefers-reduced-motion: reduce)";

/**
 * Whether this reader has asked for less motion.
 *
 * Starts true so that a server render, and the first client paint after it,
 * carry the still version. A scroll-scrubbed page that starts in motion and
 * then stops has already broken the promise.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(true);

  useEffect(() => {
    const query = window.matchMedia(REDUCED);
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return reduced;
}

/** True below the mobile breakpoint. Drives lift and parallax amplitude. */
export function isMobileViewport(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 760px)").matches;
}

export function clamp(value: number, low: number, high: number): number {
  return value < low ? low : value > high ? high : value;
}

/**
 * How far a tall scroll track has been travelled, 0 to 1.
 *
 * The track is taller than the viewport by design: the pacing law is that a
 * transition owns enough scroll distance that a normal flick cannot skip it,
 * so every scrubbed element gets a track length rather than a duration.
 */
export function trackProgress(element: HTMLElement): number {
  const box = element.getBoundingClientRect();
  const span = element.offsetHeight - window.innerHeight;
  if (span <= 0) return 0;
  return clamp(-box.top / span, 0, 1);
}

export interface Palette {
  /** A token colour at an alpha, as a string canvas accepts everywhere. */
  (token: string, alpha?: number): string;
  /** A token font family, resolved to concrete names for canvas. */
  family(token: string): string;
  /** Removes the probe element. Call on teardown. */
  dispose(): void;
}

/**
 * Resolve design tokens to concrete colours for canvas.
 *
 * Canvas cannot reference a custom property, and this page may not carry a
 * hardcoded hex, so each token is resolved through a hidden probe: the computed
 * `color` of an element is always serialised as rgb(), whatever the token held.
 * Results are cached, so a token file replaced in place lands on next reload.
 */
export function palette(host: HTMLElement): Palette {
  const probe = document.createElement("span");
  probe.setAttribute("aria-hidden", "true");
  probe.style.display = "none";
  host.appendChild(probe);

  const cache = new Map<string, [number, number, number]>();

  const channels = (token: string): [number, number, number] => {
    const hit = cache.get(token);
    if (hit) return hit;
    probe.style.color = `var(${token})`;
    const parts = getComputedStyle(probe).color.match(/[\d.]+/g);
    const triple: [number, number, number] = parts
      ? [Number(parts[0]), Number(parts[1]), Number(parts[2])]
      : [0, 0, 0];
    cache.set(token, triple);
    return triple;
  };

  const read = ((token: string, alpha = 1) => {
    const [r, g, b] = channels(token);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }) as Palette;

  read.family = (token: string) => {
    probe.style.fontFamily = `var(${token})`;
    return getComputedStyle(probe).fontFamily;
  };

  read.dispose = () => probe.remove();
  return read;
}
