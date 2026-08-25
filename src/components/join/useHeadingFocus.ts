import { useEffect, useRef } from "react";

/**
 * Moves focus to the step heading whenever the step changes.
 *
 * Without this a screen reader stays where the pressed button was and never
 * hears that the screen changed. The heading carries tabIndex={-1} so it can
 * take focus without joining the tab order.
 *
 * The first render is deliberately skipped: on initial load the reader should
 * start at the page heading and the progress indicator, not part-way down.
 */
export function useHeadingFocus<T extends HTMLElement>(key: unknown) {
  const ref = useRef<T | null>(null);
  const settled = useRef(false);

  useEffect(() => {
    if (!settled.current) {
      settled.current = true;
      return;
    }
    const node = ref.current;
    if (!node) return;
    node.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [key]);

  return ref;
}
