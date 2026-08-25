import React from "react";
import { Icon } from "./Icon";

const fieldShell: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-2)",
  height: "var(--control-md)",
  padding: "0 var(--space-3)",
  background: "var(--surface-card)",
  border: "1px solid var(--border-default)",
  borderRadius: "var(--radius-md)",
  transition: "var(--transition-control)",
};

const focusRing = "0 0 0 3px rgba(212,175,55,0.22)";

export interface FieldProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  label?: React.ReactNode;
  /** Quiet helper text, citation tier. */
  hint?: React.ReactNode;
  /** Replaces the hint and marks the field invalid. */
  error?: React.ReactNode;
  required?: boolean;
}

/** Label + control + hint/error wrapper. Wraps its control so the label is always wired. */
export function Field({ label, hint, error, required, children, style, ...rest }: FieldProps) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", ...style }} {...rest}>
      {label ? (
        <span style={{ font: "var(--type-meta)", color: "var(--text-strong)", display: "flex", gap: 4 }}>
          {label}
          {required ? (
            <span style={{ color: "var(--pan-red)" }} aria-hidden="true">
              *
            </span>
          ) : null}
        </span>
      ) : null}
      {children}
      {error ? (
        <span role="alert" style={{ font: "var(--type-meta)", fontWeight: 400, color: "var(--pan-red)" }}>
          {error}
        </span>
      ) : hint ? (
        <span style={{ font: "var(--type-cite)", color: "var(--text-cite)" }}>{hint}</span>
      ) : null}
    </label>
  );
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Lucide name rendered inside the field, leading. */
  icon?: string;
  invalid?: boolean;
}

/** Single-line text control. */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { icon, invalid = false, disabled = false, style, onFocus, onBlur, ...rest },
  ref,
) {
  const [focus, setFocus] = React.useState(false);
  return (
    <span
      style={{
        ...fieldShell,
        borderColor: invalid ? "var(--pan-red)" : focus ? "var(--navy-500)" : "var(--border-default)",
        boxShadow: focus ? focusRing : "none",
        background: disabled ? "var(--paper-100)" : "var(--surface-card)",
        ...style,
      }}
    >
      {icon ? <Icon name={icon} size={16} style={{ color: "var(--text-faint)" }} /> : null}
      <input
        ref={ref}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        onFocus={(e) => {
          setFocus(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocus(false);
          onBlur?.(e);
        }}
        style={{
          flex: 1,
          minWidth: 0,
          border: "none",
          outline: "none",
          background: "transparent",
          font: "var(--type-body)",
          fontSize: "var(--text-body-sm)",
          color: "var(--text-body)",
        }}
        {...rest}
      />
    </span>
  );
});

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

/** Multi-line text control. */
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { rows = 4, invalid = false, style, onFocus, onBlur, ...rest },
  ref,
) {
  const [focus, setFocus] = React.useState(false);
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      onFocus={(e) => {
        setFocus(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocus(false);
        onBlur?.(e);
      }}
      style={{
        padding: "10px var(--space-3)",
        resize: "vertical",
        background: "var(--surface-card)",
        color: "var(--text-body)",
        border: `1px solid ${invalid ? "var(--pan-red)" : focus ? "var(--navy-500)" : "var(--border-default)"}`,
        borderRadius: "var(--radius-md)",
        outline: "none",
        font: "var(--type-body)",
        fontSize: "var(--text-body-sm)",
        boxShadow: focus ? focusRing : "none",
        transition: "var(--transition-control)",
        ...style,
      }}
      {...rest}
    />
  );
});

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options?: Array<SelectOption | string>;
  invalid?: boolean;
}

/** Native select in system chrome. */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { options = [], invalid = false, style, onFocus, onBlur, children, ...rest },
  ref,
) {
  const [focus, setFocus] = React.useState(false);
  return (
    <span
      style={{
        ...fieldShell,
        position: "relative",
        paddingRight: "var(--space-2)",
        borderColor: invalid ? "var(--pan-red)" : focus ? "var(--navy-500)" : "var(--border-default)",
        boxShadow: focus ? focusRing : "none",
        ...style,
      }}
    >
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        onFocus={(e) => {
          setFocus(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocus(false);
          onBlur?.(e);
        }}
        style={{
          flex: 1,
          appearance: "none",
          border: "none",
          outline: "none",
          background: "transparent",
          font: "var(--type-body)",
          fontSize: "var(--text-body-sm)",
          color: "var(--text-body)",
          cursor: "pointer",
        }}
        {...rest}
      >
        {children ??
          options.map((o) => {
            const value = typeof o === "string" ? o : o.value;
            const label = typeof o === "string" ? o : o.label;
            return (
              <option key={value} value={value}>
                {label}
              </option>
            );
          })}
      </select>
      <Icon name="chevron-down" size={16} style={{ color: "var(--text-faint)" }} />
    </span>
  );
});
