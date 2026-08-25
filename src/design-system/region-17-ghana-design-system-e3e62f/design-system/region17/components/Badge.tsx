import React from "react";
import { Icon } from "./Icon";

export type BadgeTone = "neutral" | "navy" | "gold" | "verified" | "estimate" | "projected" | "alert" | "inverse";

const TONES: Record<BadgeTone, { bg: string; fg: string; bd: string }> = {
  neutral: { bg: "var(--paper-100)", fg: "var(--text-muted)", bd: "var(--border-hairline)" },
  navy: { bg: "var(--navy-100)", fg: "var(--navy-700)", bd: "var(--navy-200)" },
  gold: { bg: "var(--gold-100)", fg: "var(--gold-700)", bd: "var(--gold-300)" },
  verified: { bg: "var(--status-verified-tint)", fg: "var(--status-verified)", bd: "color-mix(in oklab, var(--status-verified) 24%, transparent)" },
  estimate: { bg: "var(--status-estimate-tint)", fg: "var(--status-estimate)", bd: "var(--gold-300)" },
  projected: { bg: "var(--status-projected-tint)", fg: "var(--status-projected)", bd: "var(--navy-200)" },
  alert: { bg: "var(--status-alert-tint)", fg: "var(--status-alert)", bd: "color-mix(in oklab, var(--status-alert) 24%, transparent)" },
  inverse: { bg: "rgba(212,175,55,0.14)", fg: "var(--gold-400)", bd: "var(--border-inverse)" },
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  /** Lucide name, leading. */
  icon?: string;
}

/** Small uppercase status mark. Never the only carrier of meaning — always labelled. */
export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { children, tone = "neutral", icon, style, ...rest },
  ref,
) {
  const t = TONES[tone];
  return (
    <span
      ref={ref}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "2px var(--space-2)",
        borderRadius: "var(--radius-xs)",
        background: t.bg,
        color: t.fg,
        border: `1px solid ${t.bd}`,
        font: "var(--type-eyebrow)",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        ...style,
      }}
      {...rest}
    >
      {icon ? <Icon name={icon} size={11} /> : null}
      {children}
    </span>
  );
});

export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Any CSS colour, usually a region token via regionColor(). */
  color?: string;
  icon?: string;
  /** Renders a remove control when provided. */
  onRemove?: () => void;
  /** Accessible name for the remove control. */
  removeLabel?: string;
}

/** Pill-shaped, removable label for chips and multi-select values. */
export const Tag = React.forwardRef<HTMLSpanElement, TagProps>(function Tag(
  { children, color = "var(--navy-600)", icon, onRemove, removeLabel = "Remove", style, ...rest },
  ref,
) {
  return (
    <span
      ref={ref}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-2)",
        padding: "4px 10px",
        borderRadius: "var(--radius-pill)",
        background: `color-mix(in oklab, ${color} 10%, var(--paper-000))`,
        color,
        border: `1px solid color-mix(in oklab, ${color} 26%, transparent)`,
        font: "var(--type-meta)",
        fontWeight: 500,
        ...style,
      }}
      {...rest}
    >
      {icon ? <Icon name={icon} size={12} /> : null}
      {children}
      {onRemove ? (
        <button
          type="button"
          aria-label={removeLabel}
          onClick={onRemove}
          style={{
            display: "inline-flex",
            alignItems: "center",
            border: "none",
            background: "transparent",
            padding: 0,
            color: "inherit",
            cursor: "pointer",
            opacity: 0.6,
          }}
        >
          <Icon name="x" size={12} />
        </button>
      ) : null}
    </span>
  );
});
