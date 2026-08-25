import React from "react";
import { Icon } from "./Icon";

export type ButtonVariant = "primary" | "gold" | "secondary" | "ghost" | "inverse" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const SIZES: Record<ButtonSize, { h: string; px: number; fs: string; gap: number }> = {
  sm: { h: "var(--control-sm)", px: 12, fs: "13px", gap: 6 },
  md: { h: "var(--control-md)", px: 18, fs: "14.5px", gap: 8 },
  lg: { h: "var(--control-lg)", px: 24, fs: "16px", gap: 9 },
};

const VARIANTS: Record<ButtonVariant, { rest: React.CSSProperties; hover: React.CSSProperties }> = {
  primary: {
    rest: { background: "var(--navy-700)", color: "var(--text-on-inverse)", border: "1px solid var(--navy-700)" },
    hover: { background: "var(--navy-600)", borderColor: "var(--navy-600)" },
  },
  gold: {
    rest: { background: "var(--gold-500)", color: "var(--navy-900)", border: "1px solid var(--gold-600)" },
    hover: { background: "var(--gold-400)", borderColor: "var(--gold-500)" },
  },
  secondary: {
    rest: { background: "var(--surface-card)", color: "var(--text-strong)", border: "1px solid var(--border-default)" },
    hover: { background: "var(--paper-100)", borderColor: "var(--navy-300)" },
  },
  ghost: {
    rest: { background: "transparent", color: "var(--text-strong)", border: "1px solid transparent" },
    hover: { background: "var(--paper-100)" },
  },
  inverse: {
    rest: { background: "rgba(255,255,255,0.08)", color: "var(--text-on-inverse)", border: "1px solid var(--border-inverse)" },
    hover: { background: "rgba(212,175,55,0.16)", borderColor: "var(--gold-500)" },
  },
  danger: {
    rest: { background: "var(--pan-red)", color: "var(--paper-000)", border: "1px solid var(--pan-red)" },
    hover: { background: "var(--navy-900)", borderColor: "var(--navy-900)" },
  },
};

export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  /** primary = navy default action · gold = the one CTA on a page · secondary/ghost = supporting · inverse = on navy · danger = destructive. */
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Lucide name, leading. */
  icon?: string;
  /** Lucide name, trailing. Use "arrow-right" for forward motion. */
  iconAfter?: string;
  fullWidth?: boolean;
  /** Renders an anchor instead of a button. */
  href?: string;
  type?: "button" | "submit" | "reset";
}

/** The system's action control. One gold button per view, never two. */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    children,
    variant = "primary",
    size = "md",
    icon,
    iconAfter,
    fullWidth = false,
    disabled = false,
    href,
    type = "button",
    style,
    ...rest
  },
  ref,
) {
  const s = SIZES[size];
  const v = VARIANTS[variant];
  const [hover, setHover] = React.useState(false);
  const glyph = size === "lg" ? 18 : 16;

  const styles: React.CSSProperties = {
    display: fullWidth ? "flex" : "inline-flex",
    width: fullWidth ? "100%" : undefined,
    alignItems: "center",
    justifyContent: "center",
    gap: s.gap,
    height: s.h,
    padding: `0 ${s.px}px`,
    font: "var(--type-ui)",
    fontSize: s.fs,
    fontWeight: 600,
    letterSpacing: "0.005em",
    borderRadius: "var(--radius-md)",
    cursor: disabled ? "not-allowed" : "pointer",
    textDecoration: "none",
    whiteSpace: "nowrap",
    transition: "var(--transition-control)",
    opacity: disabled ? 0.45 : 1,
    ...v.rest,
    ...(hover && !disabled ? v.hover : null),
    ...style,
  };

  const content = (
    <>
      {icon ? <Icon name={icon} size={glyph} /> : null}
      {children}
      {iconAfter ? <Icon name={iconAfter} size={glyph} /> : null}
    </>
  );

  if (href) {
    const { ...anchorRest } = rest as React.AnchorHTMLAttributes<HTMLAnchorElement>;
    return (
      <a
        href={href}
        aria-disabled={disabled || undefined}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={styles}
        {...anchorRest}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={styles}
      {...rest}
    >
      {content}
    </button>
  );
});
