import React from "react";
import { Icon } from "./Icon";
import { ConfidenceFlag, type ConfidenceLevel } from "./ConfidenceFlag";

export interface StatisticProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The figure itself, already formatted: "$7.8", "310", "16". */
  value: React.ReactNode;
  /** Short unit suffix: "B", "%", "districts". */
  unit?: string;
  label: React.ReactNode;
  /** Year of the cited figure. */
  year?: string | number;
  /** Full source string, surfaced on hover and to screen readers. */
  source?: string;
  confidence?: ConfidenceLevel;
  /** Overrides the figure colour, usually a region colour. */
  accent?: string;
  align?: "left" | "center";
  size?: "sm" | "md" | "lg";
}

/** One sourced figure. Year and confidence flag are always visible — a citation is never hidden. */
export const Statistic = React.forwardRef<HTMLDivElement, StatisticProps>(function Statistic(
  { value, unit, label, year, source, confidence = "verified", accent, align = "left", size = "md", style, ...rest },
  ref,
) {
  const figureSize = size === "lg" ? "44px" : size === "sm" ? "24px" : "34px";
  return (
    <div
      ref={ref}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
        alignItems: align === "center" ? "center" : "flex-start",
        textAlign: align === "center" ? "center" : "left",
        ...style,
      }}
      {...rest}
    >
      <span
        style={{
          font: "var(--type-figure)",
          fontSize: figureSize,
          color: accent || "var(--text-strong)",
          fontVariantNumeric: "tabular-nums",
          display: "inline-flex",
          alignItems: "baseline",
          gap: 3,
        }}
      >
        {value}
        {unit ? (
          <span style={{ fontSize: "0.5em", fontWeight: 500, color: "var(--text-muted)", letterSpacing: "0.02em" }}>
            {unit}
          </span>
        ) : null}
      </span>
      <span style={{ font: "var(--type-meta)", color: "var(--text-body)", maxWidth: "26ch" }}>{label}</span>
      <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
        {year ? <span className="r17-cite">{year}</span> : null}
        <ConfidenceFlag level={confidence} compact />
        {source ? (
          <span
            title={source}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
              color: "var(--text-faint)",
              cursor: "help",
              font: "var(--type-cite)",
            }}
          >
            <Icon name="book-open-text" size={11} />
            <span className="r17-sr-only">Source: </span>
            {source}
          </span>
        ) : null}
      </span>
    </div>
  );
});

export interface StatisticBandProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

/** Hairline-separated row of 3–5 statistics. Reads as a fact sheet, not a dashboard. */
export const StatisticBand = React.forwardRef<HTMLDivElement, StatisticBandProps>(function StatisticBand(
  { children, style, ...rest },
  ref,
) {
  const items = React.Children.toArray(children);
  return (
    <div
      ref={ref}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fit, minmax(180px, 1fr))`,
        gap: "var(--space-8)",
        ...style,
      }}
      {...rest}
    >
      {items.map((child, i) => (
        <div
          key={i}
          style={{
            paddingLeft: i === 0 ? 0 : "var(--space-8)",
            borderLeft: i === 0 ? "none" : "1px solid var(--border-hairline)",
          }}
        >
          {child}
        </div>
      ))}
    </div>
  );
});
