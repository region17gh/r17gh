import React from "react";
import { REGIONS, regionColor } from "../data/regions";
import { Icon } from "./Icon";

export interface RegionTagProps extends React.HTMLAttributes<HTMLElement> {
  /** Region slug, e.g. "volta". */
  slug: string;
  /** Overrides the canonical region name. */
  name?: string;
  size?: "sm" | "md";
  showDot?: boolean;
  /** Renders the tag as a link to the region page. */
  href?: string;
}

/** Region identity in one mark. Colour never travels without the region's name. */
export function RegionTag({ slug, name, size = "md", showDot = true, href, style, ...rest }: RegionTagProps) {
  const region = REGIONS.find((r) => r.slug === slug);
  const label = name || region?.name || slug;
  const color = regionColor(slug);
  const [hover, setHover] = React.useState(false);

  const shared: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "var(--space-2)",
    textDecoration: "none",
    padding: size === "sm" ? "2px var(--space-2)" : "4px 10px",
    borderRadius: "var(--radius-xs)",
    background: hover && href
      ? `color-mix(in oklab, ${color} 16%, var(--paper-000))`
      : `color-mix(in oklab, ${color} 8%, var(--paper-000))`,
    border: `1px solid color-mix(in oklab, ${color} 24%, transparent)`,
    color,
    font: "var(--type-meta)",
    fontWeight: 600,
    fontSize: size === "sm" ? "11.5px" : "13px",
    transition: "var(--transition-control)",
    ...style,
  };

  const content = (
    <>
      {showDot ? (
        <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: "var(--radius-pill)", background: color }} />
      ) : null}
      {label}
      {href ? <Icon name="arrow-right" size={11} style={{ opacity: hover ? 1 : 0.45 }} /> : null}
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={shared}
        {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
      >
        {content}
      </a>
    );
  }

  return (
    <span style={shared} {...(rest as React.HTMLAttributes<HTMLSpanElement>)}>
      {content}
    </span>
  );
}
