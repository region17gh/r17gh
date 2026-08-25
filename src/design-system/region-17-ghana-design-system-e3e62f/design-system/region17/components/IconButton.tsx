import React from "react";
import { Icon } from "./Icon";

export type IconButtonVariant = "primary" | "secondary" | "ghost" | "inverse";
export type IconButtonSize = "sm" | "md" | "lg";

const SKINS: Record<IconButtonVariant, { rest: React.CSSProperties; hover: React.CSSProperties }> = {
  secondary: {
    rest: { background: "var(--surface-card)", border: "1px solid var(--border-default)", color: "var(--text-strong)" },
    hover: { background: "var(--paper-100)", borderColor: "var(--navy-300)" },
  },
  ghost: {
    rest: { background: "transparent", border: "1px solid transparent", color: "var(--text-muted)" },
    hover: { background: "var(--paper-100)", color: "var(--text-strong)" },
  },
  inverse: {
    rest: { background: "rgba(255,255,255,0.06)", border: "1px solid var(--border-inverse)", color: "var(--text-on-inverse)" },
    hover: { background: "rgba(212,175,55,0.16)" },
  },
  primary: {
    rest: { background: "var(--navy-700)", border: "1px solid var(--navy-700)", color: "var(--text-on-inverse)" },
    hover: { background: "var(--navy-600)" },
  },
};

export interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  /** Lucide icon name. */
  icon: string;
  /** Accessible name — required, since the control has no visible text. */
  label: string;
  size?: IconButtonSize;
  variant?: IconButtonVariant;
  type?: "button" | "submit" | "reset";
}

/** Square icon-only control. Always labelled. */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, size = "md", variant = "secondary", disabled = false, type = "button", style, ...rest },
  ref,
) {
  const dim = size === "sm" ? 32 : size === "lg" ? 48 : 40;
  const [hover, setHover] = React.useState(false);
  const v = SKINS[variant];
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: dim,
        height: dim,
        borderRadius: "var(--radius-md)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        transition: "var(--transition-control)",
        ...v.rest,
        ...(hover && !disabled ? v.hover : null),
        ...style,
      }}
      {...rest}
    >
      <Icon name={icon} size={size === "sm" ? 15 : size === "lg" ? 22 : 18} />
    </button>
  );
});
