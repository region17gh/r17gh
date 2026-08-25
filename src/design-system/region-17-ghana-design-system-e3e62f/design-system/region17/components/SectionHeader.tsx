import React from "react";

export interface SectionHeaderProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  /** Uppercase kicker — the only uppercase tier in the system. */
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  /** Supporting sentence, capped at the prose measure. */
  lede?: React.ReactNode;
  align?: "left" | "center";
  /** Set on navy surfaces. */
  inverse?: boolean;
  /** Trailing control, aligned to the title baseline. */
  action?: React.ReactNode;
}

/** Standard section opening: eyebrow, serif title, lede. */
export const SectionHeader = React.forwardRef<HTMLElement, SectionHeaderProps>(function SectionHeader(
  { eyebrow, title, lede, align = "left", inverse = false, action, style, ...rest },
  ref,
) {
  return (
    <header
      ref={ref}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
        alignItems: align === "center" ? "center" : "flex-start",
        textAlign: align === "center" ? "center" : "left",
        ...style,
      }}
      {...rest}
    >
      {eyebrow ? (
        <span
          style={{
            font: "var(--type-eyebrow)",
            letterSpacing: "var(--tracking-eyebrow)",
            textTransform: "uppercase",
            color: inverse ? "var(--gold-400)" : "var(--gold-700)",
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--space-2)",
          }}
        >
          <span aria-hidden="true" style={{ width: 18, height: 1, background: "currentColor", opacity: 0.6 }} />
          {eyebrow}
        </span>
      ) : null}
      <div
        style={{
          display: "flex",
          width: "100%",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: "var(--space-8)",
        }}
      >
        <h2
          style={{
            font: "var(--type-section)",
            color: inverse ? "var(--text-on-inverse)" : "var(--text-strong)",
            maxWidth: "22ch",
          }}
        >
          {title}
        </h2>
        {action}
      </div>
      {lede ? (
        <p
          style={{
            font: "var(--type-body-lg)",
            maxWidth: "var(--measure-prose)",
            color: inverse ? "var(--text-on-inverse-muted)" : "var(--text-body)",
          }}
        >
          {lede}
        </p>
      ) : null}
    </header>
  );
});
