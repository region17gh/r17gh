import React from "react";
import { Icon } from "./Icon";

export type ConfidenceLevel = "verified" | "estimate" | "projected" | "disputed";

const FLAGS: Record<ConfidenceLevel, { label: string; tone: string; tint: string; icon: string }> = {
  verified: { label: "Verified", tone: "var(--status-verified)", tint: "var(--status-verified-tint)", icon: "shield-check" },
  estimate: { label: "Estimate", tone: "var(--status-estimate)", tint: "var(--status-estimate-tint)", icon: "circle-dashed" },
  projected: { label: "Projected", tone: "var(--status-projected)", tint: "var(--status-projected-tint)", icon: "trending-up" },
  disputed: { label: "Disputed", tone: "var(--status-alert)", tint: "var(--status-alert-tint)", icon: "circle-alert" },
};

export interface ConfidenceFlagProps extends React.HTMLAttributes<HTMLSpanElement> {
  level?: ConfidenceLevel;
  /** Tighter padding, for inline use beside a figure. */
  compact?: boolean;
}

/** Every published number carries one. If we can't flag it, we don't publish it. */
export const ConfidenceFlag = React.forwardRef<HTMLSpanElement, ConfidenceFlagProps>(function ConfidenceFlag(
  { level = "verified", compact = false, style, ...rest },
  ref,
) {
  const f = FLAGS[level];
  return (
    <span
      ref={ref}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: compact ? "1px 5px" : "2px 7px",
        background: f.tint,
        color: f.tone,
        border: `1px solid color-mix(in oklab, ${f.tone} 22%, transparent)`,
        borderRadius: "var(--radius-xs)",
        font: "var(--type-cite)",
        fontFamily: "var(--font-sans)",
        fontWeight: 600,
        fontSize: compact ? "10.5px" : "11px",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        ...style,
      }}
      {...rest}
    >
      <Icon name={f.icon} size={compact ? 10 : 11} />
      {f.label}
    </span>
  );
});
