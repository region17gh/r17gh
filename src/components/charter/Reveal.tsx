import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

/**
 * The reveal group.
 *
 * One observer per group rather than one per element: children opt into an
 * effect with a class (`charter-line`, `charter-fade`, `charter-wipe`) and into
 * their place in the stagger with `--charter-i`. The group unobserves once it
 * has fired, so a reader scrolling back up is not shown the page again.
 *
 * Under prefers-reduced-motion the stylesheet has already shown everything, so
 * nothing here needs a branch: the class lands and changes nothing.
 */
export function Reveal({
  as: Tag = "div",
  className,
  id,
  children,
}: {
  as?: "div" | "section";
  className?: string;
  id?: string;
  children: ReactNode;
}) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = host.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-in");
          observer.unobserve(entry.target);
        }
      },
      // threshold MUST stay 0. A fraction-of-the-target threshold is unmeetable
      // once the group is taller than the viewport by more than that fraction:
      // on a 390px-wide phone the region index is nearly 4000px tall, so a
      // threshold of 0.25 asked for 989px of a group inside an 844px window and
      // the whole section stayed at opacity 0, permanently. The negative bottom
      // margin is what holds the reveal until the group is properly on screen.
      { threshold: 0, rootMargin: "0px 0px -8% 0px" },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag ref={host} data-charter-reveal="" className={className} id={id}>
      {children}
    </Tag>
  );
}

/** One line of a headline, masked and lifted into place behind the one before. */
export function Line({ index, children }: { index: number; children: ReactNode }) {
  return (
    <span className="charter-line">
      <span style={{ "--charter-i": index } as CSSProperties}>{children}</span>
    </span>
  );
}
