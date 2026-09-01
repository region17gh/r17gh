import type { CSSProperties } from "react";

/**
 * A named, empty place for a photograph.
 *
 * The design export used the canvas tool's `<image-slot>`, which has no
 * equivalent here, and there is nothing to put in these slots yet:
 * `media_assets` holds no cleared media, the launch photography is unlicensed,
 * and "cleared media exists" is an open pre-launch gate. A page that cites its
 * facts and borrows its photographs is not credible, so this renders the brief
 * for the photograph rather than a stock stand-in.
 *
 * When cleared media lands, this component takes an asset and the brief becomes
 * the alt text's starting point. Nothing else on the page changes.
 */
export function PhotoSlot({
  brief,
  style,
  tone = "dark",
}: {
  /** What photograph belongs here. Shown, so it is a brief and not a TODO. */
  brief: string;
  style?: CSSProperties;
  tone?: "dark" | "light";
}) {
  const dark = tone === "dark";
  return (
    <div
      role="img"
      aria-label={brief}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-5)",
        textAlign: "center",
        background: dark ? "var(--navy-900)" : "var(--surface-sunken)",
        border: `1px dashed ${dark ? "rgba(255,255,255,0.22)" : "var(--border-default)"}`,
        color: dark ? "var(--navy-200)" : "var(--text-cite)",
        ...style,
      }}
    >
      <span className="r17-cite" style={{ color: "inherit", maxWidth: "34ch" }}>
        {brief}
      </span>
    </div>
  );
}
