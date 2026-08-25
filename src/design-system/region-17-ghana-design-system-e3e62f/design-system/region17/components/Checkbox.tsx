import React from "react";
import { Icon } from "./Icon";

const visuallyHidden: React.CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  opacity: 0,
  margin: 0,
  pointerEvents: "none",
};

const rowStyle = (description?: React.ReactNode, disabled?: boolean): React.CSSProperties => ({
  display: "flex",
  gap: "var(--space-3)",
  alignItems: description ? "flex-start" : "center",
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.5 : 1,
});

export interface ChoiceProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  label: React.ReactNode;
  description?: React.ReactNode;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
}

function Labels({ label, description }: { label: React.ReactNode; description?: React.ReactNode }) {
  return (
    <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ font: "var(--type-ui)", fontWeight: 500, color: "var(--text-strong)" }}>{label}</span>
      {description ? (
        <span style={{ font: "var(--type-cite)", fontFamily: "var(--font-sans)", color: "var(--text-muted)" }}>
          {description}
        </span>
      ) : null}
    </span>
  );
}

/** Square multi-select control. */
export const Checkbox = React.forwardRef<HTMLInputElement, ChoiceProps>(function Checkbox(
  { label, description, checked = false, onChange, disabled = false, style, ...rest },
  ref,
) {
  return (
    <label style={{ ...rowStyle(description, disabled), ...style }}>
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        style={visuallyHidden}
        {...rest}
      />
      <span
        aria-hidden="true"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 18,
          height: 18,
          flex: "0 0 auto",
          marginTop: description ? 2 : 0,
          borderRadius: "var(--radius-xs)",
          border: `1px solid ${checked ? "var(--navy-700)" : "var(--border-default)"}`,
          background: checked ? "var(--navy-700)" : "var(--surface-card)",
          color: "var(--gold-400)",
          transition: "var(--transition-control)",
        }}
      >
        {checked ? <Icon name="check" size={13} /> : null}
      </span>
      <Labels label={label} description={description} />
    </label>
  );
});

/** Round single-select control. Always used in a named group. */
export const Radio = React.forwardRef<HTMLInputElement, ChoiceProps>(function Radio(
  { label, description, checked = false, onChange, disabled = false, style, ...rest },
  ref,
) {
  return (
    <label style={{ ...rowStyle(description, disabled), ...style }}>
      <input
        ref={ref}
        type="radio"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        style={visuallyHidden}
        {...rest}
      />
      <span
        aria-hidden="true"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 18,
          height: 18,
          flex: "0 0 auto",
          marginTop: description ? 2 : 0,
          borderRadius: "var(--radius-pill)",
          border: `1px solid ${checked ? "var(--navy-700)" : "var(--border-default)"}`,
          background: "var(--surface-card)",
          transition: "var(--transition-control)",
        }}
      >
        {checked ? (
          <span style={{ width: 8, height: 8, borderRadius: "var(--radius-pill)", background: "var(--navy-700)" }} />
        ) : null}
      </span>
      <Labels label={label} description={description} />
    </label>
  );
});

export interface SwitchProps extends Omit<ChoiceProps, "description" | "label"> {
  label?: React.ReactNode;
}

/** Immediate on/off setting. Use for state that applies without a save action. */
export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { label, checked = false, onChange, disabled = false, style, ...rest },
  ref,
) {
  return (
    <label
      style={{
        display: "inline-flex",
        gap: "var(--space-3)",
        alignItems: "center",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      <input
        ref={ref}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        style={visuallyHidden}
        {...rest}
      />
      <span
        aria-hidden="true"
        style={{
          width: 38,
          height: 22,
          flex: "0 0 auto",
          padding: 2,
          borderRadius: "var(--radius-pill)",
          background: checked ? "var(--navy-700)" : "var(--paper-300)",
          transition: "background-color var(--dur-base) var(--ease-standard)",
          display: "flex",
          justifyContent: checked ? "flex-end" : "flex-start",
          alignItems: "center",
        }}
      >
        <span
          style={{
            width: 18,
            height: 18,
            borderRadius: "var(--radius-pill)",
            background: checked ? "var(--gold-500)" : "var(--paper-000)",
            boxShadow: "var(--shadow-1)",
            transition: "var(--transition-control)",
          }}
        />
      </span>
      {label ? <span style={{ font: "var(--type-ui)", color: "var(--text-strong)" }}>{label}</span> : null}
    </label>
  );
});
