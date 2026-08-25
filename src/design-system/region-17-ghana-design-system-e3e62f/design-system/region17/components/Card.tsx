import React from "react";

export type CardElevation = 0 | 1 | 2 | 3;

const SHADOWS: Record<CardElevation, string> = {
  0: "var(--shadow-none)",
  1: "var(--shadow-1)",
  2: "var(--shadow-2)",
  3: "var(--shadow-3)",
};

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevation?: CardElevation;
  /** Accent colour drawn as a 2px top rule — usually a region colour. */
  accent?: string;
  /** Lifts on hover. Pair with a real control inside for keyboard access. */
  interactive?: boolean;
  /** Inner padding; defaults to --space-6. */
  padding?: string;
}

/** Lines before shadows: a card is white with a hairline and no shadow at rest. */
export const Card = React.forwardRef<HTMLDivElement, CardProps>(function Card(
  { children, elevation = 1, accent, interactive = false, padding = "var(--space-6)", style, ...rest },
  ref,
) {
  const [hover, setHover] = React.useState(false);
  return (
    <div
      ref={ref}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative",
        background: "var(--surface-card)",
        border: "1px solid var(--border-hairline)",
        borderTop: accent ? `2px solid ${accent}` : "1px solid var(--border-hairline)",
        borderRadius: "var(--radius-card)",
        padding,
        boxShadow: interactive && hover ? "var(--shadow-3)" : SHADOWS[elevation],
        borderColor: interactive && hover ? "var(--border-default)" : undefined,
        transition: "var(--transition-surface)",
        cursor: interactive ? "pointer" : undefined,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
});
