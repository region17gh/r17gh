import React from "react";

const ICON_BASE = "https://unpkg.com/lucide-static@0.544.0/icons/";

export interface IconProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Lucide icon name, kebab-case (e.g. "arrow-right"). */
  name: string;
  /** Rendered square size in px. */
  size?: number;
  /** "thin" softens the glyph for secondary contexts. */
  strokeWidth?: "thin" | "regular";
}

/**
 * Lucide (2px stroke, rounded caps) is the system icon set. Glyphs are pulled as
 * CSS masks so they inherit currentColor — no hand-drawn SVG, no icon font.
 */
export const Icon = React.forwardRef<HTMLSpanElement, IconProps>(function Icon(
  { name, size = 18, strokeWidth = "regular", style, ...rest },
  ref,
) {
  const url = `url("${ICON_BASE}${name}.svg")`;
  return (
    <span
      ref={ref}
      aria-hidden="true"
      data-icon={name}
      style={{
        display: "inline-block",
        flex: "0 0 auto",
        width: size,
        height: size,
        background: "currentColor",
        WebkitMaskImage: url,
        maskImage: url,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        opacity: strokeWidth === "thin" ? 0.75 : 1,
        ...style,
      }}
      {...rest}
    />
  );
});
